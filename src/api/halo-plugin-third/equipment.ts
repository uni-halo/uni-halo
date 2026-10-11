/**
 * 装备管理插件 API（api.equipment.kunkunyu.com）
 * 插件地址：https://github.com/chengzhongxue/plugin-equipment
 */
import { http } from '@/http/alova'
import { RequestFrom } from '@/http/tools/enum'
import type { IResponse } from '@/http/types'
import type { IEquipmentGroupListReq, IEquipmentGroupListRes, IEquipmentListReq, IEquipmentListRes } from '../types/halo-plugin-third/equipment'

/**
 * 装备分组列表
 */
export function getEquipmentGroupList(params: IEquipmentGroupListReq) {
  return http.Get<IResponse<IEquipmentGroupListRes>>('/apis/api.equipment.kunkunyu.com/v1alpha1/equipmentgroups', {
    params,
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 装备列表(按分组)
 */
export function getEquipmentList(params: IEquipmentListReq) {
  return http.Get<IResponse<IEquipmentListRes>>('/apis/api.equipment.kunkunyu.com/v1alpha1/equipments', {
    params,
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}
