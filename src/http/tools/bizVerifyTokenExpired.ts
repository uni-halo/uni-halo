import { ResultEnum } from './enum'
import { useTokenStore } from '@/store/token'

const ignoreUrls = ['/apis/api.unihalo.ialley.cn/v1alpha1/auth/-/logout']

/**
 * 验证token是否过期
 * @param {statusCode,url} - 响应状态码和请求url
 */
export function bizVerifyTokenExpired({ url, statusCode }: { url: string, statusCode: number }): boolean {
  if (ignoreUrls.includes(url)) {
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
