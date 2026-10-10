/**
 * 绘画作品类型（插件端 Draw 模型；owner 由服务端读取时实时解析 User）
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
  /** 作者用户名（唯一标识，owner 隔离依据） */
  ownerName: string
  /** 审核状态 */
  status?: IDrawStatus
  /** 审核说明（拒绝时为原因） */
  reason?: string
  /** 审核人用户名 */
  reviewedBy?: string
  /** 审核时间（RFC3339） */
  reviewedAt?: string
}

/** 作者信息（服务端实时解析，昵称/头像始终最新） */
export interface IDrawOwner {
  /** 作者用户名 */
  username: string
  /** 作者昵称 */
  displayName?: string
  /** 作者头像链接 */
  avatar?: string
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
  /** 作者信息（读取时实时解析） */
  owner?: IDrawOwner
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

/** 发布请求 spec（ownerName/status 由服务端覆盖） */
export interface IDrawCreateSpec {
  title: string
  description?: string
  cover: string
  attachmentName?: string
}
