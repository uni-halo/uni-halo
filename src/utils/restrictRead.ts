/**
 * 受限阅读工具
 * 处理笔记受限内容(密码/验证码/登录/付费/评论)的检测与占位符替换
 */
import type { IPost } from '@/api/types/halo'

/** 受限阅读占位符 */
const RESTRICT_READ_PLACEHOLDER = 'restrict-read-placeholder'

/** 复制文本到剪贴板(旧 utils/index.js copyText) */
export function copyToClipboard(content: string, tips = '内容已复制成功！') {
  uni.setClipboardData({
    data: content,
    showToast: false,
    success: () => {
      uni.showToast({ icon: 'none', title: tips })
    },
  })
}

/** 转义字符串用于正则表达式 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 判断字符串去除 HTML 标签后是否为空 */
function isHtmlEmpty(html: string): boolean {
  return !html || !html.replace(/<[^>]+>/g, '').trim()
}

/**
 * 检查笔记是否受限
 * @param post 笔记对象
 * @returns 是否受限
 */
export function checkPostRestrictRead(post: IPost): boolean {
  const annotations = post?.metadata?.annotations
  const restrictReadEnable = annotations?.restrictReadEnable

  if (restrictReadEnable === 'false' || !restrictReadEnable)
    return false

  const restrictType = restrictReadEnable
  const raw = post.content?.raw || ''

  const startTag = `<!-- ${restrictType}:restrict-read-html-tpl start -->`
  const endTag = `<!-- ${restrictType}:restrict-read-html-tpl end -->`

  // 使用正则模糊匹配(允许前后有空白字符)
  const startRegex = new RegExp(`\\s*${escapeRegExp(startTag)}\\s*`)
  const endRegex = new RegExp(`\\s*${escapeRegExp(endTag)}\\s*`)

  return startRegex.test(raw) && endRegex.test(raw)
}

/**
 * 替换受限内容
 * @param post 笔记对象
 * @param replacement 替换内容,默认空字符串
 * @returns 替换后的 raw 文本
 */
export function replaceRestrictedContent(post: IPost, replacement = ''): string {
  const annotations = post?.metadata?.annotations
  const restrictReadEnable = annotations?.restrictReadEnable

  if (restrictReadEnable === 'false' || !restrictReadEnable)
    return post.content?.raw || ''

  const restrictType = restrictReadEnable
  const raw = post.content?.raw || ''

  const startTag = `<!-- ${restrictType}:restrict-read-html-tpl start -->`
  const endTag = `<!-- ${restrictType}:restrict-read-html-tpl end -->`

  const startRegex = new RegExp(`\\s*${escapeRegExp(startTag)}\\s*`, 'g')
  const endRegex = new RegExp(`\\s*${escapeRegExp(endTag)}\\s*`, 'g')

  // 构造完整匹配的正则
  const pattern = `${startRegex.source}(.*?)${endRegex.source}`
  const regex = new RegExp(pattern, 'gs')

  return raw.replace(regex, replacement)
}

/**
 * 获取可展示的 HTML 内容块
 * @param post 笔记对象
 * @returns 分割后的 HTML 片段数组
 */
export function getShowableContent(post: IPost): string[] {
  const restrictEnabled = checkPostRestrictRead(post)
  const rawContent = post?.content?.raw || ''

  // 替换受限内容为占位符
  const processedContent = restrictEnabled
    ? replaceRestrictedContent(post, RESTRICT_READ_PLACEHOLDER)
    : rawContent

  // 按占位符分割内容
  const contentFragments = processedContent
    .split(RESTRICT_READ_PLACEHOLDER)
    .map(fragment => fragment.trim())
    .filter(fragment => fragment.length > 0)

  // 移除最后一个元素如果它只包含 HTML 标签而无实际文本
  if (contentFragments.length > 0 && isHtmlEmpty(contentFragments[contentFragments.length - 1])) {
    contentFragments.pop()
  }

  return contentFragments
}

/**
 * 获取受限阅读类型名称
 * @param post 笔记对象
 * @returns 类型名称(密码/验证码/登录/付费/评论)
 */
export function getRestrictReadTypeName(post: IPost): string {
  const annotations = post?.metadata?.annotations
  const restrictReadEnable = annotations?.restrictReadEnable

  if (restrictReadEnable === 'false' || !restrictReadEnable)
    return ''
  if (restrictReadEnable === 'password')
    return '密码'
  if (restrictReadEnable === 'code')
    return '验证码'
  if (restrictReadEnable === 'login')
    return '登录'
  if (restrictReadEnable === 'pay')
    return '付费'
  if (restrictReadEnable === 'comment')
    return '评论'
  return ''
}
