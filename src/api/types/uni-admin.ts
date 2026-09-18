/**
 * 管理模块（发布/管理内容）类型定义
 */

/** Halo 附件对象（仅声明客户端用到的字段） */
export interface IAttachment {
  metadata: {
    name: string
    [key: string]: unknown
  }
  spec: {
    displayName?: string
    mediaType?: string
    size?: number
    [key: string]: unknown
  }
  status?: {
    permalink?: string
    [key: string]: unknown
  }
}

/** 瞬间媒体项（Moment.MomentMedia） */
export interface IMomentMedia {
  type: 'PHOTO' | 'VIDEO' | 'POST' | 'AUDIO'
  url: string
  /** 原始类型，如 image/jpeg */
  originType?: string
  [key: string]: unknown
}

/**
 * 瞬间内容（Moment.MomentContent）
 * 注意：raw/html 均为字符串（对象格式），medium 为媒体数组；
 * 创建/更新请求体与接口返回均为该结构，不存在条目数组形态。
 */
export interface IMomentContent {
  /** 原始内容 */
  raw?: string
  /** 渲染后的 HTML */
  html?: string
  /** 媒体资源（图片/视频 URL 列表） */
  medium?: IMomentMedia[]
  [key: string]: unknown
}

/** 瞬间 spec（Moment.MomentSpec） */
export interface IMomentSpec {
  /** 内容（单对象） */
  content: IMomentContent
  /** 发布时间（ISO 8601），缺省由服务端生成 */
  releaseTime?: string
  /** 可见性：PUBLIC / PRIVATE */
  visible?: 'PUBLIC' | 'PRIVATE'
  /** 所有者（服务端按当前登录用户覆写，调用方无需传） */
  owner?: string
  /** 标签名列表 */
  tags?: string[]
  /** 是否审核通过（服务端控制，调用方无需传） */
  approved?: boolean
  approvedTime?: string
  [key: string]: unknown
}

/** 瞬间资源（UC 创建/更新接口要求的完整 Moment 请求体，裸 spec 会 500） */
export interface IMomentResource {
  apiVersion?: 'moment.halo.run/v1alpha1'
  kind?: 'Moment'
  metadata?: {
    /** 更新时必传 */
    name?: string
    /** 创建时用 generateName 让服务端生成 name */
    generateName?: string
    [key: string]: unknown
  }
  spec: IMomentSpec
}
