/**
 * 友链申请文本约定格式（复制/粘贴识别共用）：
 * 首行 -网站友链申请 / -小程序友链申请 为类型标记，
 * 下属每项 --字段名：值（冒号兼容中英文，按首个冒号切分）。
 */
import { checkImageUrl } from '@/utils/url'

export interface ISiteLinkText {
  name: string
  url: string
  logo: string
  linkPageUrl: string
  email: string
  rssUrl: string
  description: string
}

export interface IMiniLinkText {
  displayName: string
  miniProgramCode: string
  appId: string
  path: string
  link: string
  authorName: string
  avatar: string
  website: string
  description: string
  applyRemark: string
  email: string
}

const SITE_HEADER = '-网站友链申请'
const MINI_HEADER = '-小程序友链申请'

/** 网站友链申请文本（总复制输出；空字段行省略，含可选作者信息） */
export function buildSiteLinkText(link: {
  displayName?: string
  url?: string
  logo?: string
  description?: string
  linkPageUrl?: string
  rssUrl?: string
  authorName?: string
  avatar?: string
  website?: string
  email?: string
}): string {
  const rows: string[] = [SITE_HEADER]
  if (link.displayName)
    rows.push(`--名称：${link.displayName}`)
  if (link.url)
    rows.push(`--地址：${link.url}`)
  if (link.logo)
    rows.push(`--Logo：${checkImageUrl(link.logo)}`)
  if (link.linkPageUrl)
    rows.push(`--链接页：${link.linkPageUrl}`)
  if (link.rssUrl)
    rows.push(`--RSS：${link.rssUrl}`)
  if (link.description)
    rows.push(`--描述：${link.description}`)
  if (link.authorName)
    rows.push(`--作者昵称：${link.authorName}`)
  if (link.avatar)
    rows.push(`--作者头像：${checkImageUrl(link.avatar)}`)
  if (link.website)
    rows.push(`--作者网站：${link.website}`)
  if (link.email)
    rows.push(`--作者邮箱：${link.email}`)
  return rows.join('\n')
}

/** 小程序友链申请文本（总复制输出；空字段行省略） */
export function buildMiniLinkText(link: {
  displayName?: string
  miniProgramCode?: string
  appId?: string
  path?: string
  link?: string
  authorName?: string
  avatar?: string
  website?: string
  email?: string
  description?: string
  applyRemark?: string
}): string {
  const rows: string[] = [MINI_HEADER]
  if (link.displayName)
    rows.push(`--应用名称：${link.displayName}`)
  if (link.miniProgramCode)
    rows.push(`--太阳码：${checkImageUrl(link.miniProgramCode)}`)
  if (link.appId)
    rows.push(`--AppID：${link.appId}`)
  if (link.path)
    rows.push(`--路径：${link.path}`)
  if (link.link)
    rows.push(`--应用地址：${link.link}`)
  if (link.authorName)
    rows.push(`--作者昵称：${link.authorName}`)
  if (link.avatar)
    rows.push(`--作者头像：${checkImageUrl(link.avatar)}`)
  if (link.website)
    rows.push(`--作者网站：${link.website}`)
  if (link.email)
    rows.push(`--作者邮箱：${link.email}`)
  if (link.description)
    rows.push(`--应用简介：${link.description}`)
  if (link.applyRemark)
    rows.push(`--申请说明：${link.applyRemark}`)
  return rows.join('\n')
}

/** 识别文本类型：site / mini / null */
export function detectLinkTextKind(text: string): 'site' | 'mini' | null {
  const first = text.trim().split(/\r?\n/)[0]?.trim()
  if (first === SITE_HEADER)
    return 'site'
  if (first === MINI_HEADER)
    return 'mini'
  return null
}

/** 解析 --字段名：值 行为映射 */
function parseRows(text: string): Record<string, string> {
  const map: Record<string, string> = {}
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('--'))
      return
    const body = trimmed.slice(2)
    const idx = body.search(/[：:]/)
    if (idx <= 0)
      return
    const key = body.slice(0, idx).trim()
    const value = body.slice(idx + 1).trim()
    if (key && value)
      map[key] = value
  })
  return map
}

/** 解析网站友链申请文本（非约定格式返回 null） */
export function parseSiteLinkText(text: string): ISiteLinkText | null {
  if (detectLinkTextKind(text) !== 'site')
    return null
  const map = parseRows(text)
  return {
    name: map['名称'] || '',
    url: map['地址'] || '',
    logo: map.Logo || '',
    linkPageUrl: map['链接页'] || '',
    email: map['邮箱'] || map['作者邮箱'] || '',
    rssUrl: map.RSS || '',
    description: map['描述'] || '',
  }
}

/** 解析小程序友链申请文本（非约定格式返回 null；兼容旧版字段名 小程序名称/跳转地址/小程序描述） */
export function parseMiniLinkText(text: string): IMiniLinkText | null {
  if (detectLinkTextKind(text) !== 'mini')
    return null
  const map = parseRows(text)
  return {
    displayName: map['应用名称'] || map['小程序名称'] || '',
    miniProgramCode: map['太阳码'] || '',
    appId: map.AppID || '',
    path: map['路径'] || '',
    link: map['应用地址'] || map['跳转地址'] || '',
    authorName: map['作者昵称'] || '',
    avatar: map['作者头像'] || '',
    website: map['作者网站'] || '',
    email: map['作者邮箱'] || '',
    description: map['应用简介'] || map['小程序描述'] || '',
    applyRemark: map['申请说明'] || '',
  }
}
