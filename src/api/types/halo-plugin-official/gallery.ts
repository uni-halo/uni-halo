/**
 * Halo 官方图库插件 API 类型定义
 * 对应 src/api/halo-plugin-official/gallery.ts
 */

import type { IListResult, IMetadata } from '../halo'

export interface IPhotoGroup {
  metadata: IMetadata
  spec: {
    displayName: string
    description?: string
    priority?: number
    cover?: string
  }
  status?: {
    permalink?: string
    photoCount?: number
  }
}

export interface IPhoto {
  metadata: IMetadata
  spec: {
    displayName: string
    description?: string
    url: string
    /** 封面图(部分接口返回) */
    cover?: string
    priority?: number
    takeTime?: string
    location?: string
    latitude?: number
    longitude?: number
  }
}

export interface IPhotoGroupListReq {
  page?: number
  size?: number
  sort?: string[]
  [key: string]: unknown
}

export type IPhotoGroupListRes = IListResult<IPhotoGroup>

export interface IPhotoListReq {
  page?: number
  size?: number
  sort?: string[]
  groupName?: string
  [key: string]: unknown
}

export type IPhotoListRes = IListResult<IPhoto>
