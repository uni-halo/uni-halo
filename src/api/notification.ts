/**
 * 站内消息通知 API（Halo 官方通知系统 UC 端点）
 *
 * 走 Halo 官方组 api.notification.halo.run/v1alpha1（userspaces/{username} 作用域），
 * 服务端以 Authorization（PAT）识别本人，天然「只能读/改自己的通知」：
 * - GET  /userspaces/{username}/notifications                       通知列表（分页 + fieldSelector 过滤）
 * - PUT  /userspaces/{username}/notifications/{name}/mark-as-read   标记单条已读
 * - PUT  /userspaces/{username}/notifications/-/mark-specified-as-read  批量已读（body: { names }）
 *
 * 注意：未读过滤使用 fieldSelector=spec.unread=true（单值即可，Spring 侧绑定 List）；
 * 排序使用 sort=metadata.creationTimestamp,desc。
 */
import { http } from '@/http/alova'
import { RequestFrom } from '@/http/tools/enum'
import type { IResponse } from '@/http/types'

const UC_NOTIFICATION_API = '/apis/api.notification.halo.run/v1alpha1/userspaces'

/** Halo ListResult 分页结构 */
export interface IHaloListResult<T> {
  items: T[]
  total: number
  page: number
  size: number
  totalPages: number
  hasNext: boolean
  hasPrevious: boolean
}

/** Halo Notification 资源（app 端用到的字段） */
export interface INotification {
  apiVersion?: string
  kind?: string
  metadata: {
    name: string
    creationTimestamp?: string
    labels?: Record<string, string>
    [key: string]: unknown
  }
  spec: {
    /** 接收者用户名 */
    recipient: string
    /** 产生本通知的 Reason metadata.name */
    reason: string
    /** 通知标题（模板渲染结果） */
    title: string
    /** 纯文本内容 */
    rawContent: string
    /** HTML 内容（模板配置 htmlBody 时才有） */
    htmlContent?: string
    /** 是否未读 */
    unread: boolean
    /** 最近一次标记已读时间 */
    lastReadAt?: string
    [key: string]: unknown
  }
}

export interface INotificationListReq {
  page?: number
  size?: number
  /** 服务端字段过滤（如 'spec.unread=true'） */
  fieldSelector?: string
  /** 排序（如 'metadata.creationTimestamp,desc'） */
  sort?: string
}

function notificationMeta() {
  return {
    cacheFor: 0 as const,
    meta: { requestFrom: RequestFrom.Halo, needAuthToken: true },
  }
}

/**
 * 获取当前用户站内通知列表（分页）
 */
export function getUserNotifications(username: string, params: INotificationListReq = {}) {
  return http.Get<IResponse<IHaloListResult<INotification>>>(
    `${UC_NOTIFICATION_API}/${username}/notifications`,
    { params, ...notificationMeta() },
  )
}

/**
 * 标记单条通知已读
 */
export function markNotificationAsRead(username: string, name: string) {
  return http.Put<IResponse<INotification>>(
    `${UC_NOTIFICATION_API}/${username}/notifications/${name}/mark-as-read`,
    undefined,
    notificationMeta(),
  )
}

/**
 * 删除单条通知
 * 注意:alova 的 Delete 签名是 (url, data, config),config 必须作第三参,
 * 误作第二参会变成请求体导致 needAuthToken 丢失、token 不携带(403)
 */
export function deleteNotification(username: string, name: string) {
  return http.Delete<IResponse<INotification>>(
    `${UC_NOTIFICATION_API}/${username}/notifications/${name}`,
    undefined,
    notificationMeta(),
  )
}

/**
 * 批量标记通知已读（「全部已读」：传未读通知 name 列表）
 */
export function markNotificationsAsRead(username: string, names: string[]) {
  return http.Put<IResponse<string[]>>(
    `${UC_NOTIFICATION_API}/${username}/notifications/-/mark-specified-as-read`,
    { names },
    notificationMeta(),
  )
}

/**
 * 查询未读通知数（size=1 只取 total，供入口徽标/Tab 计数使用）
 * @returns 未读总数；未登录或请求失败返回 0
 */
export async function getUnreadNotificationCount(username: string): Promise<number> {
  try {
    const res = await getUserNotifications(username, {
      page: 1,
      size: 1,
      fieldSelector: 'spec.unread=true',
    })
    return res.data?.total ?? 0
  }
  catch (error) {
    console.error('获取未读通知数失败:', error)
    return 0
  }
}
