import { ResultEnum } from './enum'
import { useTokenStore } from '@/store/token'

// 忽略的url(前缀匹配;这些接口可能因验证码等非token过期原因返回401)
const ignoreUrls = [
  '/apis/api.unihalo.ialley.cn/v1alpha1/auth/-/logout',
  '/apis/api.halo.run/v1alpha1/comments',
]

/**
 * 验证token是否过期
 * @param {statusCode,url} - 响应状态码和请求url
 */
export function bizVerifyTokenExpired({ url, statusCode }: { url: string, statusCode: number }): boolean {
  if (ignoreUrls.some(prefix => url.startsWith(prefix))) {
    return false
  }

  if (statusCode === ResultEnum.Unauthorized) {
    useTokenStore().clearAllLoginInfo()
    uni.showToast({
      title: '登录过期，请重新登录',
      icon: 'none',
    })
    setTimeout(() => {
      uni.switchTab({
        url: '/pages/tabbar/home/home',
      })
    }, 1500)
    return true
  }
  return false
}
