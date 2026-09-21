<script lang="ts" setup>
/**
 * 恋爱相册照片管理弹窗：查看/预览/批量添加/删除（走 console 详情，照片带服务端生成的 name）
 *
 * 用法：通过 ref.openDetail(album) 打开；增删成功后 emit on-close({ refresh: true }) 由父级刷新列表
 */
import { computed, ref } from 'vue'
import { getLoveAlbumAdmin, removeLoveAlbumPhoto, updateLoveAlbum, updateLoveAlbumPhotos } from '@/api/uni-admin'
import { useHaloUpload } from '@/hooks/useHaloUpload'
import { useDialog } from '@wot-ui/ui'
import { DIALOG_CONFIRM_BUTTON_PROPS } from '@/config/dialog'
import { checkThumbnailUrl } from '@/utils/url'
import type { ILoveAlbum, ILovePhoto } from '@/api/types/uni-halo'

defineOptions({
  options: {
    styleIsolation: 'apply-shared',
  },
})

const emit = defineEmits<{
  (e: 'on-close', data: { isSubmit: boolean, refresh: boolean }): void
}>()

const isShow = ref(false)
const currentAlbum = ref<ILoveAlbum | null>(null)
/** console 详情返回的原始 spec（整体更新时回传，避免 cover 等字段丢失） */
const currentSpec = ref<Record<string, any>>({})
const currentPhotos = ref<ILovePhoto[]>([])
const detailLoading = ref(false)

/** 批量选图并上传，成功后一次性整体提交到相册（PUT /photos，避免逐张 POST 的并发写冲突） */
const { list: pendingPhotos, choose: choosePhotos, remove: removePending, uploading, urls: photoUrls } = useHaloUpload({ maxCount: 18 })

const dialog = useDialog()

/** 未上传完成的待传照片数 */
const pendingCount = computed(() => pendingPhotos.value.filter(i => i.status !== 'success').length)

/** 外部打开：拉取相册 console 详情（照片带 name，删除照片接口依赖） */
async function openDetail(album: ILoveAlbum) {
  const name = album.metadata?.name || album.name || ''
  isShow.value = true
  detailLoading.value = true
  currentAlbum.value = album
  try {
    // console API 返回完整资源结构 { metadata, spec: { displayName, photos, ... }, status }
    const res = await getLoveAlbumAdmin(name)
    const data: any = res.data || {}
    currentSpec.value = data.spec || {}
    currentAlbum.value = {
      ...album,
      ...(data.spec || {}),
      metadata: data.metadata || album.metadata,
      photos: data.spec?.photos || [],
    }
    currentPhotos.value = data.spec?.photos || []
  }
  catch (err: any) {
    uni.showToast({ title: err?.message || '加载相册失败', icon: 'none' })
    isShow.value = false
  }
  finally {
    detailLoading.value = false
  }
}

async function commitPhotos() {
  if (!currentAlbum.value)
    return
  const name = currentAlbum.value.metadata?.name || currentAlbum.value.name || ''
  const newUrls = photoUrls()
  if (newUrls.length === 0)
    return
  try {
    // 现有照片（保留服务端生成的 name，删除接口依赖）+ 新增照片，拼成完整列表单次 PUT 提交
    const merged: ILovePhoto[] = [
      ...currentPhotos.value,
      ...newUrls.map(url => ({ url }) as ILovePhoto),
    ]
    const res = await updateLoveAlbumPhotos(name, merged)
    // 服务端返回整本相册（照片带生成的 name），以最新列表为准
    currentPhotos.value = (res.data as any)?.spec?.photos?.length ? (res.data as any).spec.photos : merged
    pendingPhotos.value = []
    uni.showToast({ title: `已添加 ${newUrls.length} 张照片`, icon: 'none' })
    emit('on-close', { isSubmit: true, refresh: true })
  }
  catch (err: any) {
    uni.showToast({ title: err?.message || '照片保存失败', icon: 'none' })
  }
}

async function handleDeletePhoto(photo: ILovePhoto) {
  const album = currentAlbum.value
  const name = album?.metadata?.name || album?.name || ''
  if (!name) {
    uni.showToast({ title: '相册缺少标识，请刷新后重试', icon: 'none' })
    return
  }
  try {
    await dialog.confirm({
      title: '删除照片',
      msg: '确定删除这张照片吗？',
      zIndex: 9999,
      confirmButtonProps: DIALOG_CONFIRM_BUTTON_PROPS,
    })
  }
  catch {
    return
  }
  try {
    // 照片无服务端 name 时按 url 过滤，整体更新 spec.photos 删除
	// 可能后续提供
    const restPhotos = currentPhotos.value.filter(p => (photo.name ? p.name !== photo.name : p.url !== photo.url))
    if (photo.name) {
      await removeLoveAlbumPhoto(name, photo.name)
    }
    else {
      await updateLoveAlbum(name, { album: { spec: { ...currentSpec.value, photos: restPhotos } } })
      currentSpec.value = { ...currentSpec.value, photos: restPhotos }
    }
    currentPhotos.value = restPhotos
    uni.showToast({ title: '已删除', icon: 'none' })
    emit('on-close', { isSubmit: true, refresh: true })
  }
  catch (err: any) {
    uni.showToast({ title: err?.message || '删除失败', icon: 'none' })
  }
}

function handlePreviewPhoto(index: number) {
  uni.previewImage({
    current: index,
    urls: currentPhotos.value.map(p => checkThumbnailUrl(p.url || '')),
  })
}

function handleClose(refresh = false) {
  isShow.value = false
  emit('on-close', { isSubmit: !!refresh, refresh })
}

defineExpose({ openDetail })
</script>

<template>
  <uh-glass-popup v-model="isShow" :z-index="100" position="bottom" custom-class="!border rounded-xl" @close="handleClose(false)">
    <!-- 弹窗容器 -->
    <view class="box-border w-full flex flex-col gap-y-3 p-3">
      <!-- 顶部 -->
      <view class="relative box-border w-full flex items-center justify-around">
        <view class="w-full flex flex-col gap-y-1">
          <text class="text-md font-bold">{{ currentAlbum?.title || currentAlbum?.displayName || '相册' }}</text>
          <text class="text-xs text-gray-500">管理相册照片，点击图片可预览</text>
        </view>
        <view class="uh-global-card-glass absolute right-0 top-0 h-6 w-6 border rounded-lg text-center shadow-none" @click="handleClose(false)">
          <wd-icon name="close" size="28rpx" class="text-gray-500" />
        </view>
      </view>
      <!-- 滚动区域 -->
      <scroll-view :scroll-y="true" :show-scrollbar="false" class="box-border max-h-[60vh]">
        <!-- 滚动内部容器 -->
        <view class="w-full flex flex-col gap-y-3">
          <view v-if="detailLoading" class="mt-10 text-center text-sm text-gray-400">
            加载中…
          </view>
          <view v-else class="grid grid-cols-3 gap-2">
            <view v-for="(photo, index) in currentPhotos" :key="photo.url" class="relative aspect-square overflow-hidden rounded-lg">
              <image :src="checkThumbnailUrl(photo.url || '', true)" class="h-full w-full" mode="aspectFill" @click="handlePreviewPhoto(index)" />
              <view class="absolute right-1 top-1 h-5 w-5 flex items-center justify-center rounded-full bg-black/50 text-white" @click.stop="handleDeletePhoto(photo)">
                <wd-icon name="close" size="22rpx" />
              </view>
            </view>
            <!-- 待上传预览 -->
            <view v-for="img in pendingPhotos" :key="img.tempPath" class="relative aspect-square overflow-hidden rounded-lg">
              <image :src="img.tempPath" class="h-full w-full" mode="aspectFill" />
              <view class="absolute right-1 top-1 h-5 w-5 flex items-center justify-center rounded-full bg-black/50 text-white" @click="removePending(img.tempPath)">
                <wd-icon name="close" size="22rpx" />
              </view>
              <view v-if="img.status === 'uploading'" class="absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-white">
                {{ img.progress }}%
              </view>
              <view v-else-if="img.status === 'error'" class="absolute inset-0 flex flex-col items-center justify-center bg-red-500/60 text-xs text-white">
                <text>失败</text>
                <text>点击重试</text>
              </view>
              <view v-else-if="img.status === 'success'" class="absolute bottom-1 right-1 h-5 w-5 flex items-center justify-center rounded-full bg-green-500 text-white">
                <wd-icon name="check" size="22rpx" />
              </view>
            </view>
            <!-- 选图入口 -->
            <view class="aspect-square flex items-center justify-center border-2 border-gray-300 rounded-lg border-dashed text-gray-400" @click="choosePhotos">
              <wd-icon name="camera" size="36rpx" />
            </view>
          </view>
        </view>
      </scroll-view>
      <!-- 底部固定操作区域 -->
      <view v-if="pendingPhotos.length" class="box-border w-full flex items-center">
        <uh-button class="flex-1" custom-class="flex-1 uh-global-card-glass uh-shadow-xs border py-2 !rounded-xl !bg-love text-white" :disabled="uploading || pendingCount > 0" @click="!(uploading || pendingCount > 0) && commitPhotos()">
          {{ uploading ? '照片上传中…' : pendingCount > 0 ? `待上传 ${pendingCount} 张` : `保存 ${pendingPhotos.length} 张照片` }}
        </uh-button>
      </view>
    </view>
  </uh-glass-popup>
  <wd-dialog />
</template>
