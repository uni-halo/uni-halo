/**
 * Halo 官方评论插件 API(api.halo.run comments + api.commentwidget.halo.run)
 */
import { http } from '@/http/alova'
import { RequestFrom } from '@/http/tools/enum'
import type { IResponse } from '@/http/types'
import { getCache } from '@/utils/storage'
import { COMMENT_WIDGET_CAPTCHA_COOKIES } from '@/http/tools/commentCookies'
import type { IComment, ICommentListReq, ICommentListRes, ICommentReplyListRes } from '../types/halo-plugin-official/comment'

export { COMMENT_WIDGET_CAPTCHA_COOKIES }

/**
 * 评论列表
 */
export function getPostCommentList(params: ICommentListReq) {
  return http.Get<IResponse<ICommentListRes>>('/apis/api.halo.run/v1alpha1/comments', {
    params,
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 评论回复列表
 */
export function getPostCommentReplyList(commentName: string, params: ICommentListReq) {
  return http.Get<IResponse<ICommentReplyListRes>>(`/apis/api.halo.run/v1alpha1/comments/${commentName}/reply`, {
    params,
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/** 新增评论(带验证码,captchaCode 转入请求头) */
export interface IAddCommentReq {
  allowNotification: boolean
  raw: string
  content?: string
  owner?: Record<string, unknown>
  /** 评论目标引用(subjectRef: group/kind/name/version) */
  subjectRef?: {
    group: string
    kind: string
    name: string
    version?: string
  }
  /** 验证码,提交时转入 X-Captcha-Code 头 */
  captchaCode?: string
  /** 回复的回复:被引用回复(CommentReply)的 name */
  quoteReply?: string
}

/**
 * 新增评论(captchaCode 拆出转 X-Captcha-Code 头 + Cookie)
 *
 * 登录态下请求体省略 owner 时,服务端(CommentServiceImpl.populateOwner)
 * 会依据 Authorization token 自动解析当前用户为评论者
 */
export function addPostComment(data: IAddCommentReq) {
  const { captchaCode, ...rest } = data
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (captchaCode)
    headers['X-Captcha-Code'] = captchaCode
  const cookie = getCache<string>(COMMENT_WIDGET_CAPTCHA_COOKIES)
  if (cookie)
    headers.Cookie = cookie
  return http.Post<IResponse<IComment>>('/apis/api.halo.run/v1alpha1/comments', rest, {
    headers,
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo, needAuthToken: true },
  })
}

/**
 * 新增评论回复(同上,验证码逻辑;登录态省略 owner 时服务端依据 token 解析当前用户)
 */
export function addPostCommentReply(commentName: string, data: IAddCommentReq) {
  const { captchaCode, ...rest } = data
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (captchaCode)
    headers['X-Captcha-Code'] = captchaCode
  const cookie = getCache<string>(COMMENT_WIDGET_CAPTCHA_COOKIES)
  if (cookie)
    headers.Cookie = cookie
  return http.Post<IResponse<IComment>>(`/apis/api.halo.run/v1alpha1/comments/${commentName}/reply`, rest, {
    headers,
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo, needAuthToken: true },
  })
}

/**
 * 获取评论组件配置
 */
export function getCommentWidgetConfig() {
  return http.Get<IResponse<Record<string, unknown>>>('/apis/api.commentwidget.halo.run/v1alpha1/config', {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 获取评论验证码
 */
export function getCommentWidgetCaptcha() {
  return http.Get<IResponse<string>>('/apis/api.commentwidget.halo.run/v1alpha1/captcha/-/generate', {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}
