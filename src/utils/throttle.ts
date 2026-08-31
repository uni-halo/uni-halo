/**
 * 节流工具(源自旧项目 utils/throttle.js,按需命名导出)
 * 首次立即执行,之后在 wait 时间窗口内最多执行一次
 */
let timer: ReturnType<typeof setTimeout> | null = null
let flag = false

/**
 * 节流函数
 * @param fn 待执行函数
 * @param wait 节流间隔(毫秒),默认 1000
 */
export function throttle(fn: (...args: unknown[]) => void, wait = 1000) {
  return function (this: unknown, ...args: unknown[]) {
    if (flag)
      return
    flag = true
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => {
      flag = false
      fn.apply(this, args)
    }, wait)
  }
}
