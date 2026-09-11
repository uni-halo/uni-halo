/**
 * 时间格式化工具
 * 支持格式化 yyyy年MM月dd日 HH点mm分ss秒 星期w q季
 * 兼容对象形式传入 { d: '2021-06-04', f: 'yyyy年' }(d 必传,f 默认 yyyy-MM-dd HH:mm:ss)
 */

export type FormatTimeInput = string | number | Date | { d: string | number | Date, f?: string }

/**
 * 时间格式化
 * @param data 时间戳/日期字符串,或 { d, f } 对象
 * @returns 格式化后的时间字符串
 */
export function formatTime(data: FormatTimeInput): string {
  let dateTime = new Date(data as string | number | Date)
  let fmt = 'yyyy-MM-dd HH:mm:ss'

  // 对象形式传参:uniapp filter 不支持多参数,用对象传 { d, f }
  if (dateTime.toString() === 'Invalid Date') {
    if (typeof data === 'object' && data !== null && !(data instanceof Date)) {
      const { d, f } = data
      if (d == null || d === '') {
        console.error('日期参数不正确，传入的参数列表：', data)
        return ''
      }
      dateTime = new Date(d)
      if (dateTime.toString() === 'Invalid Date') {
        console.error('日期参数不正确，传入的参数列表：', data)
        return '111'
      }
      if (Object.prototype.hasOwnProperty.call(data, 'f')) {
        fmt = f || fmt
      }
    }
    else {
      console.error('日期参数不正确，传入的参数列表：', data)
      return ''
    }
  }

  const weekDays = ['日', '一', '二', '三', '四', '五', '六']
  const seasons = ['冬', '春', '夏', '秋']
  const o: Record<string, number | string> = {
    'M+': dateTime.getMonth() + 1, // 月份
    'd+': dateTime.getDate(), // 日
    'H+': dateTime.getHours(), // 小时
    'm+': dateTime.getMinutes(), // 分
    's+': dateTime.getSeconds(), // 秒
    'w+': weekDays[dateTime.getDay()], // 星期几
    'q+': seasons[Math.floor((dateTime.getMonth() + 3) / 3)], // 季度
    'S': dateTime.getMilliseconds(), // 毫秒
  }

  const yMatch = fmt.match(/(y+)/)
  if (yMatch) {
    fmt = fmt.replace(yMatch[0], (`${dateTime.getFullYear()}`).substr(4 - yMatch[0].length))
  }
  for (const k in o) {
    const match = fmt.match(new RegExp(`(?:${k})`))
    if (match) {
      fmt = fmt.replace(match[0], match[0].length === 1
        ? String(o[k])
        : (`00${o[k]}`).substr(String(o[k]).length))
    }
  }
  return fmt
}
