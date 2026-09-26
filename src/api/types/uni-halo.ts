/**
 * uni-halo 自定义接口 / 三方插件 API 类型定义
 * 对应 src/api/uni-halo.ts(uni-halo 自身接口 + 三方插件)
 */

/* ---------- uni-halo 应用配置 ---------- */

/** 应用信息（featureConfig.profile.appInfo） */
export interface IAppInfoConfig {
  name?: string
  logo?: string
}

/** 博主资料（featureConfig.profile.blogger） */
export interface IProfileBlogger {
  nickname?: string
  avatar?: string
  email?: string
  description?: string
  website?: string
  /** 介绍（富文本 HTML） */
  intro?: string
}

/** 社交项（featureConfig.profile.social.items，联系博主页展示/复制） */
export interface ISocialItem {
  /** 名称（如「企鹅号」「微信号」） */
  name?: string
  /** 内容（账号/地址/链接，点击复制） */
  content?: string
  /** 图标颜色（16 进制，支持透明） */
  color?: string
  /** 背景色（16 进制，支持透明） */
  bgColor?: string
  /** 排序，越大越靠前 */
  priority?: number
  /** 是否展示 */
  visible?: boolean
}

/** 快捷导航/功能入口项（home.quickNavigation、mine 两组共用结构） */
export interface IQuickNavItem {
  key?: string
  title?: string
  /** 副标题（对标 rightText，可空） */
  subTitle?: string
  color?: string
  bgColor?: string
  iconPrefix?: string
  icon?: string
  path?: string
  visible?: boolean
}

/** 轮播图公开条目(uni-halo Banner 归一化模型公开接口,列表脱敏不含 content) */
export interface IBannerPublicItem {
  /** Banner 条目 metadata.name */
  name: string
  title?: string
  cover?: string
  /** 展示日期(ISO) */
  date?: string
  authorName?: string
  authorAvatar?: string
  /** 来源:post=笔记快照 / custom=自定义 */
  source?: 'post' | 'custom'
  /** 笔记 id(source=post 时跳转笔记详情) */
  postId?: string
  link?: string
  priority?: number
}

/** 轮播图公开详情(含 content 富文本 HTML) */
export interface IBannerPublicDetail extends IBannerPublicItem {
  content?: string
}

/** 全站页面标题（pages.titles，传入各页面 navbar default-title，留空回退内置默认） */
export interface IPageTitles {
  // tabbar 页
  home?: string
  gallery?: string
  category?: string
  moments?: string
  blogger?: string
  // 博客页
  articles?: string
  archives?: string
  /** 笔记详情页导航栏默认标题（滚动后仍显示笔记题目） */
  postDetail?: string
  categoryArticles?: string
  tags?: string
  tagArticles?: string
  search?: string
  favorites?: string
  friendLinks?: string
  notice?: string
  noticeDetail?: string
  votes?: string
  voteDetail?: string
  contact?: string
  setting?: string
  aboutProject?: string
  disclaimer?: string
  dataVisual?: string
  // 认证页
  login?: string
  register?: string
}

/** 首页分类栏分类引用快照（固定最多 3 个，数组顺序 = 展示顺序） */
export interface IHomeCategoryItem {
  name: string
  displayName?: string
  cover?: string
  /** 分类排序权重（Halo Category.spec.priority，越大越靠前） */
  priority?: number
  /** 分类笔记数（Halo Category.status.postCount 冗余快照，缺失默认 0） */
  postCount?: number
}

export interface IPageConfig {
  /** 全站页面标题（插件端「功能设置 → 页面设置 → 页面标题」配置） */
  titles?: IPageTitles
  home?: {
    /** 是否显示首页分类栏（精品笔记分类） */
    useCategory?: boolean
    /** 是否显示快捷导航(首页) */
    useQuickNavigation?: boolean
    /** 快捷导航项（数组顺序 = 展示顺序；未配置/为空时客户端回退内置默认项） */
    quickNavigation?: IQuickNavItem[]
    /** 首页分类栏分类引用（配置模式下直接映射渲染不发请求，未配置/为空时回退默认取数） */
    categories?: IHomeCategoryItem[]
  }
  /** 博主页（资料卡视觉与功能入口布局） */
  blogger?: {
    /** 资料卡背景图 */
    bgImageUrl?: string
    /** 资料卡波浪图 */
    waveImageUrl?: string
    /** 常用功能显示方式 grid=宫格 / list=列表，缺省网格 */
    commonFeaturesMode?: 'grid' | 'list' | string
  }
  /** 我的页面功能入口（常用功能/其他功能两组，条目复用快捷导航项结构） */
  mine?: {
    commonFeatures?: IQuickNavItem[]
    otherFeatures?: IQuickNavItem[]
  }
  /** 免责声明页（按内容非空展示） */
  disclaimer?: {
    content?: string
  }
  /** 用户协议页 */
  userAgreement?: {
    /** 用户协议内容(富文本 HTML) */
    content?: string
  }
  /** 隐私政策页 */
  privacyPolicy?: {
    /** 隐私政策内容(富文本 HTML) */
    content?: string
  }
  /** 笔记详情页配置（评论开关与版权文案） */
  postDetail?: {
    showComment?: boolean
    /** 启用评论（评论按钮显隐；插件端透传官方评论设置） */
    enableComment?: boolean
    copyrightEnabled?: boolean
    copyrightAuthor?: string
    copyrightDesc?: string
    copyrightViolation?: string
  }
  /** 瞬间页配置（评论列表显隐与评论开关） */
  moment?: {
    showCommentList?: boolean
    enableComment?: boolean
  }
}

/** 审核模式数据(公开接口 GET /audit-data 返回) */
/** 选中引用快照(插件端 AuditDataRef:name 为扩展 metadata.name,其余为展示快照) */
export interface IAuditDataRef {
  /** 扩展 metadata.name */
  name: string
  title?: string
  cover?: string
  subTitle?: string
  extra?: string
  /** 排序权重(分类=spec.priority,其余可空) */
  priority?: number
  /** 笔记数(分类=status.postCount,缺失默认 0) */
  postCount?: number
}

export interface IAuditDataResult {
  /** 审核模式开关(AuditDataConfig.spec.enabled) */
  enabled: boolean
  /** 选中的引用快照列表(数组顺序即展示顺序;开关关闭时为空) */
  spec?: {
    /** 选中的笔记 Post 引用列表 */
    posts?: IAuditDataRef[]
    /** 选中的分类 Category 引用列表 */
    categories?: IAuditDataRef[]
    /** 选中的图库分组 PhotoGroup 引用列表 */
    galleryGroups?: IAuditDataRef[]
    /** 选中的瞬间 Moment 引用列表 */
    moments?: IAuditDataRef[]
    /** 选中的链接分组 LinkGroup 引用列表 */
    linkGroups?: IAuditDataRef[]
    /** 备注 */
    description?: string
    [key: string]: unknown
  }
  /** 分类完整快照(插件端公开接口附带:剔除失效、按配置顺序;app 端审核模式分类页免请求映射 ICategory) */
  categoryDetails?: Array<{
    name: string
    title?: string
    cover?: string
    /** 排序权重(Halo Category.spec.priority) */
    priority?: number
    /** 笔记数(Halo Category.status.postCount,缺失默认 0) */
    postCount?: number
  }>
}

/**
 * getConfigs 响应（app 端直读不做归一化）：
 * - featureConfig：功能设置单例 spec 直发（脱敏后）——profile/pages/assets/
 *   preferences/love(脱敏)/linkInfo/maintenance（审核模式开关已迁至公开 /audit-data）
 * - safetyConfig：setting.yaml 组原样（captchaConfig）
 * - integrationConfig：setting.yaml 组原样（pluginConfig，当前暂无插件）
 * - themeConfig：setting.yaml 组原样（悬浮窗等主题端配置，app 端暂不消费）
 * - loginConfig：脱敏（仅 client 子对象内的两个登录方式开关）
 * - maintenance：可选，服务端按时间窗计算的 status（键缺失 = 未维护）
 */
export interface IAppConfig {
  /** 功能设置单例 spec 直发（脱敏后） */
  featureConfig?: {
    /** 应用资料（应用信息/博主/社交/页脚版权） */
    profile?: {
      /** 应用信息（名称/图标） */
      appInfo?: IAppInfoConfig
      /** 博主资料 */
      blogger?: IProfileBlogger
      /** 社交信息（联系博主页展示） */
      social?: {
        items?: ISocialItem[]
      }
      /** 页脚版权（显示于博主页页脚） */
      copyrightConfig?: { enabled?: boolean, content?: string }
    }
    /** 页面配置（页面标题/首页/博主页/我的页面/免责声明页/笔记详情页） */
    pages?: IPageConfig
    /** 资源与兜底（loadingGifUrl/loadingErrUrl；app 端暂不消费，保留键位） */
    assets?: Record<string, unknown>
    /** 站点级展示偏好默认（字段名与客户端偏好设置一致，直接透传消费） */
    preferences?: {
      /** single 单列 / double 双列 */
      homeListLayout?: 'single' | 'double' | string
      /** image_top/image_right/image_bottom/image_left */
      homeCardType?: string
      articlesListLayout?: 'single' | 'double' | string
      articlesCardType?: string
      archivesListLayout?: 'single' | 'double' | string
      archivesCardType?: string
      /** 分类笔记页布局（single/double）与卡片样式（image_*） */
      categoryArticlesListLayout?: 'single' | 'double' | string
      categoryArticlesCardType?: string
      /** 标签笔记页布局（single/double）与卡片样式（image_*） */
      tagArticlesListLayout?: 'single' | 'double' | string
      tagArticlesCardType?: string
      /** 头像外观：square 方形（默认）/ circle 圆形 */
      avatarShape?: 'square' | 'circle' | string
      /** 友情链接页：小程序打开模式 fullscreen 全屏（默认）/ halfScreen 半屏 */
      linkPage?: {
        miniProgramOpenMode?: 'fullscreen' | 'halfScreen' | string
      }
    }
    /** 恋爱模块（脱敏 spec 直发：loveDiary 仅 passwordEnabled；三模块入口/恋爱信息/页面设置） */
    love?: ILoveConfigGroup
    /** 友链设置（submissionEnabled/siteInfo/miniInfo） */
    linkInfo?: ILinkInfoConfig
    /** 维护模式原始配置（含 enabled 开关与排期窗口；维护状态以顶层 maintenance 为准） */
    maintenance?: {
      enabled?: boolean
      title?: string
      notice?: string
      description?: string
      startTime?: string
      endTime?: string
    }
  }
  /** 安全控制（setting.yaml 组原样） */
  safetyConfig?: {
    /** 图形验证码配置 */
    captchaConfig?: {
      enabled?: boolean
      /** 各场景开关：友链提交/相册解锁/恋爱模块解锁 */
      scope?: {
        linkSubmission?: boolean
        loveAlbumUnlock?: boolean
        loveModuleUnlock?: boolean
      }
      /** ALPHANUMERIC 字符 / ARITHMETIC 算术 */
      type?: 'ALPHANUMERIC' | 'ARITHMETIC' | string
      captchaLength?: number
      arithmeticRange?: number
    }
  }
  /**
   * 平台接入（setting.yaml 组原样：第三方插件）
   * 当前暂无插件，保留结构供后续接入
   */
  integrationConfig?: {
    pluginConfig?: Record<string, unknown>
  }
  /** 主题展示（setting.yaml 组原样：悬浮窗等主题端配置，app 端暂不消费） */
  themeConfig?: Record<string, unknown>
  /** 登录配置(仅下发 client 子对象内的两个登录方式开关,决定登录页展示哪些入口) */
  loginConfig?: ILoginPublicConfig
  /**
   * 维护模式(服务端按时间窗计算;仅 scheduled/active 时存在,
   * 键缺失=未维护或已到点自动结束)
   */
  maintenance?: IPublicMaintenance
}

/**
 * getConfigs 顶层 maintenance 键(插件端输出;status 判定权威在服务端,客户端仅据此
 *  展示维护页与倒计时)
 */
export interface IPublicMaintenance {
  /** scheduled 维护预告(倒计时至 startTime)/ active 维护中(倒计时至 endTime) */
  status: 'scheduled' | 'active'
  /** 维护页标题 */
  title?: string
  /** 维护说明(纯文本,维护页标题下方直接展示,留空展示默认文案) */
  notice?: string
  /** 维护详情(富文本 HTML,「维护详情」弹窗内 mp-html 渲染) */
  description?: string
  /** 维护开始时间(RFC3339 UTC 字符串) */
  startTime?: string
  /** 预计恢复时间(RFC3339 UTC 字符串) */
  endTime?: string
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

/* ---------- uni-halo 检查更新 ---------- */

/** 检查更新结果(uh-upgrade 对接) */
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

/** 投票选项(插件 VoteSpec.options:{id,title}) */
export interface IVoteOption {
  id?: string
  title?: string
  [key: string]: unknown
}

/** 投票列表项(Halo 扩展对象,标识在 metadata.name、内容在 spec) */
export interface IVoteItem {
  metadata?: { name?: string, [key: string]: unknown }
  spec?: {
    title?: string
    remark?: string
    type?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

/** 投票列表响应(Halo 标准 ListResult 结构,与 posts/categories 等列表接口一致) */
export interface IVoteListRes {
  items: IVoteItem[]
  page?: number
  size?: number
  total?: number
  hasNext?: boolean
}

/** 投票(Halo 扩展对象) */
export interface IVote {
  metadata: { name: string, [key: string]: unknown }
  spec?: {
    title?: string
    remark?: string
    type?: 'single' | 'multiple' | 'pk' | string
    maxVotes?: number
    options?: IVoteOption[]
    timeLimit?: 'custom' | 'permanent' | 'thirty' | 'seven' | 'one' | string
    startDate?: string
    endDate?: string
    owner?: string
    hasEnded?: boolean
    canAnonymously?: boolean
    canSeeVoters?: boolean
    [key: string]: unknown
  }
  stats?: {
    voteCount?: number
    voteUser?: number
    voteDataList?: { id?: string, voteCount?: number }[]
  }
  [key: string]: unknown
}

/** 投票详情(插件 VoteDetail:嵌套 vote + 统计) */
export interface IVoteDetail {
  vote: IVote
  voteDataList?: { id?: string, voteCount?: number }[]
  userVoteData?: string[]
  voteCount?: number
  voteUser?: number
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

/* ---------- 通知公告(uni-halo notice) ---------- */

/** 公告公开列表项(脱敏,不含 content;内嵌类型信息 typeDisplayName/typeColor) */
export interface INoticeListVo {
  name?: string
  title?: string
  summary?: string
  cover?: string
  link?: string
  typeName?: string
  typeDisplayName?: string
  typeColor?: string
  priority?: number
  /** 发布时间(spec.publishTime,ISO-8601) */
  publishTime?: string
}

/** 公告公开分页列表响应(ListResult 形态) */
export interface INoticeListRes {
  page?: number
  size?: number
  total?: number
  items: INoticeListVo[]
}

/** 公告详情 spec(完整 Notice + 内嵌 typeDisplayName/typeColor) */
export interface INoticeDetailSpec {
  title?: string
  /** 富文本 HTML(仅详情返回) */
  content?: string
  summary?: string
  cover?: string
  link?: string
  typeName?: string
  status?: string
  priority?: number
  publishTime?: string
  typeDisplayName?: string
  typeColor?: string
}

/** 公告详情(完整 extension 对象: metadata + spec) */
export interface INoticeDetail {
  metadata?: { name?: string, [key: string]: unknown }
  spec?: INoticeDetailSpec
  [key: string]: unknown
}

/** 公告分类(NoticeType extension) */
export interface INoticeType {
  metadata?: { name?: string, [key: string]: unknown }
  spec?: {
    /** 类型名称,如「活动」「维护」 */
    displayName?: string
    /** 标签颜色(hex) */
    color?: string
    /** 排序,越大越靠前 */
    priority?: number
  }
  [key: string]: unknown
}

/** 公告分类列表响应(Halo ListResult 形态) */
export interface INoticeTypeListRes {
  page?: number
  size?: number
  total?: number
  items: INoticeType[]
}

/* ---------- 恋爱模块(uni-halo love) ---------- */

/** 恋爱模块入口（三模块共用；loveDiary 仅使用密码相关字段） */
export interface ILoveModuleConfig {
  /** 是否在恋爱页展示该模块入口（loveDiary 不使用：入口显隐由快捷导航/功能入口注册表控制） */
  enabled?: boolean
  /** 入口名称（app 端入口列表标题） */
  title?: string
  /** 入口副标题（app 端入口列表副标题） */
  subTitle?: string
  /** 标题颜色（hex8 #rrggbbaa） */
  titleColor?: string
  /** 副标题颜色（hex8 #rrggbbaa） */
  subTitleColor?: string
  /** 图标背景色（hex8 #rrggbbaa） */
  iconBgColor?: string
  /** 图标字体前缀（如 uhlove-icon，app 端渲染入口图标） */
  iconPrefix?: string
  /** 图标名（app 端渲染入口图标） */
  icon?: string
  /** app 端跳转路径 */
  path?: string
  /** 排序字段（越大越靠前，插件端按 priority 降序输出） */
  priority?: number
  /** 是否已设置密码（app 端据此显示锁定态：passwordEnabled && 本地无有效 token） */
  passwordEnabled?: boolean
  /** 模块富文本内容（ourStory 的故事正文；脱敏直发） */
  content?: string
  [key: string]: unknown
}

/** 恋爱信息（纪念日 + 恋人信息；独立公开接口 GET /love-info） */
export interface ILoveInfo {
  /** 纪念日标题（默认「这是我们一起走过的」） */
  loveDateTitle?: string
  /** 恋爱纪念日（yyyy-MM-dd），用于计算恋爱天数 */
  loveDate?: string
  /** 男生昵称 */
  boyNickname?: string
  /** 男生头像 */
  boyAvatar?: string
  /** 女生昵称 */
  girlNickname?: string
  /** 女生头像 */
  girlAvatar?: string
  [key: string]: unknown
}

/** getConfigs featureConfig.love（脱敏 spec 直发；恋爱日记仅密码状态；三模块入口即 app 端入口列表数据） */
export interface ILoveConfigGroup {
  /** 恋爱日记入口（恋爱页本身，仅密码状态，无 enabled 开关） */
  loveDiary?: Pick<ILoveModuleConfig, 'passwordEnabled'>
  /** 恋爱故事模块入口 */
  ourStory?: ILoveModuleConfig
  /** 恋爱相册模块入口 */
  lovePhoto?: ILoveModuleConfig
  /** 恋爱清单模块入口 */
  loveDaily?: ILoveModuleConfig
  /** 恋爱日记页面设置（页面标题 + 恋爱页背景图，留空客户端内置回退） */
  diaryPage?: {
    pageTitle?: string
    bgImageUrl?: string
  }
  [key: string]: unknown
}

/** 小程序信息（友链「申请信息」弹窗展示项） */
export interface ILinkMiniInfo {
  displayName?: string
  /** 太阳码/小程序码图片 */
  miniProgramCode?: string
  /** 小程序 AppID（wx 开头） */
  appId?: string
  /** 跳转页面路径 */
  path?: string
  /** 跳转地址 */
  link?: string
  description?: string
  applyRemark?: string
}

/** 站点信息（本站站点名片，字段对齐 Halo 官方友链提交 API） */
export interface ILinkSiteInfo {
  displayName?: string
  url?: string
  logo?: string
  description?: string
  backlink?: string
  /** RSS/Atom 订阅地址 */
  feedUrls?: string[]
}

/** 友链设置（featureConfig.linkInfo，脱敏 spec 直发） */
export interface ILinkInfoConfig {
  /** 是否开放公开提交申请（关闭后 app 端隐藏提交入口） */
  submissionEnabled?: boolean
  /** 本站站点名片 */
  siteInfo?: ILinkSiteInfo
  /** 小程序信息 */
  miniInfo?: ILinkMiniInfo
}

export interface ILoveAlbum {
  name?: string
  title?: string
  /** 相册展示名(接口返回 displayName) */
  displayName?: string
  description?: string
  locked?: boolean
  cover?: string
  /** 排序，越大越前 */
  priority?: number
  /** 是否启用查看密码(服务端按 passwordHash 维护) */
  passwordEnabled?: boolean
  /** 照片数量(公开列表 VO 服务端计算；加密相册 photos 为空，计数以此为准) */
  photoCount?: number
  photos?: ILovePhoto[]
  /** 服务端计算的照片数量 */
  status?: { photoCount?: number, [key: string]: unknown }
  /** Halo 资源元数据(接口返回 metadata) */
  metadata?: {
    name?: string
    creationTimestamp?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

/** 相册照片(插件端 LoveAlbum.AlbumPhoto，name 为服务端生成标识) */
export interface ILovePhoto {
  /** 服务端生成的照片标识(删除照片接口按此定位) */
  name?: string
  url?: string
  title?: string
  description?: string
  /** 拍摄日期(yyyy-MM-dd) */
  takenDate?: string
  location?: string
  /** 相册内排序，越大越前 */
  priority?: number
  [key: string]: unknown
}

export interface ILoveAlbumListReq {
  page?: number
  size?: number
  [key: string]: unknown
}

/** 恋爱相册列表响应(插件分页包装) */
export interface ILoveAlbumListRes {
  page?: number
  size?: number
  total?: number
  hasNext?: boolean
  items: ILoveAlbum[]
}

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
  /** Halo 资源元数据(接口返回 metadata) */
  metadata?: {
    name?: string
    [key: string]: unknown
  }
  /** 清单项详情(接口返回 spec) */
  spec?: ILoveDailyItemSpec
  [key: string]: unknown
}

/** 恋爱清单项 spec(对齐插件 LoveDailyItemSpec) */
export interface ILoveDailyItemSpec {
  /** 清单标题 */
  title?: string
  /** 清单内容 */
  content?: string
  /** 状态:未开始/进行中/已完成 */
  status?: 'wait' | 'doing' | 'complete'
  /** 计划时间 */
  planDate?: string
  /** 完成时间 */
  completeDate?: string
  /** 完成感想 */
  completeRemark?: string
  /** 回忆图片 */
  images?: string[]
  [key: string]: unknown
}

export interface ILoveDailyItemListReq {
  page?: number
  size?: number
  [key: string]: unknown
}

/** 恋爱清单列表响应(插件分页包装) */
export interface ILoveDailyItemListRes {
  page?: number
  size?: number
  total?: number
  hasNext?: boolean
  items: ILoveDailyItem[]
}

export interface ILoveStory {
  id?: string
  title?: string
  content?: string
  date?: string
  /** Halo 资源元数据(接口返回 metadata) */
  metadata?: {
    name?: string
    [key: string]: unknown
  }
  /** 故事详情(接口返回 spec) */
  spec?: ILoveStorySpec
  [key: string]: unknown
}

/** 恋爱故事 spec(对齐插件 LoveStorySpec) */
export interface ILoveStorySpec {
  /** 故事标题 */
  title?: string
  /** 故事内容(HTML) */
  content?: string
  /** 故事日期 */
  date?: string
  /** 故事地点 */
  location?: string
  /** 故事图片 */
  images?: string[]
  /** 排序优先级(越大越靠前) */
  priority?: number
  [key: string]: unknown
}

export interface ILoveStoryListReq {
  page?: number
  size?: number
  [key: string]: unknown
}

/* ---------- 小程序链接(uni-halo mini-program-links) ---------- */

/** 小程序链接 spec(对齐插件 MiniProgramLinkSpec) */
export interface IMiniProgramLinkSpec {
  /** 小程序名称 */
  displayName?: string
  /** 太阳码(小程序码图片 URL,必填) */
  miniProgramCode?: string
  /** 小程序 AppID(wx 开头,必填) */
  appId?: string
  /** 跳转页面路径(非必填) */
  path?: string
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

/** 提交申请表单(公开 POST /-/submissions,body 为 { spec: {...} }) */
export interface IMiniProgramLinkSubmissionForm {
  /** 小程序名称(必填) */
  displayName: string
  /** 太阳码图片 URL(必填) */
  miniProgramCode: string
  /** 小程序 AppID(wx 开头,必填) */
  appId: string
  /** 跳转页面路径(非必填) */
  path?: string
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

/** 恋爱故事列表响应(插件分页包装) */
export interface ILoveStoryListRes {
  page?: number
  size?: number
  total?: number
  hasNext?: boolean
  items: ILoveStory[]
}

/* ---------- 移动端登录(uni-halo 插件 AuthEndpoint) ---------- */

/**
 * 登录公开配置（getConfigs loginConfig.client）
 * 仅含两个登录方式开关,供客户端决定登录页展示哪些入口;
 */
export interface ILoginPublicConfig {
  client: {
    /** 账号密码登录开关 */
    passwordLoginEnabled?: boolean
    /** 微信一键登录开关 */
    wechatLoginEnabled?: boolean
  }
}

/** 登录用户摘要(插件端 LoginUser,不含敏感字段) */
export interface ILoginUser {
  name?: string
  displayName?: string
  avatar?: string
  email?: string
  /** 用户是否「自主设置过密码」（插件端注解判定）。插件代生成的随机/固定密码用户为 false，改密弹层据此走免旧密码的首次设密通道 */
  passwordSetByUser?: boolean
}

/** 由角色模板递归展开的 RBAC 规则(插件端 PermissionRule) */
export interface ILoginPermissionRule {
  apiGroups?: string[]
  resources?: string[]
  verbs?: string[]
}

/**
 * 由 LoginResult 裁剪 token 后得到的用户资料(getAuthProfile / auth/profile 响应)
 * 会话恢复只需用户与权限,令牌由登录接口一次性下发,客户端自行缓存到过期
 */
export interface IProfileResult {
  user?: ILoginUser
  roles?: string[]
  permissions?: ILoginPermissionRule[]
}

/** 登录结果(插件端 LoginResult) */
export interface ILoginResult {
  token?: string
  tokenType?: string
  /** ISO 时间字符串 */
  expiresAt?: string
  patName?: string
  user?: ILoginUser
  roles?: string[]
  permissions?: ILoginPermissionRule[]
}
