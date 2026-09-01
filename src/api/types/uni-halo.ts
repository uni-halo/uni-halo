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

/** 审核模式数据(公开接口 GET /audit-data 返回) */
export interface IAuditDataResult {
  /** 审核模式开关(联动设置页 auditModeEnabled) */
  enabled: boolean
  /** 选中的引用 name 列表(数组顺序即展示顺序;开关关闭时为空) */
  spec?: {
    /** 选中的文章 Post metadata.name 列表 */
    posts?: string[]
    /** 选中的分类 Category metadata.name 列表 */
    categories?: string[]
    /** 选中的图库分组 PhotoGroup metadata.name 列表 */
    galleryGroups?: string[]
    /** 选中的瞬间 Moment metadata.name 列表 */
    moments?: string[]
    /** 选中的链接分组 LinkGroup metadata.name 列表 */
    linkGroups?: string[]
    /** 备注 */
    description?: string
    [key: string]: unknown
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

/* ---------- 小程序链接(plugin-uni-halo mini-program-links) ---------- */

/** 小程序链接 spec(对齐插件 MiniProgramLinkSpec) */
export interface IMiniProgramLinkSpec {
  /** 小程序名称 */
  displayName?: string
  /** 太阳码(小程序码图片 URL,必填) */
  miniProgramCode?: string
  /** 小程序地址(跳转链接) */
  link?: string
  /** 作者昵称 */
  authorName?: string
  /** 作者头像(图片 URL) */
  avatar?: string
  /** 作者网站 */
  website?: string
  /** 分组(引用分组 metadata.name;空=未分组) */
  groupName?: string
  /** 描述 */
  description?: string
  /** 预览图(多图) */
  screenshots?: string[]
  /** 可见性(公开接口恒为 true) */
  visible?: boolean
  /** 来源:manual 手动 / submitted 申请 */
  source?: string
  /** 排序权重 */
  priority?: number
  [key: string]: unknown
}

/** 小程序链接 */
export interface IMiniProgramLink {
  metadata?: {
    name?: string
    creationTimestamp?: string
    [key: string]: unknown
  }
  spec?: IMiniProgramLinkSpec
}

export interface IMiniProgramLinkListReq {
  page?: number
  size?: number
  [key: string]: unknown
}

export type IMiniProgramLinkListRes = IMiniProgramLink[]

/** grouped=true 分组返回项 */
export interface IMiniProgramLinkGroupVo {
  /** 分组名(空=未分组) */
  groupName?: string
  /** 分组显示名 */
  displayName?: string
  links: IMiniProgramLink[]
}

export type IMiniProgramLinkGroupedRes = IMiniProgramLinkGroupVo[]

/** 分组选项(/types) */
export interface IMiniProgramLinkGroupOption {
  name?: string
  displayName?: string
}

/** 提交申请表单(公开 POST /submissions,body 为 { spec: {...} }) */
export interface IMiniProgramLinkSubmissionForm {
  /** 小程序名称(必填) */
  displayName: string
  /** 太阳码图片 URL(必填) */
  miniProgramCode: string
  /** 小程序地址 */
  link?: string
  /** 作者昵称 */
  authorName?: string
  /** 作者头像 */
  avatar?: string
  /** 作者网站 */
  website?: string
  /** 分组 */
  groupName?: string
  /** 描述 */
  description?: string
  /** 申请说明 */
  applyRemark?: string
  /** 预览图 */
  screenshots?: string[]
  /** 申请人邮箱(非必填,填写校验格式) */
  email?: string
}

export type ILoveStoryListRes = ILoveStory[]
