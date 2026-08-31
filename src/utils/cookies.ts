/**
 * Cookie 处理工具(源自旧项目 utils/cookies.js,按需命名导出)
 */

/**
 * 从带换行的 cookie 原始串提取某一条 cookie(带;结尾)
 * @param cookieRaw set-cookie 原始字符串
 * @param cookieKey cookie 名称,例如 "comment-widget-captcha"
 * @returns 清理换行后的 cookie 片段,没匹配返回 ''
 */
export function extractCookieItem(cookieRaw: string, cookieKey: string): string {
  if (!cookieRaw || !cookieKey)
    return ''

  // 转义正则特殊字符
  const keyEscaped = cookieKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const reg = new RegExp(`${keyEscaped}=[\\s\\S]*?;`)
  const m = cookieRaw.match(reg)
  return m ? m[0].replace(/\r?\n/g, '') : ''
}

/**
 * 获取 header 中指定 key 的值,忽略大小写
 * @param headers HTTP header 对象
 * @param name HTTP header 键名
 * @returns HTTP header 值,没找到返回 ''
 */
export function getHeaderCaseInsensitive(headers: Record<string, string> | undefined, name: string): string {
  if (!headers || typeof headers !== 'object')
    return ''
  const lowerName = name.toLowerCase()
  const key = Object.keys(headers).find(k => k.toLowerCase() === lowerName)
  return key ? headers[key] : ''
}
