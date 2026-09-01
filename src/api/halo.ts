/**
 * Halo 官方 API 接口定义
 */
import { http } from '@/http/alova'
import { RequestFrom } from '@/http/tools/enum'
import type { IResponse } from '@/http/types'
import { getCache } from '@/utils/storage'
import { getNologinEmail, getOpenid } from '@/utils/auth'
import type {
  IBlogStats,
  ICategory,
  ICategoryListReq,
  ICategoryListRes,
  IComment,
  ICommentListReq,
  ICommentListRes,
  ILink,
  ILinkGroupListRes,
  ILinkListRes,
  IMoment,
  IMomentListReq,
  IMomentListRes,
  IPhotoGroupListReq,
  IPhotoGroupListRes,
  IPhotoListReq,
  IPhotoListRes,
  IPluginAvailable,
  IPost,
  IPostListReq,
  IPostListRes,
  ISearchReq,
  ISearchRes,
  ITagListRes,
  ITrackerCounterReq,
  IUpvoteReq,
} from './types/halo'

/** 评论验证码 cookie key */
const COMMENT_WIDGET_CAPTCHA_COOKIES = 'comment-widget-captcha'

/* ==================== 文章 ==================== */

/**
 * 文章列表
 */
export function getPostList(params: IPostListReq) {
  return http.Get<IResponse<IPostListRes>>('/apis/api.content.halo.run/v1alpha1/posts', {
    params,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 文章详情(带访客标识头)
 */
export function getPostByName(name: string) {
  return http.Get<IResponse<IPost>>(`/apis/api.content.halo.run/v1alpha1/posts/${name}`, {
    headers: {
      'Wechat-Session-Id': getOpenid(),
      'nologin-email': getNologinEmail(),
    },
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 关键词搜索文章
 */
export function getPostListByKeyword(params: ISearchReq) {
  return http.Post<IResponse<ISearchRes>>('/apis/api.halo.run/v1alpha1/indices/-/search', params, {
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/* ==================== 分类 / 标签 ==================== */

/**
 * 分类列表
 * 注:旧代码用 qs.stringify 特殊序列化(arrayFormat:'repeat'、allowDots),
 * alova 的 params 对数组默认即 repeat 形式(a=1&a=2),已等价;如遇嵌套对象场景再单独处理
 */
export function getCategoryList(params: ICategoryListReq) {
  return http.Get<IResponse<ICategoryListRes>>('/apis/api.content.halo.run/v1alpha1/categories', {
    params,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 分类下文章列表
 */
export function getCategoryPostList(name: string, params: IPostListReq) {
  return http.Get<IResponse<IPostListRes>>(`/apis/api.content.halo.run/v1alpha1/categories/${name}/posts`, {
    params,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 标签列表
 */
export function getTagList(params: ICategoryListReq) {
  return http.Get<IResponse<ITagListRes>>('/apis/api.content.halo.run/v1alpha1/tags', {
    params,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 标签下文章列表
 */
export function getPostByTagName(tagName: string, params: IPostListReq) {
  return http.Get<IResponse<IPostListRes>>(`/apis/api.content.halo.run/v1alpha1/tags/${tagName}/posts`, {
    params,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/* ==================== 评论(含验证码 cookie 链路) ==================== */

/**
 * 评论列表
 */
export function getPostCommentList(params: ICommentListReq) {
  return http.Get<IResponse<ICommentListRes>>('/apis/api.halo.run/v1alpha1/comments', {
    params,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 评论回复列表
 */
export function getPostCommentReplyList(commentName: string, params: ICommentListReq) {
  return http.Get<IResponse<ICommentListRes>>(`/apis/api.halo.run/v1alpha1/comments/${commentName}/reply`, {
    params,
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
}

/**
 * 新增评论(captchaCode 拆出转 X-Captcha-Code 头 + Cookie)
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
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 新增评论回复(同上,验证码逻辑)
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
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/* ==================== 瞬间 ==================== */

/**
 * 瞬间列表
 */
export function getMomentList(params: IMomentListReq) {
  return http.Get<IResponse<IMomentListRes>>('/apis/api.moment.halo.run/v1alpha1/moments', {
    params,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 瞬间详情
 */
export function getMomentByName(name: string) {
  return http.Get<IResponse<IMoment>>(`/apis/api.moment.halo.run/v1alpha1/moments/${name}`, {
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/* ==================== 图库 ==================== */

/**
 * 相册分组列表
 */
export function getPhotoGroupList(params: IPhotoGroupListReq) {
  return http.Get<IResponse<IPhotoGroupListRes>>('/apis/api.photo.halo.run/v1alpha1/photogroups', {
    params,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 照片列表(按相册)
 */
export function getPhotoListByGroupName(params: IPhotoListReq) {
  return http.Get<IResponse<IPhotoListRes>>('/apis/api.photo.halo.run/v1alpha1/photos', {
    params,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/* ==================== 友链 ==================== */

/**
 * 友链分组列表
 */
export function getFriendLinkGroupList(params: ICategoryListReq) {
  return http.Get<IResponse<ILinkGroupListRes>>('/apis/api.link.halo.run/v1alpha1/linkgroups', {
    params,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 友链列表
 */
export function getFriendLinkList(params: ICategoryListReq) {
  return http.Get<IResponse<ILinkListRes>>('/apis/api.link.halo.run/v1alpha1/links', {
    params,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/* ==================== 统计 / 埋点 / 插件 ==================== */

/**
 * 博客统计信息
 */
export function getBlogStatistics() {
  return http.Get<IResponse<IBlogStats>>('/apis/api.halo.run/v1alpha1/stats/-', {
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 提交点赞
 */
export function submitUpvote(data: IUpvoteReq) {
  return http.Post<IResponse<unknown>>('/apis/api.halo.run/v1alpha1/trackers/upvote', data, {
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 提交计数埋点
 */
export function postTrackersCounter(data: ITrackerCounterReq) {
  return http.Post<IResponse<unknown>>('/apis/api.halo.run/v1alpha1/trackers/counter', data, {
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 检查插件是否可用
 */
export function checkPluginAvailable(name: string) {
  return http.Get<IResponse<IPluginAvailable>>(`/apis/api.plugin.halo.run/v1alpha1/plugins/${name}/available`, {
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/** 分类资源(供加密分类判断等场景) */
export type { ICategory, ILink, IMoment, IPost }
