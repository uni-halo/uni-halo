/**
 * URL 处理工具
 * 依赖 BASE_API(env),负责相对路径补全为完整地址
 */

/** 基础请求地址(env) */
const BASE_API = import.meta.env.VITE_SERVER_BASEURL || ''

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
 * 检查封面图:相对路径补全,并追加版本参数避免缓存
 * @param thumbnail 封面图
 * @param mustRealUrl 是否必须返回真实地址
 */
export function checkThumbnailUrl(thumbnail?: string, mustRealUrl = false): string {
  if (!thumbnail && mustRealUrl)
    return ''
  let fallback = ''
  if (!thumbnail)
    return fallback
  if (!checkIsUrl(thumbnail))
    return BASE_API + thumbnail
  return thumbnail
}

/**
 * 检查图片:相对路径补全,并追加版本参数
 */
export function checkImageUrl(image?: string): string {
  if (!image)
    return ''
  if (!checkIsUrl(image))
    return BASE_API + image
  return image
}

/**
 * 检查头像:相对路径补全,并追加版本参数
 */
export function checkAvatarUrl(avatar?: string): string {
  if (!avatar)
    return ''
  if (!checkIsUrl(avatar))
    return BASE_API + avatar
  return avatar
}
