<script lang="ts" setup>
/**
 * 恋爱故事管理页：列表（分页加载）+ 新增 + 编辑 + 删除
 * 编辑/新增走独立表单弹层（标题 + 日期 + 地点 + 正文 + 图片）
 */
import { ref } from 'vue'
import { onPageScroll, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { getLoveStories } from '@/api/uni-halo'
import { createLoveStory, deleteLoveStory, updateLoveStory } from '@/api/uni-admin'
import { usePageScroll } from '@/hooks/usePageScroll'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { useHaloUpload } from '@/hooks/useHaloUpload'
import { checkThumbnailUrl } from '@/utils/url'
import type { ILoveStory, ILoveStorySpec } from '@/api/types/uni-halo'

definePage({
  style: {
    navigationBarTitleText: '恋爱故事管理',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
  },
})

const { scrollY, updatePageScrollValue } = usePageScroll()

/* ---------------- 数据加载 ---------------- */
const { loadingStatus, loadMoreStatus, updateLoadingStatus, updateLoadMoreStatus, resetLoadMoreStatus } = useDataLoadingStatus()
const queryParams = ref({ size: 10, page: 1 })
const dataList = ref<ILoveStory[]>([])

async function handleGetData() {
  if (!loadMoreStatus.value.active) {
    updateLoadingStatus(DataLoadingStatusEnum.Loading)
  }
  try {
    const res = await getLoveStories({ ...queryParams.value })
    const items = res.data?.items || []
    dataList.value = loadMoreStatus.value.active
      ? dataList.value.concat(items)
      : items
    if (!loadMoreStatus.value.active) {
      updateLoadingStatus(dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
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

/* ---------------- 新增/编辑弹层 ---------------- */
const formVisible = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editName = ref('')
const form = ref<ILoveStorySpec>({})
const { list: imageList, choose: chooseImages, remove: removeImage, retry: imageRetry } = useHaloUpload({ maxCount: 9 })
const saving = ref(false)

function openCreate() {
  formMode.value = 'create'
  editName.value = ''
  form.value = { title: '', content: '', date: '', location: '' }
  imageList.value = []
  formVisible.value = true
}

function openEdit(item: ILoveStory) {
  formMode.value = 'edit'
  editName.value = item.metadata?.name || ''
  form.value = { ...(item.spec || {}) }
  imageList.value = (form.value.images || []).map(url => ({
    tempPath: url,
    url,
    status: 'success' as const,
    progress: 100,
  }))
  formVisible.value = true
}

async function handleSave() {
  const spec = { ...form.value }
  if (!spec.title?.trim()) {
    uni.showToast({ title: '请填写标题', icon: 'none' })
    return
  }
  // 若有新选的本地图，先等上传完成
  if (imageList.value.some(i => i.status === 'pending' || i.status === 'uploading' || i.status === 'error')) {
    uni.showToast({ title: '图片尚未上传完成', icon: 'none' })
    return
  }
  spec.images = imageList.value.filter(i => i.status === 'success').map(i => i.url)
  saving.value = true
  try {
    if (formMode.value === 'create') {
      await createLoveStory(spec)
    }
    else {
      await updateLoveStory(editName.value, spec)
    }
    formVisible.value = false
    uni.showToast({ title: formMode.value === 'create' ? '已新增' : '已保存', icon: 'success' })
    handleRetry()
  }
  catch (err: any) {
    uni.showToast({ title: err?.message || '保存失败', icon: 'none' })
  }
  finally {
    saving.value = false
  }
}

/* ---------------- 删除 ---------------- */
function handleDelete(item: ILoveStory) {
  uni.showModal({
    title: '删除故事',
    content: `确定删除「${item.spec?.title || '未命名'}」吗？删除后不可恢复。`,
    confirmColor: '#ef4444',
    success: async (res) => {
      if (!res.confirm)
        return
      try {
        await deleteLoveStory(item.metadata?.name || '')
        dataList.value = dataList.value.filter(x => (x.metadata?.name || '') !== (item.metadata?.name || ''))
        if (dataList.value.length === 0)
          updateLoadingStatus(DataLoadingStatusEnum.Empty)
        uni.showToast({ title: '已删除', icon: 'success' })
      }
      catch (err: any) {
        uni.showToast({ title: err?.message || '删除失败', icon: 'none' })
      }
    },
  })
}

onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})
</script>

<template>
  <view class="box-border min-h-screen w-screen flex flex-col bg-page">
    <uh-navbar :scroll-y="scrollY" :use-back="true" default-title="恋爱故事管理" title-color="text-gray-900" />

    <uh-data-loading v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus" min-height="70vh" @refresh="handleRetry" />

    <view v-else class="box-border flex flex-col gap-3 px-3 pt-3">
      <view v-for="item in dataList" :key="item.metadata?.name || item.id" class="uh-global-card-glass uh-shadow-xs overflow-hidden rounded-xl">
        <view class="flex items-start gap-3 p-4">
          <image v-if="item.spec?.images?.[0]" :src="checkThumbnailUrl(item.spec.images[0], true)" mode="aspectFill" class="h-16 w-16 shrink-0 rounded-lg" />
          <view class="min-w-0 flex-1">
            <view class="text-sm text-gray-900 font-bold">
              {{ item.spec?.title || '未命名' }}
            </view>
            <view class="mt-1 text-3xs text-gray-400">
              <text v-if="item.spec?.date">📅 {{ item.spec.date }}</text>
              <text v-if="item.spec?.location"> · 📍 {{ item.spec.location }}</text>
            </view>
            <view class="line-clamp-2 mt-1 text-xs text-gray-500 leading-relaxed">
              {{ (item.spec?.content || '').replace(/<[^>]+>/g, '') || '' }}
            </view>
          </view>
        </view>
        <view class="flex items-center justify-end gap-3 border-t border-black/5 px-4 py-2.5 text-xs">
          <text class="text-gray-500" @click="openEdit(item)">✏️ 编辑</text>
          <text class="text-red-500" @click="handleDelete(item)">🗑 删除</text>
        </view>
      </view>
      <uh-data-loadmore :status="loadMoreStatus.status" :text="loadMoreStatus.text" />
    </view>

    <!-- FAB：新增 -->
    <uh-permission permission="LOVE_STORY_MANAGE">
      <view
        class="fixed bottom-30 right-4 z-50 h-14 w-14 flex items-center justify-center rounded-full bg-primary text-2xl text-white shadow-lg"
        @click="openCreate"
      >
        ＋
      </view>
    </uh-permission>

    <!-- 新增/编辑弹层 -->
    <view v-if="formVisible" class="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" @click.self="formVisible = false">
      <view class="max-h-[80vh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-safe dark:bg-dark-900">
        <view class="mb-4 flex items-center justify-between">
          <text class="text-base font-bold">{{ formMode === 'create' ? '新增故事' : '编辑故事' }}</text>
          <text class="text-sm text-primary" @click="handleSave">{{ saving ? '保存中…' : '保存' }}</text>
        </view>
        <input v-model="form.title" class="mb-3 w-full rounded-xl bg-page px-4 py-3 text-sm" placeholder="故事标题">
        <view class="mb-3 flex gap-2">
          <input v-model="form.date" class="w-1/2 rounded-xl bg-page px-4 py-3 text-sm" placeholder="日期 如 2024-06-01">
          <input v-model="form.location" class="w-1/2 rounded-xl bg-page px-4 py-3 text-sm" placeholder="地点">
        </view>
        <textarea v-model="form.content" class="mb-3 w-full rounded-xl bg-page p-4 text-sm" placeholder="故事内容…" auto-height :maxlength="10000" />
        <!-- 图片九宫格 -->
        <view class="grid grid-cols-4 gap-2">
          <view v-for="img in imageList" :key="img.tempPath" class="relative aspect-square overflow-hidden rounded-lg">
            <image :src="img.tempPath" class="h-full w-full" mode="aspectFill" />
            <view class="absolute right-1 top-1 h-5 w-5 flex items-center justify-center rounded-full bg-black/50 text-xs text-white" @click="removeImage(img.tempPath)">
              ✕
            </view>
            <view v-if="img.status === 'uploading'" class="absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-white">
              {{ img.progress }}%
            </view>
            <view v-else-if="img.status === 'error'" class="absolute inset-0 bg-red-500/60" @click="imageRetry && imageRetry(img.tempPath)" />
          </view>
          <view v-if="imageList.length < 9" class="aspect-square flex items-center justify-center border-2 border-gray-300 rounded-lg border-dashed text-2xl text-gray-400" @click="chooseImages">
            ＋
          </view>
        </view>
      </view>
    </view>
  </view>
</template>
