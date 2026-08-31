/**
 * URL 参数工具(源自旧项目 utils/url.params.js,按需命名导出)
 */

/**
 * 对象转换为 url 参数形式
 * @param param 将要转换为 URL 参数的字符串对象
 * @param key URL 参数字符串的前缀
 * @param encode 是否进行 URL 编码,默认 true
 */
export function jsonToUrlParams(param: unknown, key?: string, encode?: boolean): string {
  if (param == null)
    return ''
  let paramStr = ''
  const t = typeof param
  if (t === 'string' || t === 'number' || t === 'boolean') {
    paramStr += `&${key}=${encode == null || encode ? encodeURIComponent(String(param)) : String(param)}`
  }
  else {
    for (const i in param as Record<string, unknown>) {
      const k = key == null ? i : key + (Array.isArray(param) ? `[${i}]` : `.${i}`)
      paramStr += jsonToUrlParams((param as Record<string, unknown>)[i], k, encode)
    }
  }
  return paramStr
}

/** 过滤空值数组 */
function cleanArray(actual: string[]): string[] {
  return actual.filter(Boolean)
}

/**
 * json 对象转 Url 参数
 * @param json 参数对象
 */
export function jsonToUrlParams2(json: Record<string, unknown> | null | undefined): string {
  if (!json)
    return ''
  return cleanArray(
    Object.keys(json).map((key) => {
      if (json[key] === undefined)
        return ''
      return `${encodeURIComponent(key)}=${encodeURIComponent(String(json[key]))}`
    }),
  ).join('&')
}

/**
 * 仅获取域名
 * @param url 完整地址
 */
export function getDomainOnly(url: string): string {
  return url.replace(/^(https?:\/\/)/, '').split('/')[0]
}
