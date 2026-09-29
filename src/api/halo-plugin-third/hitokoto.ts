/**
 * 轻言插件 API(plugin-hitokoto-hub)
 */
import { http } from '@/http/alova'
import { RequestFrom } from '@/http/tools/enum'
import type { IResponse } from '@/http/types'
import type { IHitokotoLikeReq, IHitokotoRandomReq, IHitokotoRandomSentenceResponse, IHitokotoSentence } from '../types/halo-plugin-third/hitokoto'

const PREFIX = '/apis/public.api.hitokotohub.puresky.top/v1alpha1'

/**
 * 随机获取句子
 */
export function getHitokotoRandom(params?: IHitokotoRandomReq) {
  return http.Get<IResponse<IHitokotoRandomSentenceResponse>>(`${PREFIX}/sentence/random`, {
    params,
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 点赞 / 取消点赞
 */
export function likeHitokoto(params: IHitokotoLikeReq) {
  return http.Get(`${PREFIX}/sentence/like`, {
    params,
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}
