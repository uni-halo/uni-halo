/**
 * 绘画作品 API（插件端三组端点）
 *
 * 查询参数统一走 meta.query（uni 拦截器拼接），禁与 params 同传；
 * 需登录接口经 meta.needAuthToken 注入 token。
 */
import { http } from '@/http/alova'
import { RequestFrom } from '@/http/tools/enum'
import type { IResponse } from '@/http/types'
import type { IDraw, IDrawCreateSpec, IDrawListRes } from './types/draw'

const PUBLIC_DRAW_BASE = '/apis/api.unihalo.ialley.cn/v1alpha1/draws'
const UC_DRAW_BASE = '/apis/uc.api.unihalo.ialley.cn/v1alpha1/draws'
const DRAW_API_VERSION = 'unihalo.ialley.cn/v1alpha1'

/** 公开画作列表（匿名可看，服务端只返回已通过） */
export function getDrawList(params: { page?: number, size?: number } = {}) {
  return http.Get<IResponse<IDrawListRes>>(PUBLIC_DRAW_BASE, {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo, query: params },
  })
}

/** 公开画作详情（未通过/待审核返回 404） */
export function getDrawByName(name: string) {
  return http.Get<IResponse<IDraw>>(`${PUBLIC_DRAW_BASE}/${name}`, {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/** 我的绘画列表（需登录，owner=当前用户；status 非空时按状态筛选） */
export function getMyDrawList(params: { page?: number, size?: number, status?: string } = {}) {
  return http.Get<IResponse<IDrawListRes>>(UC_DRAW_BASE, {
    cacheFor: 0,
    meta: {
      requestFrom: RequestFrom.Halo,
      needAuthToken: true,
      query: params,
    },
  })
}

/** 发布绘画（完整资源体，owner/status 由服务端覆盖；需 uc-draw-use 角色） */
export function createMyDraw(spec: IDrawCreateSpec) {
  const body = {
    apiVersion: DRAW_API_VERSION,
    kind: 'Draw',
    metadata: { generateName: 'draw-' },
    spec,
  }
  return http.Post<IResponse<IDraw>>(UC_DRAW_BASE, body, {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo, needAuthToken: true },
  })
}

/** 删除我的绘画（仅本人） */
export function deleteMyDraw(name: string) {
  return http.Delete<IResponse<null>>(
    `${UC_DRAW_BASE}/${name}`,
    undefined,
    {
      cacheFor: 0,
      meta: { requestFrom: RequestFrom.Halo, needAuthToken: true },
    },
  )
}
