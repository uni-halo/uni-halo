/**
 * Halo 官方评论插件 API 类型定义
 * 对应 src/api/halo-plugin-official/comment.ts
 */

import type { IListResult, IMetadata } from '../halo'

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
