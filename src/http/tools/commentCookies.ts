/**
 * 评论验证码 cookie 保存(源自旧项目 common/http/interceptors.js 的 saveCookies)
 * 仅 APP/微信小程序端需要手动存取 cookie(H5 浏览器自动管理)
 */
import { setCache } from '@/utils/storage'
import { extractCookieItem, getHeaderCaseInsensitive } from '@/utils/cookies'

/** 评论验证码 cookie key */
export const COMMENT_WIDGET_CAPTCHA_COOKIES = 'comment-widget-captcha'

/** 需要保存 cookie 的评论相关接口 */
const MATCH_COMMENT_APIS = [
  '/apis/api.commentwidget.halo.run/v1alpha1/captcha/-/generate',
  '/apis/api.halo.run/v1alpha1/comments',
]

/**
 * 从响应头保存评论验证码 cookie
 * @param url 请求地址
 * @param header 响应头
 */
export function saveCommentCookies(url: string, header: Record<string, string> | undefined): void {
  // app/小程序 将 cookies 存储起来
  // #ifdef MP-WEIXIN || APP-PLUS
  if (MATCH_COMMENT_APIS.some(api => url.includes(api))) {
    const cookies = getHeaderCaseInsensitive(header, 'set-cookie')
    if (cookies) {
      setCache(COMMENT_WIDGET_CAPTCHA_COOKIES, extractCookieItem(cookies, COMMENT_WIDGET_CAPTCHA_COOKIES))
    }
  }
  // #endif
}
