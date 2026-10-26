/**
 * vis-3x — 交互管理器
 *
 * 负责：
 * - 鼠标/触摸 → Three.js 射线拾取
 * - 悬停高亮（材质自发光增强 + 轻微放大）
 * - 点击 / 双击 / 移入 / 移出 事件派发
 * - 提示框数据生成与屏幕坐标计算
 */
import * as THREE from 'three'
import type { Engine } from './Engine'
import type { ChartEventMap } from '../types/option'
import type { TooltipData } from '../types/option'

/** 绑定在 Object3D.userData 上的数据标识 */
export interface PickableMeta {
  seriesIndex: number
  dataIndex: number
  seriesName?: string
  name?: string
  value: number | number[]
  color: string
  /** 该对象的原始缩放，用于悬停放大后还原 */
  baseScale?: THREE.Vector3
}

/** 交互管理器构造参数 */
export interface InteractionManagerOptions {
  engine: Engine
  /** 用于射线拾取的根对象 */
  target: THREE.Object3D
  /** 是否启用悬停高亮 */
  highlightOnHover?: boolean
  /** 悬停时的放大倍数 */
  hoverScale?: number
  /** 提示框回调 */
  onTooltip?: (data: TooltipData) => void
}

/** 交互管理器 */
export class InteractionManager {
  private engine: Engine
  private target: THREE.Object3D
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private enabled = true
  private highlightOnHover: boolean
  private hoverScale: number
  private onTooltip?: (data: TooltipData) => void

  private hovered: THREE.Object3D | null = null
  private hoveredMeta: PickableMeta | null = null
  private disposers: Array<() => void> = []
  private domElement: HTMLElement
  private pointerInside = false

  constructor(options: InteractionManagerOptions) {
    this.engine = options.engine
    this.target = options.target
    this.highlightOnHover = options.highlightOnHover ?? true
    this.hoverScale = options.hoverScale ?? 1.05
    this.onTooltip = options.onTooltip
    this.domElement = this.engine.labelRenderer.domElement

    // 让覆盖层只在有可交互对象时捕获指针，其余情况穿透给 OrbitControls
    this.domElement.style.pointerEvents = 'none'

    this.bind()
  }

  /* ------------------------------------------------------------------ */
  /*                              事件绑定                               */
  /* ------------------------------------------------------------------ */

  private bind(): void {
    const dom = this.domElement
    const canvas = this.engine.renderer.domElement

    const onPointerMove = (event: PointerEvent) => this.handlePointerMove(event, canvas)
    const onPointerLeave = () => this.handlePointerLeave()
    const onClick = (event: MouseEvent) => this.handleClick(event, canvas, 'chart:click')
    const onDblClick = (event: MouseEvent) => this.handleClick(event, canvas, 'chart:dblclick')
    const onPointerDown = (event: MouseEvent) => this.handleClick(event, canvas, 'chart:mousedown')
    const onPointerUp = (event: MouseEvent) => this.handleClick(event, canvas, 'chart:mouseup')

    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerleave', onPointerLeave)
    canvas.addEventListener('click', onClick)
    canvas.addEventListener('dblclick', onDblClick)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointerup', onPointerUp)

    this.disposers.push(() => {
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('dblclick', onDblClick)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointerup', onPointerUp)
    })
  }

  /** 把屏幕坐标转换为归一化设备坐标 */
  private updatePointer(event: MouseEvent | PointerEvent, canvas: HTMLCanvasElement): void {
    const rect = canvas.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  }

  /** 获取容器内的相对像素坐标（用于提示框定位） */
  private getScreenPosition(
    event: MouseEvent | PointerEvent
  ): { x: number; y: number } {
    const rect = this.engine.container.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  /** 射线拾取 */
  private pick(event: MouseEvent | PointerEvent, canvas: HTMLCanvasElement): THREE.Intersection[] {
    this.updatePointer(event, canvas)
    this.raycaster.setFromCamera(this.pointer, this.engine.camera)
    // 只拾取带 userData.__vtPick 标记的对象
    const intersects = this.raycaster.intersectObject(this.target, true)
    return intersects.filter((hit) => {
      let node: THREE.Object3D | null = hit.object
      while (node) {
        if (node.userData?.__vtPick) return true
        if (node.userData?.__vtNoPick) return false
        node = node.parent
      }
      return false
    })
  }

  /** 从命中对象向上查找元数据 */
  private resolveMeta(object: THREE.Object3D): {
    meta: PickableMeta
    node: THREE.Object3D
  } | null {
    let node: THREE.Object3D | null = object
    while (node) {
      const meta = node.userData?.__vtPick as PickableMeta | undefined
      if (meta) return { meta, node }
      node = node.parent
    }
    return null
  }

  /* ------------------------------------------------------------------ */
  /*                              指针移动                               */
  /* ------------------------------------------------------------------ */

  private handlePointerMove(event: PointerEvent, canvas: HTMLCanvasElement): void {
    if (!this.enabled) return
    this.pointerInside = true

    const hits = this.pick(event, canvas)
    const screen = this.getScreenPosition(event)

    if (!hits.length) {
      if (this.hovered) this.handlePointerLeave(true)
      return
    }

    const resolved = this.resolveMeta(hits[0].object)
    if (!resolved) return
    const { meta, node } = resolved

    // 悬停对象变化
    if (this.hovered !== node) {
      this.restoreHover()
      this.hovered = node
      this.hoveredMeta = meta
      this.applyHover(node)
      this.engine.requestRender()

      this.emit('chart:mouseover', meta, node, hits[0].point, event)
    } else {
      this.hoveredMeta = meta
    }

    // 提示框
    this.onTooltip?.({
      title: meta.name,
      seriesName: meta.seriesName,
      value: meta.value,
      color: meta.color,
      dataIndex: meta.dataIndex,
      seriesIndex: meta.seriesIndex,
      x: screen.x,
      y: screen.y,
      visible: true,
    })

    this.emit('chart:mousemove', meta, node, hits[0].point, event)
  }

  /** 指针离开：还原高亮并隐藏提示框 */
  private handlePointerLeave(force = false): void {
    if (!this.pointerInside && !force) return
    this.pointerInside = false
    const prevMeta = this.hoveredMeta
    const prevNode = this.hovered
    this.restoreHover()

    if (prevMeta && prevNode) {
      this.emit(
        'chart:mouseout',
        prevMeta,
        prevNode,
        new THREE.Vector3(),
        { clientX: 0, clientY: 0 } as unknown as PointerEvent
      )
    }

    this.onTooltip?.({
      value: 0,
      color: '#000',
      dataIndex: -1,
      seriesIndex: -1,
      x: 0,
      y: 0,
      visible: false,
    })
    this.engine.requestRender()
  }

  /* ------------------------------------------------------------------ */
  /*                              悬停高亮                               */
  /* ------------------------------------------------------------------ */

  /** 应用高亮效果 */
  private applyHover(node: THREE.Object3D): void {
    if (!this.highlightOnHover) return
    node.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials) {
        const m = material as THREE.MeshStandardMaterial
        if (!m) continue
        // 记录原始值，便于还原
        if (m.userData.__vtOrigEmissive === undefined) {
          m.userData.__vtOrigEmissive = m.emissive ? m.emissive.getHex() : null
          m.userData.__vtOrigEmissiveIntensity = m.emissiveIntensity ?? 0
          m.userData.__vtOrigOpacity = m.opacity
        }
        if (m.emissive) {
          m.emissive.setHex(0xffffff)
          m.emissiveIntensity = 0.22
        }
        m.needsUpdate = true
      }
    })

    // 轻微放大（记录基础缩放）
    if (this.hoverScale !== 1 && !node.userData.__vtHoverScaled) {
      node.userData.__vtHoverScaled = true
      node.userData.__vtPreHoverScale = node.scale.clone()
      const s = this.hoverScale
      node.scale.multiply(new THREE.Vector3(s, s, s))
    }
  }

  /** 还原高亮 */
  private restoreHover(): void {
    const node = this.hovered
    if (!node) return

    node.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials) {
        const m = material as THREE.MeshStandardMaterial
        if (!m) continue
        const origEmissive = m.userData.__vtOrigEmissive
        if (origEmissive !== undefined && origEmissive !== null && m.emissive) {
          m.emissive.setHex(origEmissive as number)
        }
        if (m.userData.__vtOrigEmissiveIntensity !== undefined) {
          m.emissiveIntensity = m.userData.__vtOrigEmissiveIntensity as number
        }
        if (m.userData.__vtOrigOpacity !== undefined) {
          m.opacity = m.userData.__vtOrigOpacity as number
        }
        m.needsUpdate = true
      }
    })

    if (node.userData.__vtHoverScaled) {
      const pre = node.userData.__vtPreHoverScale as THREE.Vector3 | undefined
      if (pre) node.scale.copy(pre)
      node.userData.__vtHoverScaled = false
    }

    this.hovered = null
    this.hoveredMeta = null
  }

  /* ------------------------------------------------------------------ */
  /*                                点击                                 */
  /* ------------------------------------------------------------------ */

  private handleClick(
    event: MouseEvent,
    canvas: HTMLCanvasElement,
    type: 'chart:click' | 'chart:dblclick' | 'chart:mousedown' | 'chart:mouseup'
  ): void {
    if (!this.enabled) return
    const hits = this.pick(event, canvas)
    if (!hits.length) return
    const resolved = this.resolveMeta(hits[0].object)
    if (!resolved) return
    this.emit(type, resolved.meta, resolved.node, hits[0].point, event)
  }

  /** 派发事件 */
  private emit(
    type: keyof ChartEventMap,
    meta: PickableMeta,
    node: THREE.Object3D,
    position: THREE.Vector3,
    event: MouseEvent | TouchEvent | PointerEvent
  ): void {
    const payload = {
      type: type.replace('chart:', '') as 'click',
      seriesIndex: meta.seriesIndex,
      dataIndex: meta.dataIndex,
      name: meta.name,
      seriesName: meta.seriesName,
      value: meta.value,
      color: meta.color,
      object: node,
      position,
      event: event as MouseEvent,
    }
    this.engine.eventBus.emit(type, payload as never)
    // 兼容 click / dblclick 等简写事件名
    if (type === 'chart:click' || type === 'chart:dblclick') {
      this.engine.eventBus.emit(type as never, payload as never)
    }
  }

  /* ------------------------------------------------------------------ */
  /*                                控制                                 */
  /* ------------------------------------------------------------------ */

  /** 启用/禁用交互 */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) this.handlePointerLeave(true)
  }

  /** 更新拾取目标 */
  setTarget(target: THREE.Object3D): void {
    this.target = target
  }

  /**
   * 丢弃当前悬停引用（不派发事件）
   *
   * 用于「网格即将被整棵重建」的场景（例如 `setOption`）。
   * 重建前必须调用，否则 `hovered` 会指向已被 `disposeSubtree()` 释放的
   * 网格与材质，下一次 `pointerleave` 就会对已经 dispose 的材质做
   * `emissive.setHex()` / `needsUpdate`，触发 Three.js 警告并让新对象丢失高亮还原。
   */
  resetHover(): void {
    this.hovered = null
    this.hoveredMeta = null
    this.pointerInside = false
  }

  /** 设置提示框回调 */
  setTooltipCallback(cb?: (data: TooltipData) => void): void {
    this.onTooltip = cb
  }

  /** 当前悬停的数据 */
  get hoveredData(): PickableMeta | null {
    return this.hoveredMeta
  }

  /** 销毁 */
  dispose(): void {
    this.restoreHover()
    for (const dispose of this.disposers) dispose()
    this.disposers = []
    this.onTooltip = undefined
  }
}
