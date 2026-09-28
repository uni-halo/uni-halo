/**
 * 投票插件 API 类型定义
 * 对应 src/api/halo-plugin-third/vote.ts
 */

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

/** 投票列表响应(Halo 标准 ListResult 结构) */
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
