import type { Ref } from 'vue'
import { ref } from 'vue'

/** 数据加载四态(取值与旧 DataLoadingStatusEnum 一致,二者可互相兼容) */
export type DataLoadingStatus = 'loading' | 'error' | 'empty' | 'success'

export interface IUseDataLoadingOptions<T> {
  /** 自定义判空;默认:数组看长度、对象看键数、空值视为空 */
  isEmpty?: (data: T) => boolean
  /** 成功回调(数据就绪) */
  onSuccess?: (data: T) => void
  /** 失败回调(run 已捕获异常,不会向外抛出) */
  onError?: (err: unknown) => void
}

export interface IUseDataLoadingReturn<T, P extends unknown[]> {
  data: Ref<T | undefined>
  status: Ref<DataLoadingStatus>
  run: (...args: P) => Promise<T | undefined>
}

/**
 * 数据加载状态机
 * 页面只提供请求函数,loading/empty/success/error 状态由 hook 接管,
 * 取代「手工 ref + try/catch 里逐个搬运状态」的写法。
 *
 * @example
 * const { data, status, run } = useDataLoading(() => getMomentByName(name))
 * onLoad(() => run())
 * onPullDownRefresh(async () => { await run(); uni.stopPullDownRefresh() })
 */
export function useDataLoading<T, P extends unknown[] = []>(
  fetcher: (...args: P) => Promise<T>,
  options: IUseDataLoadingOptions<T> = {},
): IUseDataLoadingReturn<T, P> {
  const { isEmpty, onSuccess, onError } = options

  const data = ref<T | undefined>(undefined) as Ref<T | undefined>
  const status = ref<DataLoadingStatus>('loading')

  function calcEmpty(value: T): boolean {
    if (isEmpty)
      return isEmpty(value)
    if (Array.isArray(value))
      return value.length === 0
    if (value !== null && typeof value === 'object')
      return Object.keys(value).length === 0
    return value === undefined || value === null || value === ''
  }

  async function run(...args: P): Promise<T | undefined> {
    status.value = 'loading'
    try {
      const res = await fetcher(...args)
      data.value = res
      status.value = calcEmpty(res) ? 'empty' : 'success'
      onSuccess?.(res)
      return res
    }
    catch (err) {
      console.error('[useDataLoading] 请求失败', err)
      status.value = 'error'
      onError?.(err)
      return undefined
    }
  }

  return { data, status, run }
}
