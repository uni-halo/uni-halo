<script lang="ts" setup>
import { computed, ref } from 'vue'
import { onPageScroll, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import {
  deleteNotification,
  getUnreadNotificationCount,
  getUserNotifications,
  markNotificationAsRead,
  markNotificationsAsRead,
} from '@/api/notification'
import type { INotification } from '@/api/notification'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { useDialog } from '@wot-ui/ui'
import { DIALOG_CANCEL_BUTTON_PROPS, DIALOG_CONFIRM_BUTTON_PROPS } from '@/config/dialog'
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
const dialog = useDialog()
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

/** 多选模式：已勾选的通知 name 集合 */
const selectMode = ref(false)
const selectedNames = ref<string[]>([])
const isAllSelected = computed(() => allItems.value.length > 0 && selectedNames.value.length === allItems.value.length)
const isSelected = (item: INotification) => selectedNames.value.includes(item.metadata.name)

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

/* ---------------- 数据加载 ---------------- */
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

/* ---------------- 多选与批量操作 ---------------- */
function toggleSelectMode() {
  selectMode.value = !selectMode.value
  selectedNames.value = []
  expandedName.value = ''
}

function handleToggleSelect(item: INotification) {
  const name = item.metadata.name
  const index = selectedNames.value.indexOf(name)
  if (index >= 0) {
    selectedNames.value.splice(index, 1)
  }
  else {
    selectedNames.value.push(name)
  }
}

function handleToggleSelectAll() {
  selectedNames.value = isAllSelected.value ? [] : allItems.value.map(item => item.metadata.name)
}

/** 批量已读：仅对勾选中的未读项调用批量接口 */
async function handleBatchMarkRead() {
  const names = allItems.value
    .filter(item => selectedNames.value.includes(item.metadata.name) && item.spec.unread)
    .map(item => item.metadata.name)
  if (names.length === 0) {
    uni.showToast({ icon: 'none', title: '选中项中没有未读通知' })
    return
  }
  try {
    await markNotificationsAsRead(userInfo.value.username, names)
    allItems.value.forEach((item) => {
      if (names.includes(item.metadata.name)) {
        item.spec.unread = false
      }
    })
    unreadCount.value = Math.max(0, unreadCount.value - names.length)
    uni.showToast({ icon: 'none', title: '已标记为已读' })
    selectedNames.value = []
  }
  catch (error: any) {
    console.error('批量已读失败:', error)
    uni.showToast({ icon: 'none', title: error?.data?.message || error?.message || '操作失败，请稍后再试' })
  }
}

/** 批量删除：逐条调用删除接口（服务端无批量删除端点），完成后刷新列表 */
async function handleBatchDelete() {
  const names = [...selectedNames.value]
  if (names.length === 0) {
    return
  }
  try {
    await dialog.confirm({
      title: '批量删除通知',
      msg: `删除后不可恢复，确定删除选中的 ${names.length} 条通知吗？`,
      zIndex: 9999,
      confirmButtonProps: DIALOG_CONFIRM_BUTTON_PROPS,
      cancelButtonProps: DIALOG_CANCEL_BUTTON_PROPS,
    })
  }
  catch {
    return
  }
  try {
    await Promise.all(names.map(name => deleteNotification(userInfo.value.username, name)))
    uni.showToast({ icon: 'none', title: `已删除 ${names.length} 条` })
    selectedNames.value = []
    refreshUnreadCount()
    handleResetAndLoad()
  }
  catch (error: any) {
    console.error('批量删除失败:', error)
    uni.showToast({ icon: 'none', title: error?.data?.message || error?.message || '删除失败，请稍后再试' })
    refreshUnreadCount()
    handleResetAndLoad()
  }
}

/** 单条删除（带确认） */
async function handleDeleteOne(item: INotification) {
  try {
    await dialog.confirm({
      title: '删除通知',
      msg: '删除后不可恢复，确定删除该条通知吗？',
      zIndex: 9999,
      confirmButtonProps: DIALOG_CONFIRM_BUTTON_PROPS,
      cancelButtonProps: DIALOG_CANCEL_BUTTON_PROPS,
    })
  }
  catch {
    return
  }
  try {
    await deleteNotification(userInfo.value.username, item.metadata.name)
    allItems.value = allItems.value.filter(x => x.metadata.name !== item.metadata.name)
    totalCount.value = Math.max(0, totalCount.value - 1)
    if (item.spec.unread) {
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    }
    if (allItems.value.length === 0) {
      updateLoadingStatus(DataLoadingStatusEnum.Empty)
    }
    uni.showToast({ icon: 'none', title: '已删除' })
  }
  catch (error: any) {
    console.error('删除通知失败:', error)
    uni.showToast({ icon: 'none', title: error?.data?.message || error?.message || '删除失败，请稍后再试' })
  }
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
  <view class="box-border min-h-screen w-screen flex flex-col bg-page pb-safe">
    <uh-navbar :scroll-y="scrollY" default-title="消息通知" title-color="text-gray-900" />

    <wd-sticky :offset-top="offsetTop">
      <view class="box-border w-screen flex items-center gap-2 px-3 pt-2">
        <view
          v-for="tab in tabList" :key="tab.key"
          class="uh-global-card-glass inline-flex items-center gap-1 border rounded-2xl px-4 py-1.5 text-xs shadow-none"
          :class="activeTab === tab.key ? 'bg-primary text-gray-900 font-semibold' : 'text-gray-500'"
          @click="handleTabChange(tab.key)"
        >
          {{ tab.label }}
          <text v-if="tab.count > 0">({{ tab.count }})</text>
        </view>
      </view>
    </wd-sticky>

    <uh-data-loading
      v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus"
      empty-text="暂无消息通知" empty-sub-text="站内消息会在这里展示" min-height="65vh"
      @refresh="handleResetAndLoad"
    />

    <view v-else class="box-border flex flex-col gap-3 p-3 pb-10">
      <view
        v-for="item in allItems" :key="item.metadata.name"
        class="uh-global-card-glass uh-shadow-xs box-border flex flex-col overflow-hidden rounded-xl p-3"
        :class="selectMode && isSelected(item) ? 'border-primary' : ''"
        @click="selectMode ? handleToggleSelect(item) : handleToggleExpand(item)"
      >
        <!-- 标题行：勾选框/未读红点 + 标题 + 时间 -->
        <view class="flex items-center gap-2">
          <view
            v-if="selectMode"
            class="h-4 w-4 flex items-center justify-center border rounded-full border-solid"
            :class="isSelected(item) ? 'border-primary bg-primary' : 'border-gray-300'"
          >
            <wd-icon v-if="isSelected(item)" name="check" size="20rpx" custom-class="text-gray-900" />
          </view>
          <view v-else-if="item.spec.unread" class="h-2 w-2 shrink-0 rounded-full bg-red-400" />
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
          <view class="mt-2 flex items-center justify-between gap-x-2">
            <text class="text-xs text-gray-400">删除后不可见，请注意保存信息</text>
            <view class="flex shrink-0 items-center gap-1.5">
              <view
                class="uh-global-card-glass flex shrink-0 items-center gap-1 border rounded-lg px-2 py-0.5 shadow-none"
                @click.stop="handleDeleteOne(item)"
              >
                <wd-icon name="delete" size="22rpx" custom-class="text-red-400" />
                <text class="text-xs text-red-400">删除</text>
              </view>
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
      </view>

      <uh-data-loadmore :status="loadMoreStatus.status" :text="loadMoreStatus.text" />
    </view>

    <!-- 底部悬浮操作 -->
    <view
      v-if="loadingStatus === DataLoadingStatusEnum.Success"
      class="uh-translate-x-center fixed bottom-0 left-1/2 z-10 flex flex-col items-center justify-center gap-y-2 pb-safe"
    >
      <!-- 多选模式：全选行 -->
      <view v-if="false && selectMode" class="box-border flex items-center px-3">
        <view class="uh-global-card-glass box-border w-full flex items-center gap-x-1 border rounded-full px-1.5 py-1">
          <view
            class="h-4 w-4 flex items-center justify-center border rounded-full border-solid"
            :class="isAllSelected ? 'border-primary bg-primary' : 'border-gray-300'"
            @click="handleToggleSelectAll"
          >
            <wd-icon v-if="isAllSelected" name="check" size="20rpx" custom-class="text-gray-900" />
          </view>
          <text class="text-xs text-gray-500">全选（已选 {{ selectedNames.length }} 项）</text>
        </view>
      </view>

      <!-- 多选模式：全选 / 批量已读 / 批量删除 / 退出 -->
      <view
        v-if="selectMode"
        class="uh-global-card-glass box-border flex items-center justify-center gap-2 border rounded-full p-1 text-primary"
      >
        <view
          class="uh-global-card-glass box-border flex flex-1 items-center justify-center gap-x-1 border rounded-full px-4 py-1.5 shadow-none"
          :class="isAllSelected ? 'text-primary' : 'text-gray-600'"
          @click="handleToggleSelectAll"
        >
          <wd-icon :name="isAllSelected ? 'check-square' : 'uncheck-square'" size="32rpx" />
          <text class="shrink-0 text-xs text-gray-900 font-semibold">全选（{{ selectedNames.length }}）</text>
        </view>
        <view
          class="uh-global-card-glass box-border flex flex-1 items-center justify-center gap-x-1 border rounded-full px-4 py-1.5 shadow-none"
          :class="selectedNames.length === 0 ? 'opacity-50' : ''"
          @click="handleBatchMarkRead"
        >
          <wd-icon name="check-circle" size="32rpx" />
          <text class="shrink-0 text-xs text-gray-900 font-semibold">已读</text>
        </view>
        <view
          class="uh-global-card-glass box-border flex flex-1 items-center justify-center gap-x-1 border rounded-full px-4 py-1.5 shadow-none"
          :class="selectedNames.length === 0 ? 'opacity-50' : ''"
          @click="handleBatchDelete"
        >
          <wd-icon name="delete" size="32rpx" custom-class="text-red-400" />
          <text class="shrink-0 text-xs text-red-400 font-semibold">删除</text>
        </view>
        <view
          class="uh-global-card-glass box-border flex flex-1 items-center justify-center gap-x-1 border rounded-full px-4 py-1.5 shadow-none"
          @click="toggleSelectMode"
        >
          <wd-icon name="close" size="32rpx" />
          <text class="shrink-0 text-xs text-gray-900 font-semibold">取消</text>
        </view>
      </view>
      <!-- 普通模式：全部已读 / 管理 -->
      <view
        v-else
        class="uh-global-card-glass box-border flex items-center justify-center gap-2 border rounded-full p-1 text-primary"
      >
        <view
          v-if="unreadCount > 0"
          class="uh-global-card-glass box-border flex flex-1 items-center justify-center gap-x-1 border rounded-full px-4 py-1.5 shadow-none"
          @click="handleMarkAllAsRead"
        >
          <wd-icon name="check-circle" size="32rpx" />
          <text class="shrink-0 text-xs text-gray-900 font-semibold">全部已读</text>
        </view>
        <view
          class="uh-global-card-glass box-border flex flex-1 items-center justify-center gap-x-1 border rounded-full px-4 py-1.5 shadow-none"
          @click="toggleSelectMode"
        >
          <wd-icon name="check-square" size="32rpx" />
          <text class="shrink-0 text-xs text-gray-900 font-semibold">批量管理</text>
        </view>
      </view>
    </view>
  </view>
  <wd-dialog />
</template>

<style scoped lang="scss">
/* 水平居中定位 */
.uh-translate-x-center {
  transform: translateX(-50%);
}
</style>
