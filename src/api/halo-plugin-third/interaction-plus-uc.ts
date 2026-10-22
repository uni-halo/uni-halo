/**
 * 互动增强插件 UC(用户中心)装扮 API
 * 仅操作当前登录用户自己的数据,需登录 token
 */
import { http } from '@/http/alova'
import { RequestFrom } from '@/http/tools/enum'
import type { IResponse } from '@/http/types'
import type {
  IDecorationInventoryItem,
  IDecorationProfileSaveReq,
  IDecorationProfileView,
  IDecorationVisibilityReq,
} from '../types/halo-plugin-third/interaction-plus-uc'

const UC_BASE = '/apis/uc.api.interaction-plus.timxs.com/v1alpha1'

/** 稀有度选项(元数据) */
export interface IDecorationRarity {
  metadata?: { name?: string }
  spec?: { displayName?: string, color?: string, [key: string]: unknown }
  [key: string]: unknown
}

/** 元数据选项(启用项:分类/标签/稀有度) */
export interface IDecorationMetadataRes {
  categories?: unknown[]
  tags?: unknown[]
  rarities?: IDecorationRarity[]
  [key: string]: unknown
}

/** 元数据选项(投稿表单与筛选用,装扮端仅取稀有度配色) */
export function getDecorationMetadata() {
  return http.Get<IResponse<IDecorationMetadataRes>>(`${UC_BASE}/metadata`, {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo, needAuthToken: true },
  })
}

/** 我的装饰库存(含不可用项,status 区分) */
export function getMyDecorationInventory() {
  return http.Get<IResponse<IDecorationInventoryItem[]>>(`${UC_BASE}/inventory`, {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo, needAuthToken: true },
  })
}

/** 当前佩戴视图 */
export function getMyDecorationProfile() {
  return http.Get<IResponse<IDecorationProfileView>>(`${UC_BASE}/profile`, {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo, needAuthToken: true },
  })
}

/** 保存佩戴(全量提交六槽,值为装饰资产内部名) */
export function saveMyDecorationProfile(data: IDecorationProfileSaveReq) {
  return http.Put<IResponse<IDecorationProfileView>>(`${UC_BASE}/profile`, data, {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo, needAuthToken: true },
  })
}

/** 保存装扮墙公开开关 */
export function saveMyDecorationVisibility(data: IDecorationVisibilityReq) {
  return http.Put<IResponse<IDecorationProfileView>>(`${UC_BASE}/profile/visibility`, data, {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo, needAuthToken: true },
  })
}
