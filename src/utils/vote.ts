/**
 * 投票工具
 * 投票状态计算、UID 缓存、投票周期判断
 */
import { getCache, setCache } from './storage'

/** 投票 UID 缓存 key */
const UnihaloVoteUid = 'unihalo_vote_uid'

export type VoteType = 'single' | 'multiple' | 'pk'
export type VoteState = 'not-voted' | 'voting' | 'voted' | 'vote-ended'

/** 投票类型中文映射(key 为插件小写 type) */
export const VOTE_TYPES: Record<string, string> = {
  pk: '双选PK',
  multiple: '多选',
  single: '单选',
}

/** 投票状态常量(内部状态机) */
export const VOTE_STATES: { NOT_VOTED: VoteState, VOTING: VoteState, VOTED: VoteState, VOTE_ENDED: VoteState } = {
  NOT_VOTED: 'not-voted',
  VOTING: 'voting',
  VOTED: 'voted',
  VOTE_ENDED: 'vote-ended',
}

/** 投票展示状态(中文 + unocss 文字/背景色类) */
export const VOTE_STATE_LABELS: Record<string, { state: string, color: string, bgColor: string }> = {
  未开始: { state: '未开始', color: 'text-orange-400', bgColor: 'bg-orange-100' },
  进行中: { state: '进行中', color: 'text-white', bgColor: 'bg-green-500' },
  已结束: { state: '已结束', color: 'text-red-400', bgColor: 'bg-red-100' },
}

/**
 * 获取投票 UID(不存在则生成)
 */
export function getOrCreateVoteUid(): string {
  let uid = getCache<string>(UnihaloVoteUid)
  if (!uid) {
    uid = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    setCache(UnihaloVoteUid, uid)
  }
  return uid
}

/**
 * 计算投票展示状态
 * 非 custom 期限(permanent 等)直接看 hasEnded;custom 按起止时间判断
 * @param vote 投票对象(含 spec.timeLimit/hasEnded/startDate/endDate)
 * @returns { state: '未开始' | '进行中' | '已结束', color: unocss 文字色类, bgColor: unocss 背景色类 }
 */
export function calcVoteState(vote: { spec?: { timeLimit?: string, hasEnded?: boolean, startDate?: string, endDate?: string, [key: string]: unknown } }): {
  state: string
  color: string
  bgColor: string
} {
  if (vote.spec?.timeLimit !== 'custom') {
    return vote.spec?.hasEnded ? VOTE_STATE_LABELS['已结束'] : VOTE_STATE_LABELS['进行中']
  }

  const nowTime = new Date().getTime()
  const startTime = vote.spec?.startDate ? new Date(vote.spec.startDate).getTime() : nowTime
  const endTime = vote.spec?.endDate ? new Date(vote.spec.endDate).getTime() : nowTime

  if (nowTime < startTime) {
    return VOTE_STATE_LABELS['未开始']
  }
  if (nowTime < endTime) {
    return VOTE_STATE_LABELS['进行中']
  }
  return vote.spec?.hasEnded ? VOTE_STATE_LABELS['已结束'] : VOTE_STATE_LABELS['进行中']
}

/**
 * 计算选项票数占比(整数百分比)
 * @param vote 投票对象(含 stats.voteCount)
 * @param option 选项(含 count)
 */
export function calcVotePercent(vote: { stats?: { voteCount?: number } }, option: { count?: number }): number {
  const total = vote.stats?.voteCount || 0
  const count = option.count || 0
  if (total === 0) {
    return 0
  }
  return Math.round((count / total) * 100)
}

/** 投票缓存 key 前缀 */
const VOTE_CACHE_KEY = 'unihalo_vote_'

interface IVoteCacheData {
  selected: string[]
  data: unknown
}

/**
 * 投票缓存工具
 */
export const voteCacheUtil = {
  /** 是否已缓存(已投票) */
  has(name: string): boolean {
    return !!getCache<IVoteCacheData>(VOTE_CACHE_KEY + name)
  },
  /** 获取缓存数据 */
  get(name: string): IVoteCacheData | null {
    return getCache<IVoteCacheData>(VOTE_CACHE_KEY + name) || null
  },
  /** 写入缓存 */
  set(name: string, data: IVoteCacheData): void {
    setCache(VOTE_CACHE_KEY + name, data)
  },
}
