/**
 * Halo 官方友链插件 API 类型定义
 * 对应 src/api/halo-plugin-official/friend-links.ts
 */

import type { IListResult, IMetadata } from '../halo'

export interface ILinkGroup {
  metadata: IMetadata
  spec: {
    displayName: string
    priority?: number
    description?: string
  }
}

export interface ILink {
  metadata: IMetadata
  spec: {
    displayName: string
    url: string
    logo: string
    description?: string
    priority?: number
    groupName?: string
  }
}

export interface ILinkGroupListReq {
  page?: number
  size?: number
  sort?: string[]
  [key: string]: unknown
}

export type ILinkGroupListRes = IListResult<ILinkGroup>

export interface ILinkListReq {
  page?: number
  size?: number
  sort?: string[]
  [key: string]: unknown
}

export type ILinkListRes = IListResult<ILink>
