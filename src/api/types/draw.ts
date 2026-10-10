/**
 * 绘画作品类型（插件端 Draw 模型）
 */

export type IDrawStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface IDrawSpec {
  /** 画作标题（≤50 字） */
  title: string
  /** 画作简介（选填） */
  description?: string
  /** 画作图片永久链接 */
  cover: string
  /** 关联附件名（清理留档） */
  attachmentName?: string
  /** 作者用户名（服务端强制覆盖） */
  owner: string
  /** 作者昵称快照 */
  ownerDisplayName?: string
  /** 审核状态 */
  status?: IDrawStatus
  /** 审核说明（拒绝时为原因） */
  reason?: string
  /** 审核人用户名 */
  reviewedBy?: string
  /** 审核时间（RFC3339） */
  reviewedAt?: string
}

export interface IDraw {
  apiVersion: string
  kind: string
  metadata: {
    name: string
    creationTimestamp?: string
    deletionTimestamp?: string
  }
  spec: IDrawSpec
}

/** 列表响应（Halo ListResult 结构） */
export interface IDrawListRes {
  page: number
  size: number
  total: number
  items: IDraw[]
  hasNext?: boolean
  hasPrevious?: boolean
}

/** 发布请求 spec（owner/status 由服务端覆盖） */
export interface IDrawCreateSpec {
  title: string
  description?: string
  cover: string
  attachmentName?: string
}
