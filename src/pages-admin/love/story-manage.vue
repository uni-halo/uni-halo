<script lang="ts" setup>
/**
 * 恋爱故事管理页
 */
import { ref } from 'vue'
import { onPageScroll, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { getLoveStories } from '@/api/uni-halo'
import { deleteLoveStory } from '@/api/uni-admin'
import { usePageScroll } from '@/hooks/usePageScroll'
import { useDialog } from '@wot-ui/ui'
import { useTokenStore } from '@/store/token'
import { DIALOG_CANCEL_BUTTON_PROPS, DIALOG_CONFIRM_BUTTON_PROPS } from '@/config/dialog'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { checkThumbnailUrl } from '@/utils/url'
import { formatTime } from '@/utils/formatTime'
import type { ILoveStory } from '@/api/types/uni-halo'

const dialog = useDialog()

definePage({
  style: {
    navigationBarTitleText: '恋爱故事管理',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
  },
})

const tokenStore = useTokenStore()
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
    const items = (res.data?.items || []).map((item) => {
      item.spec!.date = formatTime({
        d: item.spec?.date,
        f: 'yyyy/MM/dd',
      })
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

function handleRefresh() {
  resetLoadMoreStatus()
  queryParams.value.page = 1
  handleGetData()
}

onPullDownRefresh(() => {
  handleRefresh()
})

onReachBottom(() => {
  if (loadMoreStatus.value.active) { return }
  if (loadMoreStatus.value.hasNext) {
    queryParams.value.page += 1
    updateLoadMoreStatus({ active: true, status: 'loading' })
    handleGetData()
  }
})

/* ---------------- 新增/编辑弹窗 ---------------- */
const storyEditVisible = ref(false)
const storyEditRef = ref<{ openEdit: (story: ILoveStory) => void } | null>(null)

function openCreate() {
  storyEditVisible.value = true
}

function openEdit(item: ILoveStory) {
  storyEditRef.value?.openEdit(item)
}

function handleEditClose(data: { isSubmit: boolean, refresh: boolean }) {
  storyEditVisible.value = false
  if (data.refresh)
    handleRetry()
}

/* ---------------- 删除 ---------------- */
function handleDelete(item: ILoveStory) {
  dialog.confirm({
    title: '删除故事',
    msg: `确定删除「${item.spec?.title || '未命名'}」吗？删除后不可恢复。`,
    zIndex: 9999,
    confirmButtonProps: DIALOG_CONFIRM_BUTTON_PROPS,
    cancelButtonProps: DIALOG_CANCEL_BUTTON_PROPS,
  }).then(async () => {
    try {
      await deleteLoveStory(item.metadata?.name || '')
      dataList.value = dataList.value.filter(x => (x.metadata?.name || '') !== (item.metadata?.name || ''))
      if (dataList.value.length === 0)
        updateLoadingStatus(DataLoadingStatusEnum.Empty)
      uni.showToast({ title: '已删除', icon: 'none' })
    }
    catch (err: any) {
      uni.showToast({ title: err?.message || '删除失败', icon: 'none' })
    }
  }).catch(() => {})
}

onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})

/* ---------------- 登录守卫（页面内兜底，拦截器不覆盖） ---------------- */
onShow(() => {
  if (!tokenStore.updateNowTime().hasLogin) {
    uni.showToast({ icon: 'none', title: '请先登录' })
    setTimeout(() => uni.navigateBack(), 600)
    return
  }
  handleRefresh()
})
</script>

<template>
  <wd-dialog />
  <view class="box-border min-h-screen w-screen flex flex-col bg-page">
    <uh-navbar :scroll-y="scrollY" :use-back="true" default-title="恋爱故事管理" title-color="text-gray-900" />

    <uh-data-loading
      v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus"
      min-height="70vh" theme="love" @refresh="handleRetry"
    />

    <view v-else class="box-border flex flex-col gap-3 px-3 pb-24 pt-3">
      <view
        v-for="(item) in dataList" :key="item.metadata?.name || item.id"
        class="uh-global-card-glass uh-shadow-xs box-border flex flex-col gap-y-3 overflow-hidden rounded-xl p-3"
      >
        <view class="flex gap-3">
          <!-- 有图，wd-img 如果加载空的地址 会一直处于loading状态，所以空值我们不加载 -->
          <wd-img
            v-if="item.spec?.images?.[0]" :src="checkThumbnailUrl(item.spec.images[0], true)"
            mode="aspectFill" class="h-20 w-20 shrink-0" :radius="8"
          >
            <template #loading>
              <wd-loading size="64rpx" custom-class="!text-love" />
            </template>
          </wd-img>
          <!-- 无图 -->
          <view v-else
            class="h-20 w-20 shrink-0 flex items-center justify-center from-[#fdeef1] to-[#fff8f9] bg-gradient-to-b text-gray-400">
            <wd-icon class-prefix="uhemoji-icon" name="-injury" size="48rpx" />
          </view>
          <view class="flex flex-1 flex-col justify-between gap-y-1">
            <view class="shrink-0 text-sm text-gray-900 font-semibold">
              {{ item.spec?.title || '忘写了' }}
            </view>
            <view class="line-clamp-2 flex-1 text-xs text-gray-500 leading-relaxed">
              {{ (item.spec?.content || '').replace(/<[^>]+>/g, '') || '' }}
            </view>
            <view v-if="item.spec?.location" class="flex shrink-0 items-center gap-2 text-3xs text-gray-500">
              <view class="flex items-center gap-0.5">
                <wd-icon name="location" size="22rpx" />
                <text>{{ item.spec.location }}</text>
              </view>
            </view>
          </view>
        </view>
        <view
          class="box-border flex items-center justify-end gap-4 text-xs"
        >
          <view class="flex flex-1 items-center gap-x-2">
            <view v-if="item.spec?.date" class="flex items-center gap-x-1 text-3xs text-love font-bold">
              <text>{{ item.spec.date }}</text>
            </view>
          </view>
          <view class="flex shrink-0 items-center justify-end gap-x-4">
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

    <!-- 底部悬浮 -->
    <uh-permission permission="LOVE_STORY_MANAGE">
      <view class="uh-translate-x-center fixed bottom-0 left-1/2 z-10 flex items-center justify-center pb-safe">
        <view
          class="uh-global-card-glass box-border flex items-center justify-center gap-x-1 border rounded-full px-6 py-2.5 text-love shadow-none"
          @click="openCreate"
        >
          <wd-icon name="plus" size="28rpx" />
          <text class="shrink-0 text-3xs font-semibold">新增故事</text>
        </view>
      </view>
    </uh-permission>

    <!-- 新增/编辑弹窗（全局组件，内聚表单与上传逻辑） -->
    <uh-admin-story-edit-popup ref="storyEditRef" :show="storyEditVisible" @on-close="handleEditClose" />
  </view>
</template>

<style scoped lang="scss">
.uh-translate-x-center {
  transform: translateX(-50%);
}
</style>
