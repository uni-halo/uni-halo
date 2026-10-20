/**
 * 公告链接跳转解析(纯函数)
 *
 * 按「链接类型 × 运行端 × 小程序资质类型」解析出统一的跳转动作与按钮文案:
 * - internal 内部页面 → uni.navigateTo
 * - miniapp 小程序链接 → 仅微信小程序端 navigateToMiniProgram(path 空=首页)
 * - external 外部链接 / wechat-mp 微信公众号文章 → App 端企业资质走内部 webview,
 *   其余(个人资质/未配置/非 App 端)保守回退复制链接(H5 直接打开)
 * - none / 链接字段为空 → 不展示跳转入口
 *
 * 文案永远描述本次点击的真实动作(「复制」不隐瞒、打开即「打开」)。
 * 平台由调用侧经条件编译注入(uniapp 条件编译不能进纯函数)。
 */

/** 公告链接类型(与插件端 Notice.spec.linkType 一致) */
export type NoticeLinkType = 'none' | 'external' | 'miniapp' | 'internal' | 'wechat-mp'

/** 运行端 */
export type NoticePlatform = 'app' | 'mp-weixin' | 'h5'

/** 链接实际执行行为 */
export type NoticeLinkBehavior = 'internal' | 'miniapp' | 'webview' | 'h5-open' | 'copy'

/** 公告链接字段(Notice.spec 中与链接相关的子集) */
export interface NoticeLinkEntry {
  linkType?: string
  link?: string
  linkAppId?: string
  linkPath?: string
}

/** 解析输入 */
export interface NoticeLinkInput {
  entry: NoticeLinkEntry
  /** 当前运行端(调用侧条件编译注入) */
  platform: NoticePlatform
  /** 小程序资质类型(插件端 appInfo.qualification:personal/enterprise;仅 App 端打开策略消费) */
  qualification?: string
}

/** 解析结果 */
export interface NoticeLinkAction {
  /** 是否展示跳转入口 */
  visible: boolean
  /** 执行行为(visible=false 时为空) */
  behavior?: NoticeLinkBehavior
  /** 入口按钮文案(=本次点击的真实动作) */
  text: string
}

/** 链接类型归一:显式值优先,历史数据(linkType 空)按 link 非空回退 external,无链接为 none */
function resolveType(raw: string | undefined, link: string): NoticeLinkType {
  if (raw === 'external' || raw === 'miniapp' || raw === 'internal' || raw === 'wechat-mp')
    return raw
  if (raw === 'none')
    return 'none'
  return link ? 'external' : 'none'
}

function hidden(): NoticeLinkAction {
  return { visible: false, text: '' }
}

export function resolveNoticeLink({ entry, platform, qualification = '' }: NoticeLinkInput): NoticeLinkAction {
  const link = entry.link || ''
  const type = resolveType(entry.linkType, link)

  if (type === 'none')
    return hidden()

  if (type === 'internal') {
    return link
      ? { visible: true, behavior: 'internal', text: '查看相关页面' }
      : hidden()
  }

  if (type === 'miniapp') {
    // App/H5 不支持跳转小程序,不展示入口
    if (platform !== 'mp-weixin')
      return hidden()
    return entry.linkAppId
      ? { visible: true, behavior: 'miniapp', text: '打开小程序' }
      : hidden()
  }

  // external / wechat-mp:均需 link
  if (!link)
    return hidden()

  const isMpArticle = type === 'wechat-mp'
  if (platform === 'app') {
    // App 端企业资质走内部 webview;个人资质/未配置保守复制链接
    if (qualification === 'enterprise') {
      return { visible: true, behavior: 'webview', text: isMpArticle ? '打开公众号文章' : '打开网页' }
    }
    return { visible: true, behavior: 'copy', text: isMpArticle ? '复制公众号链接' : '复制链接地址' }
  }
  if (platform === 'h5') {
    return { visible: true, behavior: 'h5-open', text: isMpArticle ? '打开公众号文章' : '打开链接' }
  }
  // 微信小程序端:公众号域名/外站域名需配业务域名,保守复制
  return { visible: true, behavior: 'copy', text: isMpArticle ? '复制公众号链接' : '复制链接地址' }
}
