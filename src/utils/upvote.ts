/**
 * 点赞状态工具
 * 笔记/瞬间点赞状态本地缓存
 */
import { getCache, setCache } from './storage'

const upvote = {
  key: 'upvote_records',
  maxLength: 300,
}

/** 获取已点赞记录列表 */
function getRecords(): string[] {
  return getCache<string[]>(upvote.key) || []
}

/** 保存点赞记录列表 */
function setRecords(list: string[]) {
  setCache(upvote.key, list)
}

/**
 * 是否已点赞
 * @param key 点赞目标标识(如 post name)
 */
export function hasUpvoted(key: string): boolean {
  return getRecords().includes(key)
}

/**
 * 记录点赞(超过最大长度时清空旧记录)
 * @param key 点赞目标标识
 */
export function addUpvoteRecord(key: string) {
  const list = getRecords()
  if (list.length >= upvote.maxLength) {
    // 记录过多时重置
    setRecords([key])
    return
  }
  if (!list.includes(key)) {
    list.push(key)
    setRecords(list)
  }
}
