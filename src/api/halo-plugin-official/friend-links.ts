/**
 * Halo 官方友链插件 API(api.link.halo.run)
 */
import { http } from '@/http/alova'
import { RequestFrom } from '@/http/tools/enum'
import type { IResponse } from '@/http/types'
import type { ICategoryListReq } from '../types/halo'
import type { ILinkGroup, ILinkGroupListReq, ILinkListReq, ILinkListRes } from '../types/halo-plugin-official/friend-links'

/**
 * 友链分组列表
 */
export function getFriendLinkGroupList(params: ICategoryListReq | ILinkGroupListReq) {
  return http.Get<IResponse<ILinkGroup[]>>('/apis/api.link.halo.run/v1alpha1/linkgroups', {
    params,
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 友链列表
 */
export function getFriendLinkList(params: ICategoryListReq | ILinkListReq) {
  return http.Get<IResponse<ILinkListRes>>('/apis/api.link.halo.run/v1alpha1/links', {
    params,
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}
