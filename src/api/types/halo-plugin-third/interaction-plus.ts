/**
 * 互动增强插件(interaction-plus)API 类型定义
 * 对应 src/api/halo-plugin-third/interaction-plus.ts
 */

/**
 * 身份标识(角色映射的前台标牌)
 * 三种形态二选一:color 有值=文字牌;icon 为 data URL=图标;icon 为图片地址=图片
 */
export interface IIdentityMark {
  /** 标识显示名:文字牌的牌面、图标/图片的悬停提示、图片加载失败时回落为文字牌的文案 */
  displayName: string
  /** 文字牌颜色(hex);非文字牌时为 null;与 icon 互斥 */
  color?: string | null
  /** 图标(data:image/svg+xml 格式的 Iconify 字形)或图片地址;文字牌时为 null;与 color 互斥 */
  icon?: string | null
  /** 展示优先级,数字越小越靠前(具体排序规则由站长在后台设置) */
  priority?: number
  [key: string]: unknown
}

/**
 * 装饰类型
 */
export type DecorationType = 'badge' | 'avatar_frame' | 'title' | 'name_style' | 'card_background' | string

/**
 * 装饰基础信息
 * 五类装饰:type = badge(勋章) / avatar_frame(头像框) / title(称号) / name_style(昵称样式) / card_background(名片背景)
 */
export interface IDecorationItem {
  /** 装饰资产内部名(唯一标识,可作列表 key) */
  assetName?: string
  /** 装饰类型 */
  type: DecorationType
  /** 素材图片地址;昵称样式类装饰通常无图 */
  url?: string
  [key: string]: unknown
}

/**
 * 称号(名称恒非空;颜色可空,没选文字色继承正文、没选背景无底色)
 */
export interface ITitleDecoration extends IDecorationItem {
  /** 称号名称,恒非空;同时是称号图(titleText 有 url 时)的替代文本与加载失败回落 */
  titleText: string
  /** 称号文字色,格式 #RGB / #RRGGBB / #RRGGBBAA;可空 */
  titleColor?: string
  /** 称号背景色,格式同上;可空(无背景) */
  titleBackground?: string
  /** 称号背景第二色;与 titleBackground 组成 135° 渐变;可空 */
  titleBackgroundSecondary?: string
}

/**
 * 昵称样式
 */
export interface INameStyleDecoration extends IDecorationItem {
  /** 样式具体配置 */
  nameStyle?: {
    /** 样式模式:gradient=渐变 / solid=纯色 */
    mode?: 'gradient' | 'solid' | string
    /** gradient 模式的渐变色列表(按顺序组成渐变) */
    colors?: string[]
    /** solid 模式的纯色值 */
    color?: string
    [key: string]: unknown
  }
}

/**
 * 当前佩戴的装饰(用户在「装扮」中心选配)
 * 各字段为该类装饰当前佩戴的那一个;未佩戴时字段不存在
 */
export interface IWornDecorations {
  /** 头像框:叠加在头像外围的素材图,随容器等比缩放 */
  avatarFrame?: IDecorationItem
  /** 称号 */
  title?: ITitleDecoration
  /** 主勋章(唯一展示的勋章) */
  primaryBadge?: IDecorationItem
  /** 展示勋章(≤8 个) */
  badgeShowcase?: IDecorationItem[]
  /** 名片背景(用户卡顶部露出带素材) */
  cardBackground?: IDecorationItem
  /** 昵称样式 */
  nameStyle?: INameStyleDecoration
  [key: string]: unknown
}

/**
 * 互动统计(用户卡数据行与「加入时间」的数据源)
 */
export interface IIdentityStats {
  /** 已发布文章数(公开口径) */
  posts?: number
  /** 已审核评论数(公开口径) */
  comments?: number
  /** 各类装扮持有计数;为 null 表示用户关闭了公开装扮墙(此时勿显示勋章计数) */
  decorations?: {
    /** 装饰总数 */
    total?: number
    /** 勋章数量 */
    badge?: number
    /** 头像框数量 */
    avatarFrame?: number
    /** 称号数量 */
    title?: number
    /** 昵称样式数量 */
    nameStyle?: number
    /** 名片背景数量 */
    cardBackground?: number
  } | null
  /** 其他插件贡献的统计项(如问答插件的采纳数) */
  extras?: {
    /** 来源插件 id */
    source: string
    /** 统计项标识 */
    key: string
    /** 显示名(如「采纳」) */
    label: string
    /** 已格式化的值,原样展示即可 */
    value: string
  }[]
  [key: string]: unknown
}

/**
 * 站点级展示策略(站长设置,全站一份,非用户属性;自绘界面可整个忽略)
 */
export interface IDisplayPolicy {
  /** 身份行(评论区昵称行等)场景的展示开关 */
  identityLine?: {
    /** 是否展示称号 */
    showTitle?: boolean
    /** 是否展示主勋章 */
    showPrimaryBadge?: boolean
    /** 是否展示昵称样式 */
    showNameStyle?: boolean
    /** 是否展示身份标识 */
    showIdentityMarks?: boolean
    /** 身份标识最多展示个数 */
    identityLimit?: number
    [key: string]: unknown
  }
  /** 头像场景的展示开关 */
  avatar?: {
    /** 是否展示头像框 */
    showFrame?: boolean
    [key: string]: unknown
  }
  /** 用户卡场景的展示开关(字段同 identityLine,另含 showcaseBadgeLimit 等) */
  userCard?: Record<string, unknown>
  /** 用户卡头像/昵称的跳转链接模板,{name} 替换为用户名;空串表示关闭跳转 */
  userCardLinkTemplate?: string
  [key: string]: unknown
}

/**
 * 公开身份(GET /identity/{userName})
 * 游客可访问;用户不存在或被禁用时接口返回 404
 */
export interface IPublicIdentity {
  /** 用户名(Halo metadata.name) */
  userName: string
  /** 用户显示名(昵称) */
  displayName: string
  /** 头像地址 */
  avatar?: string
  /** 个人简介 */
  bio?: string
  /** 注册时间(ISO 8601) */
  registeredAt?: string
  /** 身份标识(角色映射的标牌) */
  identityMarks?: IIdentityMark[]
  /** 当前佩戴的装饰 */
  decorations?: IWornDecorations
  /** 互动统计 */
  stats?: IIdentityStats
  /** 站点级展示策略 */
  display?: IDisplayPolicy
  [key: string]: unknown
}

/**
 * 批量身份响应(POST /identities)
 */
export interface IBatchIdentitiesRes {
  /** 查到的身份列表(顺序与入参不保证一致) */
  items: IPublicIdentity[]
  /** 查无或不可用的用户名 */
  skipped?: string[]
}

/**
 * 装饰墙项(GET /identity/{userName}/decorations)
 * 用户获得的全部有效装饰,每项自包含完整信息,无需再按 id 查询;
 * 用户关闭「公开装扮墙」时返回空数组,用户不存在或被禁用时 404
 */
export interface IDecorationWallItem {
  /** 装饰资产内部名(唯一标识,可作列表 key) */
  assetName?: string
  /** 装饰类型(同 IDecorationItem.type) */
  type: DecorationType
  /** 装饰显示名 */
  displayName: string
  /** 素材图片地址 */
  url?: string
  /** 稀有度内部名(如 rarity-epic),仅作样式标识用 */
  rarityName?: string
  /** 稀有度显示名(如「史诗」) */
  rarityDisplayName?: string
  /** 稀有度颜色(hex),可直接用于边框/文字着色 */
  rarityColor?: string
  /** 获得时间(ISO 8601) */
  grantedAt?: string
  /** 到期时间(ISO 8601);null 表示永久 */
  expiresAt?: string | null
  [key: string]: unknown
}
