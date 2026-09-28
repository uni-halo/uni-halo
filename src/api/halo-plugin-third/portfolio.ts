/**
 * 项目集插件 API(halo-plugin-portfolio)
 */
import { http } from '@/http/alova'
import { RequestFrom } from '@/http/tools/enum'
import type { IResponse } from '@/http/types'
import type { IProject, IProjectListReq, IProjectListRes } from '../types/halo-plugin-third/portfolio'

/** 项目集公开接口基础路径 */
const PORTFOLIO_BASE = '/apis/public.portfolio.muyin.site/v1alpha1/projects'

/**
 * 公开项目列表
 */
export function getProjectList(params: IProjectListReq) {
  return http.Get<IResponse<IProjectListRes>>(`${PORTFOLIO_BASE}/list`, {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo, query: params },
  })
}

/**
 * 推荐项目列表
 */
export function getFeaturedProjects(params: IProjectListReq) {
  return http.Get<IResponse<IProjectListRes>>(`${PORTFOLIO_BASE}/featured`, {
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
