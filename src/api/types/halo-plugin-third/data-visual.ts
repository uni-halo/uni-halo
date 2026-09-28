/**
 * 数据看板插件 API 类型定义
 * 对应 src/api/halo-plugin-third/data-visual.ts
 */

/** 图表统计数据 */
export interface IDataStatistics {
  tags: { name: string, count: number }[]
  categories: { name: string, total: number }[]
  /** 发布趋势:articleTotal=当日笔记数,momentTotal=当日瞬间数,total=二者之和 */
  articles: { date: string, articleTotal: number, momentTotal: number, name: string, total: number }[]
  comments: { username: string, count: number }[]
  top10Articles: { name: string, views: number }[]
  [key: string]: unknown
}
