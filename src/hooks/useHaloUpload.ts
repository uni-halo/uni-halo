/**
 * Halo 附件上传 hook（多图队列、进度、失败重试、前置校验）
 * 上传走 UC 附件端点（个人中心附件配置），token 由 uploadFile 拦截器携带
 */
import { ref } from 'vue'
import { getAttachmentPermalink, uploadAttachment } from '@/api/uni-admin'

/** 单张图片的上传状态 */
export type UploadStatus = 'pending' | 'uploading' | 'success' | 'error'

export interface UploadImageItem {
  /** 本地临时路径（唯一 key） */
  tempPath: string
  /** 上传成功后的远程 URL */
  url: string
  /** 上传状态 */
  status: UploadStatus
  /** 上传进度 0-100 */
  progress: number
  /** 失败信息 */
  error?: string
}

export interface UseHaloUploadOptions {
  /** 最大图片数（默认 9） */
  maxCount?: number
  /** 单图大小上限（字节，默认 10MB） */
  maxSize?: number
  /** 失败自动重试次数（默认 0，手动点角标重试） */
  retries?: number
  /** 单图上传成功回调 */
  onSuccess?: (item: UploadImageItem) => void
  /** 全部队列完成（无失败）回调 */
  onAllSuccess?: () => void
}

export function useHaloUpload(options: UseHaloUploadOptions = {}) {
  const {
    maxCount = 9,
    maxSize = 10 * 1024 * 1024,
    retries = 0,
    onSuccess,
    onAllSuccess,
  } = options

  /** 队列中的图片列表 */
  const list = ref<UploadImageItem[]>([])
  const uploading = ref(false)

  /**
   * 选择图片并加入上传队列
   * 平台差异：微信小程序用 chooseMedia，其余用 chooseImage
   */
  function choose() {
    const remain = maxCount - list.value.length
    if (remain <= 0) {
      uni.showToast({ title: `最多选择 ${maxCount} 张`, icon: 'none' })
      return
    }

    const onPicked = (paths: string[], sizes: number[]) => {
      const items: UploadImageItem[] = paths.map((p, i) => ({
        tempPath: p,
        url: '',
        status: 'pending',
        progress: 0,
      }))
      // 大小前置校验
      const valid: UploadImageItem[] = []
      for (let i = 0; i < items.length; i++) {
        if (sizes[i] > maxSize) {
          uni.showToast({ title: `第 ${i + 1} 张超过 ${Math.round(maxSize / 1024 / 1024)}MB`, icon: 'none' })
        }
        else {
          valid.push(items[i])
        }
      }
      list.value.push(...valid)
      uploadAll()
    }

    // #ifdef MP-WEIXIN
    uni.chooseMedia({
      count: remain,
      mediaType: ['image'],
      success: (res) => {
        onPicked(
          res.tempFiles.map(f => f.tempFilePath),
          res.tempFiles.map(f => f.size),
        )
      },
    })
    // #endif
    // #ifndef MP-WEIXIN
    uni.chooseImage({
      count: remain,
      success: (res) => {
        const files = Array.isArray(res.tempFiles) ? res.tempFiles : []
        onPicked(
          [...res.tempFilePaths],
          files.map(f => (f as { size?: number }).size || 0),
        )
      },
    })
    // #endif
  }

  /** 串行上传所有 pending 项 */
  async function uploadAll() {
    if (uploading.value)
      return
    uploading.value = true
    try {
      for (const item of list.value) {
        if (item.status === 'success')
          continue
        await uploadOne(item, retries)
      }
      if (list.value.length > 0 && list.value.every(i => i.status === 'success'))
        onAllSuccess?.()
    }
    finally {
      uploading.value = false
    }
  }

  /** 上传单张（含自动重试），成功标记 url */
  async function uploadOne(item: UploadImageItem, leftRetries: number): Promise<boolean> {
    item.status = 'uploading'
    item.progress = 0
    item.error = undefined
    try {
      const attachment = await uploadAttachment(item.tempPath, p => (item.progress = p))
      const permalink = getAttachmentPermalink(attachment)
      if (!permalink)
        throw new Error('未获取到文件地址')
      item.url = permalink
      item.status = 'success'
      item.progress = 100
      onSuccess?.(item)
      return true
    }
    catch (err: any) {
      if (leftRetries > 0)
        return uploadOne(item, leftRetries - 1)
      item.status = 'error'
      item.error = err?.message || '上传失败'
      return false
    }
  }

  /** 手动重试某张失败的图 */
  async function retry(tempPath: string) {
    const item = list.value.find(i => i.tempPath === tempPath)
    if (!item || item.status !== 'error')
      return
    if (uploading.value) {
      uni.showToast({ title: '队列上传中，请稍后', icon: 'none' })
      return
    }
    uploading.value = true
    try {
      await uploadOne(item, 0)
    }
    finally {
      uploading.value = false
    }
  }

  /** 从队列移除一张 */
  function remove(tempPath: string) {
    const idx = list.value.findIndex(i => i.tempPath === tempPath)
    if (idx >= 0)
      list.value.splice(idx, 1)
  }

  /** 是否全部上传成功（发布前校验用） */
  function allSuccess(): boolean {
    return list.value.length > 0 && list.value.every(i => i.status === 'success')
  }

  /** 成功的远程 URL 列表 */
  function urls(): string[] {
    return list.value.filter(i => i.status === 'success').map(i => i.url)
  }

  /** 清空队列 */
  function reset() {
    list.value = []
  }

  return { list, uploading, choose, retry, remove, allSuccess, urls, reset }
}
