/**
 * 移动端登录 API(uni-halo 插件 AuthEndpoint)
 *
 * 登录成功返回 Halo 原生 PAT(pat_ 前缀)与用户信息/角色/权限,
 * 客户端按 Authorization: Bearer <token> 携带即可访问 Halo 原生 API 与本插件接口
 */
import { http } from '@/http/alova'
import { RequestFrom } from '@/http/tools/enum'
import type { IResponse } from '@/http/types'
import type { ILoginResult, IProfileResult } from './types/uni-halo'

/** 认证接口基础路径(插件端 Constants.AUTH_API_BASE_PATH) */
const AUTH_API_BASE = '/apis/api.unihalo.ialley.cn/v1alpha1/plugins/uni-halo/auth'

/**
 * 账号密码登录(公开接口)
 * 成功返回 LoginResult(token + user + roles + permissions),失败 401 返回 { code, message }
 */
export function loginByPassword(username: string, password: string) {
  return http.Post<IResponse<ILoginResult>>(
    `${AUTH_API_BASE}/login`,
    { username, password },
    {
      cacheFor: 0,
      meta: { requestFrom: RequestFrom.Halo },
    },
  )
}

/**
 * 微信登录(公开接口,仅微信小程序可用)
 * @param code uni.login({ provider: 'weixin' }) 获取的 wx.login 一次性凭证
 */
export function loginByWechat(code: string) {
  return http.Post<IResponse<ILoginResult>>(
    `${AUTH_API_BASE}/login/wechat`,
    { code },
    {
      cacheFor: 0,
      meta: { requestFrom: RequestFrom.Halo },
    },
  )
}

/**
 * 获取当前登录用户资料(需登录 token,经 meta.needAuthToken 由拦截器携带)
 * 刻意不含令牌:令牌由登录接口一次性下发,客户端自行缓存到过期
 */
export function getAuthProfile() {
  return http.Get<IResponse<IProfileResult>>(
    `${AUTH_API_BASE}/profile`,
    {
      cacheFor: 0,
      meta: { requestFrom: RequestFrom.Halo, needAuthToken: 123 },
    },
  )
}

/**
 * 退出登录(需登录 token,服务端吊销当前 PAT)
 */
export function logout() {
  return http.Post<IResponse<{ success: boolean }>>(
    `${AUTH_API_BASE}/logout`,
    {},
    {
      cacheFor: 0,
      meta: { requestFrom: RequestFrom.Halo, needAuthToken: true },
    },
  )
}

/**
 * 获取微信登录凭证(code)
 * @returns Promise 包含 wx.login 的一次性凭证 code
 */
export function getWxCode() {
  return new Promise<UniApp.LoginRes>((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: res => resolve(res),
      fail: err => reject(new Error(err.errMsg || 'uni.login 失败')),
    })
  })
}

/* ---------- 我的微信绑定(「我的信息」页) ---------- */

/** 我的微信绑定状态(插件端 WechatBindingVo) */
export interface IMyWechatBinding {
  username: string
  bound: boolean
  /** 绑定的微信标识(openid/unionid),未绑定为 null */
  providerUserId?: string | null
  /** 绑定关系最近一次更新时间(ISO 字符串),未绑定为 null */
  boundAt?: string | null
}

/**
 * 查询当前登录用户的微信绑定状态(需登录 token)
 */
export function getMyWechatBinding() {
  return http.Get<IResponse<IMyWechatBinding>>(
    `${AUTH_API_BASE}/my/wechat-binding`,
    {
      cacheFor: 0,
      meta: { requestFrom: RequestFrom.Halo, needAuthToken: true },
    },
  )
}

/**
 * 当前登录用户绑定微信(需登录 token,仅微信小程序可用)
 * 身份由 Authorization 头携带,微信身份由 wx.login() 的 code 换取
 * @param code wx.login 一次性凭证
 */
export function bindMyWechat(code: string) {
  return http.Post<IResponse<{ success: boolean }>>(
    `${AUTH_API_BASE}/bind/wechat`,
    { code },
    {
      cacheFor: 0,
      meta: { requestFrom: RequestFrom.Halo, needAuthToken: true },
    },
  )
}

/**
 * 当前登录用户解除微信绑定(需登录 token,幂等:未绑定时同样返回成功)
 */
export function unbindMyWechat() {
  return http.Delete<IResponse<{ success: boolean }>>(
    `${AUTH_API_BASE}/my/wechat-binding`,
    {
      cacheFor: 0,
      meta: { requestFrom: RequestFrom.Halo, needAuthToken: true },
    },
  )
}

/* ---------- 微信扫码绑定(BindTicket) ---------- */

/** 扫码绑定票据状态(插件端 BindTicketService.Status) */
export type IBindTicketStatus = 'PENDING' | 'CONFIRMED' | 'EXPIRED'

/** 票据状态查询响应 */
export interface IBindTicketStatusRes {
  ticket: string
  status: IBindTicketStatus
}

/**
 * 查询扫码绑定票据状态(匿名轮询接口)
 * @param ticket 票据号(扫码内容 uh-bindwx-{ticket} 中解析)
 */
export function getBindTicketStatus(ticket: string) {
  return http.Get<IResponse<IBindTicketStatusRes>>(
    `${AUTH_API_BASE}/bind/wechat/qr/tickets/${ticket}`,
    {
      cacheFor: 0,
      meta: { requestFrom: RequestFrom.Halo },
    },
  )
}

/**
 * 确认扫码绑定微信(匿名接口,仅微信小程序可用)
 * 身份由 wx.login() 的 code 换取,绑定目标用户名在票据创建时已锁定
 * @param ticket 票据号
 * @param code wx.login 一次性凭证
 */
export function confirmBindTicket(ticket: string, code: string) {
  return http.Post<IResponse<{ success: boolean }>>(
    `${AUTH_API_BASE}/bind/wechat/qr/tickets/${ticket}/confirm`,
    { code },
    {
      cacheFor: 0,
      meta: { requestFrom: RequestFrom.Halo },
    },
  )
}
