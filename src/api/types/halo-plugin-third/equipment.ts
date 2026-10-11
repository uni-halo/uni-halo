/**
 * 装备管理插件 API 类型定义（equipment.kunkunyu.com）
 * 对应 src/api/halo-plugin-official/equipment.ts
 */

import type { IListResult, IMetadata } from '../halo'

export interface IEquipmentGroup {
  metadata: IMetadata
  spec: {
    displayName: string
    description?: string
    priority?: number
  }
  status?: {
    equipmentCount?: number
  }
}

export interface IEquipment {
  metadata: IMetadata
  spec: {
    displayName: string
    /** 规格参数 */
    specification?: string
    description?: string
    /** 封面图 */
    cover: string
    /** 相关链接（可选，无详情页，点击复制） */
    url?: string
    priority?: number
    groupName: string
  }
}

export interface IEquipmentGroupListReq {
  page?: number
  size?: number
  sort?: string[]
  [key: string]: unknown
}

export type IEquipmentGroupListRes = IListResult<IEquipmentGroup>

export interface IEquipmentListReq {
  page?: number
  size?: number
  sort?: string[]
  /** 按分组元数据名过滤，空为全部 */
  group?: string
  keyword?: string
  [key: string]: unknown
}

export type IEquipmentListRes = IListResult<IEquipment>
