/**
 * vis-3x — Vue 3 图表容器组件（基座）
 *
 * 这是所有语义化图表组件（VisBar3D / VisLine3D ...）的公共实现：
 * 1. 管理图表实例的创建、更新、销毁生命周期
 * 2. 监听 option 变化并触发重渲染（带深度比较，避免无谓渲染）
 * 3. 渲染提示框 / 图例 / 标题 / 加载遮罩等 HTML 覆盖层
 * 4. 通过 defineExpose 暴露命令式 API
 *
 * 该组件既可直接使用（传入 type），也可被具体图表组件复用。
 *
 * 说明：使用渲染函数而非 SFC 模板实现，因此本文件同时适用于
 * JS 项目（编译产物）与 TS 项目（类型声明），且无需 vue-loader 支持。
 */
import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type PropType,
  type CSSProperties,
} from 'vue'
import type { Vis3xOption, TooltipData, ChartEventMap, ChartEventType } from '../types/option'
import type { LegendStyle, TooltipStyle } from '../types/style'
import type { ChartBase, LegendItemData } from '../core/ChartBase'
import { createChart, inferChartType } from '../core/registry'
import type { ChartType } from '../types/option'
import { formatNumber } from '../core/LabelManager'
import { toCssColor } from '../utils/color'

/** 组件 props */
export interface BaseChartProps {
  /** 图表配置项 */
  option: Vis3xOption
  /** 图表类型；不传时按 option.type 或第一个系列推断 */
  type?: ChartType
  /** 宽度，默认 100% */
  width?: string | number
  /** 高度，默认 100% */
  height?: string | number
  /** 主题调色板（等价于 option.theme.palette，便于快速换色） */
  palette?: string[]
  /** 是否显示加载遮罩 */
  loading?: boolean
  /** 高亮光源索引（调试用） */
  hoveredLightIndex?: number
  /** 额外的容器样式 */
  containerStyle?: CSSProperties
}

export default defineComponent({
  name: 'VisChartBase',
  props: {
    option: {
      type: Object as PropType<Vis3xOption>,
      required: true,
    },
    type: {
      type: String as PropType<ChartType>,
      default: undefined,
    },
    width: {
      type: [String, Number] as PropType<string | number>,
      default: '100%',
    },
    height: {
      type: [String, Number] as PropType<string | number>,
      default: '100%',
    },
    palette: {
      type: Array as PropType<string[]>,
      default: undefined,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    hoveredLightIndex: {
      type: Number,
      default: undefined,
    },
    containerStyle: {
      type: Object as PropType<CSSProperties>,
      default: undefined,
    },
  },
  emits: {
    /* 数据交互事件 */
    click: (_payload: ChartEventMap['chart:click']) => true,
    dblclick: (_payload: ChartEventMap['chart:dblclick']) => true,
    mouseover: (_payload: ChartEventMap['chart:mouseover']) => true,
    mouseout: (_payload: ChartEventMap['chart:mouseout']) => true,
    mousemove: (_payload: ChartEventMap['chart:mousemove']) => true,
    mousedown: (_payload: ChartEventMap['chart:mousedown']) => true,
    mouseup: (_payload: ChartEventMap['chart:mouseup']) => true,
    /* 生命周期事件 */
    rendered: (_payload: ChartEventMap['chart:rendered']) => true,
    'legend-toggle': (_payload: ChartEventMap['legend:toggle']) => true,
    'camera-change': (_payload: ChartEventMap['camera:change']) => true,
    ready: (_chart: ChartBase) => true,
  },
  setup(props, { emit, expose, slots }) {
    /** 容器 DOM */
    const containerRef = ref<HTMLDivElement | null>(null)
    /** 图表实例（不需要深层响应式） */
    const chart = shallowRef<ChartBase | null>(null)
    /** 提示框状态 */
    const tooltip = ref<TooltipData | null>(null)
    /** 图例项 */
    const legendItems = ref<LegendItemData[]>([])
    /** 已隐藏的系列/数据项键 */
    const hiddenKeys = ref<Set<string>>(new Set())

    /* ------------------------------------------------------------------ */
    /*                              样式计算                               */
    /* ------------------------------------------------------------------ */

    const toCssSize = (value: string | number): string =>
      typeof value === 'number' ? `${value}px` : value

    const containerStyle = computed<CSSProperties>(() => ({
      width: toCssSize(props.width),
      height: toCssSize(props.height),
      ...props.containerStyle,
    }))

    const tooltipStyle = computed<CSSProperties>(() => {
      const t: TooltipStyle = props.option?.tooltip ?? {}
      const data = tooltip.value
      if (!data) return { display: 'none' }
      return {
        left: `${data.x}px`,
        top: `${data.y}px`,
        display: data.visible ? '' : 'none',
        backgroundColor: t.backgroundColor ? toCssColor(t.backgroundColor) : undefined,
        color: t.color ? toCssColor(t.color) : undefined,
        borderColor: t.borderColor ? toCssColor(t.borderColor) : undefined,
        borderWidth: t.borderWidth !== undefined ? `${t.borderWidth}px` : undefined,
        fontSize: t.fontSize !== undefined ? `${t.fontSize}px` : undefined,
        padding: t.padding !== undefined ? `${t.padding}px ${t.padding + 4}px` : undefined,
        borderRadius: t.borderRadius !== undefined ? `${t.borderRadius}px` : undefined,
      }
    })

    /** 图例容器的样式（对照 ECharts 的 legend 外观字段） */
    const legendStyle = computed<CSSProperties>(() => {
      const l: LegendStyle = props.option?.legend ?? {}
      const isVertical = l.position === 'left' || l.position === 'right'
      return {
        color: l.color ? toCssColor(l.color) : undefined,
        fontSize: l.fontSize !== undefined ? `${l.fontSize}px` : undefined,
        gap: l.itemGap !== undefined
          ? `${l.itemGap}px`
          : l.gap !== undefined
            ? `${l.gap}px`
            : undefined,
        backgroundColor: l.backgroundColor ? toCssColor(l.backgroundColor) : undefined,
        padding:
          l.padding !== undefined
            ? `${l.padding}px ${l.padding + 4}px`
            : undefined,
        borderRadius: l.borderRadius !== undefined ? `${l.borderRadius}px` : undefined,
        border: l.borderWidth
          ? `${l.borderWidth}px solid ${toCssColor(l.borderColor, 'transparent')}`
          : undefined,
        width: typeof l.width === 'number' ? `${l.width}px` : l.width,
        maxHeight:
          typeof l.maxHeight === 'number' ? `${l.maxHeight}px` : l.maxHeight,
        overflowY: l.scroll ? 'auto' : undefined,
        // 竖向排列时改为 column，避免左右两侧的图例挤成一行
        flexDirection: isVertical ? 'column' : undefined,
      }
    })

    /* ------------------------------------------------------------------ */
    /*                          图表实例生命周期                            */
    /* ------------------------------------------------------------------ */

    /** 解析实际使用的图表类型 */
    const resolveType = (): Exclude<ChartType, 'auto'> => {
      if (props.type && props.type !== 'auto') return props.type
      const configured = props.option?.type
      if (configured && configured !== 'auto') return configured
      const seriesTypes = (props.option?.series ?? []).map((s) => s.type)
      return inferChartType(seriesTypes)
    }

    /** 应用配置到图表实例 */
    const applyOption = (): void => {
      if (!chart.value || !props.option) return

      const option: Vis3xOption = { ...props.option }
      // palette 快捷属性优先
      if (props.palette?.length) {
        option.theme = { ...(option.theme ?? {}), palette: props.palette }
      }
      // 过滤掉被图例隐藏的系列/数据项
      if (hiddenKeys.value.size && option.series) {
        option.series = option.series.map((series, seriesIndex) => {
          // 饼图/漏斗：按数据项隐藏
          if (series.type === 'pie3D' || series.type === 'funnel3D') {
            const filtered = series.data.filter(
              (_, dataIndex) => !hiddenKeys.value.has(`${seriesIndex}-${dataIndex}`)
            )
            if (filtered.length === series.data.length) return series
            return { ...series, data: filtered } as typeof series
          }
          // 其他：按系列隐藏
          if (hiddenKeys.value.has(`${seriesIndex}-all`)) {
            return { ...series, visible: false } as typeof series
          }
          return series
        })
      }

      chart.value.setOption(option)
      appliedSignature = signatureOf(option, props.palette)
      legendItems.value = buildLegend(option)
    }

    /**
     * 构建图例数据
     *
     * 颜色解析与可见性判定统一由内核的 `buildLegendItems()` 负责，
     * 组件层只负责把结果渲染成 DOM。这样图例色和提示框色永远一致，
     * 不会出现「两处各写一份、改一处漏一处」的漂移。
     */
    const buildLegend = (option: Vis3xOption): LegendItemData[] => {
      const items = chart.value?.getLegendItems(option) ?? []
      // 组件侧的图例隐藏状态（点击图例切换）优先级最高
      return items.map((item) => {
        const key =
          item.dataIndex !== undefined
            ? `${item.seriesIndex}-${item.dataIndex}`
            : `${item.seriesIndex}-all`
        if (!hiddenKeys.value.size) return item
        return { ...item, visible: item.visible && !hiddenKeys.value.has(key) }
      })
    }
    /** 创建图表实例 */
    const createInstance = (): void => {
      if (!containerRef.value) return
      try {
        const type = resolveType()
        const instance = createChart(type, containerRef.value, {
          backgroundColor: props.option?.backgroundColor,
          controlSettings: props.option?.controlSettings,
          onDemandRendering: props.option?.onDemandRendering,
        })

        // 提示框回调
        instance.onTooltip((data) => {
          if (props.option?.tooltip?.show === false) return
          tooltip.value = data.visible ? data : null
        })

        // 图例回调
        instance.onLegend((items) => {
          legendItems.value = items
        })

        // 事件桥接：图表事件 -> Vue emit
        bindChartEvents(instance)

        chart.value = instance
        applyOption()
        emit('ready', instance)
      } catch (error) {
        console.error('[vis-3x] 图表初始化失败：', error)
      }
    }

    /** 把图表事件转发为 Vue 事件 */
    const bindChartEvents = (instance: ChartBase): void => {
      const eventNames: Array<[keyof ChartEventMap, string]> = [
        ['chart:click', 'click'],
        ['chart:dblclick', 'dblclick'],
        ['chart:mouseover', 'mouseover'],
        ['chart:mouseout', 'mouseout'],
        ['chart:mousemove', 'mousemove'],
        ['chart:mousedown', 'mousedown'],
        ['chart:mouseup', 'mouseup'],
        ['chart:rendered', 'rendered'],
        ['legend:toggle', 'legend-toggle'],
        ['camera:change', 'camera-change'],
      ]
      for (const [eventName, emitName] of eventNames) {
        instance.on(eventName as ChartEventType, (payload: unknown) => {
          emit(emitName as 'click', payload as ChartEventMap['chart:click'])
        })
      }
    }

    /** 销毁图表实例 */
    const destroyInstance = (): void => {
      if (chart.value) {
        chart.value.dispose()
        chart.value = null
      }
    }

    /* ------------------------------------------------------------------ */
    /*                                图例交互                             */
    /* ------------------------------------------------------------------ */

    /** 点击图例项：切换显隐 */
    const toggleLegend = (item: LegendItemData): void => {
      if (props.option?.legend?.selectable === false) return
      const isPieLike = item.dataIndex !== undefined
      const key = isPieLike ? `${item.seriesIndex}-${item.dataIndex}` : `${item.seriesIndex}-all`
      const next = new Set(hiddenKeys.value)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      hiddenKeys.value = next

      applyOption()
      emit('legend-toggle', {
        seriesIndex: item.seriesIndex,
        seriesName: item.name,
        visible: !next.has(key),
      })
    }

    /* ------------------------------------------------------------------ */
    /*                                监听                                 */
    /* ------------------------------------------------------------------ */

    /**
     * 上一次实际应用过的 option 签名
     *
     * 为什么需要它：`option` 的深度 watch 非常容易误触发——
     * 父组件里 `computed(() => ({ ...option, data: someRef.value }))`
     * 这类写法每次求值都会产生**新对象**，但内容完全一样。
     * 如果每次都调 `setOption()`，图表会整棵重建、重播入场动画，
     * 用户只改了一个无关变量，画面却在闪。
     *
     * 这里用一个廉价的结构签名做去抖：只有「真的变了」才重建。
     */
    let appliedSignature = ''

    /**
     * 计算 option 的结构签名
     *
     * 覆盖对渲染结果有影响的字段：系列数据、坐标轴、主题/调色板、
     * 动画与样式开关。用 JSON 序列化而不是深度比较，是因为 option 里
     * 可能含有函数（formatter 等），JSON.stringify 会把它们忽略掉，
     * 而函数变化本身不需要重建（闭包里的最新值在下一次渲染时自然生效）。
     */
    const signatureOf = (option: Vis3xOption, palette?: string[]): string => {
      try {
        return JSON.stringify([
          option.type,
          option.series,
          option.xAxis3D,
          option.yAxis3D,
          option.zAxis3D,
          option.theme,
          option.backgroundColor,
          option.animation,
          option.showCoordinate,
          option.gridFloor,
          option.controlSettings,
          option.lights,
          palette,
        ])
      } catch {
        // 存在循环引用时退化为「总是变化」，保证功能正确性优先
        return `${Math.random()}`
      }
    }

    watch(
      () => props.option,
      () => {
        if (!chart.value) return
        const next = signatureOf(props.option, props.palette)
        if (next === appliedSignature) return
        applyOption()
      },
      { deep: true }
    )

    watch(
      () => props.type,
      () => {
        // 类型变化需要重建实例
        destroyInstance()
        createInstance()
      }
    )

    watch(
      () => props.palette,
      () => {
        if (!chart.value) return
        const next = signatureOf(props.option, props.palette)
        if (next === appliedSignature) return
        applyOption()
      },
      { deep: true }
    )

    watch(
      () => props.hoveredLightIndex,
      (index) => {
        // 预留：高亮指定光源
        if (index === undefined || !chart.value) return
        chart.value.requestRender()
      }
    )

    onMounted(() => {
      createInstance()
    })

    onBeforeUnmount(() => {
      destroyInstance()
    })

    /* ------------------------------------------------------------------ */
    /*                              暴露 API                               */
    /* ------------------------------------------------------------------ */

    expose({
      /** 底层图表实例 */
      getChart: () => chart.value,
      /** 容器元素 */
      getContainer: () => containerRef.value,
      /** 导出图片 */
      exportImage: (options?: { backgroundColor?: string | null; scale?: number }) =>
        chart.value?.exportImage(options) ?? '',
      /** 重新计算尺寸 */
      resize: () => chart.value?.resize(),
      /** 相机自适应 */
      fitToScreen: () => chart.value?.fitToScreen(),
      /** 重置视角 */
      resetCamera: () => chart.value?.resetCamera(),
      /** 命令式更新配置 */
      setOption: (option: Vis3xOption) => chart.value?.setOption(option),
      /** 订阅事件 */
      on: (event: ChartEventType, listener: (payload: never) => void) =>
        chart.value?.on(event, listener as never),
      /** 派发事件 */
      dispatch: (event: ChartEventType, payload: never) => chart.value?.dispatch(event, payload),
      /** 手动触发一次渲染 */
      render: () => chart.value?.requestRender(),
    })

    /* ------------------------------------------------------------------ */
    /*                              渲染函数                               */
    /* ------------------------------------------------------------------ */

    /** 渲染提示框内容 */
    const renderTooltip = () => {
      const data = tooltip.value
      if (!data) return null
      const t: TooltipStyle = props.option?.tooltip ?? {}

      if (t.formatter) {
        const html = t.formatter({
          seriesName: data.seriesName,
          name: data.title,
          value: data.value,
          color: data.color,
          dataIndex: data.dataIndex,
          seriesIndex: data.seriesIndex,
          percent: data.percent,
        })
        return h('div', {
          class: ['vt-tooltip', t.className].filter(Boolean).join(' '),
          'data-vt-overlay': 'tooltip',
          style: tooltipStyle.value,
          innerHTML: html,
        })
      }

      const title = data.title ?? data.seriesName
      const valueText = formatNumber(data.value, { precision: 2 }).replace(/\.0+$/, '')

      return h(
        'div',
        {
          class: ['vt-tooltip', t.className].filter(Boolean).join(' '),
          'data-vt-overlay': 'tooltip',
          style: tooltipStyle.value,
        },
        [
          title
            ? h('div', { class: 'vt-tooltip__title' }, [
                h('span', {
                  class: 'vt-tooltip__dot',
                  style: { backgroundColor: data.color },
                }),
                String(title),
              ])
            : null,
          h('div', { class: 'vt-tooltip__row' }, [
            h('span', { class: 'vt-tooltip__label' }, data.seriesName ?? '数值'),
            h('span', { class: 'vt-tooltip__value' }, valueText),
          ]),
        ]
      )
    }

    /** 渲染图例 */
    const renderLegend = () => {
      const l: LegendStyle = props.option?.legend ?? {}
      if (l.show === false) return null
      if (!legendItems.value.length) return null
      const position = l.position ?? 'bottom'
      const selectable = l.selectable !== false && l.selectedMode !== false
      const iconSize = l.iconSize ?? 10
      const iconW = l.itemWidth ?? l.itemStyle?.width ?? iconSize
      const iconH = l.itemHeight ?? l.itemStyle?.height ?? iconSize
      const inactiveColor = l.inactiveColor ? toCssColor(l.inactiveColor) : undefined
      const inactiveBorder = l.inactiveBorderColor
        ? toCssColor(l.inactiveBorderColor)
        : undefined
      const iconBorder = l.itemStyle?.borderWidth
        ? `${l.itemStyle.borderWidth}px solid ${toCssColor(l.itemStyle.borderColor, 'transparent')}`
        : undefined

      /** 图例文字格式化（字符串模板支持 {name}） */
      const formatName = (name: string): string => {
        if (typeof l.formatter === 'function') return l.formatter(name)
        if (typeof l.formatter === 'string') {
          return l.formatter.replace(/\{name\}/g, name)
        }
        return name
      }

      return h(
        'div',
        {
          class: ['vt-legend', `vt-legend--${position}`],
          'data-vt-overlay': 'legend',
          style: legendStyle.value,
        },
        legendItems.value.map((item) =>
          h(
            'div',
            {
              key: `${item.seriesIndex}-${item.dataIndex ?? 'all'}`,
              class: [
                'vt-legend__item',
                selectable ? 'vt-legend__item--clickable' : '',
                item.visible ? '' : 'vt-legend__item--hidden',
              ]
                .filter(Boolean)
                .join(' '),
              style: item.visible ? undefined : {
                color: inactiveColor,
                opacity: l.inactiveColor ? 1 : undefined,
              },
              onClick: () => toggleLegend(item),
            },
            [
              h('span', {
                class: [
                  'vt-legend__icon',
                  item.symbol === 'circle' ? 'vt-legend__icon--circle' : '',
                ]
                  .filter(Boolean)
                  .join(' '),
                style: {
                  backgroundColor: item.visible || !inactiveBorder ? item.color : 'transparent',
                  border: item.visible ? iconBorder : inactiveBorder,
                  width: `${iconW}px`,
                  height: `${iconH}px`,
                  opacity: !item.visible && !inactiveColor ? 0.4 : l.itemStyle?.opacity,
                },
              }),
              h('span', formatName(item.name)),
            ]
          )
        )
      )
    }

    /** 渲染标题 */
    const renderTitle = () => {
      const title = props.option?.title
      if (!title?.show || !title.text) return null
      const left = typeof title.left === 'number' ? `${title.left}px` : (title.left ?? '16px')
      const top = typeof title.top === 'number' ? `${title.top}px` : (title.top ?? '12px')
      return h(
        'div',
        {
          class: 'vt-title',
          'data-vt-overlay': 'title',
          style: { left, top },
        },
        [
          h('div', { class: 'vt-title__text', style: title.textStyle ?? {} }, title.text),
          title.subtext
            ? h('div', { class: 'vt-title__subtext', style: title.subtextStyle ?? {} }, title.subtext)
            : null,
        ]
      )
    }

    /** 渲染加载遮罩 */
    const renderLoading = () => {
      if (!props.loading && !props.option?.loading) return null
      return h('div', { class: 'vt-loading', 'data-vt-overlay': 'loading' }, [
        h('div', { class: 'vt-loading__spinner' }),
        h('div', null, '加载中…'),
      ])
    }

    /** 渲染空状态 */
    const renderEmpty = () => {
      const hasSeries = (props.option?.series ?? []).some(
        (s) => 'data' in s && Array.isArray(s.data) && s.data.length > 0
      )
      if (hasSeries) return null
      return h('div', { class: 'vt-empty' }, slots.empty?.() ?? '暂无数据')
    }

    return () =>
      h(
        'div',
        {
          ref: containerRef,
          class: 'vt-container',
          style: containerStyle.value,
        },
        [
          renderTitle(),
          renderLegend(),
          renderTooltip(),
          renderLoading(),
          renderEmpty(),
          slots.default?.(),
        ]
      )
  },
})
