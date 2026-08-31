/**
 * plugin-uni-halo 自定义接口 / 三方插件 API 类型定义
 * 对应 src/api/uni-halo.ts(plugin-uni-halo 自身接口 + 三方插件)
 */

/* ---------- plugin-uni-halo 应用配置 ---------- */

/** 图片相关配置 */
export interface IImagesConfig {
  defaultThumbnailUrl?: string
  defaultStaticThumbnailUrl?: string
  defaultImageUrl?: string
  defaultAvatarUrl?: string
  [key: string]: unknown
}

/** 插件配置(toolsPlugin/linksSubmitPlugin 等带 Authorization) */
export interface IPluginConfig {
  votePlugin?: Record<string, unknown>
  toolsPlugin?: { Authorization?: string } & Record<string, unknown>
  linksPlugin?: Record<string, unknown>
  linksSubmitPlugin?: { Authorization?: string } & Record<string, unknown>
  doubanPlugin?: { position?: string } & Record<string, unknown>
  [key: string]: unknown
}

/** 首页配置(banner 等) */
export interface IBannerConfig {
  enabled?: boolean
  showTitle?: boolean
  showIndicator?: boolean
  height?: string
  dotPosition?: string
  type?: string
  list?: unknown[]
}

export interface IPageConfig {
  homeConfig?: {
    pageTitle?: string
    useCategory?: boolean
    /** 是否显示快捷导航(首页) */
    useQuickNavigation?: boolean
    bannerConfig?: IBannerConfig
  }
  categoryConfig?: { type?: string }
  momentConfig?: { useTagRandomColor?: boolean }
  galleryConfig?: { pageTitle?: string }
  aboutConfig?: {
    bgImageUrl?: string
    waveImageUrl?: string
  }
  [key: string]: unknown
}

/** 审计模式配置 */
export interface IAuditConfig {
  auditModeEnabled?: boolean
  auditModeData?: {
    jsonUrl?: string
    jsonData?: string
  }
}

/** 应用基础配置(对应旧 DefaultAppConfigs) */
export interface IAppConfig {
  basicConfig?: {
    tokenConfig?: {
      personalToken?: string
    }
  }
  loveConfig?: Record<string, unknown>
  imagesConfig?: IImagesConfig
  authorConfig?: Record<string, unknown>
  appConfig?: Record<string, unknown>
  pluginConfig?: IPluginConfig
  pageConfig?: IPageConfig
  auditConfig?: IAuditConfig
  [key: string]: unknown
}

/** Halo 全局配置(对应旧 DefaultHaloGlobalConfigs,/actuator/globalinfo) */
export interface IHaloGlobalConfig {
  allowAnonymousComments?: boolean
  allowRegistration?: boolean
  mustVerifyEmailOnRegistration?: boolean
  mustVerifyPhoneOnRegistration?: boolean
  restrictRegistrationDomain?: boolean
  shopDisabled?: boolean
  [key: string]: unknown
}

/** 审计模式模拟数据 */
export type IMockJson = Record<string, unknown>

/* ---------- plugin-uni-halo 二维码 / 检查更新 ---------- */

export interface IQRCodeInfo {
  [key: string]: unknown
}

export interface IQRCodeImg {
  [key: string]: unknown
}

/** 检查更新结果(uhalo-upgrade 对接) */
export interface IUpdateCheckRes {
  code: number
  message: string
  url?: string
  title?: string
  contents?: string
  is_mandatory?: boolean
  is_silently?: boolean
  type?: 'wgt' | 'apk' | 'ipa'
  platform?: string[]
  version?: string
  [key: string]: unknown
}

/* ---------- 受限阅读(tools.muyin.site) ---------- */

export type RestrictReadType = 'password' | 'code' | 'login' | 'pay' | 'comment'

/** 受限阅读校验请求 */
export interface IRestrictReadCheckReq {
  code: string
  templateType: 'post'
  restrictType: RestrictReadType
  keyId: string
}

export interface IRestrictReadCheckRes {
  success?: boolean
  [key: string]: unknown
}

/** 验证码创建结果 */
export interface IVerificationCodeRes {
  code?: string
  [key: string]: unknown
}

/* ---------- 友链提交(linkssubmit.muyin.site) ---------- */

export interface ISubmitLinkForm {
  name?: string
  url?: string
  logo?: string
  description?: string
  email?: string
  [key: string]: unknown
}

export interface ILinkSubmitRes {
  success?: boolean
  message?: string
  [key: string]: unknown
}

/* ---------- 投票(api.vote.kunkunyu.com) ---------- */

export interface IVoteListReq {
  page?: number
  size?: number
  [key: string]: unknown
}

export interface IVoteItem {
  name: string
  title: string
  description?: string
  [key: string]: unknown
}

export type IVoteListRes = IVoteItem[]

export interface IVote {
  name: string
  title: string
  description?: string
  options?: IVoteOption[]
  [key: string]: unknown
}

export interface IVoteOption {
  name?: string
  label?: string
  count?: number
  [key: string]: unknown
}

export interface IVoteUser {
  [key: string]: unknown
}

export type IVoteUserListRes = IVoteUser[]

/** 提交投票 */
export interface IVoteSubmitReq {
  optionName?: string
  [key: string]: unknown
}

export interface IVoteSubmitRes {
  success?: boolean
  [key: string]: unknown
}

/* ---------- 豆瓣(api.douban.moony.la) ---------- */

export interface IDoubanDetail {
  title?: string
  poster?: string
  rating?: string
  year?: string
  [key: string]: unknown
}

/* ---------- 评论组件(api.commentwidget.halo.run) ---------- */

export interface ICommentWidgetConfig {
  [key: string]: unknown
}

/** 评论验证码 */
export interface ICommentCaptcha {
  [key: string]: unknown
}

/* ---------- 恋爱模块(plugin-uni-halo love) ---------- */

export interface ILoveConfig {
  /** 纪念日 */
  anniversary?: string
  /** 恋人信息 */
  lovers?: {
    name?: string
    avatar?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface ILoveAlbum {
  name?: string
  title?: string
  /** 相册展示名(接口返回 displayName) */
  displayName?: string
  description?: string
  locked?: boolean
  cover?: string
  photos?: ILovePhoto[]
  [key: string]: unknown
}

export interface ILovePhoto {
  url?: string
  description?: string
  [key: string]: unknown
}

export interface ILoveAlbumListReq {
  page?: number
  size?: number
  [key: string]: unknown
}

export type ILoveAlbumListRes = ILoveAlbum[]

export interface ILoveAlbumDetailReq {
  [key: string]: unknown
}

export interface IUnlockAlbumReq {
  password: string
}

export interface ILoveUnlockRes {
  success?: boolean
  [key: string]: unknown
}

export interface ILoveDailyItem {
  id?: string
  content?: string
  date?: string
  [key: string]: unknown
}

export interface ILoveDailyItemListReq {
  page?: number
  size?: number
  [key: string]: unknown
}

export type ILoveDailyItemListRes = ILoveDailyItem[]

export interface ILoveStory {
  id?: string
  title?: string
  content?: string
  date?: string
  [key: string]: unknown
}

export interface ILoveStoryListReq {
  page?: number
  size?: number
  [key: string]: unknown
}

export type ILoveStoryListRes = ILoveStory[]
