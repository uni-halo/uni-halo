/**
 * 绘画作品类型（插件端 Draw 模型；owner 由服务端读取时实时解析 User）
 */

export type IDrawStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type IDrawPuzzleStatus = 'GUESSING' | 'REVEALED'

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
  /** 是否隐藏（隐藏后公开列表/详情不展示，不影响作者本人查看） */
  hidden?: boolean
  /** 审核说明（拒绝时为原因） */
  reason?: string
  /** 审核人用户名 */
  reviewedBy?: string
  /** 审核时间（RFC3339） */
  reviewedAt?: string
  /** 猜画谜底（≤20 字；仅出题人/管理端接口返回，公开接口恒为空） */
  puzzleAnswer?: string
  /** 猜画提示语（公开可见） */
  puzzleHint?: string
  /** 自动揭晓时间（RFC3339；null/空 = 永不自动揭晓） */
  autoRevealAt?: string
  /** 竞猜状态（无谜底时无意义） */
  puzzleStatus?: IDrawPuzzleStatus
  /** 揭晓时间（RFC3339） */
  revealedAt?: string
  /** 揭晓人（手动 = 出题人/管理员，自动 = system） */
  revealedBy?: string
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
  /** 猜画谜底（空 = 普通作品） */
  puzzleAnswer?: string
  /** 猜画提示语（选填） */
  puzzleHint?: string
  /** 自动揭晓时间（RFC3339；空 = 永不自动揭晓） */
  autoRevealAt?: string
}

/** 猜画作答结果 */
export interface IGuessResult {
  /** CORRECT / CLOSE（很接近）/ WRONG */
  result: 'CORRECT' | 'CLOSE' | 'WRONG'
  /** 谜底（仅 CORRECT 时返回，给猜中者本人看） */
  answer?: string
}

/** 猜中榜条目 */
export interface IGuessBoardItem {
  username: string
  displayName?: string
  avatar?: string
  /** 猜中时刻（RFC3339） */
  solvedAt?: string
}

/** 竞猜信息合一（未揭晓不含谜底，已揭晓附谜底） */
export interface IGuessBoard {
  revealed: boolean
  answer?: string
  puzzleHint?: string
  autoRevealAt?: string
  guessCount: number
  solvedCount: number
  board: IGuessBoardItem[]
}

/** 积分排行榜条目（score = 累计猜中画作数） */
export interface IGuessRankItem {
  rank: number
  username: string
  displayName?: string
  avatar?: string
  score: number
}

/** 竞猜记录（出题人/管理端视角） */
export interface IPuzzleRecord {
  username: string
  displayName?: string
  avatar?: string
  /** 猜者最近一次提交的答案 */
  answer?: string
  correct?: boolean
  /** 猜中时刻（RFC3339，未猜中为空） */
  solvedAt?: string
}

/** 竞猜管理信息（仅出题人/管理端，含谜底原文） */
export interface IPuzzleInfo {
  drawName?: string
  puzzleAnswer?: string
  puzzleHint?: string
  autoRevealAt?: string
  puzzleStatus?: IDrawPuzzleStatus
  revealedAt?: string
  revealedBy?: string
  guessCount: number
  solvedCount: number
  records: IPuzzleRecord[]
}
