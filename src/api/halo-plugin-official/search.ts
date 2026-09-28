/**
 * Halo 官方搜索 API(api.halo.run indices,搜索组件插件)
 */
import { http } from '@/http/alova'
import { RequestFrom } from '@/http/tools/enum'
import type { IResponse } from '@/http/types'
import type { ISearchReq, ISearchRes } from '../types/halo-plugin-official/search'

/**
 * 关键词搜索笔记
 */
export function getPostListByKeyword(params: ISearchReq) {
  return http.Post<IResponse<ISearchRes>>('/apis/api.halo.run/v1alpha1/indices/-/search', params, {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}
