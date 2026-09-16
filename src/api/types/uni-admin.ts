/**
 * 管理模块（发布/管理内容）类型定义
 * 对应 PRD：docs/PRD-app-publish.md
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

/** 瞬间内容条目（瞬间插件 Moment spec.content） */
export interface IMomentContent {
  /** 内容类型：TEXT / QUOTE / PHOTO / VIDEO / AUDIO */
  type: 'TEXT' | 'QUOTE' | 'PHOTO' | 'VIDEO' | 'AUDIO'
  /** markdown 正文 */
  content: string
  /** 媒体资源（图片/视频 URL 列表） */
  medium?: {
    type: 'PHOTO' | 'VIDEO' | 'AUDIO'
    url: string
    originType?: string
    [key: string]: unknown
  }[]
  [key: string]: unknown
}

/** 创建/更新瞬间的请求体（瞬间插件 UC API） */
export interface IMomentSpec {
  /** 内容条目（通常单条） */
  content: IMomentContent
  /** 可见性：PUBLIC / PRIVATE */
  visible?: 'PUBLIC' | 'PRIVATE'
  /** 标签名列表 */
  tags?: string[]
  /** 发布时间（ISO 8601），缺省由服务端生成 */
  releaseTime?: string
  [key: string]: unknown
}
