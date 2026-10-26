/**
 * vis-3x — ChartBase 引用桥
 *
 * `defineChart` / `extendChart` 需要在运行时拿到 `ChartBase` 构造函数，
 * 才能动态生成子类；但 `ChartBase` 又（间接）依赖图表实现，直接互相 import
 * 会形成循环依赖，在 ESM 下会触发
 * `ReferenceError: Cannot access 'X' before initialization`。
 *
 * 因此把这个「引用」单独放到一个没有任何依赖的模块里：
 * - ChartBase 加载尾部调用 `setChartBase()`
 * - registry 通过 `getChartBase()` 读取
 *
 * 这样依赖方向始终是单向的：ChartBase -> bridge <- registry
 */

import type { ChartBase } from './ChartBase'
import type { EngineOptions } from './Engine'

/** ChartBase 构造函数签名 */
export type ChartBaseConstructor = new (
  container: HTMLElement,
  options?: EngineOptions
) => ChartBase

let ChartBaseRef: ChartBaseConstructor | null = null

/** 由 ChartBase 模块在加载完成后注入 */
export function setChartBase(ctor: ChartBaseConstructor): void {
  ChartBaseRef = ctor
}

/**
 * 获取 ChartBase 构造函数
 *
 * @throws 如果 ChartBase 尚未加载（通常意味着导入路径不正确）
 */
export function getChartBase(): ChartBaseConstructor {
  if (!ChartBaseRef) {
    throw new Error(
      '[vis-3x] 内部错误：ChartBase 尚未就绪。' +
        '请确保从 "vis-3x" 或 "vis-3x/core" 主入口导入 defineChart / extendChart。'
    )
  }
  return ChartBaseRef
}
