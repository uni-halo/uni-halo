/**
 * 互动增强插件 UC(用户中心)装扮 API 类型定义
 * 对应 src/api/halo-plugin-third/interaction-plus-uc.ts
 */
import type { DecorationType, IIdentityMark } from './interaction-plus'

/**
 * 装饰素材引用
 */
export interface IDecorationAssetRef {
  /** 素材访问地址 */
  url?: string
  /** 媒体类型(如 image/png) */
  mediaType?: string
  /** 宽度(像素) */
  width?: number
  /** 高度(像素) */
  height?: number
  /** 文件大小(字节) */
  sizeBytes?: number
  [key: string]: unknown
}

/**
 * 装饰类型扩展字段(称号文案/昵称颜色等)
 */
export interface IDecorationPayload {
  /** 称号名称(type=title) */
  titleText?: string
  /** 称号文字色(#RGB/#RRGGBB/#RRGGBBAA) */
  titleColor?: string
  /** 称号背景色 */
  titleBackground?: string
  /** 称号背景第二色(与背景色组成渐变) */
  titleBackgroundSecondary?: string
  /** 昵称样式配置(type=name_style) */
  nameStyle?: {
    /** solid=纯色 / gradient=渐变 */
    mode?: 'solid' | 'gradient' | string
    /** 颜色列表:纯色 1 个,渐变 2-3 个 */
    colors?: string[]
    [key: string]: unknown
  }
  [key: string]: unknown
}

/**
 * 库存项状态
 */
export type DecorationInventoryStatus = 'available' | 'expired' | 'revoked' | 'disabled'

/**
 * 我的装饰库存项(GET /inventory)
 */
export interface IDecorationInventoryItem {
  /** 授予记录内部名 */
  grantName?: string
  /** 装饰资产内部名(佩戴保存时使用) */
  assetName?: string
  /** 装饰类型 */
  type: DecorationType
  /** 装饰显示名 */
  displayName?: string
  /** 描述 */
  description?: string
  /** 素材引用 */
  asset?: IDecorationAssetRef
  /** 类型扩展字段 */
  payload?: IDecorationPayload
  /** 分类内部名 */
  categoryName?: string
  /** 标签内部名列表 */
  tagNames?: string[]
  /** 稀有度内部名 */
  rarityName?: string
  /** 状态 */
  status: DecorationInventoryStatus
  /** 是否可佩戴 */
  available: boolean
  /** 获得时间(ISO 8601) */
  grantedAt?: string
  /** 到期时间(ISO 8601);空表示永久 */
  expiresAt?: string | null
  [key: string]: unknown
}

/**
 * 失效佩戴项(GET /profile 的 invalidItems)
 */
export interface IInvalidEquipItem {
  /** 槽位名(avatarFrame/title/primaryBadge/badgeShowcase/cardBackground/nameStyle) */
  slot?: string
  /** 装饰资产内部名 */
  assetName?: string
  [key: string]: unknown
}

/**
 * 当前佩戴视图(GET /profile)
 * 各槽位字段为装饰资产内部名;佩戴失效项时该名不在可用库存中
 */
export interface IDecorationProfileView {
  avatarFrame?: string | null
  title?: string | null
  primaryBadge?: string | null
  /** 展示勋章(≤8 个) */
  badgeShowcase: string[]
  cardBackground?: string | null
  nameStyle?: string | null
  /** 当前佩戴中已失效的槽位明细 */
  invalidItems: IInvalidEquipItem[]
  /** 当前生效的身份标识(角色映射,只读) */
  identityMarks: IIdentityMark[]
  /** 是否公开展示装扮墙;空视为公开 */
  publicDecorationsVisible?: boolean | null
  [key: string]: unknown
}

/**
 * 保存佩戴请求体(PUT /profile)
 * 全量提交:未传/为 null 的槽位视为取下;字段值为装饰资产内部名
 */
export interface IDecorationProfileSaveReq {
  avatarFrame?: string | null
  title?: string | null
  primaryBadge?: string | null
  badgeShowcase?: string[]
  cardBackground?: string | null
  nameStyle?: string | null
}

/**
 * 装扮墙可见性请求体(PUT /profile/visibility)
 */
export interface IDecorationVisibilityReq {
  /** 是否公开展示装扮墙 */
  publicDecorationsVisible: boolean
}
