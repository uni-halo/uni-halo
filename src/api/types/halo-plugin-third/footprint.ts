/**
 * 足迹插件 API 类型定义（halo-plugin-footprint）
 * 对应 src/api/halo-plugin-third/footprint.ts
 */

/** 足迹 spec */
export interface IFootprintSpec {
  /** 足迹名称 */
  name?: string
  /** 足迹描述 */
  description?: string
  /** 经度(GCJ-02) */
  longitude?: number
  /** 纬度(GCJ-02) */
  latitude?: number
  /** 地址 */
  address?: string
  /** 足迹类型 */
  footprintType?: string
  /** 足迹图片 URL */
  image?: string
  /** 相关文章 URL */
  article?: string
  /** 创建时间(ISO-8601) */
  createTime?: string
}

/** 足迹(metadata + spec) */
export interface IFootprint {
  metadata?: {
    name?: string
    creationTimestamp?: string
    [key: string]: unknown
  }
  spec?: IFootprintSpec
  [key: string]: unknown
}

/** 所有足迹列表响应(数组) */
export type IFootprintListRes = IFootprint[]
