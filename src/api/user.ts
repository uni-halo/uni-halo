/**
 * 用户资料管理 API（「我的信息」页）
 *
 * 走 Halo Console 自定义端点（api.console.halo.run），需登录 token：
 * - PUT /users/- 仅更新 displayName/bio/phone（服务端不处理 avatar/password）；
 * - 头像必须走专用 multipart 端点 POST /users/-/avatar（"-" = 当前登录用户，
 *   服务端处理附件与头像注解）；
 * - 邮箱验证走官方端点 POST /users/-/send-email-verification-code（新邮箱暂存
 *   EMAIL_TO_VERIFY 注解）与 POST /users/-/verify-email（当前密码 + 验证码确认，
 *   成功后才写入 spec.email 并置 emailVerified=true）。
 *
 * 注意（图片地址规范）：接口返回的 avatar 为服务端原始地址（允许相对路径），
 * 一律原样写入 store，渲染时经 checkAvatarUrl() 补全，保证博客迁移后仍可访问。
 */
import { http } from '@/http/alova'
import { RequestFrom } from '@/http/tools/enum'
import type { IResponse } from '@/http/types'

const CONSOLE_USER_API = '/apis/api.console.halo.run/v1alpha1/users'

/** Halo User 资源（节选资料编辑用到的字段） */
export interface IHaloUser {
  apiVersion?: string
  kind?: string
  metadata: {
    name: string
    /** 乐观锁版本（更新时必须回传） */
    version?: number
    annotations?: Record<string, string>
    [key: string]: unknown
  }
  spec: {
    displayName?: string
    avatar?: string
    email?: string
    /** 邮箱是否已通过验证（官方 verify-email 成功后置 true） */
    emailVerified?: boolean
    bio?: string
    phone?: string
    [key: string]: unknown
  }
}

/** Console 端点 GET /users/- 响应（DetailedUser） */
export interface IDetailedUser {
  user: IHaloUser
  roles: unknown[]
}

function userMeta() {
  return {
    cacheFor: 0 as const,
    meta: { requestFrom: RequestFrom.Halo, needAuthToken: true },
  }
}

/**
 * 获取当前用户完整资料（含 metadata.version，供更新时乐观锁使用）
 */
export function getCurrentUserDetail() {
  return http.Get<IResponse<IDetailedUser>>(`${CONSOLE_USER_API}/-`, userMeta())
}

/**
 * 更新当前用户资料（displayName/bio/phone）
 * 请求体须为完整 User：metadata.name 必须与当前用户一致，version 用于乐观锁
 */
export function updateUserProfile(user: IHaloUser) {
  return http.Put<IResponse<IHaloUser>>(`${CONSOLE_USER_API}/-`, user, userMeta())
}

/**
 * 发送邮箱验证码（官方端点，验证码发往新邮箱，10 分钟有效、最多 5 次尝试）
 * 服务端把新邮箱暂存到 User 的 EMAIL_TO_VERIFY 注解，验证通过后才真正替换 spec.email；
 * 若新邮箱与当前已验证邮箱相同会报 "Email already verified."
 */
export function sendEmailVerificationCode(email: string) {
  return http.Post<IResponse<null>>(
    `${CONSOLE_USER_API}/-/send-email-verification-code`,
    { email },
    userMeta(),
  )
}

/**
 * 验证新邮箱（官方端点）：当前密码 + 验证码双重确认；
 * 成功后服务端把 EMAIL_TO_VERIFY 注解中的邮箱写入 spec.email 并置 emailVerified=true。
 * 未自主设置过密码的账号（微信自动注册随机密码）无法通过密码校验，需先「修改密码」。
 */
export function verifyEmail(password: string, code: string) {
  return http.Post<IResponse<null>>(
    `${CONSOLE_USER_API}/-/verify-email`,
    { password, code },
    userMeta(),
  )
}

/**
 * 上传头像（multipart，uni.uploadFile 直传；token 由 uploadFile 拦截器按
 * meta.needAuthToken 携带）。注意：Halo 服务端仅写入头像注解，spec.avatar
 * 由 User Reconciler 异步回填——响应里的 spec.avatar 是旧值，调用方须轮询
 * profile 刷新，不能直接采信本次响应。
 * 路径固定 users/-/avatar（"-" = 当前登录用户）：内置自权规则
 * role-template-own-user-info 对 users/avatar 的 resourceNames 是字面量 "-"，
 * 传真实用户名会因匹配不上而 403，传 "-" 与规则及服务端 getUserOrSelf 语义一致。
 */
export function uploadUserAvatar(filePath: string): Promise<IHaloUser> {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${CONSOLE_USER_API}/-/avatar`,
      filePath,
      name: 'file',
      meta: { needAuthToken: true },
      success: (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`头像上传失败(${res.statusCode})`))
          return
        }
        try {
          resolve(JSON.parse(res.data) as IHaloUser)
        }
        catch {
          reject(new Error('头像上传响应解析失败'))
        }
      },
      fail: err => reject(new Error(err.errMsg || '头像上传失败')),
    })
  })
}

/* ==================== 密码（UC 端点） ==================== */

const UC_USER_API = '/apis/uc.api.halo.run/v1alpha1/users'

/** UC 当前用户脱敏资料（UcUserVo：含 passwordSet，不含 bio） */
export interface IUcUserVo {
  name: string
  displayName?: string
  avatar?: string
  passwordSet: boolean
}

/**
 * 获取 UC 当前用户脱敏资料（用于判断是否已设置过密码）
 */
export function getUcCurrentUser() {
  return http.Get<IResponse<IUcUserVo>>(`${UC_USER_API}/-`, userMeta())
}

/**
 * 修改自己的密码（UC 端点；已设置过密码时服务端校验 oldPassword，
 * 未设置过密码（如微信自动建号）可省略 oldPassword）
 */
export function changeMyPassword(oldPassword: string | undefined, password: string) {
  return http.Put<IResponse<IUcUserVo>>(`${UC_USER_API}/-/password`, { oldPassword, password }, userMeta())
}
