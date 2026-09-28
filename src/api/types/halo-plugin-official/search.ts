/**
 * Halo 官方搜索 API 类型定义
 * 对应 src/api/halo-plugin-official/search.ts
 */

import type { IListResult, IPost } from '../halo'

/** 笔记搜索请求参数(关键字) */
export interface ISearchReq {
  keyword?: string
  /** 返回条数上限(默认 50) */
  limit?: number
  page?: number
  size?: number
  highlightPreTag?: string
  highlightPostTag?: string
}

export type ISearchRes = IListResult<IPost>
