/**
 * 文本工具:HTML 剥离为纯文本 + 摘要截断
 * 跨端实现(小程序无 DOM),仅用正则处理,不依赖 DOMParser
 */

/** HTML 实体解码(覆盖常见实体即可) */
const HTML_ENTITY_MAP: Record<string, string> = {
  '&nbsp;': ' ',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': '\'',
  '&amp;': '&',
}

/** 行首 markdown 标记(# 标题 / * - 列表 / 数字序号 / 引用 > / 代码块 ``` 等) */
const MD_PREFIX_REG = /^\s{0,3}(#{1,6}[ \t]|>|[+*-][ \t]|\d+[.、)][ \t]|```|~~~|!?\[)/gm

/**
 * 将 HTML/Markdown 源文本剥离为压缩空白后的纯文本
 * @param source 原文(可为空)
 */
export function htmlToPlainText(source?: string): string {
  if (!source)
    return ''
  let text = source
  // 剥离脚本/样式块
  text = text.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
  // 块级/换行标签替换为空格,其余标签整体剥离
  text = text
    .replace(/<\/(p|div|br|li|h[1-6]|blockquote|pre|tr|section|article)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
  // markdown 行首符号清理
  text = text.replace(MD_PREFIX_REG, '')
  // 实体解码
  text = text.replace(/&[a-z]+;|&#\d+;/gi, match => HTML_ENTITY_MAP[match.toLowerCase()] ?? ' ')
  // 压缩空白(含换行)
  return text.replace(/\s+/g, ' ').trim()
}

/** 截断文本,超长追加省略号 */
export function truncateText(text: string, max: number, ellipsis = '…'): string {
  if (!text || text.length <= max)
    return text
  return `${text.slice(0, max).trimEnd()}${ellipsis}`
}

/** 从 HTML/Markdown 源提取纯文本摘要(去标签 + 截断) */
export function extractPlainExcerpt(source?: string, max = 120): string {
  return truncateText(htmlToPlainText(source), max)
}
