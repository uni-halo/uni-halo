/**
 * Halo 插件 API 接口定义
 * 项目集插件(halo-plugin-portfolio)、豆瓣插件(plugin-douban)
 */
import { http } from '@/http/alova'
import { RequestFrom } from '@/http/tools/enum'
import type { IResponse } from '@/http/types'
import type { IDoubanMovie, IDoubanMovieListReq, IDoubanMovieListRes, IDoubanTypeVo, IProject, IProjectListReq, IProjectListRes } from './types/halo-plugin'

/* ==================== 项目集插件 ==================== */

/** 项目集公开接口基础路径 */
const PORTFOLIO_BASE = '/apis/public.portfolio.muyin.site/v1alpha1/projects'

/**
 * 公开项目列表
 */
export function getProjectList(params: IProjectListReq) {
  return http.Get<IResponse<IProjectListRes>>(`${PORTFOLIO_BASE}/list`, {
    params,
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo, query: params },
  })
}

/**
 * 推荐项目列表
 */
export function getFeaturedProjects(params: IProjectListReq) {
  return http.Get<IResponse<IProjectListRes>>(`${PORTFOLIO_BASE}/featured`, {
    params,
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo, query: params },
  })
}

/**
 * 公开项目详情
 */
export function getProjectDetail(slug: string) {
  return http.Get<IResponse<IProject>>(`${PORTFOLIO_BASE}/${slug}`, {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/* ==================== 豆瓣插件 ==================== */

/** 豆瓣公开接口基础路径 */
const DOUBAN_BASE = '/apis/api.douban.moony.la/v1alpha1'

/**
 * 豆瓣记录列表
 */
export function getDoubanMovieList(params: IDoubanMovieListReq) {
  return http.Get<IResponse<IDoubanMovieListRes>>(`${DOUBAN_BASE}/doubanmovies`, {
    params,
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo, query: params },
  })
}

/**
 * 豆瓣类型列表
 */
export function getDoubanTypes() {
  return http.Get<IResponse<IDoubanTypeVo[]>>(`${DOUBAN_BASE}/doubanmovies/-/types`, {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 豆瓣流派/标签列表
 */
export function getDoubanGenres(type?: string) {
  return http.Get<IResponse<string[]>>(`${DOUBAN_BASE}/doubanmovies/-/genres`, {
    params: type ? { type } : undefined,
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 豆瓣详情（按豆瓣条目链接）
 */
export function getDoubanDetail(url: string) {
  return http.Get<IResponse<IDoubanMovie>>(`${DOUBAN_BASE}/doubanmovies/-/getDoubanDetail`, {
    params: { url },
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}
