export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface ThrottleOptions {
  /** 周期开始时立即执行, 默认 true */
  leading?: boolean
  /** 周期结束后补执行最后一次调用, 默认 true */
  trailing?: boolean
}

export interface ThrottledFunction<F extends (...args: any[]) => void> {
  (...args: Parameters<F>): void
  /** 取消未执行的待调用 */
  cancel: () => void
}

/**
 * 节流: throttleMs 内最多执行一次(与 utils/debounce.ts 同源 es-toolkit 风格)
 *
 * @example
 * const onScroll = throttle(updateBar, 200)
 * onScroll()
 * onScroll.cancel()
 */
export function throttle<F extends (...args: any[]) => void>(
  func: F,
  throttleMs: number,
  { leading = true, trailing = true }: ThrottleOptions = {},
): ThrottledFunction<F> {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pendingArgs: Parameters<F> | null = null

  const invoke = () => {
    if (pendingArgs !== null) {
      const args = pendingArgs
      pendingArgs = null
      func(...args)
    }
  }

  const throttled = (...args: Parameters<F>) => {
    pendingArgs = args
    if (timer === null) {
      if (leading) { invoke() }
      timer = setTimeout(() => {
        timer = null
        if (trailing) { invoke() }
      }, throttleMs)
    }
  }

  throttled.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    pendingArgs = null
  }

  return throttled
}
