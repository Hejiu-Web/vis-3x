/**
 * vis-3x — 3D 渲染引擎
 *
 * 引擎负责「与业务无关」的基础设施：
 * - Three.js 场景 / 相机 / WebGL 渲染器 / CSS2D 标签层
 * - OrbitControls 交互控制
 * - 光照系统（含专业三点光照默认值）
 * - 按需渲染调度（静止时停止重绘，显著降低 GPU 占用）
 * - 尺寸自适应（ResizeObserver）
 * - WebGL 上下文丢失恢复
 * - 导出图片
 *
 * 具体图表逻辑由 ChartBase 子类实现。
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer } from './CSS2DRenderer'
import { EventBus } from './EventBus'
import { ResourceManager } from './ResourceManager'
import type {
  ControlSettings,
  InteractionMode,
  LightConfig,
  PostprocessingOptions,
  ThemeConfig,
} from '../types/environment'
import type { ChartEventMap } from '../types/option'
import { DEFAULT_PALETTE } from '../utils/color'
import { clamp, degToRad } from '../utils/math'

/** 引擎构造参数 */
export interface EngineOptions {
  /** 相机初始位置 */
  cameraPosition?: [number, number, number]
  /** 背景色 */
  backgroundColor?: string | number | null
  /** 是否启用交互控制 */
  enableControls?: boolean
  /** 是否保留绘制缓冲（导出图片必需，略有性能损耗） */
  preserveDrawingBuffer?: boolean
  /** 最大像素比，默认 min(devicePixelRatio, 2) */
  maxPixelRatio?: number
  /** 抗锯齿 */
  antialias?: boolean
  /** WebGL 电源偏好 */
  powerPreference?: WebGLPowerPreference
  /** 控制器配置 */
  controlSettings?: ControlSettings
  /** 主题 */
  theme?: ThemeConfig
  /** 是否启用按需渲染 */
  onDemandRendering?: boolean
  /** 相机远近裁剪面 */
  near?: number
  /** 相机远裁剪面 */
  far?: number
  /** 相机视场角 */
  fov?: number
}

/** 光照默认值：专业三点光照 + 环境补光 */
function defaultLights(): LightConfig[] {
  return [
    // 环境补光：避免暗部死黑
    { type: 'ambient', color: '#ffffff', intensity: 0.55 },
    // 主光：右上前方，投射阴影
    {
      type: 'directional',
      position: [1, 1.6, 1],
      color: '#ffffff',
      intensity: 1.6,
      shadow: true,
      shadowMapSize: 2048,
      shadowCameraSize: 12,
    },
    // 补光：左前方，降低主光造成的对比，柔化暗部
    {
      type: 'directional',
      position: [-1.2, 0.9, 0.8],
      color: '#dbeafe',
      intensity: 0.6,
    },
    // 轮廓光：后方，勾出边缘增强立体感
    {
      type: 'directional',
      position: [-0.6, 0.5, -1.4],
      color: '#93c5fd',
      intensity: 0.45,
    },
  ]
}

/**
 * 引擎类
 */
export class Engine {
  readonly container: HTMLElement
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer
  readonly labelRenderer: CSS2DRenderer
  readonly controls: OrbitControls
  readonly eventBus = new EventBus()
  readonly resources = new ResourceManager()

  /** 光照分组 */
  readonly lightGroup = new THREE.Group()
  /** 根分组：所有图表内容挂载于此，便于整体缩放/居中 */
  readonly root = new THREE.Group()

  options: EngineOptions

  private width = 1
  private height = 1
  private pixelRatio = 1
  private frameHandle: number | null = null
  private needsRender = true
  private continuous = false
  private disposed = false
  private resizeObserver?: ResizeObserver
  private loopCallbacks = new Set<() => void>()
  private resizeCallbacks = new Set<(w: number, h: number) => void>()
  private lightHelpers: THREE.Object3D[] = []
  private shadowNeedsUpdate = true
  private environmentTexture?: THREE.Texture
  private contextLost = false
  private boundContextLost: (e: Event) => void
  private boundContextRestored: () => void
  private lastRenderTime = 0

  constructor(container: HTMLElement, options: EngineOptions = {}) {
    this.container = container
    this.options = {
      antialias: true,
      powerPreference: 'high-performance',
      maxPixelRatio: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2),
      enableControls: true,
      onDemandRendering: true,
      fov: 45,
      near: 0.1,
      far: 2000,
      ...options,
    }

    /* ----------------------------- 场景 ----------------------------- */
    this.scene = new THREE.Scene()
    if (options.backgroundColor !== undefined && options.backgroundColor !== null) {
      this.scene.background = new THREE.Color(options.backgroundColor)
    }

    /* ----------------------------- 相机 ----------------------------- */
    const aspect = this.getAspect()
    this.camera = new THREE.PerspectiveCamera(
      this.options.fov ?? 45,
      aspect,
      10,
      this.options.far ?? 2000
    )
    this.camera.near = this.options.near ?? 0.1
    const pos = options.cameraPosition ?? [1, 1.15, 1]
    const len = Math.hypot(pos[0], pos[1], pos[2]) || 1
    // 归一化后放大到合适距离，具体距离由 fitToScreen 调整
    this.camera.position.set(
      (pos[0] / len) * 10,
      (pos[1] / len) * 10,
      (pos[2] / len) * 10
    )
    this.camera.lookAt(0, 0, 0)

    /* ---------------------------- 渲染器 ---------------------------- */
    this.renderer = new THREE.WebGLRenderer({
      antialias: this.options.antialias,
      alpha: true,
      /**
       * 默认关闭绘制缓冲保留
       *
       * `preserveDrawingBuffer: true` 会显著增加每帧开销（Three.js 官方建议
       * 只在「需要多次读取像素」时开启）。`exportImage()` 的做法是
       * 「同步渲染一帧后立刻 toDataURL」，同一任务内缓冲仍然有效，
       * 所以导出功能并不需要这个开关。
       *
       * 确实需要异步读像素（例如把 canvas 交给外部工具处理）时，
       * 可以显式传 `preserveDrawingBuffer: true`。
       */
      preserveDrawingBuffer: this.options.preserveDrawingBuffer ?? false,
      powerPreference: this.options.powerPreference,
      stencil: false,
    })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = true
    // Three.js r186 移除了 PCFSoftShadowMap，强行赋值会打印警告并退化为默认。
    // 用存在性判断做版本兼容：新版本用 PCFShadowMap，旧版本保留软阴影。
    const shadowTypes = THREE as unknown as {
      PCFSoftShadowMap?: THREE.ShadowMapType
      PCFShadowMap?: THREE.ShadowMapType
    }
    this.renderer.shadowMap.type =
      shadowTypes.PCFSoftShadowMap ?? shadowTypes.PCFShadowMap ?? THREE.PCFShadowMap

    const canvas = this.renderer.domElement
    canvas.style.display = 'block'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'
    canvas.style.outline = 'none'

    /* --------------------------- 标签渲染器 -------------------------- */
    this.labelRenderer = new CSS2DRenderer()

    /* --------------------------- 容器装配 --------------------------- */
    // 容器需要定位上下文
    const computedPosition = window.getComputedStyle(container).position
    if (computedPosition === 'static') {
      container.style.position = 'relative'
    }
    container.style.overflow = container.style.overflow || 'hidden'
    container.appendChild(canvas)
    container.appendChild(this.labelRenderer.domElement)

    /* ----------------------------- 分组 ---------------------------- */
    this.lightGroup.name = '__vt_lights'
    this.root.name = '__vt_root'
    this.scene.add(this.lightGroup)
    this.scene.add(this.root)

    /* ---------------------------- 控制器 ---------------------------- */
    // 必须绑定到 canvas：
    // 标签层（labelRenderer.domElement）设了 pointer-events: none，
    // 不参与事件派发，绑在它上面的控制器永远收不到指针事件。
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.rotateSpeed = 0.85
    this.controls.zoomSpeed = 0.85
    this.controls.panSpeed = 0.7
    this.controls.minDistance = 3
    this.controls.maxDistance = 120
    this.controls.maxPolarAngle = Math.PI * 0.495
    this.controls.minPolarAngle = 0.05
    this.controls.enablePan = true
    this.controls.screenSpacePanning = true
    this.controls.target.set(0, 0, 0)
    this.applyControlSettings(this.options.controlSettings)

    // 交互时请求重绘
    this.controls.addEventListener('change', this.handleControlsChange)

    /* ---------------------------- 光照 ----------------------------- */
    this.setLights(defaultLights())

    /* ------------------------- 上下文丢失处理 ------------------------ */
    this.boundContextLost = (e: Event) => {
      e.preventDefault()
      this.contextLost = true
      this.setContinuousRendering(false)
    }
    this.boundContextRestored = () => {
      this.contextLost = false
      this.requestRender()
    }
    canvas.addEventListener('webglcontextlost', this.boundContextLost as EventListener)
    canvas.addEventListener('webglcontextrestored', this.boundContextRestored)

    /* ----------------------------- 尺寸 ---------------------------- */
    this.resize()
    this.observeResize()

    // 启动渲染循环
    this.loop()
  }

  /* ------------------------------------------------------------------ */
  /*                                尺寸                                 */
  /* ------------------------------------------------------------------ */

  private getAspect(): number {
    return this.height > 0 ? this.width / this.height : 1
  }

  private observeResize(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize())
      this.resizeObserver.observe(this.container)
    }
  }

  /** 更新渲染尺寸 */
  resize(): void {
    if (this.disposed) return
    const rect = this.container.getBoundingClientRect()
    const width = Math.max(1, Math.floor(rect.width || this.container.clientWidth || 300))
    const height = Math.max(1, Math.floor(rect.height || this.container.clientHeight || 150))
    if (width === this.width && height === this.height) return

    this.width = width
    this.height = height
    this.pixelRatio = Math.min(
      window.devicePixelRatio || 1,
      this.options.maxPixelRatio ?? 2
    )

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()

    this.renderer.setPixelRatio(this.pixelRatio)
    this.renderer.setSize(width, height, false)
    this.labelRenderer.setSize(width, height)

    for (const cb of this.resizeCallbacks) cb(width, height)
    this.eventBus.emit('resize', { width, height })
    this.requestRender()
  }

  /** 注册尺寸变化回调 */
  onResize(callback: (width: number, height: number) => void): () => void {
    this.resizeCallbacks.add(callback)
    return () => this.resizeCallbacks.delete(callback)
  }

  get size(): { width: number; height: number } {
    return { width: this.width, height: this.height }
  }

  /* ------------------------------------------------------------------ */
  /*                                光照                                 */
  /* ------------------------------------------------------------------ */

  /**
   * 设置光源（替换全部现有光源）
   */
  setLights(lights: LightConfig[]): void {
    // 清理旧光源
    for (const light of [...this.lightGroup.children]) {
      this.lightGroup.remove(light)
      const asLight = light as THREE.Light
      if (asLight.isLight) {
        asLight.shadow?.map?.dispose()
        asLight.dispose?.()
      }
    }
    this.clearLightHelpers()

    for (const config of lights) {
      const light = this.createLight(config)
      if (light) this.lightGroup.add(light)
    }
    this.requestShadowMapUpdate()
  }

  private createLight(config: LightConfig): THREE.Light | null {
    const color = new THREE.Color(config.color ?? '#ffffff')
    const intensity = config.intensity ?? 1
    const type = config.type ?? 'directional'
    let light: THREE.Light | null = null
    const target = new THREE.Vector3(...(config.target ?? [0, 0, 0]))

    switch (type) {
      case 'ambient': {
        light = new THREE.AmbientLight(color, intensity)
        break
      }
      case 'hemisphere': {
        light = new THREE.HemisphereLight(
          new THREE.Color(config.skyColor ?? config.color ?? '#ffffff'),
          new THREE.Color(config.groundColor ?? '#1b2233'),
          intensity
        )
        break
      }
      case 'point': {
        const p = new THREE.PointLight(color, intensity, config.distance ?? 0, 2)
        const pos = config.position ?? [0, 5, 0]
        const len = Math.hypot(...pos) || 1
        // 点光位置按场景比例缩放（默认单位为 1，图表尺度约 10）
        p.position.set((pos[0] / len) * 10, (pos[1] / len) * 10, (pos[2] / len) * 10)
        light = p
        break
      }
      case 'spot': {
        const p = new THREE.SpotLight(
          color,
          intensity,
          config.distance ?? 0,
          degToRad(config.angle ?? 30),
          config.penumbra ?? 0.3,
          2
        )
        const pos = config.position ?? [0, 8, 0]
        const len = Math.hypot(...pos) || 1
        p.position.set((pos[0] / len) * 12, (pos[1] / len) * 12, (pos[2] / len) * 12)
        p.target.position.copy(target)
        light = p
        break
      }
      case 'directional':
      default: {
        const d = new THREE.DirectionalLight(color, intensity)
        const pos = config.position ?? [1, 1.5, 1]
        const len = Math.hypot(pos[0], pos[1], pos[2]) || 1
        // 方向光的 position 只决定方向，距离不影响力度，这里归一化到合理距离
        d.position.set((pos[0] / len) * 20, (pos[1] / len) * 20, (pos[2] / len) * 20)
        d.target.position.copy(target)
        light = d
        break
      }
    }

    if (!light) return null

    // 阴影配置
    if (config.shadow && (light as THREE.DirectionalLight).shadow) {
      const shadowCapable = light as THREE.DirectionalLight
      shadowCapable.castShadow = true
      const mapSize = config.shadowMapSize ?? 2048
      shadowCapable.shadow.mapSize.set(mapSize, mapSize)
      const camSize = config.shadowCameraSize ?? 12
      const cam = shadowCapable.shadow.camera
      cam.left = -camSize
      cam.right = camSize
      cam.top = camSize
      cam.bottom = -camSize
      cam.near = 0.5
      cam.far = 80
      cam.updateProjectionMatrix()
      shadowCapable.shadow.bias = config.shadowBias ?? -0.0008
      shadowCapable.shadow.normalBias = 0.02
      if (config.shadowRadius !== undefined) shadowCapable.shadow.radius = config.shadowRadius
    }

    light.name = `__vt_light_${type}`
    return light
  }

  /** 显示/隐藏光源辅助器（调试） */
  setLightHelpersVisible(visible: boolean): void {
    if (visible) {
      if (this.lightHelpers.length) return
      for (const child of this.lightGroup.children) {
        const light = child as THREE.DirectionalLight
        if (light.isDirectionalLight) {
          const helper = new THREE.DirectionalLightHelper(light, 1.5)
          this.scene.add(helper)
          this.lightHelpers.push(helper)
        }
      }
    } else {
      this.clearLightHelpers()
    }
    this.requestRender()
  }

  private clearLightHelpers(): void {
    for (const helper of this.lightHelpers) {
      this.scene.remove(helper)
      const disposable = helper as THREE.Object3D & { dispose?: () => void }
      disposable.dispose?.()
    }
    this.lightHelpers = []
  }

  /* ------------------------------------------------------------------ */
  /*                              控制器                                 */
  /* ------------------------------------------------------------------ */

  private handleControlsChange = (): void => {
    this.requestRender()
    this.eventBus.emit('camera:change', {
      position: {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z,
      },
      target: {
        x: this.controls.target.x,
        y: this.controls.target.y,
        z: this.controls.target.z,
      },
    })
  }

  /** 应用控制器配置 */
  applyControlSettings(settings?: ControlSettings): void {
    const c = this.controls

    // 无配置时也要同步一次鼠标样式（保持默认自由视角的手势提示）
    if (!settings) {
      this.syncCursorStyle()
      return
    }

    /* ------------------------------------------------------------------ */
    /* 交互模式总开关：先按模式设置默认值，再用显式字段覆盖                  */
    /* ------------------------------------------------------------------ */
    const mode = settings.interactionMode
    if (mode) {
      switch (mode) {
        case 'fixed':
          // 固定视角：完全禁用相机交互
          c.enableRotate = false
          c.enableZoom = false
          c.enablePan = false
          c.autoRotate = false
          // 同时停掉阻尼惯性，否则松手后还会漂移一段
          c.enableDamping = false
          break
        case 'rotate':
          // 仅旋转：可转角度，但不能拉近拉远或拖动位置
          c.enableRotate = true
          c.enableZoom = false
          c.enablePan = false
          c.enableDamping = true
          break
        case 'free':
        default:
          c.enableRotate = true
          c.enableZoom = true
          c.enablePan = true
          c.enableDamping = true
          break
      }
    }

    // 显式字段优先级高于模式默认值
    if (settings.enableRotate !== undefined) c.enableRotate = settings.enableRotate
    if (settings.enableZoom !== undefined) c.enableZoom = settings.enableZoom
    if (settings.enablePan !== undefined) c.enablePan = settings.enablePan
    if (settings.enableDamping !== undefined) c.enableDamping = settings.enableDamping
    if (settings.minPolarAngle !== undefined) c.minPolarAngle = settings.minPolarAngle
    if (settings.maxPolarAngle !== undefined) c.maxPolarAngle = settings.maxPolarAngle
    if (settings.minAzimuthAngle !== undefined) c.minAzimuthAngle = settings.minAzimuthAngle
    if (settings.maxAzimuthAngle !== undefined) c.maxAzimuthAngle = settings.maxAzimuthAngle
    if (settings.minDistance !== undefined) c.minDistance = settings.minDistance
    if (settings.maxDistance !== undefined) c.maxDistance = settings.maxDistance
    if (settings.dampingFactor !== undefined) c.dampingFactor = settings.dampingFactor
    if (settings.zoomSpeed !== undefined) c.zoomSpeed = settings.zoomSpeed
    if (settings.rotateSpeed !== undefined) c.rotateSpeed = settings.rotateSpeed
    if (settings.autoRotate !== undefined) c.autoRotate = settings.autoRotate
    if (settings.autoRotateSpeed !== undefined) c.autoRotateSpeed = settings.autoRotateSpeed
    if (settings.target) c.target.set(...settings.target)

    // 自定义观察方向
    if (settings.cameraDirection) {
      const dir = settings.cameraDirection
      const v = new THREE.Vector3(dir.x ?? 1, dir.y ?? 1, dir.z ?? 1)
      if (v.lengthSq() > 0) {
        v.normalize().multiplyScalar(this.camera.position.length() || 10)

        /**
         * 关键：先把 y 为负的方向对应的极角上限放开
         *
         * OrbitControls 会在 `update()` 时把极角钳制到
         * `[minPolarAngle, maxPolarAngle]` 区间。默认上限是
         * `π × 0.495 ≈ 89.1°`，也就是相机**永远不能低于水平面**，
         * 因此 `cameraDirection.y` 为负数时会被立刻弹回。
         */
        this.ensurePolarRangeFor(v.clone().normalize())

        this.camera.position.copy(v)
        this.camera.lookAt(c.target)
        c.update()
      }
    }

    // 相机交互被禁用时，同步关闭鼠标样式提示，避免误导用户
    this.syncCursorStyle()

    if (c.autoRotate) this.setContinuousRendering(true)
    c.update()
  }

  /**
   * 根据当前控制器状态同步 canvas 鼠标样式
   *
   * 交互关闭时用默认箭头，开启时用抓取手势，
   * 让用户一眼看出这个图表能不能拖。
   */
  private syncCursorStyle(): void {
    const c = this.controls
    const interactive = c.enableRotate || c.enableZoom || c.enablePan
    const canvas = this.renderer.domElement
    canvas.style.cursor = interactive ? 'grab' : 'default'
  }

  /** 当前是否允许用户调整相机（旋转 / 缩放 / 平移任一可用） */
  get isCameraInteractive(): boolean {
    const c = this.controls
    return c.enableRotate || c.enableZoom || c.enablePan
  }

  /**
   * 运行时切换交互模式
   *
   * @example
   * ```ts
   * chart.engine.setInteractionMode('fixed')  // 锁定视角
   * chart.engine.setInteractionMode('free')   // 恢复自由视角
   * ```
   */
  setInteractionMode(mode: InteractionMode): void {
    this.options.controlSettings = {
      ...(this.options.controlSettings ?? {}),
      interactionMode: mode,
    }
    this.applyControlSettings(this.options.controlSettings)
  }

  /**
   * 相机自适应：根据内容包围盒调整相机距离与目标点
   *
   * @param box 内容包围盒；不传则使用 root 分组
   * @param factor 留白系数 0~1，越大留白越多
   * @param padding 额外留白（世界单位），用于给坐标轴标签/名称留出空间
   */
  fitToScreen(box?: THREE.Box3, factor?: number, padding = 0): void {
    const targetBox = (box ?? new THREE.Box3().setFromObject(this.root)).clone()
    if (targetBox.isEmpty()) return
    // 向外扩张，保证轴标签不被裁切
    if (padding > 0) targetBox.expandByScalar(padding)

    const center = targetBox.getCenter(new THREE.Vector3())
    const size = targetBox.getSize(new THREE.Vector3())
    const maxSize = Math.max(size.x, size.y, size.z, 1e-3)
    const f = clamp(factor ?? this.options.controlSettings?.fitToScreenFactor ?? 0.82, 0.3, 1.6)

    // 依据垂直/水平 FOV 计算刚好容纳的球半径距离
    const fitHeightDistance = maxSize / (2 * Math.atan((Math.PI * this.camera.fov) / 360))
    const fitWidthDistance = fitHeightDistance / this.camera.aspect
    const distance = f * Math.max(fitHeightDistance, fitWidthDistance) * 1.35
    const radius = Math.max(size.length() / 2, 1e-3)

    // 保持当前观察方向不变，只调整距离
    const direction = this.camera.position
      .clone()
      .sub(this.controls.target)
      .normalize()
    if (direction.lengthSq() < 1e-6) direction.set(1, 1, 1).normalize()

    this.controls.target.copy(center)
    this.camera.position.copy(center).addScaledVector(direction, distance + radius * 0.35)

    this.controls.minDistance = Math.max(radius * 0.2, 0.5)
    this.controls.maxDistance = Math.max(radius * 12, 20)

    this.camera.near = Math.max(distance / 200, 0.05)
    this.camera.far = distance * 20 + radius * 20
    this.camera.updateProjectionMatrix()
    this.controls.update()
    this.requestRender()
  }

  /** 重置相机到默认视角 */
  resetCamera(direction?: { x?: number; y?: number; z?: number }): void {
    const d = direction ?? this.options.controlSettings?.cameraDirection ?? { x: 1, y: 1.15, z: 1 }
    const v = new THREE.Vector3(d.x ?? 1, d.y ?? 1.15, d.z ?? 1).normalize()

    // 与 applyControlSettings 一致：先按目标方向放宽极角限制，
    // 否则 y < 0（仰视）会被 OrbitControls 立即钳制回水平面以上。
    this.ensurePolarRangeFor(v)

    const dist = this.camera.position.distanceTo(this.controls.target) || 20
    this.camera.position.copy(this.controls.target).addScaledVector(v, dist)
    this.camera.lookAt(this.controls.target)
    this.controls.update()
    this.requestRender()
  }

  /**
   * 根据目标方向放宽极角区间
   *
   * OrbitControls 的极角范围默认是 `[0.05, π×0.495]`，
   * 意味着相机不能低于水平面。传入负 y 的观察方向时，
   * 必须先把上限扩到目标角度之外，否则会被立即钳制回去。
   */
  private ensurePolarRangeFor(direction: THREE.Vector3): void {
    const horiz = Math.hypot(direction.x, direction.z)
    // 贴近 ±Y 轴时极角取 0 或 π，否则用 atan2 反推
    const polar =
      horiz < 1e-6
        ? direction.y >= 0
          ? 0
          : Math.PI
        : Math.atan2(horiz, direction.y)

    if (polar > this.controls.maxPolarAngle) {
      this.controls.maxPolarAngle = Math.min(Math.PI, polar + 0.02)
    }
    if (polar < this.controls.minPolarAngle) {
      this.controls.minPolarAngle = Math.max(0, polar - 0.02)
    }
  }

  /* ------------------------------------------------------------------ */
  /*                              渲染循环                               */
  /* ------------------------------------------------------------------ */

  /** 请求渲染一帧（按需渲染的核心） */
  requestRender(): void {
    this.needsRender = true
    if (this.options.onDemandRendering === false) this.setContinuousRendering(true)
    // 静止时 rAF 循环是停的，这里负责把它唤醒
    this.scheduleLoop()
  }

  /** 标记阴影贴图需要更新 */
  requestShadowMapUpdate(): void {
    this.shadowNeedsUpdate = true
    this.requestRender()
  }

  /** 开启/关闭持续渲染 */
  setContinuousRendering(enabled: boolean): void {
    this.continuous = enabled
    if (enabled) this.requestRender()
  }

  /**
   * 注册每帧回调（返回取消函数）
   *
   * 注意：有循环回调时会一直保持 rAF 运转，回调全部注销后
   * 引擎会自动退回「按需渲染」，不再空转占用主线程。
   */
  onLoop(callback: () => void): () => void {
    this.loopCallbacks.add(callback)
    this.setContinuousRendering(true)
    this.scheduleLoop()
    return () => {
      this.loopCallbacks.delete(callback)
      if (!this.loopCallbacks.size && this.options.onDemandRendering !== false) {
        if (!this.controls.autoRotate) this.continuous = false
      }
      // 没有回调后如果也不需要渲染，允许循环自行停止
      this.scheduleLoop()
    }
  }

  /** 启动 rAF 循环（幂等） */
  private scheduleLoop(): void {
    if (this.disposed || this.frameHandle !== null) return
    this.frameHandle = requestAnimationFrame(this.loop)
  }

  private loop = (): void => {
    this.frameHandle = null
    if (this.disposed) return
    if (this.contextLost) return

    const hasCallbacks = this.loopCallbacks.size > 0
    const damping = this.controls.enableDamping
    const changed = damping ? this.controls.update() : false
    if (!damping) this.controls.update()

    for (const cb of this.loopCallbacks) {
      try {
        cb()
      } catch (error) {
        console.error('[vis-3x] 渲染循环回调出错', error)
      }
    }

    const shouldRender =
      this.needsRender ||
      this.continuous ||
      hasCallbacks ||
      this.controls.autoRotate ||
      changed

    if (!shouldRender) return

    this.needsRender = false
    this.renderFrame()

    /**
     * 只在「确实还需要下一帧」时续排 rAF
     *
     * 之前的实现是无条件 `requestAnimationFrame(this.loop)`，
     * 即使场景完全静止也在常驻空转。一个页面开 20 张图表
     * 就会有 20 个永不停止的 rAF 回调，移动端耗电明显。
     */
    if (this.continuous || hasCallbacks || this.controls.autoRotate || changed) {
      this.scheduleLoop()
    }
  }

  /** 立即渲染一帧 */
  renderFrame(): void {
    if (this.disposed || this.contextLost) return

    if (this.shadowNeedsUpdate && this.renderer.shadowMap.enabled) {
      this.renderer.shadowMap.needsUpdate = true
      this.shadowNeedsUpdate = false
    }

    this.renderer.render(this.scene, this.camera)
    this.labelRenderer.render(this.scene, this.camera)
    this.lastRenderTime = performance.now()
  }

  /* ------------------------------------------------------------------ */
  /*                              导出图片                               */
  /* ------------------------------------------------------------------ */

  /**
   * 导出为 PNG DataURL
   *
   * @param options 导出选项
   */
  exportImage(options: { backgroundColor?: string | null; scale?: number } = {}): string {
    const { backgroundColor, scale = 1 } = options
    const src = this.renderer.domElement
    const width = Math.max(1, Math.floor(this.width * scale))
    const height = Math.max(1, Math.floor(this.height * scale))

    // 先渲染一帧保证内容最新
    this.renderFrame()

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return src.toDataURL('image/png')

    const bg =
      backgroundColor !== undefined
        ? backgroundColor
        : this.scene.background instanceof THREE.Color
          ? `#${this.scene.background.getHexString()}`
          : null

    if (bg) {
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, width, height)
    }
    ctx.drawImage(src, 0, 0, width, height)

    // 叠加 HTML 覆盖层（标签 / 图例 / 提示框）
    const overlays = this.container.querySelectorAll<HTMLElement>('[data-vt-overlay]')
    for (const overlay of overlays) {
      this.drawOverlay(ctx, overlay, width, height)
    }

    return canvas.toDataURL('image/png')
  }

  /** 把一个 HTML 覆盖层绘制到 canvas（简化实现，支持纯色背景与文字） */
  private drawOverlay(
    ctx: CanvasRenderingContext2D,
    element: HTMLElement,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    const containerRect = this.container.getBoundingClientRect()
    const scaleX = canvasWidth / containerRect.width
    const scaleY = canvasHeight / containerRect.height
    const rect = element.getBoundingClientRect()
    const style = window.getComputedStyle(element)

    const x = (rect.left - containerRect.left) * scaleX
    const y = (rect.top - containerRect.top) * scaleY
    const w = rect.width * scaleX
    const h = rect.height * scaleY

    ctx.save()
    const bg = style.backgroundColor
    const opacity = Number(style.opacity || 1)
    ctx.globalAlpha = Number.isFinite(opacity) ? opacity : 1
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
      ctx.fillStyle = bg
      const radius = parseFloat(style.borderRadius) || 0
      this.roundRect(ctx, x, y, w, h, radius * scaleX)
      ctx.fill()
    }
    const borderWidth = parseFloat(style.borderWidth) || 0
    if (borderWidth > 0 && style.borderColor) {
      ctx.strokeStyle = style.borderColor
      ctx.lineWidth = borderWidth * scaleX
      this.roundRect(ctx, x, y, w, h, (parseFloat(style.borderRadius) || 0) * scaleX)
      ctx.stroke()
    }

    // 文字
    const fontSize = (parseFloat(style.fontSize) || 12) * scaleY
    ctx.fillStyle = style.color || '#ffffff'
    ctx.font = `${style.fontWeight || 400} ${fontSize}px ${style.fontFamily || 'sans-serif'}`
    ctx.textBaseline = 'top'
    const padding = (parseFloat(style.paddingTop) || 0) * scaleY
    const paddingLeft = (parseFloat(style.paddingLeft) || 0) * scaleX
    const text = element.innerText ?? ''
    const lines = text.split('\n')
    lines.forEach((line, i) => {
      ctx.fillText(line, x + paddingLeft, y + padding + i * fontSize * 1.4)
    })
    ctx.restore()
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    const radius = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + w - radius, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
    ctx.lineTo(x + w, y + h - radius)
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
    ctx.lineTo(x + radius, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.closePath()
  }

  /* ------------------------------------------------------------------ */
  /*                                其他                                 */
  /* ------------------------------------------------------------------ */

  /** 应用主题（调色板等由此向图表传递） */
  applyTheme(theme: ThemeConfig): void {
    if (theme.backgroundColor !== undefined) {
      if (theme.backgroundColor === null) this.scene.background = null
      else this.scene.background = new THREE.Color(theme.backgroundColor)
    }
    this.requestRender()
  }

  /** 设置后处理（占位：当前版本通过渲染器参数实现色调映射） */
  applyPostprocessing(options?: PostprocessingOptions): void {
    if (!options) return
    const exposure = options.toneMappingExposure ?? 1.05
    this.renderer.toneMappingExposure = exposure

    /**
     * 从 three 命名空间按名取色调映射常量
     *
     * ⚠️ 这里**必须**用 `in` 判断后再取值，不能写成
     * `(THREE as Record<string, unknown>).AgXToneMapping`。
     * 后者只是类型层面的断言，Rollup 仍会把它编译成对 `THREE.AgXToneMapping`
     * 的**具名访问**，于是在不含该常量的 three 版本（< 0.166）上会直接报：
     *
     *   "NeutralToneMapping" is not exported by "three.module.js"
     *
     * 用字符串键 + `in` 才能真正做到「旧版本静默跳过」。
     */
    const num = (key: string): THREE.ToneMapping | undefined => {
      const ns = THREE as unknown as Record<string, number | undefined>
      return key in ns ? (ns[key] as THREE.ToneMapping) : undefined
    }

    const map: Record<string, THREE.ToneMapping | undefined> = {
      none: THREE.NoToneMapping,
      linear: THREE.LinearToneMapping,
      reinhard: THREE.ReinhardToneMapping,
      cineon: THREE.CineonToneMapping,
      aces: THREE.ACESFilmicToneMapping,
      // AgX / Neutral 在 three >= 0.166 才提供，旧版本下为 undefined
      agx: num('AgXToneMapping'),
      neutral: num('NeutralToneMapping'),
    }
    if (options.toneMapping && map[options.toneMapping] !== undefined) {
      // neutral 需要较新的 three 版本，缺失时回退到 ACES
      this.renderer.toneMapping = map[options.toneMapping] ?? THREE.ACESFilmicToneMapping
    }
    this.requestRender()
  }

  /** 生成默认调色板（预留主题扩展点） */
  get palette(): string[] {
    return this.options.theme?.palette ?? DEFAULT_PALETTE
  }

  /** 上一次渲染时间戳 */
  get lastRenderAt(): number {
    return this.lastRenderTime
  }

  /** 当前是否处于持续渲染 */
  get isContinuous(): boolean {
    return this.continuous
  }

  /** 注册事件（语法糖，转发到 eventBus） */
  on<T extends keyof ChartEventMap>(
    event: T,
    listener: (payload: ChartEventMap[T]) => void
  ): () => void {
    return this.eventBus.on(event, listener)
  }

  /** 销毁引擎 */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true

    if (this.frameHandle !== null) cancelAnimationFrame(this.frameHandle)
    this.resizeObserver?.disconnect()
    this.loopCallbacks.clear()
    this.resizeCallbacks.clear()

    this.controls.removeEventListener('change', this.handleControlsChange)
    this.controls.dispose()

    const canvas = this.renderer.domElement
    canvas.removeEventListener('webglcontextlost', this.boundContextLost as EventListener)
    canvas.removeEventListener('webglcontextrestored', this.boundContextRestored)

    this.clearLightHelpers()
    this.labelRenderer.dispose()

    /**
     * 资源释放只做一次
     *
     * 之前的实现既 `scene.traverse()` 手动 dispose，又调用
     * `resources.dispose()`，同一批几何体/材质被释放两次。
     * Three.js 对重复 dispose 会打印警告，且 `forceContextLoss()` 之后再
     * 操作 GPU 资源容易触发 WebGL 上下文错误。
     *
     * 这里只保留 `resources.dispose()`（它是所有资源的唯一登记处），
     * scene 只需清空引用。
     */
    this.resources.dispose()
    this.scene.clear()

    this.environmentTexture?.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss?.()
    canvas.remove()
    this.eventBus.clear()
  }

  get isDisposed(): boolean {
    return this.disposed
  }
}
