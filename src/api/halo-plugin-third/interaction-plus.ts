/**
 * 互动增强插件 API(api.interaction-plus.timxs.com)
 */
import { http } from '@/http/alova'
import { RequestFrom } from '@/http/tools/enum'
import type { IResponse } from '@/http/types'
import type { IBatchIdentitiesRes, IDecorationWallItem, IPublicIdentity } from '../types/halo-plugin-third/interaction-plus'

const BASE = '/apis/api.interaction-plus.timxs.com/v1alpha1'

/**
 * 单用户公开身份
 */
export function getPublicIdentity(userName: string) {
  return http.Get<IResponse<IPublicIdentity>>(`${BASE}/identity/${userName}`, {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 批量公开身份(单次最多 50,自动去重)
 */
export function getBatchIdentities(userNames: string[]) {
  return http.Post<IResponse<IBatchIdentitiesRes>>(`${BASE}/identities`, { userNames }, {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 用户装饰墙(尊重用户公开开关,关闭返回空数组)
 */
export function getDecorationWall(userName: string) {
  return http.Get<IResponse<IDecorationWallItem[]>>(`${BASE}/identity/${userName}/decorations`, {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}
