/**
 * 投票工具(源自旧项目 utils/vote.js,按需命名导出)
 * 投票状态计算、UID 缓存、投票周期判断
 */
import { getCache, setCache } from './storage'

/** 投票 UID 缓存 key */
const UnihaloVoteUid = 'unihalo_vote_uid'

export type VoteType = 'SINGLE' | 'MULTIPLE'
export type VoteState = 'not-voted' | 'voting' | 'voted' | 'vote-ended'

/** 投票类型常量 */
export const VOTE_TYPES: { SINGLE: VoteType, MULTIPLE: VoteType } = {
  SINGLE: 'SINGLE',
  MULTIPLE: 'MULTIPLE',
}

/** 投票状态常量 */
export const VOTE_STATES: { NOT_VOTED: VoteState, VOTING: VoteState, VOTED: VoteState, VOTE_ENDED: VoteState } = {
  NOT_VOTED: 'not-voted',
  VOTING: 'voting',
  VOTED: 'voted',
  VOTE_ENDED: 'vote-ended',
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
 * 计算投票状态
 * @param vote 投票对象(含 startTime/endTime/options)
 * @param voteTypes 已投票项
 * @param canAnonymously 是否允许匿名
 */
export function calcVoteState(
  vote: { startTime?: string, endTime?: string, [key: string]: unknown },
  voteTypes: string[],
  canAnonymously: boolean,
): VoteState {
  const now = Date.now()
  const startTime = vote.startTime ? new Date(vote.startTime).getTime() : now
  const endTime = vote.endTime ? new Date(vote.endTime).getTime() : now

  if (endTime < now)
    return VOTE_STATES.VOTE_ENDED
  if (startTime > now)
    return VOTE_STATES.NOT_VOTED
  if (voteTypes.length !== 0)
    return VOTE_STATES.VOTED
  if (!canAnonymously)
    return VOTE_STATES.NOT_VOTED
  return VOTE_STATES.VOTING
}

/**
 * 计算选项票数占比
 * @param vote 投票对象(含 stats.voteCount)
 * @param option 选项(含 count)
 */
export function calcVotePercent(vote: { stats?: { voteCount?: number } }, option: { count?: number }): number {
  const total = vote.stats?.voteCount || 0
  const count = option.count || 0
  if (total === 0)
    return 0
  return Number(((count / total) * 100).toFixed(2))
}

/** 投票缓存 key 前缀 */
const VOTE_CACHE_KEY = 'unihalo_vote_'

interface IVoteCacheData {
  selected: string[]
  data: unknown
}

/**
 * 投票缓存工具(源自旧项目 utils/vote.js 的 voteCacheUtil)
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
