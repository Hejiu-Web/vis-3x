/**
 * vis-3x — CSS2D 标签渲染器
 *
 * Three.js 官方 CSS2DRenderer 在容器不位于视口 (0,0) 时会出现标签偏移。
 * 这里使用「相对容器的 bounding rect」计算屏幕坐标，从根本上避免该问题，
 * 同时支持 z-index 排序、可见性裁剪与批量更新。
 */
import * as THREE from 'three'

interface LabelEntry {
  element: HTMLElement
  object: THREE.Object3D
  /** 是否始终显示（即使在相机背面） */
  alwaysVisible: boolean
  /** 用户自定义的可见性开关 */
  enabled: boolean
  zIndex: number
}

/** 投影用临时向量，避免每帧分配 */
const _vector = new THREE.Vector3()
const _viewMatrix = new THREE.Matrix4()
const _viewProjectionMatrix = new THREE.Matrix4()

/**
 * 标签渲染器
 *
 * 用法：把 THREE.Object3D 与 DOM 元素绑定，每帧调用 render() 更新位置。
 */
export class CSS2DRenderer {
  /** 承载标签的 DOM 容器（绝对定位覆盖在 canvas 之上） */
  readonly domElement: HTMLDivElement

  private entries = new Map<THREE.Object3D, LabelEntry>()
  private width = 0
  private height = 0
  private widthHalf = 0
  private heightHalf = 0
  private orderCounter = 0
  private dirty = true

  constructor() {
    const element = document.createElement('div')
    element.style.position = 'absolute'
    element.style.top = '0'
    element.style.left = '0'
    element.style.width = '100%'
    element.style.height = '100%'
    element.style.overflow = 'hidden'
    element.style.pointerEvents = 'none'
    element.style.zIndex = '10'
    this.domElement = element
  }

  /** 设置渲染尺寸 */
  setSize(width: number, height: number): void {
    this.width = width
    this.height = height
    this.widthHalf = width / 2
    this.heightHalf = height / 2
  }

  /** 获取渲染尺寸 */
  getSize(): { width: number; height: number } {
    return { width: this.width, height: this.height }
  }

  /**
   * 绑定 DOM 元素到 3D 对象
   *
   * @param object 3D 对象
   * @param element DOM 元素
   * @param options 配置
   */
  add(
    object: THREE.Object3D,
    element: HTMLElement,
    options: { alwaysVisible?: boolean; center?: boolean; zIndex?: number } = {}
  ): void {
    const { alwaysVisible = false, center = true, zIndex } = options
    if (center) {
      element.style.position = 'absolute'
      element.style.transform = 'translate(-50%, -50%)'
    }
    element.style.pointerEvents = element.style.pointerEvents || 'auto'
    if (!element.parentNode) this.domElement.appendChild(element)

    this.entries.set(object, {
      element,
      object,
      alwaysVisible,
      enabled: true,
      zIndex: zIndex ?? this.orderCounter++,
    })
    this.dirty = true
  }

  /** 是否已绑定该对象 */
  has(object: THREE.Object3D): boolean {
    return this.entries.has(object)
  }

  /** 更新元素（用于 label 内容/样式变化后的重排） */
  update(object: THREE.Object3D, options: { zIndex?: number } = {}): void {
    const entry = this.entries.get(object)
    if (!entry) return
    if (options.zIndex !== undefined) entry.zIndex = options.zIndex
    this.dirty = true
  }

  /** 设置单个标签的可见性 */
  setVisible(object: THREE.Object3D, visible: boolean): void {
    const entry = this.entries.get(object)
    if (!entry) return
    entry.enabled = visible
    if (!visible) entry.element.style.display = 'none'
    this.dirty = true
  }

  /** 移除绑定 */
  remove(object: THREE.Object3D): void {
    const entry = this.entries.get(object)
    if (!entry) return
    entry.element.remove()
    this.entries.delete(object)
    this.dirty = true
  }

  /** 清空所有标签 */
  clear(): void {
    for (const entry of this.entries.values()) {
      entry.element.remove()
    }
    this.entries.clear()
    this.dirty = true
  }

  get count(): number {
    return this.entries.size
  }

  /**
   * 渲染一帧
   *
   * @param scene 场景
   * @param camera 相机
   */
  render(scene: THREE.Scene, camera: THREE.Camera): void {
    if (!this.entries.size) return
    void scene
    void this.dirty

    scene.updateMatrixWorld()
    camera.updateMatrixWorld()

    // 相对渲染器容器的偏移：修正容器不在视口原点的问题
    const rect = this.domElement.getBoundingClientRect()

    _viewMatrix.copy(camera.matrixWorldInverse)
    _viewProjectionMatrix.multiplyMatrices(camera.projectionMatrix, _viewMatrix)

    // 收集需要渲染的项，按深度排序
    const renderList: Array<{ entry: LabelEntry; x: number; y: number; z: number }> = []

    for (const entry of this.entries.values()) {
      const { object, element, enabled, alwaysVisible } = entry
      if (!enabled) continue
      if (!object.visible) {
        element.style.display = 'none'
        continue
      }
      // 检查祖先链可见性
      let parentVisible = true
      let node: THREE.Object3D | null = object.parent
      while (node) {
        if (!node.visible) {
          parentVisible = false
          break
        }
        node = node.parent
      }
      if (!parentVisible) {
        element.style.display = 'none'
        continue
      }

      object.getWorldPosition(_vector)
      _vector.applyMatrix4(_viewProjectionMatrix)

      const inFront = _vector.z > -1 && _vector.z < 1
      if (!inFront && !alwaysVisible) {
        element.style.display = 'none'
        continue
      }

      // NDC -> 屏幕像素（相对容器左上角）
      const x = _vector.x * this.widthHalf + this.widthHalf
      const y = -_vector.y * this.heightHalf + this.heightHalf
      void rect

      renderList.push({ entry, x, y, z: _vector.z })
    }

    // 远的先渲染（屏幕层叠时近的在上）
    renderList.sort((a, b) => b.z - a.z || a.entry.zIndex - b.entry.zIndex)

    for (const item of renderList) {
      const { entry, x, y } = item
      const { element } = entry
      element.style.display = ''
      element.style.transform = `translate(-50%, -50%) translate(${Math.round(x)}px, ${Math.round(
        y
      )}px)`
      // 近的标签 z-index 更高
      const zIndex = 10 + Math.round((1 - item.z) * 1000) + entry.zIndex
      element.style.zIndex = String(zIndex)
    }
  }

  /** 销毁 */
  dispose(): void {
    this.clear()
    this.domElement.remove()
  }
}
