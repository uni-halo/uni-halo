/**
 * 用户资料管理 API（「我的信息」页）
 *
 * 走 Halo Console 自定义端点（api.console.halo.run），需登录 token：
 * - PUT /users/- 仅更新 displayName/bio/phone（服务端不处理 avatar/password）；
 * - 头像必须走专用 multipart 端点 POST /users/{name}/avatar（服务端处理附件与头像注解）。
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
 * 上传头像（multipart，uni.uploadFile 直传；token 由 uploadFile 拦截器按
 * meta.needLoginToken 携带）。注意：Halo 服务端仅写入头像注解，spec.avatar
 * 由 User Reconciler 异步回填——响应里的 spec.avatar 是旧值，调用方须轮询
 * profile 刷新，不能直接采信本次响应。
 * @param username 当前登录用户名（metadata.name）
 * @param filePath 本地临时文件路径
 */
export function uploadUserAvatar(username: string, filePath: string): Promise<IHaloUser> {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${CONSOLE_USER_API}/${username}/avatar`,
      filePath,
      name: 'file',
      meta: { needLoginToken: true },
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
