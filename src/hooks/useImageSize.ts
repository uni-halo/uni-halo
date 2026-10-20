/**
 * 图片宽高测量与缓存
 */

export interface IImageSize {
  width: number
  height: number
}

/** 图片宽高测量与缓存 */
export function useImageSize() {
  const cache = new Map<string, IImageSize>()

  /** 缓存的宽高 */
  function getCachedSize(url: string): IImageSize | undefined {
    return cache.get(url)
  }

  /** 获取图片宽高（超时或失败返回 null） */
  async function fetchImageSize(url: string, timeoutMs = 3000): Promise<IImageSize | null> {
    if (!url) {
      return null
    }
    const cached = cache.get(url)
    if (cached) {
      return cached
    }
    try {
      const size = await withTimeout(loadImageSize(url), timeoutMs)
      if (size.width > 0 && size.height > 0) {
        cache.set(url, size)
        return size
      }
    }
    catch (err) {
      console.error('获取图片宽高失败', err)
    }
    return null
  }

  return { getCachedSize, fetchImageSize }
}

/** 加载图片宽高 */
function loadImageSize(url: string): Promise<IImageSize> {
  return new Promise((resolve, reject) => {
    uni.getImageInfo({
      src: url,
      success: res => resolve({ width: res.width, height: res.height }),
      fail: err => reject(err),
    })
  })
}

/** 带超时的 Promise */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}
