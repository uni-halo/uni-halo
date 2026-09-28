/**
 * 豆瓣插件 API 类型定义
 * 对应 src/api/halo-plugin-third/douban.ts
 */

import type { IListResult } from '../halo'

/** 豆瓣记录 */
export interface IDoubanMovie {
  id?: string
  creationTimestamp?: string
  /** 标题 */
  name?: string
  /** 海报图 */
  poster?: string
  /** 豆瓣条目链接 */
  link?: string
  doubanId?: string
  /** 豆瓣评分 */
  score?: string
  _score?: number
  year?: string
  /** 类型(movie/music/book/game/drama) */
  type?: string
  /** 上映/出版日期 */
  pubdate?: string
  /** 卡片副标题 */
  cardSubtitle?: string
  dataType?: string
  /** 流派/标签 */
  genres?: string[]
  /** 我的短评 */
  favesRemark?: string
  favesCreateTime?: string
  /** 我的评分 */
  favesScore?: string
  favesStatus?: string
  /** 简介 HTML(仅 getDoubanDetail 实时抓取返回) */
  content?: string
}

/** 豆瓣记录列表请求参数 */
export interface IDoubanMovieListReq {
  page?: number
  size?: number
  keyword?: string
  type?: string
  status?: string
  dataType?: string
  genre?: string[]
  sort?: string[]
}

export type IDoubanMovieListRes = IListResult<IDoubanMovie>

/** 豆瓣类型项 */
export interface IDoubanTypeVo {
  type?: string
  count?: number
  [key: string]: unknown
}

/** 豆瓣条目详情(getDoubanDetail 实时抓取) */
export interface IDoubanDetail {
  title?: string
  poster?: string
  rating?: string
  year?: string
  [key: string]: unknown
}
