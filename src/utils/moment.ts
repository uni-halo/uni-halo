/**
 * 瞬间内容兼容解析工具
 *
 * 瞬间插件（halo-plugin-moments）的 spec.content 存在两种形态：
 * 1. 对象格式（列表/详情接口实际返回的存储格式）：
 *    content = { raw: string, html: string, medium: [{ type, url }] }
 * 2. 数组格式（创建/更新请求体使用的条目格式）：
 *    content = [{ type, content: string, medium: [{ type, url }] }]
 *
 * 注意：对象格式中 raw/html 均为字符串（raw 不是 { content } 对象）。
 */

export interface ExtractedMomentContent {
  /** 原始内容文本（对象格式取 raw，数组格式取条目 content） */
  raw: string
  /** 渲染用 HTML（仅对象格式有） */
  html: string
  /** 图片 URL 列表 */
  photos: string[]
}

/** 兼容解析两种形态的 spec.content */
export function extractMomentContent(content: unknown): ExtractedMomentContent {
  if (!content)
    return { raw: '', html: '', photos: [] }

  const isArray = Array.isArray(content)
  const first: any = isArray ? (content as any[])[0] : content

  const rawVal = isArray ? first?.content : (first as any)?.raw
  const raw = typeof rawVal === 'string' ? rawVal : (rawVal?.content ?? '')
  const html = isArray ? '' : String((first as any)?.html || '')
  const medium = (isArray ? first?.medium : (first as any)?.medium) || []
  const photos = medium
    .filter((m: any) => m?.type === 'PHOTO' && m?.url)
    .map((m: any) => m.url as string)

  return { raw: String(raw || ''), html, photos }
}

/** 剥离 HTML 标签为纯文本（列表卡片摘要展示用） */
export function stripHtmlTags(html: string): string {
  if (!html)
    return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .trim()
}
