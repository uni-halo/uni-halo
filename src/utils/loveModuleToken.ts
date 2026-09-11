/**
 * 恋爱模块入口解锁 token 管理（插件端 POST /love-modules/unlock 签发，HMAC 30 分钟有效）
 * 模块 scope：loveDiary(恋爱日记入口/恋爱页本身) / ourStory(恋爱故事) /
 * lovePhoto(恋爱相册) / loveDaily(恋爱清单)
 */
import { delCache, getCache, setCache } from '@/utils/storage'

/** 恋爱模块解锁 token 存储键（module → token） */
const LOVE_MODULE_TOKEN_KEY = 'uh_love_module_token_v1'
/** 解锁 token 有效期（与后端约定一致：HMAC 30 分钟，过期由 getCache 自动清除，服务端 401 兜底） */
const LOVE_MODULE_TOKEN_TTL_SECONDS = 30 * 60

export type LoveModuleKey = 'loveDiary' | 'ourStory' | 'lovePhoto' | 'loveDaily'

/** 读取指定模块的解锁 token（未解锁或已过期则 undefined） */
export function getLoveModuleToken(module: LoveModuleKey): string | undefined {
  const cache = getCache<Record<string, string>>(LOVE_MODULE_TOKEN_KEY)
  return cache?.[module]
}

/** 保存指定模块的解锁 token（30 分钟失效存储；过期由 getCache 自动清除，服务端 401 兜底重新解锁） */
export function setLoveModuleToken(module: LoveModuleKey, token: string): void {
  const cache = getCache<Record<string, string>>(LOVE_MODULE_TOKEN_KEY) || {}
  cache[module] = token
  setCache(LOVE_MODULE_TOKEN_KEY, cache, LOVE_MODULE_TOKEN_TTL_SECONDS)
}

/** 清除指定模块的解锁 token（401 locked 时调用，回到未解锁状态） */
export function clearLoveModuleToken(module: LoveModuleKey): void {
  const cache = getCache<Record<string, string>>(LOVE_MODULE_TOKEN_KEY)
  if (cache && module in cache) {
    delete cache[module]
    setCache(LOVE_MODULE_TOKEN_KEY, cache)
  }
}

/** 恋爱模块数据接口 401 locked 处理（清除 token + 提示，返回是否命中 locked） */
export function handleLoveModuleLocked(module: LoveModuleKey, err: unknown): boolean {
  // alova 错误：err.cause?.response?.status === 401 且响应体 reason === 'locked'
  const status = (err as { cause?: { response?: { status?: number } } })?.cause?.response?.status
  if (status === 401) {
    clearLoveModuleToken(module)
    uni.showToast({ icon: 'none', title: '访问密码已失效，请返回重新解锁' })
    return true
  }
  return false
}
