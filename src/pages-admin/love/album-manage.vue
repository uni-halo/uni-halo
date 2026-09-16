<script lang="ts" setup>
/**
 * 恋爱相册管理页
 */
import { computed, ref } from 'vue'
import { onLoad, onPageScroll, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { getLoveAlbums } from '@/api/uni-halo'
import { addLoveAlbumPhoto, createLoveAlbum, deleteLoveAlbum, getLoveAlbumAdmin, removeLoveAlbumPhoto, updateLoveAlbum } from '@/api/uni-admin'
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

/* ---------------- 新建/编辑相册弹层 ---------------- */
const formVisible = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editName = ref('')
/** 表单（对齐插件端 LoveAlbumSpec + 密码操作语义） */
const form = ref({
  displayName: '',
  description: '',
  priority: 0,
  cover: '',
  /** 明文密码：创建=设置；编辑=留空保持原密码 */
  password: '',
  /** 编辑模式：true=清除密码（提交后复位） */
  passwordRemoved: false,
  /** 当前是否已启用密码（服务端回显） */
  passwordEnabled: false,
})
const saving = ref(false)

/** 封面单图上传 */
const { list: coverList, choose: chooseCover, remove: removeCover, uploading: coverUploading, urls: coverUrls } = useHaloUpload({ maxCount: 1 })

function handleCoverChange() {
  form.value.cover = coverUrls()[0] || form.value.cover
}

function openCreate() {
  formMode.value = 'create'
  editName.value = ''
  form.value = { displayName: '', description: '', priority: 0, cover: '', password: '', passwordRemoved: false, passwordEnabled: false }
  coverList.value = []
  formVisible.value = true
}

async function openEdit(album: ILoveAlbum) {
  formMode.value = 'edit'
  editName.value = album.metadata?.name || album.name || ''
  formVisible.value = true
  // 用 console 详情回填（含 passwordEnabled/priority 及原始 spec 字段）
  try {
    const res = await getLoveAlbumAdmin(editName.value)
    const spec = (res.data?.spec || {}) as Record<string, any>
    form.value.displayName = spec.displayName || album.displayName || ''
    form.value.description = spec.description || ''
    form.value.priority = Number(spec.priority ?? 0)
    form.value.cover = spec.cover || ''
    form.value.password = ''
    form.value.passwordRemoved = false
    form.value.passwordEnabled = spec.passwordEnabled === true
    coverList.value = form.value.cover
      ? [{ tempPath: checkThumbnailUrl(form.value.cover), url: form.value.cover, status: 'success' as const, progress: 100 }]
      : []
  }
  catch {
    // 详情拉取失败时退回列表项数据
    form.value.displayName = album.displayName || album.title || ''
    uni.showToast({ title: '相册详情加载失败，仅回填基础信息', icon: 'none' })
  }
}

async function handleSave() {
  if (!form.value.displayName.trim()) {
    uni.showToast({ title: '请填写相册名称', icon: 'none' })
    return
  }
  if (coverList.value.some(i => i.status === 'pending' || i.status === 'uploading' || i.status === 'error')) {
    uni.showToast({ title: '封面上传中，请稍候', icon: 'none' })
    return
  }
  handleCoverChange()
  const spec = {
    displayName: form.value.displayName.trim(),
    description: form.value.description,
    cover: form.value.cover,
    priority: Number(form.value.priority) || 0,
  }
  saving.value = true
  try {
    if (formMode.value === 'create') {
      await createLoveAlbum({ album: { spec }, password: form.value.password || undefined })
    }
    else {
      await updateLoveAlbum(editName.value, {
        album: { spec },
        password: form.value.password || undefined,
        passwordRemoved: form.value.passwordRemoved || undefined,
      })
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
    // 用 console 详情拉取（照片带服务端生成的 name，删除照片接口依赖）
    // console API 返回完整资源结构 { metadata, spec: { displayName, photos, ... }, status }
    const res = await getLoveAlbumAdmin(name)
    const data: any = res.data || {}
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
    detailVisible.value = false
  }
  finally {
    detailLoading.value = false
  }
}

/** 批量选图并上传，成功后逐张提交到相册（POST /photos，name 由服务端生成） */
const { list: pendingPhotos, choose: choosePhotos, remove: removePending, uploading, urls: photoUrls } = useHaloUpload({ maxCount: 18 })

async function commitPhotos() {
  if (!currentAlbum.value)
    return
  const name = currentAlbum.value.metadata?.name || currentAlbum.value.name || ''
  const newUrls = photoUrls()
  if (newUrls.length === 0)
    return
  try {
    const created = await Promise.all(newUrls.map(url => addLoveAlbumPhoto(name, { url })))
    // 服务端返回整本相册（照片带生成的 name），直接以最新列表为准
    const latestPhotos = (created[0]?.data as any)?.spec?.photos as ILovePhoto[] | undefined
    currentPhotos.value = latestPhotos?.length ? latestPhotos : [...currentPhotos.value, ...newUrls.map(url => ({ url }) as ILovePhoto)]
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
  if (!photo.name) {
    uni.showToast({ title: '照片缺少标识，请刷新后重试', icon: 'none' })
    return
  }
  uni.showModal({
    title: '删除照片',
    content: '确定删除这张照片吗？',
    confirmColor: '#ef4444',
    success: async (res) => {
      if (!res.confirm)
        return
      try {
        await removeLoveAlbumPhoto(name, photo.name || '')
        currentPhotos.value = currentPhotos.value.filter(p => p.name !== photo.name)
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
    urls: currentPhotos.value.map(p => checkThumbnailUrl(p.url || '')),
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

    <view v-if="!detailVisible" class="grid grid-cols-2 gap-3 px-3 pb-24 pt-3">
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
    <uh-permission v-if="!detailVisible" permission="LOVE_ALBUM_MANAGE">
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

    <!-- 新建/编辑相册弹层 -->
    <uh-glass-popup v-model="formVisible" :z-index="100" position="bottom" custom-class="!border rounded-xl">
      <view class="relative mb-4 box-border w-full flex items-center justify-around px-4 pt-4">
        <view class="w-full flex flex-col gap-y-1">
          <text class="text-md font-bold">{{ formMode === 'create' ? '新建相册' : '编辑相册' }}</text>
          <text class="text-xs text-gray-500">{{ formMode === 'create' ? '创建一个新相册来存放回忆' : '修改相册信息' }}</text>
        </view>
        <view class="uh-global-card-glass absolute right-4 top-4 h-6 w-6 border rounded-lg text-center shadow-none" @click="formVisible = false">
          <wd-icon name="close" size="32rpx" class="text-gray-500" />
        </view>
      </view>
      <scroll-view :scroll-y="true" :show-scrollbar="false" class="box-border max-h-[60vh] p-4 pt-0">
        <view class="mb-5 flex items-center">
          <text class="w-[140rpx] shrink-0 text-sm text-[#666]">名称 *</text>
          <input v-model="form.displayName" class="uh-global-card-glass h-9 flex-1 border rounded-xl px-4 text-sm shadow-none" placeholder="请输入相册名称">
        </view>
        <view class="mb-5 flex items-start">
          <text class="w-[140rpx] shrink-0 pt-2.5 text-sm text-[#666]">描述</text>
          <textarea v-model="form.description" class="uh-global-card-glass box-border h-24 flex-1 border rounded-xl p-3 text-sm shadow-none" placeholder="请输入相册描述(选填)" :maxlength="200" />
        </view>
        <view class="mb-5 flex items-center">
          <text class="w-[140rpx] shrink-0 text-sm text-[#666]">排序</text>
          <input v-model="form.priority" type="number" class="uh-global-card-glass h-9 flex-1 border rounded-xl px-4 text-sm shadow-none" placeholder="数字越大越靠前，默认 0">
        </view>
        <view class="mb-5 flex items-start">
          <text class="w-[140rpx] shrink-0 pt-1 text-sm text-[#666]">封面</text>
          <view class="grid flex-1 grid-cols-4 gap-2">
            <view v-for="img in coverList" :key="img.tempPath" class="relative aspect-square overflow-hidden rounded-lg">
              <image :src="img.tempPath" mode="aspectFill" class="h-full w-full" />
              <view class="absolute right-1 top-1 h-5 w-5 flex items-center justify-center rounded-full bg-black/50 text-white" @click="removeCover(img.tempPath); handleCoverChange()">
                <wd-icon name="close" size="22rpx" />
              </view>
            </view>
            <view v-if="!coverList.length" class="aspect-square flex items-center justify-center border-2 border-gray-300 rounded-lg border-dashed text-gray-400" @click="chooseCover">
              <wd-icon name="camera" size="36rpx" />
            </view>
          </view>
        </view>
        <text v-if="coverUploading" class="mb-4 block pl-[140rpx] text-3xs text-gray-400">封面上传中…</text>
        <view class="mb-5">
          <view class="flex items-center">
            <text class="w-[140rpx] shrink-0 text-sm text-[#666]">查看密码</text>
            <input
              v-model="form.password"
              class="uh-global-card-glass h-9 flex-1 border rounded-xl px-4 text-sm shadow-none"
              :placeholder="formMode === 'create' ? '设置查看密码(选填)' : '输入新密码重设，留空保持不变'"
              password
            >
          </view>
          <!-- 密码状态与操作：单独一行在输入框下方 -->
          <view v-if="formMode === 'edit'" class="mt-2 flex items-center gap-4 pl-[140rpx]">
            <text class="text-3xs" :class="form.passwordRemoved ? 'text-orange-500' : form.passwordEnabled ? 'text-green-600' : 'text-gray-400'">
              {{ form.passwordRemoved ? '保存后清除' : form.passwordEnabled ? '已启用' : '未设置' }}
            </text>
            <view v-if="form.passwordEnabled" class="flex items-center gap-1.5" @click="form.passwordRemoved = !form.passwordRemoved">
              <view class="h-4 w-4 flex items-center justify-center rounded border" :class="form.passwordRemoved ? 'border-orange-400 bg-orange-400 text-white' : 'border-gray-300'">
                <wd-icon v-if="form.passwordRemoved" name="check" size="20rpx" />
              </view>
              <text class="text-3xs text-gray-500">清除查看密码</text>
            </view>
          </view>
        </view>
      </scroll-view>

      <!-- 底部固定操作栏（滚动区外） -->
      <view class="border-t border-black/5 px-4 pb-safe pt-3">
        <uh-button custom-class="py-2 !rounded-xl !bg-love text-white" :loading="saving" @click="handleSave">
          保存
        </uh-button>
      </view>
    </uh-glass-popup>

    <!-- 相册详情（照片管理弹窗） -->
    <uh-glass-popup v-model="detailVisible" :z-index="100" position="bottom" custom-class="!border rounded-xl">
      <view class="relative mb-4 box-border w-full flex items-center justify-around px-4 pt-4">
        <view class="w-full flex flex-col gap-y-1">
          <text class="text-md font-bold">{{ currentAlbum?.title || currentAlbum?.displayName || '相册' }}</text>
          <text class="text-xs text-gray-500">管理相册照片，点击图片可预览</text>
        </view>
        <view class="uh-global-card-glass absolute right-4 top-4 h-6 w-6 border rounded-lg text-center shadow-none" @click="detailVisible = false">
          <wd-icon name="close" size="32rpx" class="text-gray-500" />
        </view>
      </view>

      <scroll-view :scroll-y="true" :show-scrollbar="false" class="box-border max-h-[60vh] p-4 pt-0">
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
      </scroll-view>

      <!-- 提交待传照片：底部固定操作栏（滚动区外） -->
      <view v-if="pendingPhotos.length" class="border-t border-black/5 px-4 pb-safe pt-3">
        <uh-button custom-class="py-2 !rounded-xl !bg-love text-white" :disabled="uploading || pendingCount > 0" @click="!(uploading || pendingCount > 0) && commitPhotos()">
          {{ uploading ? '照片上传中…' : pendingCount > 0 ? `待上传 ${pendingCount} 张` : `保存 ${pendingPhotos.length} 张照片` }}
        </uh-button>
      </view>
    </uh-glass-popup>
  </view>
</template>

<style scoped lang="scss">
.uh-translate-x-center {
  transform: translateX(-50%);
}
</style>
