/**
 * Halo 官方图库插件 API(api.photo.halo.run)
 */
import { http } from '@/http/alova'
import { RequestFrom } from '@/http/tools/enum'
import type { IResponse } from '@/http/types'
import type { IPhotoGroupListReq, IPhotoGroupListRes, IPhotoListReq, IPhotoListRes } from '../types/halo-plugin-official/gallery'

/**
 * 相册分组列表
 */
export function getPhotoGroupList(params: IPhotoGroupListReq) {
  return http.Get<IResponse<IPhotoGroupListRes>>('/apis/api.photo.halo.run/v1alpha1/photogroups', {
    params,
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 照片列表(按相册)
 */
export function getPhotoListByGroupName(params: IPhotoListReq) {
  return http.Get<IResponse<IPhotoListRes>>('/apis/api.photo.halo.run/v1alpha1/photos', {
    params,
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}
