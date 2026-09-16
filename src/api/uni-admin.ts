/**
 * 管理模块 API（发布瞬间、附件上传、恋爱模块管理）
 * 对应 PRD：docs/PRD-app-publish.md
 *
 * 注意：附件上传走 uni.uploadFile（multipart），token 由
 * http/interceptor.ts 的 uploadFile 拦截器按 meta.needLoginToken 携带；
 * 其余写接口走 alova，鉴权经 meta.needAuthToken。
 */
import { http } from '@/http/alova'
import { RequestFrom } from '@/http/tools/enum'
import type { IResponse } from '@/http/types'
import type { IAttachment, IMomentSpec } from './types/uni-admin'
import type { ILoveAlbum, ILoveDailyItem, ILoveDailyItemSpec, ILovePhoto, ILoveStory, ILoveStorySpec } from './types/uni-halo'

/** UC 附件上传端点（存储策略由站点后台「个人中心附件配置」决定） */
export const UC_ATTACHMENT_UPLOAD_URL = '/apis/uc.api.storage.halo.run/v1alpha1/attachments/-/upload'

/**
 * 上传附件到个人中心存储（multipart，uni.uploadFile 直传）
 * @param filePath 本地临时文件路径
 * @param onProgress 上传进度回调（0-100）
 * @returns Halo Attachment 对象，permalink 取 status.permalink
 */
export function uploadAttachment(
  filePath: string,
  onProgress?: (progress: number) => void,
): Promise<IAttachment> {
  return new Promise((resolve, reject) => {
    const uploadTask = uni.uploadFile({
      url: UC_ATTACHMENT_UPLOAD_URL,
      filePath,
      name: 'file',
      meta: { needLoginToken: true },
      success: (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`上传失败(${res.statusCode})`))
          return
        }
        try {
          const attachment = JSON.parse(res.data) as IAttachment
          resolve(attachment)
        }
        catch {
          reject(new Error('上传响应解析失败'))
        }
      },
      fail: err => reject(new Error(err.errMsg || '上传失败')),
    })
    if (onProgress && uploadTask) {
      uploadTask.onProgressUpdate(p => onProgress(p.progress))
    }
  })
}

/** UC 瞬间列表请求参数 */
export interface IMomentUCListReq {
  page?: number
  size?: number
  /** 按标签筛选 */
  tag?: string
  [key: string]: unknown
}

/** 获取当前用户的瞬间列表（UC API，分页） */
export function listMyMoments(params: IMomentUCListReq) {
  return http.Get<IResponse<{ items: { metadata: { name: string }, spec: IMomentSpec, [key: string]: unknown }[], hasNext: boolean, [key: string]: unknown }>>(
    '/apis/uc.api.moment.halo.run/v1alpha1/moments',
    {
      params,
      cacheFor: 0,
      meta: { requestFrom: RequestFrom.Halo, needAuthToken: true },
    },
  )
}

/** 发布瞬间（UC API；无审核权限时进入待审） */
export function createMoment(spec: IMomentSpec) {
  return http.Post<IResponse<IMomentSpec>>(
    '/apis/uc.api.moment.halo.run/v1alpha1/moments',
    spec,
    {
      cacheFor: 0,
      meta: { requestFrom: RequestFrom.Halo, needAuthToken: true },
    },
  )
}

/** 删除自己的瞬间（UC API） */
export function deleteMoment(name: string) {
  return http.Delete<IResponse<null>>(
    `/apis/uc.api.moment.halo.run/v1alpha1/moments/${name}`,
    {
      cacheFor: 0,
      meta: { requestFrom: RequestFrom.Halo, needAuthToken: true },
    },
  )
}

/** 从 Attachment 提取可访问 URL（permalink 异步时返回空串，由调用方轮询兜底） */
export function getAttachmentPermalink(attachment: IAttachment): string {
  return attachment.status?.permalink || ''
}

/* ==================== 恋爱模块管理（插件端 CRUD，路径待插件端最终确认） ==================== */

const LOVE_API_BASE = '/apis/api.unihalo.ialley.cn/v1alpha1/plugins/uni-halo'

function loveAdminMeta() {
  return {
    cacheFor: 0 as const,
    meta: { requestFrom: RequestFrom.Halo, needAuthToken: true },
  }
}

/* ---------- 恋爱清单 ---------- */

export function createLoveDailyItem(spec: Partial<ILoveDailyItemSpec>) {
  return http.Post<IResponse<ILoveDailyItem>>(`${LOVE_API_BASE}/love-daily-items`, { spec }, loveAdminMeta())
}

export function updateLoveDailyItem(name: string, spec: Partial<ILoveDailyItemSpec>) {
  return http.Put<IResponse<ILoveDailyItem>>(`${LOVE_API_BASE}/love-daily-items/${name}`, { spec }, loveAdminMeta())
}

export function deleteLoveDailyItem(name: string) {
  return http.Delete<IResponse<null>>(`${LOVE_API_BASE}/love-daily-items/${name}`, loveAdminMeta())
}

/* ---------- 恋爱故事 ---------- */

export function createLoveStory(spec: Partial<ILoveStorySpec>) {
  return http.Post<IResponse<ILoveStory>>(`${LOVE_API_BASE}/love-stories`, { spec }, loveAdminMeta())
}

export function updateLoveStory(name: string, spec: Partial<ILoveStorySpec>) {
  return http.Put<IResponse<ILoveStory>>(`${LOVE_API_BASE}/love-stories/${name}`, { spec }, loveAdminMeta())
}

export function deleteLoveStory(name: string) {
  return http.Delete<IResponse<null>>(`${LOVE_API_BASE}/love-stories/${name}`, loveAdminMeta())
}

/* ---------- 恋爱相册 ---------- */

export function createLoveAlbum(spec: { title?: string, description?: string, cover?: string }) {
  return http.Post<IResponse<ILoveAlbum>>(`${LOVE_API_BASE}/love-albums`, { spec }, loveAdminMeta())
}

export function updateLoveAlbum(name: string, spec: { title?: string, description?: string, cover?: string }) {
  return http.Put<IResponse<ILoveAlbum>>(`${LOVE_API_BASE}/love-albums/${name}`, { spec }, loveAdminMeta())
}

export function deleteLoveAlbum(name: string) {
  return http.Delete<IResponse<null>>(`${LOVE_API_BASE}/love-albums/${name}`, loveAdminMeta())
}

/** 相册新增照片（覆盖式提交 photos，调用方先取现有 photos 合并） */
export function addLoveAlbumPhotos(name: string, photos: ILovePhoto[]) {
  return http.Put<IResponse<ILoveAlbum>>(`${LOVE_API_BASE}/love-albums/${name}/photos`, { photos }, loveAdminMeta())
}

/** 相册删除单张照片（按 url 定位，覆盖式提交剩余 photos） */
export function removeLoveAlbumPhoto(name: string, url: string, remainPhotos: ILovePhoto[]) {
  return http.Put<IResponse<ILoveAlbum>>(
    `${LOVE_API_BASE}/love-albums/${name}/photos`,
    { photos: remainPhotos.filter(p => p.url !== url) },
    loveAdminMeta(),
  )
}
