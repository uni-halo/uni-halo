<script lang="ts" setup>
/**
 * 我的绘画管理页：我的画作列表（状态筛选 + 分页加载）+ 查看/删除（无编辑）
 */
import { computed, ref } from 'vue'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import dayjs from 'dayjs'
import { deleteMyDraw, getMyDrawList, setMyDrawHidden } from '@/api/draw'
import { useDialog } from '@wot-ui/ui'
import { DIALOG_CANCEL_BUTTON_PROPS, DIALOG_CONFIRM_BUTTON_PROPS } from '@/config/dialog'
import { usePageScroll } from '@/hooks/usePageScroll'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useNavbarSticky } from '@/hooks/useNavbarSticky'
import { useTokenStore } from '@/store/token'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { checkThumbnailUrl } from '@/utils/url'
import type { IDraw, IDrawStatus } from '@/api/types/draw'

const dialog = useDialog()

definePage({
  style: {
    navigationBarTitleText: '我的绘画',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
  },
})

const tokenStore = useTokenStore()
const { scrollY, updatePageScrollValue } = usePageScroll()
/** 页面标题（插件端可配置，留空回退内置默认） */
const pageTitle = usePageTitle('drawManage', '我的绘画')
const { height: offsetTop } = useNavbarSticky()

/* ---------------- 状态筛选 ---------------- */
const STATUS_TABS: { label: string, value?: IDrawStatus }[] = [
  { label: '全部' },
  { label: '待审核', value: 'PENDING' },
  { label: '已通过', value: 'APPROVED' },
  { label: '未通过', value: 'REJECTED' },
]
const activeStatus = ref<IDrawStatus | undefined>(undefined)

/** 切换状态：清空列表并重置分页（参考豆瓣筛选切换） */
function handleSelectStatus(value?: IDrawStatus) {
  if (activeStatus.value === value)
    return
  activeStatus.value = value
  handleRetry()
}

/* ---------------- 数据加载 ---------------- */
const { loadingStatus, loadMoreStatus, updateLoadingStatus, updateLoadMoreStatus, resetLoadMoreStatus } = useDataLoadingStatus()
const queryParams = ref({ size: 10, page: 1 })
const dataList = ref<IDraw[]>([])

async function handleGetData() {
  if (!loadMoreStatus.value.active) {
    updateLoadingStatus(DataLoadingStatusEnum.Loading)
  }
  try {
    const res = await getMyDrawList({ ...queryParams.value, status: activeStatus.value })
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
  catch (err: any) {
    console.error(err)
    if (loadMoreStatus.value.active) {
      updateLoadMoreStatus({ active: false, status: 'error' })
    }
    else {
      updateLoadingStatus(DataLoadingStatusEnum.Error)
      uni.showToast({ title: err?.message || '加载失败', icon: 'none' })
    }
  }
  finally {
    uni.stopPullDownRefresh()
  }
}

function handleRetry() {
  resetLoadMoreStatus()
  dataList.value = []
  queryParams.value.page = 1
  handleGetData()
}

onPullDownRefresh(() => {
  handleRetry()
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

onShow(() => {
  if (!tokenStore.updateNowTime().hasLogin) {
    uni.showToast({ icon: 'none', title: '请先登录' })
    setTimeout(() => uni.navigateBack(), 600)
    return
  }
  handleRetry()
})

/* ---------------- 交互 ---------------- */
const statusText = computed(() => (draw: IDraw) => {
  switch (draw.spec.status) {
    case 'APPROVED':
      return '已通过'
    case 'REJECTED':
      return '未通过'
    default:
      return '待审核'
  }
})

const statusClass = computed(() => (draw: IDraw) => {
  switch (draw.spec.status) {
    case 'APPROVED':
      return 'bg-green-100 text-green-500'
    case 'REJECTED':
      return 'bg-red-100 text-red-500'
    default:
      return 'bg-orange-100 text-orange-500'
  }
})

function formatTime(time?: string) {
  return time ? dayjs(time).format('YYYY-MM-DD HH:mm') : ''
}

function handlePreview(draw: IDraw) {
  const url = checkThumbnailUrl(draw.spec.cover)
  if (url) {
    uni.previewImage({ urls: [url] })
  }
}

function handleGoDraw() {
  uni.navigateTo({ url: '/pages-blog/draw-canvas/draw-canvas' })
}

/** 切换显隐（仅已通过的画作可切换；隐藏后公开列表/详情不展示） */
async function handleToggleHidden(draw: IDraw) {
  const target = !draw.spec.hidden
  try {
    const res = await setMyDrawHidden(draw.metadata.name, target)
    const idx = dataList.value.findIndex(x => x.metadata.name === draw.metadata.name)
    if (idx > -1 && res.data)
      dataList.value[idx] = res.data
    uni.showToast({ title: target ? '已隐藏' : '已公开', icon: 'none' })
  }
  catch (err: any) {
    uni.showToast({ title: err?.message || '操作失败', icon: 'none' })
  }
}

function handleDelete(draw: IDraw) {
  dialog.confirm({
    title: '删除绘画',
    msg: `确定删除「${draw.spec.title || '无题'}」吗？删除后不可恢复。`,
    zIndex: 9999,
    confirmButtonProps: DIALOG_CONFIRM_BUTTON_PROPS,
    cancelButtonProps: DIALOG_CANCEL_BUTTON_PROPS,
  }).then(async () => {
    try {
      await deleteMyDraw(draw.metadata.name)
      dataList.value = dataList.value.filter(x => x.metadata.name !== draw.metadata.name)
      if (dataList.value.length === 0)
        updateLoadingStatus(DataLoadingStatusEnum.Empty)
      uni.showToast({ title: '已删除', icon: 'none' })
    }
    catch (err: any) {
      uni.showToast({ title: err?.message || '删除失败', icon: 'none' })
    }
  }).catch(() => { })
}

onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})
</script>

<template>
  <wd-dialog />
  <view class="box-border min-h-screen w-screen flex flex-col bg-page pb-safe">
    <uh-navbar :scroll-y="scrollY" :use-back="true" :default-title="pageTitle" title-color="text-gray-900" />

    <!-- 状态筛选(吸顶) -->
    <wd-sticky :offset-top="offsetTop">
      <view class="w-screen overflow-hidden">
        <scroll-view :scroll-x="true" :show-scrollbar="false" class="w-full whitespace-nowrap pb-1.5">
          <view
            v-for="tab in STATUS_TABS" :key="tab.label"
            class="uh-global-card-glass ml-3 inline-flex border rounded-2xl px-4 py-1.5 text-xs shadow-none"
            :class="activeStatus === tab.value ? '!bg-primary text-gray-900 font-semibold' : 'text-gray-500'"
            @click="handleSelectStatus(tab.value)"
          >
            {{ tab.label }}
          </view>
        </scroll-view>
      </view>
    </wd-sticky>

    <uh-data-loading
      v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus"
      min-height="65vh" empty-text="暂无绘画作品" empty-sub-text="还没有画作，去画一幅吧" @refresh="handleRetry"
    />

    <view v-else class="box-border flex flex-col gap-3 px-3 pb-18 pt-3">
      <view
        v-for="draw in dataList" :key="draw.metadata.name"
        class="uh-global-card-glass uh-shadow-xs box-border overflow-hidden rounded-xl"
      >
        <view class="box-border flex gap-3 p-3">
          <wd-img
            :src="checkThumbnailUrl(draw.spec.cover)" mode="aspectFill" class="h-24 w-24 shrink-0 rounded-xl"
            :radius="8" @click="handlePreview(draw)"
          >
            <template #loading>
              <wd-loading size="64rpx" custom-class="text-primary" />
            </template>
          </wd-img>
          <view class="box-border flex flex-1 flex-col justify-between gap-y-1.5">
            <view class="flex items-center justify-between gap-2">
              <text class="min-w-0 flex-1 truncate text-sm text-gray-900 font-medium">
                {{ draw.spec.title || '没有作品描述' }}
              </text>
              <text class="shrink-0 rounded-full px-2 py-0.5 text-xs" :class="statusClass(draw)">
                {{ statusText(draw) }}
              </text>
              <view
                v-if="draw.spec.status === 'APPROVED'" class="shrink-0"
                @click.stop="handleToggleHidden(draw)"
              >
                <wd-icon
                  :name="draw.spec.hidden ? 'eye-invisible' : 'eye'" size="30rpx"
                  :custom-class="draw.spec.hidden ? 'text-orange-400' : 'text-gray-400'"
                />
              </view>
            </view>
            <text class="text-3xs text-gray-400">
              日期：{{ formatTime(draw.metadata.creationTimestamp) }}
            </text>
            <text class="truncate text-3xs text-gray-500 leading-relaxed">
              审核：{{ draw.spec.reason ?? '暂无结果' }}
            </text>
            <view class="flex items-center justify-between gap-2 text-xs">
              <text class="text-3xs text-gray-400">
                操作：
              </text>
              <uh-button
                custom-class="uh-global-card-glass flex items-center gap-1 !shadow-none !border !rounded-lg !bg-red !text-white !py-1 !px-1 !text-sm !text-gray-900 active:opacity-80"
                class="" @click="handleDelete(draw)"
              >
                <wd-icon name="delete" size="24rpx" />
              </uh-button>
            </view>
          </view>
        </view>
      </view>
      <uh-data-loadmore :status="loadMoreStatus.status" :text="loadMoreStatus.text" />
    </view>

    <!-- 底部悬浮：画一幅 -->
    <view
      class="uh-translate-x-center fixed bottom-0 left-1/2 z-10 pb-safe"
    >
      <view
        class="uh-global-card-glass uh-shadow-xs box-border flex items-center justify-center gap-x-1 border rounded-full px-6 py-2.5 text-primary"
        @click="handleGoDraw"
      >
        <wd-icon name="plus" size="28rpx" />
        <text class="shrink-0 text-3xs font-semibold">画一幅</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.uh-translate-x-center {
  transform: translateX(-50%);
}
</style>
