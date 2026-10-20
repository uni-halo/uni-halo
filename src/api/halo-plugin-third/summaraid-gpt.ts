/**
 * 智阅全能AI助手插件 API(halo-plugin-summaraidGPT)播客听读
 */
import { http } from '@/http/alova'
import { RequestFrom } from '@/http/tools/enum'
import type { IResponse } from '@/http/types'
import type { IPublicPodcast } from '../types/halo-plugin-third/summaraid-gpt'

const PREFIX = '/apis/api.summary.summaraidgpt.lik.cc/v1alpha1'

/**
 * 获取已发布文章的公开播客(标题 + 音频地址 + 逐轮时间戳)
 * 未生成或未发布时接口返回 404,调用方需自行静默处理
 */
export function getArticlePodcast(postName: string) {
  return http.Get<IResponse<IPublicPodcast>>(`${PREFIX}/articlePodcasts/${encodeURIComponent(postName)}`, {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}
