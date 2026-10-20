/**
 * 瀑布流双列
 */
import { computed, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'
import { useImageSize } from './useImageSize'

export interface IColumnSplitResult<T> {
  leftColumn: T[]
  rightColumn: T[]
  leftHeight: number
  rightHeight: number
}

/** 双列均衡分列：按顺序逐条放入当前较矮的列 */
export function splitWaterfallColumns<T>(
  items: T[],
  heightOf: (item: T) => number,
  start?: { left: number, right: number },
): IColumnSplitResult<T> {
  const leftColumn: T[] = []
  const rightColumn: T[] = []
  let leftHeight = start?.left ?? 0
  let rightHeight = start?.right ?? 0
  for (const item of items) {
    const h = Math.max(heightOf(item), 0)
    if (leftHeight <= rightHeight) {
      leftColumn.push(item)
      leftHeight += h
    }
    else {
      rightColumn.push(item)
      rightHeight += h
    }
  }
  return { leftColumn, rightColumn, leftHeight, rightHeight }
}

export interface IWaterfallOptions {
  /** 尺寸缺失时的兜底宽高比（高/宽） */
  estimatedAspect?: number
  /** 单张尺寸获取超时（毫秒） */
  sizeTimeout?: number
}

/** 瀑布流双列：预取图片宽高后均衡分列，分页增量续分 */
export function useWaterfallColumns<T extends object>(
  items: Ref<T[]>,
  urlOf: (item: T) => string,
  options: IWaterfallOptions = {},
) {
  const estimatedAspect = options.estimatedAspect ?? 1
  const sizeTimeout = options.sizeTimeout ?? 3000
  const { getCachedSize, fetchImageSize } = useImageSize()

  // 整组替换/拼接,shallowRef 保住泛型 T 的类型
  const leftColumn = shallowRef<T[]>([])
  const rightColumn = shallowRef<T[]>([])

  let assignedList: T[] | null = null
  let assignedCount = 0
  let leftHeight = 0
  let rightHeight = 0
  let gen = 0

  /** 条目显示高度（列宽单位） */
  function heightOf(item: T): number {
    const size = getCachedSize(urlOf(item))
    return size ? size.height / size.width : estimatedAspect
  }

  /** 列表是否沿用上次分列（前缀一致） */
  function isContinuation(list: T[]): boolean {
    if (!assignedList || list.length < assignedCount) {
      return false
    }
    for (let i = 0; i < assignedCount; i++) {
      if (list[i] !== assignedList[i]) {
        return false
      }
    }
    return true
  }

  async function sync() {
    const list = items.value
    const myGen = ++gen
    if (!isContinuation(list)) {
      assignedCount = 0
      leftHeight = 0
      rightHeight = 0
      leftColumn.value = []
      rightColumn.value = []
    }
    assignedList = list
    const newItems = list.slice(assignedCount)
    if (newItems.length === 0) {
      return
    }
    await Promise.all(newItems.map(item => fetchImageSize(urlOf(item), sizeTimeout)))
    if (myGen !== gen || items.value !== list) {
      return
    }
    const result = splitWaterfallColumns(newItems, heightOf, { left: leftHeight, right: rightHeight })
    leftColumn.value = [...leftColumn.value, ...result.leftColumn]
    rightColumn.value = [...rightColumn.value, ...result.rightColumn]
    leftHeight = result.leftHeight
    rightHeight = result.rightHeight
    assignedCount = list.length
  }

  watch(items, sync, { immediate: true })

  /** 条目宽高比（高/宽） */
  function aspectOf(item: T): number {
    return heightOf(item)
  }

  return {
    leftColumn,
    rightColumn,
    columns: computed(() => [leftColumn.value, rightColumn.value]),
    aspectOf,
  }
}
