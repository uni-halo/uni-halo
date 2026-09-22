<script lang="ts" setup>
import { computed, ref } from 'vue'
import { onPageScroll, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import {
  getUnreadNotificationCount,
  getUserNotifications,
  markNotificationAsRead,
  markNotificationsAsRead,
} from '@/api/notification'
import type { INotification } from '@/api/notification'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { usePageScroll } from '@/hooks/usePageScroll'
import { useNavbarSticky } from '@/hooks/useNavbarSticky'
import { useTokenStore } from '@/store/token'
import { useUserStore } from '@/store/user'
import { formatTime } from '@/utils/formatTime'
import { sleep } from '@/utils/common'

definePage({
  style: {
    navigationBarTitleText: '消息通知',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
  },
})

const { height: offsetTop } = useNavbarSticky()
const { scrollY, updatePageScrollValue } = usePageScroll()
const tokenStore = useTokenStore()
const { userInfo } = storeToRefs(useUserStore())
const PAGE_SIZE = 20

/** Tab：全部 / 未读（未读走服务端 fieldSelector 过滤） */
type NotifyTab = 'all' | 'unread'
const activeTab = ref<NotifyTab>('all')

/** 状态机（同 articles 页）：首屏/下拉刷新 loading、empty、error；触底加载失败仅底部提示，不切整页错误态 */
const { loadingStatus, loadMoreStatus, updateLoadingStatus, updateLoadMoreStatus, resetLoadMoreStatus } = useDataLoadingStatus()
const allItems = ref<INotification[]>([])
const totalCount = ref(0)
const queryParams = ref({ page: 1, size: PAGE_SIZE })
const unreadCount = ref(0)

/** 展开查看详情的通知（同时最多展开一条） */
const expandedName = ref('')

const tabList = computed(() => [
  { key: 'all' as NotifyTab, value: undefined, label: '全部' },
  { key: 'unread' as NotifyTab, value: 'spec.unread=true', label: '未读', count: unreadCount.value },
  { key: 'read' as NotifyTab, value: 'spec.unread=false', label: '已读' },
])

/* ---------------- 登录守卫（页面内兜底，拦截器不覆盖） ---------------- */
onShow(() => {
  if (!tokenStore.updateNowTime().hasLogin) {
    uni.showToast({ icon: 'none', title: '请先登录' })
    setTimeout(() => uni.navigateBack(), 600)
    return
  }
  refreshUnreadCount()
  handleResetAndLoad()
})

async function refreshUnreadCount() {
  if (!userInfo.value.username) {
    return
  }
  unreadCount.value = await getUnreadNotificationCount(userInfo.value.username)
}

/* ---------------- 数据加载（与 articles 页同构） ---------------- */
/** 重置分页并重新查询（切 Tab / 下拉刷新 / 全部已读后） */
function handleResetAndLoad() {
  resetLoadMoreStatus()
  allItems.value = []
  expandedName.value = ''
  queryParams.value.page = 1
  handleGetNotifications()
}

async function handleGetNotifications() {
  if (!userInfo.value.username) {
    return
  }
  if (!loadMoreStatus.value.active) {
    updateLoadingStatus(DataLoadingStatusEnum.Loading)
  }
  try {
    const fieldSelector = tabList.value.find(item => item.key === activeTab.value)?.value

    const res = await getUserNotifications(userInfo.value.username, {
      ...queryParams.value,
      fieldSelector,
      sort: 'metadata.creationTimestamp,desc',
    })
    totalCount.value = res.data?.total ?? 0
    const items = res.data?.items || []
    // 触底加载追加，重置加载替换
    allItems.value = loadMoreStatus.value.active
      ? allItems.value.concat(items)
      : items
    if (!loadMoreStatus.value.active) {
      await sleep(600)
      updateLoadingStatus(allItems.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
    }
    updateLoadMoreStatus({
      active: false,
      status: res.data?.hasNext ? 'loadMore' : 'noMore',
      hasNext: res.data?.hasNext,
    })
  }
  catch (err) {
    console.error('通知列表加载失败', err)
    if (loadMoreStatus.value.active) {
      updateLoadMoreStatus({
        active: false,
        status: 'error',
      })
    }
    else {
      updateLoadingStatus(DataLoadingStatusEnum.Error)
    }
  }
  finally {
    uni.stopPullDownRefresh()
  }
}

/** 切换 Tab：重新请求服务端筛选结果 */
function handleTabChange(key: NotifyTab) {
  if (activeTab.value === key) {
    return
  }
  activeTab.value = key
  handleResetAndLoad()
}

function handleTime(time?: string) {
  if (!time) {
    return ''
  }
  return formatTime({ d: time, f: 'yyyy年MM月dd日 HH:mm' })
}

/* ---------------- 已读交互 ---------------- */
/** 展开通知：未读时顺带标记已读 */
async function handleToggleExpand(item: INotification) {
  const name = item.metadata.name
  expandedName.value = expandedName.value === name ? '' : name
  if (expandedName.value && item.spec.unread) {
    await markRead(item)
  }
}

async function markRead(item: INotification) {
  try {
    await markNotificationAsRead(userInfo.value.username, item.metadata.name)
    // 本地同步状态，避免整页刷新
    item.spec.unread = false
    item.spec.lastReadAt = new Date().toISOString()
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  }
  catch (error: any) {
    console.error('标记已读失败:', error)
    uni.showToast({ icon: 'none', title: error?.data?.message || error?.message || '标记已读失败' })
  }
}

/** 全部已读：服务端拉取未读列表 name 后批量标记，再重置加载当前 Tab */
async function handleMarkAllAsRead() {
  if (unreadCount.value === 0) {
    return
  }
  try {
    const res = await getUserNotifications(userInfo.value.username, {
      page: 1,
      size: 1000,
      fieldSelector: 'spec.unread=true',
    })
    const names = (res.data?.items || []).map(item => item.metadata.name)
    if (names.length === 0) {
      unreadCount.value = 0
      return
    }
    await markNotificationsAsRead(userInfo.value.username, names)
    uni.showToast({ icon: 'none', title: '已全部标记为已读' })
    refreshUnreadCount()
    handleResetAndLoad()
  }
  catch (error: any) {
    console.error('全部已读失败:', error)
    uni.showToast({ icon: 'none', title: error?.data?.message || error?.message || '操作失败，请稍后再试' })
  }
}

/** 复制通知内容（初始密码等信息便捷复制） */
function handleCopyContent(item: INotification) {
  uni.setClipboardData({
    data: item.spec.rawContent || '',
    success: () => uni.showToast({ icon: 'none', title: '内容已复制' }),
  })
}

onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})

onReachBottom(() => {
  // 正在加载时阻止重复请求
  if (loadMoreStatus.value.active) {
    return
  }
  // 有更多数据时继续加载
  if (loadMoreStatus.value.hasNext) {
    queryParams.value.page += 1
    updateLoadMoreStatus({
      active: true,
      status: 'loading',
    })
    handleGetNotifications()
  }
})

onPullDownRefresh(() => {
  handleResetAndLoad()
})
</script>

<template>
  <view class="min-h-screen w-screen flex flex-col bg-page">
    <uh-navbar :scroll-y="scrollY" default-title="消息通知" title-color="text-gray-900" />

    <!-- 顶部 Tab(吸顶玻璃胶囊 chip，与我的收藏同款) -->
    <wd-sticky :offset-top="offsetTop">
      <scroll-view :scroll-x="true" :show-scrollbar="false" class="w-full whitespace-nowrap pt-2">
        <view class="box-border w-full flex items-center gap-2 px-3 pb-1.5">
          <view
            v-for="tab in tabList" :key="tab.key"
            class="uh-global-card-glass inline-flex items-center gap-1 border rounded-2xl px-4 py-1.5 text-xs shadow-none"
            :class="activeTab === tab.key ? 'bg-primary text-gray-900 font-semibold' : 'text-gray-500'"
            @click="handleTabChange(tab.key)"
          >
            {{ tab.label }}
            <text v-if="tab.count > 0">({{ tab.count }})</text>
          </view>
          <view class="flex-1" />
          <view
            v-if="unreadCount > 0"
            class="uh-global-card-glass inline-flex shrink-0 items-center border rounded-2xl px-4 py-1.5 text-xs text-gray-500 shadow-none"
            @click="handleMarkAllAsRead"
          >
            <wd-icon name="check" size="24rpx" custom-class="mr-1" />
            全部已读
          </view>
        </view>
      </scroll-view>
    </wd-sticky>

    <uh-data-loading
      v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus"
      empty-text="暂无消息通知" empty-sub-text="站内消息会在这里展示" min-height="75vh"
      @refresh="handleResetAndLoad"
    />

    <view v-else class="box-border pt-2">
      <view class="box-border flex flex-col gap-3 px-3">
        <view
          v-for="item in allItems" :key="item.metadata.name"
          class="uh-global-card-glass uh-shadow-xs box-border flex flex-col overflow-hidden rounded-xl p-3"
          @click="handleToggleExpand(item)"
        >
          <!-- 标题行：未读红点 + 标题 + 时间 -->
          <view class="flex items-center gap-2">
            <view v-if="item.spec.unread" class="h-2 w-2 shrink-0 rounded-full bg-red-400" />
            <view class="min-w-0 flex-1 truncate text-sm text-gray-900 font-bold leading-snug dark:text-gray-100">
              {{ item.spec.title || '系统通知' }}
            </view>
            <wd-icon
              name="down" size="28rpx" custom-class="shrink-0 text-gray-400 transition-transform"
              :class="expandedName === item.metadata.name ? 'rotate-180' : ''"
              :style="{
                transform: expandedName === item.metadata.name ? 'rotate(180deg)' : 'rotate(0deg)',
              }"
            />
          </view>
          <!-- 未读时收起态给一行摘要，降低"不知道内容"的门槛 -->
          <text
            v-if="expandedName !== item.metadata.name"
            class="mt-1.5 truncate text-3xs text-gray-600 leading-relaxed"
          >
            {{ item.spec.rawContent }}
          </text>
          <text class="mt-2 shrink-0 text-xs text-gray-500">
            {{ handleTime(item.metadata.creationTimestamp) }}
          </text>

          <!-- 展开详情：纯文本渲染（保留换行），支持复制 -->
          <view v-if="expandedName === item.metadata.name" class="mt-2">
            <text class="whitespace-pre-line break-all text-3xs text-gray-600 leading-relaxed">
              {{ item.spec.rawContent }}
            </text>
            <view class="mt-2 flex items-center justify-between">
              <text class="text-xs text-gray-400">仅你本人可见，请注意保管敏感信息</text>
              <view
                class="uh-global-card-glass flex shrink-0 items-center gap-1 border rounded-lg px-2 py-0.5 shadow-none"
                @click.stop="handleCopyContent(item)"
              >
                <wd-icon name="copy" size="22rpx" custom-class="text-gray-500" />
                <text class="text-xs text-gray-500">复制</text>
              </view>
            </view>
          </view>
        </view>

        <uh-data-loadmore :status="loadMoreStatus.status" :text="loadMoreStatus.text" />
      </view>
    </view>
  </view>
</template>
