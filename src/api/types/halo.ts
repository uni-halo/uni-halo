/**
 * Halo 官方 API 类型定义
 * 对应 src/api/halo.ts(Halo 官方 api.*.halo.run 扩展点)
 * 结构基于 Halo 2.x API 规范
 */

/** Halo 通用元数据 */
export interface IMetadata {
  name: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  version?: number
  creationTimestamp?: string
  updateTimestamp?: string
}

/** Halo 通用分页结构(ListResult) */
export interface IListResult<T> {
  page: number
  size: number
  total: number
  items: T[]
  first: boolean
  last: boolean
  hasNext: boolean
  hasPrevious: boolean
  totalPages: number
}

export interface IOwner {
	avatar?: string
	displayName?: string
	bio?: string
	metadata:{name:string}
}

/* ---------- 笔记 Post ---------- */

export interface IPostSpec {
  title: string
  slug: string
  excerpt?: string
  cover?: string
  owner:IOwner
  /** 发布时间(Halo 2.x 结构) */
  publishTime?: string
  deleted: boolean
  publish: boolean
  pinned: boolean
  allowComment: boolean
  visible: 'PUBLIC' | 'PRIVATE'
  priority: number
  categories: string[]
  tags: string[]
  template?: string
  htmlMetas?: Record<string, string>
  baseSnapshot?: string
  headSnapshot?: string
  snapshotVersion?: number
  excerptAutoGenerate?: boolean
}

export interface IPostStatus {
  permalink: string
  inProgress: boolean
  commentsCount?: number
  contributors?: IContributor[]
  stats?: IPostStats
  excerpt?: string
}

export interface IContributor {
  name: string
  displayName: string
  avatar: string
}

export interface IPostStats {
  visits?: number
  upvotes?: number
  comments?: number
}

/** 笔记内容(含受限阅读的 raw 源文本) */
export interface IContent {
  raw: string
  content: string
  displayVersion?: string
}

export interface IPost {
  metadata: IMetadata
  spec: IPostSpec
  owner: IOwner
  status?: IPostStatus
  content?: IContent
  categories?: ICategory[]
  tags?: ITag[]
  contributors?: IContributor[]
  /** 顶层统计(兼容 Halo 旧版结构) */
  stats?: {
    visit?: number
    upvote?: number
    comment?: number
    [key: string]: unknown
  }
}

/** 笔记列表请求参数(分页 + 过滤) */
export interface IPostListReq {
  page?: number
  size?: number
  sort?: string[]
  keyword?: string
  category?: string
  tag?: string
  visible?: 'PUBLIC' | 'PRIVATE'
  [key: string]: unknown
}

export type IPostListRes = IListResult<IPost>

/** UC 端点返回的 ListedPost(Halo 结构:Post 包裹在 post 字段,owner/stats 在顶层) */
export interface IUcListedPost {
  post: IPost
  owner?: IPost['owner']
  stats?: IPost['stats']
  categories?: ICategory[]
  tags?: ITag[]
  contributors?: IContributor[]
}

export type IUcPostListRes = IListResult<IUcListedPost>

/** 笔记搜索请求参数(关键字) */
export interface ISearchReq {
  keyword?: string
  /** 返回条数上限(默认 50) */
  limit?: number
  page?: number
  size?: number
  highlightPreTag?: string
  highlightPostTag?: string
}

export type ISearchRes = IListResult<IPost>

/* ---------- 分类 Category ---------- */

export interface ICategory {
  metadata: IMetadata
  spec: {
    displayName: string
    slug: string
    description?: string
    cover?: string
    template?: string
    priority: number
    children?: string[]
  }
  status?: {
    permalink: string
    postCount?: number
    visiblePostCount?: number
  }
  children?: ICategory[]
  /** 笔记数 */
  postCount?: number
}

export interface ICategoryListReq {
  page?: number
  size?: number
  sort?: string[]
  tree?: boolean
  [key: string]: unknown
}

export type ICategoryListRes = IListResult<ICategory>

/** 分类下笔记列表请求 */
export interface ICategoryPostListReq extends IPostListReq {
  /** 私密分类密码(加密分类访问) */
  password?: string
}

export type ICategoryPostListRes = IListResult<IPost>

/* ---------- 标签 Tag ---------- */

export interface ITag {
  metadata: IMetadata
  spec: {
    displayName: string
    slug: string
    color?: string
    cover?: string
  }
  status?: {
    permalink: string
    postCount?: number
    visiblePostCount?: number
  }
}

export interface ITagListReq {
  page?: number
  size?: number
  sort?: string[]
  [key: string]: unknown
}

export type ITagListRes = IListResult<ITag>

/* ---------- 评论 Comment ---------- */

export interface ICommentOwner {
  kind: 'EMAIL' | 'PHONE' | 'GRAVATAR' | 'WEIXIN' | 'QQ'
  displayName: string
  avatar?: string
  email?: string
  website?: string
}

export interface IComment {
  metadata: IMetadata
  spec: {
    raw: string
    content: string
    owner: ICommentOwner
    userAgent?: string
    ipAddress?: string
    priority?: number
    top?: boolean
    allowNotification?: boolean
    approved: boolean
    hidden: boolean
    subjectRef: {
      group: string
      version: string
      kind: string
      name: string
    }
    lastReadTime?: string
    creationTime?: string
  }
  status?: {
    hasReply?: boolean
    replyCount?: number
    /** 可见回复数(公开接口按审核可见统计) */
    visibleReplyCount?: number
    visibleTime?: string
  }
  replies?: IListResult<ICommentReply>
}

export interface ICommentReply {
  metadata: IMetadata
  spec: {
    raw: string
    content: string
    owner: ICommentOwner
    quoteReply?: string
    userAgent?: string
    ipAddress?: string
    priority?: number
    top?: boolean
    approved: boolean
    hidden: boolean
    subjectRef: {
      group: string
      version: string
      kind: string
      name: string
    }
    lastReadTime?: string
    creationTime?: string
  }
}

/** 评论回复列表响应(分页) */
export type ICommentReplyListRes = IListResult<ICommentReply>

export interface ICommentListReq {
  page?: number
  size?: number
  sort?: string[]
  /** 主题名称(笔记 name) */
  name?: string
  /** 是否携带该评论的部分回复(默认 false) */
  withReplies?: boolean
  /** 携带回复条数(仅 withReplies=true 时生效,默认 10) */
  replySize?: number
  [key: string]: unknown
}

export type ICommentListRes = IListResult<IComment>

/* ---------- 瞬间 Moment ---------- */

export interface IMoment {
  metadata: IMetadata
  /** 作者(公开接口在顶层返回;spec.owner 只是作者用户名) */
  owner?: {
    avatar?: string
    bio?: string
    displayName: string
    name: string
    [key: string]: unknown
  }
  spec: {
    content: {
      /** 正文 HTML */
      html?: string
      raw?: string
      /** 多媒体(图片/视频/音频均在此,勿误读成 spec.medium) */
      medium?: {
        type?: 'PHOTO' | 'VIDEO' | 'AUDIO'
        url?: string
        [key: string]: unknown
      }[]
      [key: string]: unknown
    }
    owner?: string
    visible: 'PUBLIC' | 'PRIVATE'
    allowComment: boolean
    approved: boolean
    pinned?: boolean
    priority?: number
    tags?: string[]
    releaseTime?: string
  }
  /** 互动数据(公开接口返回:点赞/评论数) */
  stats?: {
    approvedComment?: number
    totalComment?: number
    upvote?: number
    [key: string]: unknown
  }
  status?: {
    permalink: string
    approved?: boolean
    inProgress?: boolean
    commentsCount?: number
  }
}

export interface IMomentListReq {
  page?: number
  size?: number
  sort?: string[]
  [key: string]: unknown
}

export type IMomentListRes = IListResult<IMoment>

/* ---------- 图库 Photo ---------- */

export interface IPhotoGroup {
  metadata: IMetadata
  spec: {
    displayName: string
    description?: string
    priority?: number
    cover?: string
  }
  status?: {
    permalink?: string
    photoCount?: number
  }
}

export interface IPhoto {
  metadata: IMetadata
  spec: {
    displayName: string
    description?: string
    url: string
    /** 封面图(部分接口返回) */
    cover?: string
    priority?: number
    takeTime?: string
    location?: string
    latitude?: number
    longitude?: number
  }
}

export interface IPhotoGroupListReq {
  page?: number
  size?: number
  sort?: string[]
  [key: string]: unknown
}

export type IPhotoGroupListRes = IListResult<IPhotoGroup>

export interface IPhotoListReq {
  page?: number
  size?: number
  sort?: string[]
  groupName?: string
  [key: string]: unknown
}

export type IPhotoListRes = IListResult<IPhoto>

/* ---------- 友链 FriendLink ---------- */

export interface ILinkGroup {
  metadata: IMetadata
  spec: {
    displayName: string
    priority?: number
    description?: string
  }
}

export interface ILink {
  metadata: IMetadata
  spec: {
    displayName: string
    url: string
    logo: string
    description?: string
    priority?: number
    groupName?: string
  }
}

export interface ILinkGroupListReq {
  page?: number
  size?: number
  sort?: string[]
  [key: string]: unknown
}

export type ILinkGroupListRes = IListResult<ILinkGroup>

export interface ILinkListReq {
  page?: number
  size?: number
  sort?: string[]
  [key: string]: unknown
}

export type ILinkListRes = IListResult<ILink>

/* ---------- 统计 / 埋点 ---------- */

export interface IBlogStats {
  visit?: number
  upvote?: number
  comment?: number
  post?: number
  category?: number
  tag?: number
  [key: string]: unknown
}

export interface ITrackerCounterReq {
  group: string
  name: string
  plural?: string
  endpoint?: string
  hostname?: string
  screen?: string
  title?: string
  referrer?: string
  language?: string
  /** 访问页面路径(埋点 url 字段) */
  url?: string
}

export interface IUpvoteReq {
  group: string
  name: string
  plural?: string
}
