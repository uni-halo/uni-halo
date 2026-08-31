/**
 * URL 处理工具(源自旧项目 utils/index.js 的 URL 相关方法,按需命名导出)
 * 依赖 BASE_API(env)与应用图片配置(storage)
 */
import { getCache } from './storage'
import type { IAppConfig } from '@/api/types/uni-halo'

/** 应用配置存储 key(与 store/appConfig 保持一致) */
const APP_GLOBAL_CONFIGS_KEY = 'APP_GLOBAL_CONFIGS'

/** 基础请求地址(env) */
const BASE_API = import.meta.env.VITE_SERVER_BASEURL || ''

/** 读取应用配置(store 未就绪时兜底从 storage 解析) */
function getAppConfig(): Partial<IAppConfig> {
  return getCache<IAppConfig>(APP_GLOBAL_CONFIGS_KEY) || {}
}

/**
 * 检查是否为 http/https 链接
 */
export function checkIsUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

/**
 * 检查链接:相对路径补全为完整地址
 * @param url 原始链接
 */
export function checkUrl(url?: string): string {
  if (!url)
    return ''
  if (checkIsUrl(url))
    return url
  return BASE_API + url
}

/**
 * 检查封面图:无封面时使用默认封面,并追加版本参数避免缓存
 * @param thumbnail 封面图
 * @param mustRealUrl 是否必须返回真实地址
 */
export function checkThumbnailUrl(thumbnail?: string, mustRealUrl = false): string {
  if (!thumbnail && mustRealUrl) {
    return checkUrl(getAppConfig().imagesConfig?.defaultStaticThumbnailUrl)
  }
  let fallback = checkUrl(getAppConfig().imagesConfig?.defaultThumbnailUrl)
  fallback = appendNextVersion(fallback)
  if (!thumbnail)
    return fallback
  if (!checkIsUrl(thumbnail))
    return BASE_API + thumbnail
  return thumbnail
}

/**
 * 检查图片:无图片时使用默认图,并追加版本参数
 */
export function checkImageUrl(image?: string): string {
  let fallback = checkUrl(getAppConfig().imagesConfig?.defaultImageUrl)
  fallback = appendNextVersion(fallback)
  if (!image)
    return fallback
  if (!checkIsUrl(image))
    return BASE_API + image
  return image
}

/**
 * 检查头像:无头像时使用默认头像,并追加版本参数
 */
export function checkAvatarUrl(avatar?: string): string {
  if (!avatar) {
    return appendNextVersion(checkUrl(getAppConfig().imagesConfig?.defaultAvatarUrl))
  }
  if (!checkIsUrl(avatar))
    return BASE_API + avatar
  return avatar
}

/** 追加版本参数(?next-v=时间戳),避免图片缓存 */
function appendNextVersion(url: string): string {
  if (!url)
    return ''
  if (!url.includes('?')) {
    return `${url}?next-v=${Date.now()}`
  }
  return `${url}&next-v=${Date.now()}`
}
