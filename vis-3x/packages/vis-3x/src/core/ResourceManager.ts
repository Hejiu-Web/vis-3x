/**
 * vis-3x — 资源管理（几何体 / 材质 / 贴图 的统一创建与销毁）
 *
 * 设计目标：
 * 1. **集中创建**：所有 Three.js 资源经由 ResourceManager 创建，便于统计与销毁。
 * 2. **缓存复用**：相同参数的材质只创建一次，多系列共享可显著降低 draw call 开销。
 * 3. **彻底销毁**：dispose() 会释放几何体、材质、贴图，避免 WebGL 内存泄漏。
 */
import * as THREE from 'three'
import type { ItemStyle } from '../types/style'
import { toThreeColor } from '../utils/color'
import { parseGradient, createGradientTexture } from '../utils/gradient'

/** 材质缓存键的分隔符 */
const SEP = '|'

/** 材质参数的可序列化表示 */
interface MaterialKeyInput {
  color: string
  preset: string
  opacity: number
  roughness: number
  metalness: number
  emissive: string
  emissiveIntensity: number
  transparent: boolean
  side: string
  wireframe: boolean
  flatShading: boolean
  depthTest: boolean
  depthWrite: boolean
  clearcoat: number
  clearcoatRoughness: number
  transmission: number
  ior: number
  thickness: number
  envMapIntensity: number
  map?: string
}

function serializeKey(k: MaterialKeyInput): string {
  return [
    k.color,
    k.preset,
    k.opacity,
    k.roughness,
    k.metalness,
    k.emissive,
    k.emissiveIntensity,
    k.transparent ? 1 : 0,
    k.side,
    k.wireframe ? 1 : 0,
    k.flatShading ? 1 : 0,
    k.depthTest ? 1 : 0,
    k.depthWrite ? 1 : 0,
    k.clearcoat,
    k.clearcoatRoughness,
    k.transmission,
    k.ior,
    k.thickness,
    k.envMapIntensity,
    k.map ?? '',
  ].join(SEP)
}

const SIDE_MAP: Record<string, THREE.Side> = {
  front: THREE.FrontSide,
  back: THREE.BackSide,
  double: THREE.DoubleSide,
}

/**
 * 资源管理器
 *
 * 每个图表实例持有一个，实例销毁时一并释放。
 */
export class ResourceManager {
  private geometries = new Set<THREE.BufferGeometry>()
  private materials = new Set<THREE.Material>()
  private textures = new Set<THREE.Texture>()
  private materialCache = new Map<string, THREE.Material>()
  /** 渐变字符串 -> 渐变贴图，多材质共享 */
  private gradientTextures = new Map<string, THREE.Texture>()
  private disposed = false

  /* ------------------------------ 纹理管理 ------------------------------ */

  /** 创建一个纹理并登记 */
  createTexture(texture: THREE.Texture): THREE.Texture {
    if (this.disposed) return texture
    texture.colorSpace = texture.colorSpace ?? THREE.SRGBColorSpace
    this.textures.add(texture)
    return texture
  }

  /** 创建 Canvas 纹理 */
  createCanvasTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
    this.textures.add(texture)
    return texture
  }

  /** 加载并登记纹理 */
  loadTexture(url: string, onLoad?: (t: THREE.Texture) => void): THREE.Texture {
    const loader = new THREE.TextureLoader()
    const texture = loader.load(url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace
      onLoad?.(t)
    })
    this.textures.add(texture)
    return texture
  }

  /** 手动登记外部创建的纹理 */
  registerTexture(texture: THREE.Texture): THREE.Texture {
    this.textures.add(texture)
    return texture
  }

  /* ------------------------------ 材质管理 ------------------------------ */

  /**
   * 创建（或复用）材质
   *
   * @param color 基础颜色（CSS 字符串、数字，或 `linear-gradient(...)` 渐变字符串）
   * @param style 样式配置
   */
  createMaterial(color: string | number, style?: ItemStyle): THREE.Material {
    const key = this.buildMaterialKey(color, style)
    const cached = this.materialCache.get(key)
    if (cached) return cached

    const material = this.instantiateMaterial(color, style)
    this.materialCache.set(key, material)
    this.materials.add(material)
    return material
  }

  /** 强制创建一个新材质（不复用缓存） */
  createUniqueMaterial(color: string | number, style?: ItemStyle): THREE.Material {
    const material = this.instantiateMaterial(color, style)
    this.materials.add(material)
    return material
  }

  private buildMaterialKey(color: string | number, style?: ItemStyle): string {
    const s = style ?? {}
    return serializeKey({
      color: String(color),
      preset: s.preset ?? 'standard',
      opacity: s.opacity ?? 1,
      roughness: s.roughness ?? 0.35,
      metalness: s.metalness ?? 0.15,
      emissive: String(s.emissive ?? ''),
      emissiveIntensity: s.emissiveIntensity ?? 0,
      transparent: s.transparent ?? (s.opacity !== undefined && s.opacity < 1),
      side: s.side ?? 'front',
      wireframe: s.wireframe ?? false,
      flatShading: s.flatShading ?? false,
      depthTest: s.depthTest ?? true,
      depthWrite: s.depthWrite ?? true,
      clearcoat: s.clearcoat ?? 0,
      clearcoatRoughness: s.clearcoatRoughness ?? 0.1,
      transmission: s.transmission ?? 0,
      ior: s.ior ?? 1.5,
      thickness: s.thickness ?? 0,
      envMapIntensity: s.envMapIntensity ?? 1,
      map: s.map,
    })
  }

  private instantiateMaterial(color: string | number, style?: ItemStyle): THREE.Material {
    const s = style ?? {}
    const preset = s.preset ?? 'standard'
    // 颜色可能是渐变字符串：此时取首色作为材质的 baseColor，
    // 再由 map 贴图提供真正的竖向渐变
    const rawColor = s.color ?? color
    const gradient = parseGradient(rawColor)
    const solidColor = gradient ? gradient.stops[0]?.color : rawColor
    const baseColor = toThreeColor(solidColor)

    // 渐变里的 alpha 需要让材质整体透明
    const gradientMinAlpha = gradient
      ? Math.min(...gradient.stops.map((st) => st.alpha ?? 1))
      : 1
    const opacity = s.opacity ?? 1
    const needsGradientTransparency = gradient !== null && gradientMinAlpha < 1
    const transparent = s.transparent ?? (opacity < 1 || needsGradientTransparency)
    const side = SIDE_MAP[s.side ?? 'front'] ?? THREE.FrontSide
    const emissive = s.emissive !== undefined ? toThreeColor(s.emissive) : undefined

    const common = {
      color: baseColor,
      transparent,
      opacity,
      side,
      wireframe: s.wireframe ?? false,
      depthTest: s.depthTest ?? true,
      depthWrite: s.depthWrite ?? (transparent ? false : true),
    }

    let material: THREE.Material

    switch (preset) {
      case 'basic':
        material = new THREE.MeshBasicMaterial(common)
        break
      case 'lambert':
        material = new THREE.MeshLambertMaterial({
          ...common,
          emissive: emissive ?? new THREE.Color(0x000000),
          emissiveIntensity: s.emissiveIntensity ?? 0,
        })
        break
      case 'toon':
        material = new THREE.MeshToonMaterial({
          ...common,
          emissive: emissive ?? new THREE.Color(0x000000),
          emissiveIntensity: s.emissiveIntensity ?? 0,
        })
        break
      case 'physical':
        material = new THREE.MeshPhysicalMaterial({
          ...common,
          roughness: s.roughness ?? 0.25,
          metalness: s.metalness ?? 0.1,
          flatShading: s.flatShading ?? false,
          clearcoat: s.clearcoat ?? 0,
          clearcoatRoughness: s.clearcoatRoughness ?? 0.1,
          transmission: s.transmission ?? 0,
          ior: s.ior ?? 1.5,
          thickness: s.thickness ?? 0,
          envMapIntensity: s.envMapIntensity ?? 1,
          emissive: emissive ?? new THREE.Color(0x000000),
          emissiveIntensity: s.emissiveIntensity ?? 0,
        })
        break
      case 'standard':
      default:
        material = new THREE.MeshStandardMaterial({
          ...common,
          roughness: s.roughness ?? 0.35,
          metalness: s.metalness ?? 0.15,
          flatShading: s.flatShading ?? false,
          envMapIntensity: s.envMapIntensity ?? 1,
          emissive: emissive ?? new THREE.Color(0x000000),
          emissiveIntensity: s.emissiveIntensity ?? 0,
        })
        break
    }

    // 贴图
    if (s.map) {
      const texture = this.loadTexture(s.map)
      if (s.textureRepeat) {
        texture.wrapS = THREE.RepeatWrapping
        texture.wrapT = THREE.RepeatWrapping
        texture.repeat.set(s.textureRepeat[0], s.textureRepeat[1])
      }
      if (s.textureRotation !== undefined) {
        texture.center.set(0.5, 0.5)
        texture.rotation = s.textureRotation
      }
      const matWithMap = material as THREE.Material & { map?: THREE.Texture | null }
      matWithMap.map = texture
      material.needsUpdate = true
    }

    // 渐变注入：把颜色字符串转成竖向渐变贴图挂到 map 上
    // 这样柱状图、饼图、雷达、漏斗、仪表盘等所有走材质的图表都自动支持渐变，
    // 无需改动各自的几何体构建逻辑。
    if (gradient) {
      const texture = this.getOrCreateGradientTexture(gradient.raw)
      const matWithMap = material as THREE.Material & { map?: THREE.Texture | null }
      matWithMap.map = texture
      // 渐变贴图已包含颜色信息，基色需置白避免被二次相乘
      baseColor.set(0xffffff)
      material.needsUpdate = true
    }

    return material
  }

  /**
   * 按原始渐变字符串缓存渐变贴图
   *
   * 相同渐变的多个材质共享同一张贴图，避免重复生成 Canvas。
   */
  private getOrCreateGradientTexture(raw: string): THREE.Texture {
    const cached = this.gradientTextures.get(raw)
    if (cached) return cached
    const spec = parseGradient(raw)
    if (!spec) {
      // 解析失败兜底：返回 1×1 白色贴图，不改变原有颜色
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, 1, 1)
      }
      const fallback = this.createCanvasTexture(canvas)
      this.gradientTextures.set(raw, fallback)
      return fallback
    }
    const texture = this.createTexture(createGradientTexture(spec))
    this.gradientTextures.set(raw, texture)
    return texture
  }

  /* ------------------------------ 几何体管理 ---------------------------- */

  /** 登记几何体 */
  track<T extends THREE.BufferGeometry>(geometry: T): T {
    if (!this.disposed) this.geometries.add(geometry)
    return geometry
  }

  /**
   * 创建 BoxGeometry
   */
  createBox(
    width: number,
    height: number,
    depth: number,
    segments?: { width?: number; height?: number; depth?: number }
  ): THREE.BoxGeometry {
    const geo = new THREE.BoxGeometry(
      Math.max(width, 1e-6),
      Math.max(height, 1e-6),
      Math.max(depth, 1e-6),
      segments?.width ?? 1,
      segments?.height ?? 1,
      segments?.depth ?? 1
    )
    return this.track(geo)
  }

  /** 创建圆柱几何体 */
  createCylinder(
    radiusTop: number,
    radiusBottom: number,
    height: number,
    radialSegments = 32,
    openEnded = false
  ): THREE.CylinderGeometry {
    const geo = new THREE.CylinderGeometry(
      Math.max(radiusTop, 1e-6),
      Math.max(radiusBottom, 1e-6),
      Math.max(height, 1e-6),
      radialSegments,
      1,
      openEnded
    )
    return this.track(geo)
  }

  /** 创建球体几何体 */
  createSphere(radius: number, segments = 24): THREE.SphereGeometry {
    const geo = new THREE.SphereGeometry(Math.max(radius, 1e-6), segments, segments / 2)
    return this.track(geo)
  }

  /** 创建平面几何体 */
  createPlane(width: number, height: number): THREE.PlaneGeometry {
    const geo = new THREE.PlaneGeometry(Math.max(width, 1e-6), Math.max(height, 1e-6))
    return this.track(geo)
  }

  /** 创建圆几何体 */
  createCircle(radius: number, segments = 48): THREE.CircleGeometry {
    const geo = new THREE.CircleGeometry(Math.max(radius, 1e-6), segments)
    return this.track(geo)
  }

  /** 创建圆环几何体 */
  createRing(inner: number, outer: number, segments = 64, thetaLength = Math.PI * 2): THREE.RingGeometry {
    const geo = new THREE.RingGeometry(
      Math.max(inner, 1e-6),
      Math.max(outer, 1e-6),
      segments,
      1,
      0,
      thetaLength
    )
    return this.track(geo)
  }

  /** 登记自定义几何体 */
  trackGeometry<T extends THREE.BufferGeometry>(geometry: T): T {
    return this.track(geometry)
  }

  /* ------------------------------ 释放 ---------------------------------- */

  /** 释放单个几何体 */
  disposeGeometry(geometry: THREE.BufferGeometry): void {
    this.geometries.delete(geometry)
    geometry.dispose()
  }

  /** 释放单个材质 */
  disposeMaterial(material: THREE.Material): void {
    this.materials.delete(material)
    for (const key of Object.keys(this.materialCache)) {
      if (this.materialCache.get(key) === material) this.materialCache.delete(key)
    }
    material.dispose()
  }

  /**
   * 释放一个 Object3D 子树中的几何体与材质
   *
   * 注意：材质可能被缓存复用，因此这里只从场景移除，
   * 真正的释放统一在 dispose() 中完成。
   */
  releaseSubtree(root: THREE.Object3D): void {
    root.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (mesh.geometry) this.geometries.delete(mesh.geometry as THREE.BufferGeometry)
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const m of mats) this.materials.delete(m)
      }
    })
  }

  /** 强制释放整个子树（不走缓存，用于动态生成的临时对象） */
  disposeSubtree(root: THREE.Object3D): void {
    root.traverse((object) => {
      const mesh = object as THREE.Mesh & { isLight?: boolean }
      if (mesh.geometry) {
        this.geometries.delete(mesh.geometry as THREE.BufferGeometry)
        ;(mesh.geometry as THREE.BufferGeometry).dispose()
      }
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const m of mats) {
          this.materials.delete(m)
          m.dispose()
        }
      }
    })
  }

  /** 清空材质缓存（数据变更时可调用，避免缓存无限增长） */
  clearMaterialCache(): void {
    for (const material of this.materialCache.values()) {
      this.materials.delete(material)
      material.dispose()
    }
    this.materialCache.clear()
  }

  /** 统计信息（调试用） */
  stats(): { geometries: number; materials: number; textures: number; cached: number } {
    return {
      geometries: this.geometries.size,
      materials: this.materials.size,
      textures: this.textures.size,
      cached: this.materialCache.size,
    }
  }

  /** 释放全部资源 */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const geometry of this.geometries) geometry.dispose()
    for (const material of this.materials) material.dispose()
    for (const texture of this.textures) texture.dispose()
    this.geometries.clear()
    this.materials.clear()
    this.textures.clear()
    this.materialCache.clear()
    this.gradientTextures.clear()
  }

  get isDisposed(): boolean {
    return this.disposed
  }
}
