<script lang="ts" setup>
/**
 * 恋爱清单管理页：列表（分页加载）+ 新增 + 编辑 + 删除 + 状态勾选
 * 仅 author/admin 可用（FAB/弹层由 uh-permission 或页面级权限守卫控制）
 */
import { ref } from 'vue'
import { onPageScroll, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { getLoveDailyItems } from '@/api/uni-halo'
import { createLoveDailyItem, deleteLoveDailyItem, updateLoveDailyItem } from '@/api/uni-admin'
import { usePageScroll } from '@/hooks/usePageScroll'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { useHaloUpload } from '@/hooks/useHaloUpload'
import { checkThumbnailUrl } from '@/utils/url'
import type { ILoveDailyItem, ILoveDailyItemSpec } from '@/api/types/uni-halo'

definePage({
  style: {
    navigationBarTitleText: '恋爱清单管理',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
  },
})

const { scrollY, updatePageScrollValue } = usePageScroll()

/* ---------------- 数据加载（同瞬间管理页模式） ---------------- */
const { loadingStatus, loadMoreStatus, updateLoadingStatus, updateLoadMoreStatus, resetLoadMoreStatus } = useDataLoadingStatus()
const queryParams = ref({ size: 10, page: 1 })
const dataList = ref<ILoveDailyItem[]>([])

async function handleGetData() {
  if (!loadMoreStatus.value.active) {
    updateLoadingStatus(DataLoadingStatusEnum.Loading)
  }
  try {
    const res = await getLoveDailyItems({ ...queryParams.value })
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
const form = ref<ILoveDailyItemSpec>({})
const { list: coverList, choose: chooseCover, remove: removeCover } = useHaloUpload({ maxCount: 1 })

function openCreate() {
  formMode.value = 'create'
  editName.value = ''
  form.value = { title: '', content: '', status: 'wait', planDate: '' }
  coverList.value = []
  formVisible.value = true
}

function openEdit(item: ILoveDailyItem) {
  formMode.value = 'edit'
  editName.value = item.metadata?.name || ''
  form.value = { ...(item.spec || {}) }
  coverList.value = (form.value.images || []).map(url => ({
    tempPath: url,
    url,
    status: 'success' as const,
    progress: 100,
  }))
  formVisible.value = true
}

const saving = ref(false)

async function handleSave() {
  const spec = { ...form.value }
  if (!spec.title?.trim()) {
    uni.showToast({ title: '请填写标题', icon: 'none' })
    return
  }
  // 回填封面上传后的远程地址
  spec.images = coverList.value.filter(i => i.status === 'success').map(i => i.url)
  saving.value = true
  try {
    if (formMode.value === 'create') {
      await createLoveDailyItem(spec)
    }
    else {
      await updateLoveDailyItem(editName.value, spec)
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

/* ---------------- 状态切换 / 删除 ---------------- */
async function handleToggleStatus(item: ILoveDailyItem) {
  const spec = { ...(item.spec || {}) }
  const done = spec.status === 'complete'
  spec.status = done ? 'wait' : 'complete'
  if (!done)
    spec.completeDate = new Date().toISOString()
  else
    spec.completeDate = ''
  try {
    await updateLoveDailyItem(item.metadata?.name || '', spec)
    item.spec = { ...item.spec, ...spec }
  }
  catch (err: any) {
    uni.showToast({ title: err?.message || '更新失败', icon: 'none' })
  }
}

function handleDelete(item: ILoveDailyItem) {
  uni.showModal({
    title: '删除清单项',
    content: `确定删除「${item.spec?.title || '未命名'}」吗？`,
    confirmColor: '#ef4444',
    success: async (res) => {
      if (!res.confirm)
        return
      try {
        await deleteLoveDailyItem(item.metadata?.name || '')
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
    <uh-navbar :scroll-y="scrollY" :use-back="true" default-title="恋爱清单管理" title-color="text-gray-900" />

    <uh-data-loading v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus" min-height="70vh" @refresh="handleRetry" />

    <view v-else class="box-border flex flex-col gap-3 px-3 pt-3">
      <view v-for="item in dataList" :key="item.metadata?.name || item.id" class="uh-global-card-glass uh-shadow-xs overflow-hidden rounded-xl">
        <view class="flex items-start gap-3 p-4">
          <!-- 勾选完成状态 -->
          <view
            class="mt-1 h-6 w-6 flex shrink-0 items-center justify-center border-2 rounded-full text-xs"
            :class="item.spec?.status === 'complete' ? 'border-primary bg-primary text-white' : 'border-gray-300'"
            @click="handleToggleStatus(item)"
          >
            ✓
          </view>
          <view class="min-w-0 flex-1">
            <view class="text-sm text-gray-900 font-bold" :class="item.spec?.status === 'complete' ? 'text-gray-400 line-through' : ''">
              {{ item.spec?.title || '未命名' }}
            </view>
            <view class="line-clamp-2 mt-1 text-xs text-gray-500 leading-relaxed">
              {{ item.spec?.content || '' }}
            </view>
            <view v-if="item.spec?.planDate" class="mt-1 text-3xs text-gray-400">
              📅 计划：{{ item.spec.planDate }}
            </view>
          </view>
          <image v-if="item.spec?.images?.[0]" :src="checkThumbnailUrl(item.spec.images[0], true)" mode="aspectFill" class="h-16 w-16 shrink-0 rounded-lg" />
        </view>
        <view class="flex items-center justify-end gap-3 border-t border-black/5 px-4 py-2.5 text-xs">
          <text class="text-gray-500" @click="openEdit(item)">✏️ 编辑</text>
          <text class="text-red-500" @click="handleDelete(item)">🗑 删除</text>
        </view>
      </view>
      <uh-data-loadmore :status="loadMoreStatus.status" :text="loadMoreStatus.text" />
    </view>

    <!-- FAB：新增 -->
    <uh-permission permission="LOVE_DAILY_MANAGE">
      <view
        class="fixed bottom-30 right-4 z-50 h-14 w-14 flex items-center justify-center rounded-full bg-primary text-2xl text-white shadow-lg"
        @click="openCreate"
      >
        ＋
      </view>
    </uh-permission>

    <!-- 新增/编辑弹层 -->
    <view v-if="formVisible" class="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" @click.self="formVisible = false">
      <view class="rounded-t-3xl bg-white p-5 pb-safe dark:bg-dark-900">
        <view class="mb-4 flex items-center justify-between">
          <text class="text-base font-bold">{{ formMode === 'create' ? '新增心愿' : '编辑心愿' }}</text>
          <text class="text-sm text-primary" @click="handleSave">{{ saving ? '保存中…' : '保存' }}</text>
        </view>
        <input v-model="form.title" class="mb-3 w-full rounded-xl bg-page px-4 py-3 text-sm" placeholder="标题">
        <textarea v-model="form.content" class="mb-3 w-full rounded-xl bg-page p-4 text-sm" placeholder="描述…" auto-height :maxlength="500" />
        <view class="mb-3 flex items-center gap-2">
          <text class="text-xs text-gray-500">状态</text>
          <view class="flex gap-2">
            <text
              v-for="s in [{ v: 'wait', t: '未开始' }, { v: 'doing', t: '进行中' }, { v: 'complete', t: '已完成' }]"
              :key="s.v"
              class="rounded-full px-3 py-1 text-xs"
              :class="form.status === s.v ? 'bg-primary text-white' : 'bg-page text-gray-500'"
              @click="form.status = s.v as ILoveDailyItemSpec['status']"
            >
              {{ s.t }}
            </text>
          </view>
        </view>
        <view class="flex items-center gap-3">
          <view v-for="img in coverList" :key="img.tempPath" class="relative h-16 w-16 overflow-hidden rounded-lg">
            <image :src="img.tempPath" class="h-full w-full" mode="aspectFill" />
            <view class="absolute right-0 top-0 h-5 w-5 flex items-center justify-center bg-black/50 text-xs text-white" @click="removeCover(img.tempPath)">
              ✕
            </view>
          </view>
          <view v-if="coverList.length === 0" class="h-16 w-16 flex items-center justify-center border-2 border-gray-300 rounded-lg border-dashed text-2xl text-gray-400" @click="chooseCover">
            ＋
          </view>
          <text class="text-xs text-gray-400">封面图（可选）</text>
        </view>
      </view>
    </view>
  </view>
</template>
