/**
 * 通用缓存(带过期时间)
 * 源自旧项目 utils/storage.js,按需命名导出
 */

interface ICacheItem<T> {
  data: T
  /** 存储时间戳(秒) */
  time: number
  /** 过期时间(秒),0 表示永久有效 */
  expire: number
}

/**
 * 设置缓存
 * @param key 缓存 key
 * @param value 存储值
 * @param expire 过期时间(秒),默认 0 永久有效
 */
export function setCache<T>(key: string, value: T, expire = 0): void {
  const obj: ICacheItem<T> = {
    data: value,
    time: Date.now() / 1000,
    expire,
  }
  uni.setStorageSync(key, JSON.stringify(obj))
}

/**
 * 获取缓存,过期自动清除并返回 null
 */
export function getCache<T>(key: string): T | null {
  const val = uni.getStorageSync(key)
  if (!val)
    return null
  let item: ICacheItem<T>
  try {
    item = JSON.parse(val)
  }
  catch {
    return null
  }
  if (item.expire && Date.now() / 1000 - item.time > item.expire) {
    uni.removeStorageSync(key)
    return null
  }
  return item.data
}

/**
 * 删除缓存
 */
export function delCache(key: string): void {
  uni.removeStorageSync(key)
}
