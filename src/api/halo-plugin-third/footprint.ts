/**
 * 足迹插件 API（halo-plugin-footprint）
 */
import { http } from '@/http/alova'
import { RequestFrom } from '@/http/tools/enum'
import type { IResponse } from '@/http/types'
import type { IFootprintListRes } from '../types/halo-plugin-third/footprint'

/** 足迹公开接口基础路径 */
const FOOTPRINT_BASE = '/apis/api.footprint.lik.cc/v1alpha1'

/**
 * 获取所有足迹
 */
export function getAllFootprints() {
  return http.Get<IResponse<IFootprintListRes>>(`${FOOTPRINT_BASE}/listAllFootprints`, {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}
