/**
 * Halo 官方 API 接口定义
 */
import { http } from '@/http/alova'
import { RequestFrom } from '@/http/tools/enum'
import type { IResponse } from '@/http/types'
import { getNologinEmail, getOpenid } from '@/utils/auth'
import type {
  IBlogStats,
  ICategory,
  ICategoryListReq,
  ICategoryListRes,
  IMoment,
  IMomentListReq,
  IMomentListRes,
  IPost,
  IPostListReq,
  IPostListRes,
  ITagListRes,
  ITrackerCounterReq,
  IUcPostListRes,
  IUpvoteReq,
} from './types/halo'

/* ==================== 笔记 ==================== */

/**
 * 笔记列表
 */
export function getPostList(params: IPostListReq) {
  return http.Get<IResponse<IPostListRes>>('/apis/api.content.halo.run/v1alpha1/posts', {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo, query: params },
  })
}

/**
 * UC「我的笔记」列表(服务端强制 owner=当前登录用户)。
 * 个人主页走 UC 接口:公开接口 fieldSelector=spec.owner 实测查不到内容。
 * 固定 publishPhase=PUBLISHED 仅返回已发布,与站点可见性保持一致。
 * 响应为 UC ListedPost 结构(post 包裹 + 顶层 owner/stats),调用方需 mapUcListedPost 映射。
 * RBAC 前提:登录默认角色需聚合 uc.api.content.halo.run posts 的 list 权限。
 */
export function getUcMyPostList(params: { page?: number, size?: number, sort?: string[] }) {
  return http.Get<IResponse<IUcPostListRes>>('/apis/uc.api.content.halo.run/v1alpha1/posts', {
    cacheFor: 0,
    meta: {
      requestFrom: RequestFrom.Halo,
      needAuthToken: true,
      query: { ...params, publishPhase: 'PUBLISHED' },
    },
  })
}

/**
 * 笔记详情(带访客标识头)
 */
export function getPostByName(name: string) {
  return http.Get<IResponse<IPost>>(`/apis/api.content.halo.run/v1alpha1/posts/${name}`, {
    headers: {
      'Wechat-Session-Id': getOpenid(),
      'nologin-email': getNologinEmail(),
    },
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/* ==================== 分类 / 标签 ==================== */

/**
 * 分类列表
 */
export function getCategoryList(params: ICategoryListReq) {
  return http.Get<IResponse<ICategoryListRes>>('/apis/api.content.halo.run/v1alpha1/categories', {
    params,
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 分类下笔记列表
 */
export function getCategoryPostList(name: string, params: IPostListReq) {
  return http.Get<IResponse<IPostListRes>>(`/apis/api.content.halo.run/v1alpha1/categories/${name}/posts`, {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo, query: params },
  })
}

/**
 * 标签列表
 */
export function getTagList(params: ICategoryListReq) {
  return http.Get<IResponse<ITagListRes>>('/apis/api.content.halo.run/v1alpha1/tags', {
    params,
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 标签下笔记列表
 */
export function getPostByTagName(tagName: string, params: IPostListReq) {
  return http.Get<IResponse<IPostListRes>>(`/apis/api.content.halo.run/v1alpha1/tags/${tagName}/posts`, {
    params,
    cacheFor: 0,
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
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 瞬间详情
 */
export function getMomentByName(name: string) {
  return http.Get<IResponse<IMoment>>(`/apis/api.moment.halo.run/v1alpha1/moments/${name}`, {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/* ==================== 统计 / 埋点 / 插件 ==================== */

/**
 * 博客统计信息
 */
export function getBlogStatistics() {
  return http.Get<IResponse<IBlogStats>>('/apis/api.halo.run/v1alpha1/stats/-', {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 提交点赞
 */
export function submitUpvote(data: IUpvoteReq) {
  return http.Post<IResponse<unknown>>('/apis/api.halo.run/v1alpha1/trackers/upvote', data, {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 提交计数埋点
 */
export function postTrackersCounter(data: ITrackerCounterReq) {
  return http.Post<IResponse<unknown>>('/apis/api.halo.run/v1alpha1/trackers/counter', data, {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 检查插件是否可用
 */
export function checkPluginAvailable(name: string) {
  return http.Get<IResponse<boolean>>(`/apis/api.plugin.halo.run/v1alpha1/plugins/${name}/available`, {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/** 分类资源(供加密分类判断等场景) */
export type { ICategory, IMoment, IPost }
