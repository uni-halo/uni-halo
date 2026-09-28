/**
 * 项目集插件 API 类型定义
 * 对应 src/api/halo-plugin-third/portfolio.ts
 */

import type { IListResult } from '../halo'

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
