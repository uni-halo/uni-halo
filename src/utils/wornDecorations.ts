/**
 * 互动增强佩戴装饰 → 展示槽位（纯函数，无副作用）
 *
 * 将互动增强插件的 IPublicIdentity（含佩戴装饰与站点展示策略）拆解为
 * 组件可直接消费的 {visible, ...} 槽位对象；所有门控（插件可用性/审核模式/
 * 站点全局开关）由 identity store 的 enabled 承担，此处只做单用户维度的裁剪：
 * 策略开关（display.userCard.*）、素材 URL 合法性、字段存在性。
 *
 * 语义对齐 user-profile 试点：
 * - 头像框/主勋章：素材 URL 合法 且 display.userCard.showXxx 为真值（未配置视为关闭）
 * - 称号：佩戴 且 display.userCard.showTitle 为真值；样式由颜色字段组合 CSS
 * - 名片背景：素材 URL 合法即可（不受 userCard 策略裁剪，跟随试点行为）
 */
import type { IDecorationItem, IIdentityMark, INameStyleDecoration, IPublicIdentity, ITitleDecoration } from '@/api/types/halo-plugin-third/interaction-plus'

/**
 * 素材地址校验（装饰素材由互动增强插件下发，均为绝对地址）：
 * 仅接受 http(s)/协议相对/data: 形式；其余（含空值/相对路径）视为非法返回空串。
 */
function normalizeAssetUrl(url?: string): string {
  if (!url) { return '' }
  return /^(?:https?:)?\/\//.test(url) || url.startsWith('data:') ? url : ''
}

/** 图片类槽位（头像框/主勋章/名片背景） */
export interface IWornImageSlot {
  visible: boolean
  url: string
  /** 原始装饰数据，包含所有字段 */
  data: IDecorationItem
}

/** 称号槽位 */
export interface IWornTitleSlot {
  visible: boolean
  /** 称号原文（titleText），恒非空（visible 时） */
  text: string
  /** 称号样式 CSS（背景/渐变 + 文字色），直接绑定 :style */
  style: string
  /** 原始装饰数据，包含所有字段 */
  data: IDecorationItem
}

/** 昵称样式槽位 */
export interface IWornNameStyleSlot {
  visible: boolean
  /** 昵称样式 CSS（渐变文字挖空/纯色），直接绑定 :style */
  style: string
}

/** 单用户全部展示槽位（无数据时各槽位 visible=false，调用方零防御） */
export interface IWornSlots {
  avatarFrame: IWornImageSlot
  primaryBadge: IWornImageSlot
  title: IWornTitleSlot
  cardBackground: IWornImageSlot
  nameStyle: IWornNameStyleSlot
}

/** 称号样式 CSS（背景支持 135° 渐变第二色；文字色可空继承正文） */
export function titleStyleCss(title: ITitleDecoration): string {
  const bg = title.titleBackgroundSecondary
    ? `linear-gradient(135deg,${title.titleBackground},${title.titleBackgroundSecondary})`
    : title.titleBackground
  return `${bg ? `background-image:${bg};` : ''}${title.titleColor ? `color:${title.titleColor}` : ''}`
}

/** 昵称样式配置 → CSS（gradient 渐变文字 / solid 纯色；无配置返回空串） */
function nameStyleRuleCss(ns?: { mode?: string, colors?: string[], color?: string }): string {
  if (!ns) { return '' }
  if (ns.mode === 'gradient' && ns.colors?.length) {
    return `background-image:linear-gradient(135deg,${ns.colors.join(',')});-webkit-background-clip:text;background-clip:text;color:transparent`
  }
  const solid = ns.color || (ns.mode === 'solid' ? ns.colors?.[0] : '')
  return solid ? `color:${solid}` : ''
}

/** 昵称样式 CSS 文字单色或者渐变 */
export function nicknameStyleCss(item: ITitleDecoration | INameStyleDecoration): string {
  return nameStyleRuleCss((item as INameStyleDecoration).nameStyle)
}

/** 身份标识样式 CSS 边框加文字颜色 */
export function identityMarksStyleCss(mark: IIdentityMark): string {
  return `border-color:${mark.color};color:${mark.color};`
}

/**
 * 构建单用户展示槽位（identity 为空/装饰缺失时各槽位 visible=false）
 */
export function buildWornSlots(identity: IPublicIdentity | null | undefined): IWornSlots {
  const worn = identity?.decorations || {}
  const userCard = (identity?.display?.userCard || {}) as Record<string, unknown>
  const identityLine = identity?.display?.identityLine || {}
  const nameStyleCss = nameStyleRuleCss(worn.nameStyle?.nameStyle)

  const frameUrl = normalizeAssetUrl(worn.avatarFrame?.url || '')
  const badgeUrl = normalizeAssetUrl(worn.primaryBadge?.url || '')
  const cardBgUrl = normalizeAssetUrl(worn.cardBackground?.url || '')
  const title = worn.title || null

  return {
    avatarFrame: {
      visible: true,
      url: frameUrl,
      data: worn.avatarFrame,
    },
    primaryBadge: {
      visible: !!badgeUrl && !!userCard.showPrimaryBadge,
      url: badgeUrl,
      data: worn.primaryBadge,
    },
    title: {
      visible: !!title && !!userCard.showTitle,
      text: title?.titleText || '',
      style: title ? titleStyleCss(title) : '',
      data: worn.title,
    },
    cardBackground: {
      visible: !!cardBgUrl,
      url: cardBgUrl,
      data: worn.cardBackground,
    },
    nameStyle: {
      visible: !!nameStyleCss && !!identityLine.showNameStyle,
      style: identityLine.showNameStyle ? nameStyleCss : '',
    },
  }
}

/**
 * 昵称样式 CSS（nameStyle：gradient 渐变文字 / solid 纯色；无样式返回空串）
 */
export function nameStyleCssOf(identity: IPublicIdentity | null | undefined): string {
  return nameStyleRuleCss(identity?.decorations?.nameStyle?.nameStyle)
}
