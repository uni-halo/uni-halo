/**
 * 图片缓存工具(源自旧项目 utils/imageCache.js,按需命名导出)
 * 下载图片到本地缓存(APP 端),返回本地路径
 */
import { checkIsUrl } from './url'

const CACHE_PREFIX = 'IMAGE_CACHE_'

/**
 * 缓存图片(存在则直接返回缓存路径,否则下载)
 * @param url 图片远程地址
 * @returns 可用的本地/远程路径
 */
export function getCachedImage(url: string): Promise<string> {
  return new Promise((resolve) => {
    if (!checkIsUrl(url)) {
      resolve(url)
      return
    }
    const key = CACHE_PREFIX + url
    // #ifdef APP-PLUS
    const cached = uni.getStorageSync(key)
    if (cached) {
      resolve(cached)
      return
    }
    uni.downloadFile({
      url,
      success: (res) => {
        if (res.statusCode === 200) {
          try {
            uni.setStorageSync(key, res.tempFilePath)
            resolve(res.tempFilePath)
          }
          catch (e) {
            console.error('图片缓存写入失败', e)
            resolve(url)
          }
        }
        else {
          resolve(url)
        }
      },
      fail: () => {
        resolve(url)
      },
    })
    // #endif
    // #ifndef APP-PLUS
    resolve(url)
    // #endif
  })
}
