/**
 * 数据看板插件 API(api.data.statistics.xhhao.com)
 */
import { http } from '@/http/alova'
import { RequestFrom } from '@/http/tools/enum'
import type { IResponse } from '@/http/types'
import type { IDataStatistics } from '../types/halo-plugin-third/data-visual'

/**
 * 获取图表统计数据
 * @description 标签、分类、笔记发布趋势、评论活跃用户、热门笔记 top10
 */
export function getChartData() {
  return http.Get<IResponse<IDataStatistics>>('/apis/api.data.statistics.xhhao.com/v1alpha1/chart/data', {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 获取 Github 配置信息
 */
export function getGithubConfig() {
  return http.Get<IResponse<unknown>>('/apis/api.data.statistics.xhhao.com/v1alpha1/github/config', {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 获取 Uptime Kuma 状态页面数据
 */
export function getUptimeKumaStatus() {
  return http.Get<IResponse<unknown>>('/apis/api.data.statistics.xhhao.com/v1alpha1/uptime/status', {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}
