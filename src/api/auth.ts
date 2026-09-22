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

/** 认证接口基础路径(插件端 Constants.AUTH_API_BASE_PATH;端点注册在组根路径) */
const AUTH_API_BASE = '/apis/api.unihalo.ialley.cn/v1alpha1/auth'
// 两段式 POST（资源/name）会被 Halo 降级为非资源请求致 RBAC 失效，
// 写操作统一用 "-" 占位符构成 资源/-/动作 三段式（官方模式），与插件端保持一致

/** 登录表单 */
export interface ILoginForm {
  username: string
  password: string
}

/** 双 token 刷新请求 */
export interface IRefreshTokenReq {
  refreshToken: string
}

/**
 * 刷新token（预留接口）
 *
 * 当前 uni-halo 插件端认证为单 token 模式（下发 Halo PAT，无刷新接口），
 * 此函数为双 token 模式预留，待插件端提供 /auth/refreshToken 类接口后对接
 */
export function refreshToken(refreshToken: string) {
  return http.Post<IResponse<{ accessToken: string, refreshToken: string, accessExpiresIn: number, refreshExpiresIn: number }>>(
    `${AUTH_API_BASE}/-/refreshToken`,
    { refreshToken } satisfies IRefreshTokenReq,
    {
      cacheFor: 0,
      meta: { requestFrom: RequestFrom.Halo },
    },
  )
}

/**
 * 验证当前登录 token 是否有效
 */
export function verifyTokenExpires() {
  return http.Post<IResponse<{ valid: boolean, username: string, patName: string, expiresAt: string }>>(
    `${AUTH_API_BASE}/token-check`,
    {},
    {
      cacheFor: 0,
      meta: { requestFrom: RequestFrom.Halo, needAuthToken: true },
    },
  )
}

/**
 * 账号密码登录(公开接口)
 * 成功返回 LoginResult(token + user + roles + permissions),失败 401 返回 { code, message }
 */
export function loginByPassword(username: string, password: string) {
  return http.Post<IResponse<ILoginResult>>(
    `${AUTH_API_BASE}/-/login`,
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
      meta: { requestFrom: RequestFrom.Halo, needAuthToken: true },
    },
  )
}

/**
 * 退出登录(需登录 token,服务端吊销当前 PAT)
 */
export function logout() {
  return http.Post<IResponse<{ success: boolean }>>(
    `${AUTH_API_BASE}/-/logout`,
    {},
    {
      cacheFor: 0,
      meta: { requestFrom: RequestFrom.Halo, needAuthToken: true },
    },
  )
}

/* ---------- 注册 ---------- */

/** 注册表单 */
export interface IRegisterForm {
  username: string
  /** 显示名称(昵称) */
  displayName: string
  password: string
  /** 确认密码(插件端校验两次输入一致) */
  confirmPassword: string
  /** 邮箱(站点开启注册邮箱验证时必填) */
  email?: string
  /** 邮箱验证码(站点开启注册邮箱验证时必填) */
  emailCode?: string
}

/**
 * 账号密码注册并登录(公开接口)
 * 插件端中转 Halo 注册,成功直接返回 LoginResult(token + user + roles + permissions),实现注册即登录
 */
export function registerByPassword(form: IRegisterForm) {
  return http.Post<IResponse<ILoginResult>>(
    `${AUTH_API_BASE}/-/register`,
    form,
    {
      cacheFor: 0,
      meta: { requestFrom: RequestFrom.Halo },
    },
  )
}

/**
 * 微信注册并登录(公开接口,仅微信小程序可用)
 * 与微信登录同源(wx.login code 换身份),用户不存在时服务端自动创建
 * @param code uni.login({ provider: 'weixin' }) 获取的 wx.login 一次性凭证
 */
export function registerByWechat(code: string) {
  return http.Post<IResponse<ILoginResult>>(
    `${AUTH_API_BASE}/register/wechat`,
    { code },
    {
      cacheFor: 0,
      meta: { requestFrom: RequestFrom.Halo },
    },
  )
}

/** 站点全局信息(Halo /actuator/globalinfo,匿名可访问) */
export interface IGlobalInfo {
  allowRegistration?: boolean
  mustVerifyEmailOnRegistration?: boolean
}

/**
 * 发送注册邮箱验证码(Halo 匿名端点 POST /signup/send-email-code,2.20+)
 *
 * 请求体 { email },成功返回 202 Accepted(无响应体,由 http 层归一化 code=202),
 * 服务端按客户端 IP 限流(resilience4j send-email-verification-code 配置),429 表示发送过于频繁。
 * 验证码随注册表单(email + emailCode)经插件端 /auth/register 中转,由 Halo signUp 校验(邮箱须与发码时一致)。
 */
export function sendRegisterEmailCode(email: string) {
  return http.Post<IResponse<null>>(
    '/signup/send-email-code',
    { email },
    {
      cacheFor: 0,
      meta: { requestFrom: RequestFrom.Halo },
    },
  )
}

/**
 * 获取站点全局信息(匿名公开接口)
 * 注册入口/注册页据此判断 allowRegistration 开关
 */
export function getGlobalInfo() {
  return http.Get<IResponse<IGlobalInfo>>(
    '/actuator/globalinfo',
    {
      cacheFor: 0,
      meta: { requestFrom: RequestFrom.Halo },
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
 * 注意:alova 的 Delete 签名是 (url, data, config)——config 必须作第三参,
 * 误作第二参会变成请求体导致 meta 丢失、token 不携带(401)
 */
export function unbindMyWechat() {
  return http.Delete<IResponse<{ success: boolean }>>(
    `${AUTH_API_BASE}/my/wechat-binding`,
    undefined,
    {
      cacheFor: 0,
      meta: { requestFrom: RequestFrom.Halo, needAuthToken: true },
    },
  )
}

/* ---------- 首次设置密码---------- */

/**
 * 首次设置密码(需登录 token,免旧密码)
 *
 * 仅「从未自主设置过密码」的用户可用(微信自动注册的随机密码用户)；
 * 服务端以用户注解 password-set-by-user 判定，设置成功后此通道关闭，
 * 后续改密走 UC 端点 PUT /users/-/password(需旧密码)。
 * 已设置过时服务端返回 403 { code: 'PASSWORD_ALREADY_SET' }。
 */
export function setInitialPassword(newPassword: string) {
  return http.Post<IResponse<{ success: boolean }>>(
    `${AUTH_API_BASE}/-/password/set`,
    { newPassword },
    {
      cacheFor: 0,
      meta: { requestFrom: RequestFrom.Halo, needAuthToken: true },
    },
  )
}

/* ---------- 微信扫码绑定(BindTicket) ---------- */

/** 扫码绑定票据状态(插件端 BindTicketService.Status) */
/**
 * 票据状态：PENDING 等待扫码 / SCANNED 已扫码待电脑端确认
 * / CONFIRMED 已绑定 / FAILED 绑定失败或被拒绝 / EXPIRED 已过期
 *
 * FAILED 必须有：确认与绑定分两步，没有失败终态时轮询会把「绑定失败」显示成成功。
 * SCANNED 是两阶段确认的待确认态：扫码只登记微信身份，必须发起方在电脑端再点
 * 一次「确认绑定」才真正建立关系。
 */
export type IBindTicketStatus = 'PENDING' | 'SCANNED' | 'CONFIRMED' | 'FAILED' | 'EXPIRED'

/** 票据状态查询响应 */
export interface IBindTicketStatusRes {
  ticket: string
  status: IBindTicketStatus
  /** 失败原因文案（仅 FAILED 有值，其余为空串） */
  reason?: string
  /** 扫码方微信标识的脱敏尾号（仅 SCANNED 有值） */
  hint?: string
  /**
   * 登录态预检：true 二维码归属当前登录账号 / false 归属其他账号 /
   * null 未登录（匿名扫码是合法主流程，无登录态可比）。
   * 仅用于提前给出失败提示，真正的归属裁决始终在服务端 confirm 时完成
   */
  mine?: boolean | null
}

/**
 * 查询扫码绑定票据状态(匿名可调;带登录态时服务端额外返回 mine 预检字段)
 * @param ticket 票据号(扫码内容 uh-bindwx-{ticket} 中解析)
 */
export function getBindTicketStatus(ticket: string) {
  return http.Get<IResponse<IBindTicketStatusRes>>(
    `${AUTH_API_BASE}/bind/wechat/qr/tickets/${ticket}`,
    {
      cacheFor: 0,
      // needAuthToken 仅在已登录时注入 Authorization(拦截器判空),匿名请求保持无头,
      // 服务端据此返回 mine: null
      meta: { requestFrom: RequestFrom.Halo, needAuthToken: true },
    },
  )
}

/**
 * 确认扫码绑定微信(第一阶段:登记微信身份,不直接绑定,仅微信小程序可用)
 *
 * 真正的绑定要等发起方在电脑端点「确认绑定」后才发生(两阶段确认)。
 *
 * **必须携带登录态**:服务端据此判断扫码者是否已登录其他账号——手机登录着 B
 * 却扫了 A 的码时,绑定会被拒绝(否则微信会被静默绑给 A)。未登录时请求不带
 * token,服务端按匿名处理,行为与原来一致。
 *
 * @param ticket 票据号
 * @param code wx.login 一次性凭证
 */
export function confirmBindTicket(ticket: string, code: string) {
  return http.Post<IResponse<{ success: boolean }>>(
    `${AUTH_API_BASE}/bind/wechat/qr/tickets/${ticket}/confirm`,
    { code },
    {
      cacheFor: 0,
      meta: { requestFrom: RequestFrom.Halo, needAuthToken: true },
    },
  )
}
