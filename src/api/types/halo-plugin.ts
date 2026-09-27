/**
 * Halo 插件 API 类型定义
 * 对应 src/api/halo-plugin.ts(第三方插件 api 端点)
 */

import type { IListResult } from './halo'

/* ==================== 项目集插件(halo-plugin-portfolio) ==================== */

/** 项目 */
export interface IProject {
  /** 项目名 */
  title: string
  /** 路由标识(详情页参数) */
  slug: string
  /** 简介 */
  summary?: string
  /** 正文(markdown/html) */
  content?: string
  /** 封面图 */
  cover?: string
  /** 平台 */
  platform?: string
  /** 类型(筛选维度) */
  type?: string
  /** 技术栈 */
  techStacks?: string[]
  /** 标签(筛选维度) */
  tags?: string[]
  /** 仓库地址 */
  repoUrl?: string
  /** 演示地址 */
  demoUrl?: string
  /** 文档地址 */
  docsUrl?: string
  /** 排序权重 */
  priority?: number
  /** 是否推荐 */
  featured?: boolean
  /** 状态(draft/published/archived) */
  status?: string
  createTime?: string
  updateTime?: string
}

/** 项目列表请求参数 */
export interface IProjectListReq {
  page?: number
  size?: number
  keyword?: string
  platform?: string
  type?: string
  tag?: string
  featured?: boolean
  sort?: string[]
}

export type IProjectListRes = IListResult<IProject>

/* ==================== 豆瓣插件(plugin-douban) ==================== */

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
