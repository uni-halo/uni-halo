<script lang="ts" setup>
/**
 * 恋爱相册管理页：相册列表（分页）+ 新建/编辑/删除 + 相册内照片管理（批量上传/删除）
 */
import { computed, ref } from 'vue'
import { onPageScroll, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { getLoveAlbumByName, getLoveAlbums } from '@/api/uni-halo'
import { addLoveAlbumPhotos, createLoveAlbum, deleteLoveAlbum, removeLoveAlbumPhoto, updateLoveAlbum } from '@/api/uni-admin'
import { usePageScroll } from '@/hooks/usePageScroll'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { useHaloUpload } from '@/hooks/useHaloUpload'
import { checkThumbnailUrl } from '@/utils/url'
import type { ILoveAlbum, ILovePhoto } from '@/api/types/uni-halo'

definePage({
  style: {
    navigationBarTitleText: '相册管理',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
  },
})

const { scrollY, updatePageScrollValue } = usePageScroll()

/* ---------------- 相册列表（分页） ---------------- */
const { loadingStatus, loadMoreStatus, updateLoadingStatus, updateLoadMoreStatus, resetLoadMoreStatus } = useDataLoadingStatus()
const queryParams = ref({ size: 10, page: 1 })
const albumList = ref<ILoveAlbum[]>([])

async function handleGetData() {
  if (!loadMoreStatus.value.active) {
    updateLoadingStatus(DataLoadingStatusEnum.Loading)
  }
  try {
    const res = await getLoveAlbums({ ...queryParams.value })
    const items = res.data?.items || []
    albumList.value = loadMoreStatus.value.active
      ? albumList.value.concat(items)
      : items
    if (!loadMoreStatus.value.active) {
      updateLoadingStatus(albumList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
    }
    updateLoadMoreStatus({
      active: false,
      status: res.data?.hasNext ? 'loadMore' : 'noMore',
      hasNext: !!res.data?.hasNext,
    })
  }
  catch (err) {
    console.error(err)
    if (loadMoreStatus.value.active) {
      updateLoadMoreStatus({ active: false, status: 'error' })
    }
    else {
      updateLoadingStatus(DataLoadingStatusEnum.Error)
    }
  }
  finally {
    uni.stopPullDownRefresh()
  }
}

function handleRetry() {
  queryParams.value.page = 1
  handleGetData()
}

onPullDownRefresh(() => {
  resetLoadMoreStatus()
  queryParams.value.page = 1
  handleGetData()
})

onReachBottom(() => {
  if (loadMoreStatus.value.active)
    return
  if (loadMoreStatus.value.hasNext) {
    queryParams.value.page += 1
    updateLoadMoreStatus({ active: true, status: 'loading' })
    handleGetData()
  }
})

/* ---------------- 新建/编辑相册弹层 ---------------- */
const formVisible = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editName = ref('')
const form = ref({ title: '', description: '' })
const saving = ref(false)

function openCreate() {
  formMode.value = 'create'
  editName.value = ''
  form.value = { title: '', description: '' }
  formVisible.value = true
}

function openEdit(album: ILoveAlbum) {
  formMode.value = 'edit'
  editName.value = album.metadata?.name || album.name || ''
  form.value = { title: album.title || album.displayName || '', description: album.description || '' }
  formVisible.value = true
}

async function handleSave() {
  if (!form.value.title.trim()) {
    uni.showToast({ title: '请填写相册名称', icon: 'none' })
    return
  }
  saving.value = true
  try {
    if (formMode.value === 'create') {
      await createLoveAlbum(form.value)
    }
    else {
      await updateLoveAlbum(editName.value, form.value)
    }
    formVisible.value = false
    uni.showToast({ title: formMode.value === 'create' ? '已创建' : '已保存', icon: 'success' })
    handleRetry()
  }
  catch (err: any) {
    uni.showToast({ title: err?.message || '保存失败', icon: 'none' })
  }
  finally {
    saving.value = false
  }
}

function handleDeleteAlbum(album: ILoveAlbum) {
  uni.showModal({
    title: '删除相册',
    content: `确定删除「${album.title || album.displayName || '未命名'}」吗？相册内照片将一并删除。`,
    confirmColor: '#ef4444',
    success: async (res) => {
      if (!res.confirm)
        return
      try {
        await deleteLoveAlbum(album.metadata?.name || album.name || '')
        albumList.value = albumList.value.filter(x => (x.metadata?.name || x.name) !== (album.metadata?.name || album.name))
        if (albumList.value.length === 0)
          updateLoadingStatus(DataLoadingStatusEnum.Empty)
        uni.showToast({ title: '已删除', icon: 'success' })
      }
      catch (err: any) {
        uni.showToast({ title: err?.message || '删除失败', icon: 'none' })
      }
    },
  })
}

/* ---------------- 相册详情（照片管理） ---------------- */
const detailVisible = ref(false)
const currentAlbum = ref<ILoveAlbum | null>(null)
const currentPhotos = ref<ILovePhoto[]>([])
const detailLoading = ref(false)

async function openDetail(album: ILoveAlbum) {
  const name = album.metadata?.name || album.name || ''
  detailVisible.value = true
  detailLoading.value = true
  currentAlbum.value = album
  try {
    const res = await getLoveAlbumByName(name, { page: 1, size: 100 })
    currentAlbum.value = res.data
    currentPhotos.value = res.data?.photos || []
  }
  catch (err: any) {
    uni.showToast({ title: err?.message || '加载相册失败', icon: 'none' })
    detailVisible.value = false
  }
  finally {
    detailLoading.value = false
  }
}

/** 批量选图并上传，成功后合并提交到相册 */
const { list: pendingPhotos, choose: choosePhotos, remove: removePending, uploading, allSuccess: photosAllSuccess, urls: photoUrls } = useHaloUpload({ maxCount: 18 })

async function handleUploadPhotos() {
  choosePhotos()
}

async function commitPhotos() {
  if (!currentAlbum.value)
    return
  const name = currentAlbum.value.metadata?.name || currentAlbum.value.name || ''
  const newUrls = photoUrls()
  if (newUrls.length === 0)
    return
  const merged: ILovePhoto[] = [
    ...currentPhotos.value,
    ...newUrls.map(url => ({ url })),
  ]
  try {
    await addLoveAlbumPhotos(name, merged)
    currentPhotos.value = merged
    pendingPhotos.value = []
    uni.showToast({ title: `已添加 ${newUrls.length} 张照片`, icon: 'success' })
    handleRetry()
  }
  catch (err: any) {
    uni.showToast({ title: err?.message || '照片保存失败', icon: 'none' })
  }
}

/** 未上传完成的待传照片数 */
const pendingCount = computed(() => pendingPhotos.value.filter(i => i.status !== 'success').length)

function handleDeletePhoto(photo: ILovePhoto) {
  const name = currentAlbum.value?.metadata?.name || currentAlbum.value?.name || ''
  uni.showModal({
    title: '删除照片',
    content: '确定删除这张照片吗？',
    confirmColor: '#ef4444',
    success: async (res) => {
      if (!res.confirm)
        return
      try {
        await removeLoveAlbumPhoto(name, photo.url || '', currentPhotos.value)
        currentPhotos.value = currentPhotos.value.filter(p => p.url !== photo.url)
        uni.showToast({ title: '已删除', icon: 'success' })
        handleRetry()
      }
      catch (err: any) {
        uni.showToast({ title: err?.message || '删除失败', icon: 'none' })
      }
    },
  })
}

function handlePreviewPhoto(index: number) {
  uni.previewImage({
    current: index,
    urls: currentPhotos.value.map(p => p.url || ''),
  })
}

onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})
</script>

<template>
  <view class="box-border min-h-screen w-screen flex flex-col bg-page">
    <uh-navbar :scroll-y="scrollY" :use-back="true" default-title="相册管理" title-color="text-gray-900" />

    <!-- 相册列表 -->
    <uh-data-loading v-if="loadingStatus !== DataLoadingStatusEnum.Success && !detailVisible" :loading-status="loadingStatus" min-height="70vh" @refresh="handleRetry" />

    <view v-if="!detailVisible" class="grid grid-cols-2 gap-3 px-3 pt-3">
      <view v-for="album in albumList" :key="album.metadata?.name || album.name" class="uh-global-card-glass uh-shadow-xs overflow-hidden rounded-xl">
        <view class="relative h-32 w-full">
          <image v-if="album.cover || album.photos?.[0]?.url" :src="checkThumbnailUrl(album.cover || album.photos?.[0]?.url || '', true)" class="h-full w-full" mode="aspectFill" />
          <view v-else class="h-full w-full flex items-center justify-center bg-gray-100 text-3xl text-gray-300">
            📷
          </view>
        </view>
        <view class="p-3">
          <view class="truncate text-sm text-gray-900 font-bold">
            {{ album.title || album.displayName || '未命名相册' }}
          </view>
          <view class="mt-0.5 text-3xs text-gray-400">
            {{ album.photos?.length || 0 }} 张
          </view>
          <view class="mt-2 flex items-center justify-end gap-3 text-xs">
            <text class="text-gray-500" @click="openDetail(album)">📷 照片</text>
            <text class="text-gray-500" @click="openEdit(album)">✏️</text>
            <text class="text-red-500" @click="handleDeleteAlbum(album)">🗑</text>
          </view>
        </view>
      </view>
      <uh-data-loadmore v-if="albumList.length" class="col-span-2" :status="loadMoreStatus.status" :text="loadMoreStatus.text" />
    </view>

    <!-- FAB：新建相册 -->
    <uh-permission v-if="!detailVisible" permission="LOVE_ALBUM_MANAGE">
      <view
        class="fixed bottom-30 right-4 z-50 h-14 w-14 flex items-center justify-center rounded-full bg-primary text-2xl text-white shadow-lg"
        @click="openCreate"
      >
        ＋
      </view>
    </uh-permission>

    <!-- 新建/编辑相册弹层 -->
    <view v-if="formVisible" class="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" @click.self="formVisible = false">
      <view class="rounded-t-3xl bg-white p-5 pb-safe dark:bg-dark-900">
        <view class="mb-4 flex items-center justify-between">
          <text class="text-base font-bold">{{ formMode === 'create' ? '新建相册' : '编辑相册' }}</text>
          <text class="text-sm text-primary" @click="handleSave">{{ saving ? '保存中…' : '保存' }}</text>
        </view>
        <input v-model="form.title" class="mb-3 w-full rounded-xl bg-page px-4 py-3 text-sm" placeholder="相册名称">
        <textarea v-model="form.description" class="w-full rounded-xl bg-page p-4 text-sm" placeholder="相册描述（可选）" auto-height :maxlength="200" />
      </view>
    </view>

    <!-- 相册详情（照片管理） -->
    <view v-if="detailVisible" class="fixed inset-0 z-50 flex flex-col bg-page">
      <view class="safe-area-top flex items-center gap-2 bg-white/90 px-4 py-3 dark:bg-dark-900/90">
        <text class="text-xl" @click="detailVisible = false">←</text>
        <text class="flex-1 text-base font-bold">{{ currentAlbum?.title || currentAlbum?.displayName || '相册' }}</text>
      </view>

      <scroll-view scroll-y class="min-h-0 flex-1">
        <view v-if="detailLoading" class="mt-20 text-center text-sm text-gray-400">
          加载中…
        </view>
        <view v-else class="grid grid-cols-3 gap-2 p-3">
          <view v-for="(photo, index) in currentPhotos" :key="photo.url" class="relative aspect-square overflow-hidden rounded-lg">
            <image :src="checkThumbnailUrl(photo.url || '', true)" class="h-full w-full" mode="aspectFill" @click="handlePreviewPhoto(index)" />
            <view class="absolute right-1 top-1 h-5 w-5 flex items-center justify-center rounded-full bg-black/50 text-xs text-white" @click.stop="handleDeletePhoto(photo)">
              ✕
            </view>
          </view>
          <!-- 待上传预览 -->
          <view v-for="img in pendingPhotos" :key="img.tempPath" class="relative aspect-square overflow-hidden rounded-lg">
            <image :src="img.tempPath" class="h-full w-full" mode="aspectFill" />
            <view class="absolute right-1 top-1 h-5 w-5 flex items-center justify-center rounded-full bg-black/50 text-xs text-white" @click="removePending(img.tempPath)">
              ✕
            </view>
            <view v-if="img.status === 'uploading'" class="absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-white">
              {{ img.progress }}%
            </view>
            <view v-else-if="img.status === 'error'" class="absolute inset-0 flex items-center justify-center bg-red-500/60 text-xs text-white" @click="img.status = 'pending'">
              失败
            </view>
          </view>
          <!-- 选图入口 -->
          <view class="aspect-square flex items-center justify-center border-2 border-gray-300 rounded-lg border-dashed text-2xl text-gray-400" @click="handleUploadPhotos">
            ＋
          </view>
        </view>
      </scroll-view>

      <!-- 底部提交条（有待传照片时显示） -->
      <view v-if="pendingPhotos.length" class="border-t border-gray-100 bg-white/90 p-3 pb-safe dark:bg-dark-900/90">
        <button
          class="w-full rounded-full text-white"
          :class="uploading || pendingCount > 0 ? 'bg-gray-300' : 'bg-primary'"
          :disabled="uploading || pendingCount > 0"
          @click="commitPhotos"
        >
          {{ uploading ? '照片上传中…' : pendingCount > 0 ? `待上传 ${pendingCount} 张` : `保存 ${pendingPhotos.length} 张照片` }}
        </button>
      </view>
    </view>
  </view>
</template>
