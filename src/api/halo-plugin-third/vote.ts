/**
 * 投票插件 API(api.vote.kunkunyu.com)
 */
import { http } from '@/http/alova'
import { RequestFrom } from '@/http/tools/enum'
import type { IResponse } from '@/http/types'
import { getPersonalToken } from '@/store/token'
import type { IVoteDetail, IVoteListReq, IVoteListRes, IVoteSubmitReq } from '../types/halo-plugin-third/vote'

/**
 * 投票列表
 */
export function getVoteList(params: IVoteListReq) {
  return http.Get<IResponse<IVoteListRes>>('/apis/api.vote.kunkunyu.com/v1alpha1/votes', {
    params,
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 投票详情
 */
export function getVoteDetail(name: string) {
  return http.Get<IResponse<IVoteDetail>>(`/apis/api.vote.kunkunyu.com/v1alpha1/votes/${name}/detail`, {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 投票用户列表
 */
export function getVoteUserList(name: string) {
  return http.Get<IResponse<unknown[]>>(`/apis/api.vote.kunkunyu.com/v1alpha1/votes/${name}/user-list`, {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 提交投票
 * @param canAnonymously 是否允许匿名;非匿名时带个人 token
 */
export function submitVote(name: string, data: IVoteSubmitReq, canAnonymously = true) {
  const headers: Record<string, string> = {}
  if (!canAnonymously) {
    const token = getPersonalToken()
    if (token)
      headers.Authorization = `Bearer ${token}`
  }
  return http.Post<IResponse<unknown>>(`/apis/api.vote.kunkunyu.com/v1alpha1/votes/${name}/submit`, data, {
    headers,
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}
