<script lang="ts" setup>
/**
 * 恋爱相册管理页
 * 新建/编辑相册弹窗为全局组件 uh-admin-album-edit-popup，照片管理弹窗为 uh-admin-album-photo-popup
 */
import { ref } from 'vue'
import { onLoad, onPageScroll, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { getLoveAlbums } from '@/api/uni-halo'
import { deleteLoveAlbum } from '@/api/uni-admin'
import { usePageScroll } from '@/hooks/usePageScroll'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { checkThumbnailUrl } from '@/utils/url'
import type { ILoveAlbum } from '@/api/types/uni-halo'

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

onLoad(() => {
  handleGetData()
})

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

/* ---------------- 新建/编辑相册弹窗（全局组件） ---------------- */
const albumEditVisible = ref(false)
const albumEditRef = ref<{ openEdit(album: ILoveAlbum): void } | null>(null)

function openCreate() {
  albumEditVisible.value = true
}

function openEdit(album: ILoveAlbum) {
  albumEditRef.value?.openEdit(album)
}

function handleEditClose(data: { isSubmit: boolean, refresh: boolean }) {
  albumEditVisible.value = false
  if (data.refresh)
    handleRetry()
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

/* ---------------- 相册照片管理弹窗（全局组件） ---------------- */
const photoPopupRef = ref<{ openDetail(album: ILoveAlbum): void } | null>(null)

function openDetail(album: ILoveAlbum) {
  photoPopupRef.value?.openDetail(album)
}

function handlePhotoClose(data: { isSubmit: boolean, refresh: boolean }) {
  if (data.refresh)
    handleRetry()
}

onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})
</script>

<template>
  <view class="box-border min-h-screen w-screen flex flex-col bg-page">
    <uh-navbar :scroll-y="scrollY" :use-back="true" default-title="恋爱相册管理" title-color="text-gray-900" />

    <!-- 相册列表 -->
    <uh-data-loading v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus" min-height="70vh" @refresh="handleRetry" />

    <view v-else class="grid grid-cols-2 gap-3 px-3 pb-24 pt-3">
      <view v-for="album in albumList" :key="album.metadata?.name || album.name" class="uh-global-card-glass uh-shadow-xs overflow-hidden rounded-xl">
        <view class="relative h-32 w-full">
          <image v-if="album.cover || album.photos?.[0]?.url" :src="checkThumbnailUrl(album.cover || album.photos?.[0]?.url || '', true)" class="h-full w-full" mode="aspectFill" />
          <view v-else class="h-full w-full flex items-center justify-center bg-gray-100 text-gray-300">
            <wd-icon name="camera" size="60rpx" />
          </view>
        </view>
        <view class="p-3">
          <view class="truncate text-sm text-gray-900 font-bold">
            {{ album.title || album.displayName || '未命名相册' }}
          </view>
          <view class="mt-0.5 text-3xs text-gray-400">
            {{ album.photoCount ?? album.photos?.length ?? 0 }} 张
          </view>
          <view class="mt-2 flex items-center justify-between gap-2 text-xs">
            <view class="flex items-center gap-0.5 text-gray-500" @click="openDetail(album)">
              <wd-icon name="camera" size="26rpx" />
              <text>照片</text>
            </view>
            <view class="flex items-center gap-0.5 text-gray-500" @click="openEdit(album)">
              <wd-icon name="edit" size="26rpx" />
              <text>编辑</text>
            </view>
            <view class="flex items-center gap-0.5 text-red-500" @click="handleDeleteAlbum(album)">
              <wd-icon name="delete" size="26rpx" />
              <text>删除</text>
            </view>
          </view>
        </view>
      </view>
      <uh-data-loadmore v-if="albumList.length" class="col-span-2" :status="loadMoreStatus.status" :text="loadMoreStatus.text" />
    </view>

    <!-- 底部悬浮：新建相册（参考文章详情悬浮设计） -->
    <uh-permission permission="LOVE_ALBUM_MANAGE">
      <view class="uh-translate-x-center fixed bottom-0 left-1/2 z-10 flex items-center justify-center pb-safe">
        <view
          class="uh-global-card-glass box-border flex items-center justify-center gap-x-1 border rounded-full px-6 py-2.5 text-love shadow-none"
          @click="openCreate"
        >
          <wd-icon name="add-circle" size="32rpx" />
          <text class="shrink-0 text-xs font-semibold">新建相册</text>
        </view>
      </view>
    </uh-permission>

    <!-- 新建/编辑相册弹窗（全局组件，内聚表单与上传逻辑） -->
    <uh-admin-album-edit-popup ref="albumEditRef" :show="albumEditVisible" @on-close="handleEditClose" />

    <!-- 相册照片管理弹窗（全局组件，内聚上传/删除/预览逻辑） -->
    <uh-admin-album-photo-popup ref="photoPopupRef" @on-close="handlePhotoClose" />
  </view>
</template>

<style scoped lang="scss">
.uh-translate-x-center {
  transform: translateX(-50%);
}
</style>
