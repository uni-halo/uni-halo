<script lang="ts" setup>
/**
 * 恋爱清单管理页
 */
import { ref } from 'vue'
import { onLoad, onPageScroll, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import dayjs from 'dayjs'
import { getLoveDailyItems } from '@/api/uni-halo'
import { deleteLoveDailyItem, updateLoveDailyItem } from '@/api/uni-admin'
import { usePageScroll } from '@/hooks/usePageScroll'
import { useDialog } from '@wot-ui/ui'
import { DIALOG_CANCEL_BUTTON_PROPS, DIALOG_CONFIRM_BUTTON_PROPS } from '@/config/dialog'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { checkThumbnailUrl } from '@/utils/url'
import type { ILoveDailyItem } from '@/api/types/uni-halo'

const dialog = useDialog()

definePage({
  style: {
    navigationBarTitleText: '恋爱清单管理',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
  },
})

const { scrollY, updatePageScrollValue } = usePageScroll()

const status = reactive([
  { name: '未开始', value: 'wait', color: 'text-gray-500' },
  { name: '进行中', value: 'doing', color: 'text-blue-500' },
  { name: '已完成', value: 'complete', color: 'text-love' },
])

/* ---------------- 数据加载 ---------------- */
const { loadingStatus, loadMoreStatus, updateLoadingStatus, updateLoadMoreStatus, resetLoadMoreStatus } = useDataLoadingStatus()
const queryParams = ref({ size: 10, page: 1 })
const dataList = ref<ILoveDailyItem[]>([])

async function handleGetData() {
  if (!loadMoreStatus.value.active) {
    updateLoadingStatus(DataLoadingStatusEnum.Loading)
  }
  try {
    const res = await getLoveDailyItems({ ...queryParams.value })
    const items = (res.data?.items || []).map((item) => {
      const _status = status.find(s => s.value === item.spec.status)
      item.spec._status = _status?.name ?? '未命名'
      item.spec._statusClass = _status.color
      return item
    })
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

onLoad(() => {
  handleGetData()
})

onPullDownRefresh(() => {
  resetLoadMoreStatus()
  queryParams.value.page = 1
  handleGetData()
})

onReachBottom(() => {
  if (loadMoreStatus.value.active) { return }
  if (loadMoreStatus.value.hasNext) {
    queryParams.value.page += 1
    updateLoadMoreStatus({ active: true, status: 'loading' })
    handleGetData()
  }
})

/* ---------------- 新增/编辑弹窗（全局组件） ---------------- */
const dailyEditVisible = ref(false)
const dailyEditRef = ref<{ openEdit: (item: ILoveDailyItem) => void } | null>(null)

function openCreate() {
  dailyEditVisible.value = true
}

function openEdit(item: ILoveDailyItem) {
  dailyEditRef.value?.openEdit(item)
}

function handleEditClose(data: { isSubmit: boolean, refresh: boolean }) {
  dailyEditVisible.value = false
  if (data.refresh)
    handleRetry()
}

/* ---------------- 状态切换 / 删除 ---------------- */
async function handleToggleStatus(item: ILoveDailyItem) {
  const spec = { ...(item.spec || {}) }
  const done = spec.status === 'complete'
  spec.status = done ? 'wait' : 'complete'
  // 插件端要求 yyyy-MM-dd 格式
  spec.completeDate = done ? '' : dayjs().format('YYYY-MM-DD')
  try {
    await updateLoveDailyItem(item.metadata?.name || '', spec)
    item.spec = { ...item.spec, ...spec }
  }
  catch (err: any) {
    uni.showToast({ title: err?.message || '更新失败', icon: 'none' })
  }
}

function handleDelete(item: ILoveDailyItem) {
  dialog.confirm({
    title: '删除清单项',
    msg: `确定删除「${item.spec?.title || '未命名'}」吗？`,
    zIndex: 9999,
    confirmButtonProps: DIALOG_CONFIRM_BUTTON_PROPS,
    cancelButtonProps: DIALOG_CANCEL_BUTTON_PROPS,
  }).then(async () => {
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
  }).catch(() => {})
}

onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})
</script>

<template>
  <wd-dialog />
  <view class="box-border min-h-screen w-screen flex flex-col bg-page">
    <uh-navbar :scroll-y="scrollY" :use-back="true" default-title="恋爱清单管理" title-color="text-gray-900" />

    <uh-data-loading
      v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus"
      min-height="70vh" theme="love" @refresh="handleRetry"
    />

    <view v-else class="box-border flex flex-col gap-3 px-3 pb-24 pt-3">
      <view
        v-for="(item, index) in dataList" :key="item.metadata?.name || item.id"
        class="uh-global-card-glass uh-shadow-xs overflow-hidden rounded-xl"
      >
        <view class="flex items-start gap-3 p-4">
          <!-- 勾选完成状态 -->
          <view
            class="uh-global-card-glass mt-1 h-6 w-6 flex shrink-0 items-center justify-center rounded-full bg-love text-xs text-white"
            @click="handleToggleStatus(item)"
          >
            {{ index + 1 }}
          </view>
          <view class="min-w-0 flex-1">
            <view class="text-sm text-gray-900 font-bold">
              {{ item.spec?.title || '未命名' }}
            </view>
            <view class="line-clamp-2 mt-1 text-xs text-gray-500 leading-relaxed">
              {{ item.spec?.content || '' }}
            </view>
            <view v-if="item.spec?.planDate" class="mt-1 flex items-center gap-1 text-xs text-gray-500">
              <text>计划日期：{{ item.spec.planDate }}</text>
            </view>
          </view>
          <image
            v-if="item.spec?.images?.[0]" :src="checkThumbnailUrl(item.spec.images[0], true)"
            mode="aspectFill" class="h-16 w-16 shrink-0 rounded-lg"
          />
        </view>
        <view
          class="flex items-center justify-end gap-6 border-t border-gray-100 border-t-solid px-4 py-2.5 text-xs"
        >
          <view class="flex-1 font-bold" :class="[item.spec._statusClass]">
            {{ item.spec._status }}
          </view>
          <view class="flex shrink-0 items-center justify-end gap-x-6">
            <view class="flex items-center gap-1 text-gray-500" @click="openEdit(item)">
              <wd-icon name="edit" size="26rpx" />
              <text>编辑</text>
            </view>
            <view class="flex items-center gap-1 text-red-500" @click="handleDelete(item)">
              <wd-icon name="delete" size="26rpx" />
              <text>删除</text>
            </view>
          </view>
        </view>
      </view>
      <uh-data-loadmore :status="loadMoreStatus.status" :text="loadMoreStatus.text" />
    </view>

    <!-- 底部悬浮：新增（参考笔记详情悬浮设计） -->
    <uh-permission permission="LOVE_DAILY_MANAGE">
      <view class="uh-translate-x-center fixed bottom-0 left-1/2 z-10 flex items-center justify-center pb-safe">
        <view
          class="uh-global-card-glass box-border flex items-center justify-center gap-x-1 border rounded-full px-6 py-2.5 text-love shadow-none"
          @click="openCreate"
        >
          <wd-icon name="plus" size="28rpx" />
          <text class="shrink-0 text-3xs font-semibold">新增清单</text>
        </view>
      </view>
    </uh-permission>

    <!-- 新增/编辑弹窗（全局组件，内聚表单与上传逻辑） -->
    <uh-admin-daily-edit-popup ref="dailyEditRef" :show="dailyEditVisible" @on-close="handleEditClose" />
  </view>
</template>

<style scoped lang="scss">
	.uh-translate-x-center {
  transform: translateX(-50%);
}
</style>
