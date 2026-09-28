/**
 * 豆瓣插件 API(plugin-douban)
 */
import { http } from '@/http/alova'
import { RequestFrom } from '@/http/tools/enum'
import type { IResponse } from '@/http/types'
import type { IDoubanMovie, IDoubanMovieListReq, IDoubanMovieListRes, IDoubanTypeVo } from '../types/halo-plugin-third/douban'

/** 豆瓣公开接口基础路径 */
const DOUBAN_BASE = '/apis/api.douban.moony.la/v1alpha1'

/**
 * 豆瓣记录列表
 */
export function getDoubanMovieList(params: IDoubanMovieListReq) {
  return http.Get<IResponse<IDoubanMovieListRes>>(`${DOUBAN_BASE}/doubanmovies`, {
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
