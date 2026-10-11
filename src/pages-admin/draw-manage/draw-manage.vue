<script lang="ts" setup>
/**
 * 我的绘画管理页：我的画作列表（状态筛选 + 分页加载）+ 查看/删除（无编辑）
 */
import { computed, ref } from 'vue'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import dayjs from 'dayjs'
import { deleteMyDraw, getMyDrawList, getMyPuzzle, revealMyPuzzle, setMyDrawHidden } from '@/api/draw'
import { useDialog } from '@wot-ui/ui'
import { DIALOG_CANCEL_BUTTON_PROPS, DIALOG_CONFIRM_BUTTON_PROPS } from '@/config/dialog'
import { usePageScroll } from '@/hooks/usePageScroll'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useNavbarSticky } from '@/hooks/useNavbarSticky'
import { useTokenStore } from '@/store/token'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { checkThumbnailUrl } from '@/utils/url'
import type { IDraw, IDrawStatus, IPuzzleInfo } from '@/api/types/draw'

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

/* ---------------- 竞猜管理（仅竞猜作品） ---------------- */
const isPuzzle = (draw: IDraw) => !!draw.spec.puzzleStatus

const puzzleVisible = ref(false)
const puzzleLoading = ref(false)
const puzzleInfo = ref<IPuzzleInfo | null>(null)
const puzzleDraw = ref<IDraw | null>(null)

async function handleOpenPuzzle(draw: IDraw) {
  puzzleDraw.value = draw
  puzzleInfo.value = null
  puzzleVisible.value = true
  puzzleLoading.value = true
  try {
    const res = await getMyPuzzle(draw.metadata.name)
    puzzleInfo.value = res.data || null
  }
  catch (err: any) {
    uni.showToast({ title: err?.message || '获取画谜信息失败', icon: 'none' })
  }
  finally {
    puzzleLoading.value = false
  }
}

/** 手动揭晓（二次确认，幂等；揭晓后谜底公开、竞猜结束） */
function handleReveal() {
  if (!puzzleDraw.value) { return }
  dialog.confirm({
    title: '揭晓谜底',
    msg: '揭晓后谜底公开、画谜结束，不可恢复为进行中。确定揭晓吗？',
    zIndex: 9999,
    confirmButtonProps: DIALOG_CONFIRM_BUTTON_PROPS,
    cancelButtonProps: DIALOG_CANCEL_BUTTON_PROPS,
  }).then(async () => {
    try {
      await revealMyPuzzle(puzzleDraw.value!.metadata.name)
      uni.showToast({ title: '已揭晓', icon: 'none' })
      handleOpenPuzzle(puzzleDraw.value!)
      handleRetry()
    }
    catch (err: any) {
      uni.showToast({ title: err?.message || '揭晓失败', icon: 'none' })
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
            :src="checkThumbnailUrl(draw.spec.cover)" mode="aspectFill" class="h-16 w-16 shrink-0 rounded-xl"
            :radius="8" @click="handlePreview(draw)"
          >
            <template #loading>
              <wd-loading size="64rpx" custom-class="text-primary" />
            </template>
          </wd-img>
          <view class="box-border flex flex-1 flex-col justify-between gap-y-1">
            <view class="flex items-center justify-between gap-2">
              <text class="min-w-0 flex-1 truncate text-sm text-gray-900 font-medium">
                {{ draw.spec.title || '没有作品描述' }}
              </text>
              <text
                v-if="isPuzzle(draw)"
                class="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-500"
              >
                {{ draw.spec.puzzleStatus === 'REVEALED' ? '已揭晓' : '进行中' }}
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
            <text class="truncate text-xs text-gray-500 leading-relaxed">
              审核：{{ draw.spec.reason ?? '暂无结果' }}
            </text>
            <text class="text-xs text-gray-400">
              日期：{{ formatTime(draw.metadata.creationTimestamp) }}
            </text>
          </view>
        </view>
        <view class="box-border w-full flex items-center gap-2 overflow-hidden p-3 pt-0">
          <uh-button
            v-if="isPuzzle(draw)"
            class="flex-1"
            custom-class="uh-global-card-glass flex items-center gap-1 !shadow-none !border !rounded-lg !bg-orange-100 !py-1.5 !px-2 !text-sm !text-orange-500 active:opacity-80"
            @click="handleOpenPuzzle(draw)"
          >
            <wd-icon name="user" size="24rpx" />
            <text class="text-xs">画谜管理</text>
          </uh-button>
          <uh-button
            class="flex-1"
            custom-class="uh-global-card-glass flex items-center gap-1 !shadow-none !border !rounded-lg !bg-red-100 !py-1.5 !px-2 !text-sm !text-red-500 active:opacity-80"
            @click="handleDelete(draw)"
          >
            <wd-icon name="delete" size="24rpx" />
            <text class="text-xs">删除</text>
          </uh-button>
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

    <!-- 竞猜管理弹层（谜底 / 竞猜记录 / 手动揭晓） -->
    <uh-glass-popup v-model="puzzleVisible" position="bottom" custom-class="rounded-2xl" :z-index="120">
      <view class="box-border flex flex-col gap-y-3 p-3">
        <view class="relative box-border w-full flex items-center justify-center">
          <text class="text-md font-bold">画谜管理</text>
          <view
            class="uh-global-card-glass absolute right-0 top-0 h-6 w-6 flex items-center justify-center border rounded-lg shadow-none"
            @click="puzzleVisible = false"
          >
            <wd-icon name="close" size="28rpx" class="text-gray-500" />
          </view>
        </view>

        <wd-loading v-if="puzzleLoading" size="64rpx" custom-class="text-primary py-8" />
        <template v-else-if="puzzleInfo">
          <!-- 谜底信息 -->
          <view class="uh-global-card-glass flex flex-col gap-y-1.5 rounded-xl p-3 !border !shadow-none">
            <view class="flex items-center justify-between">
              <text class="text-sm text-gray-900 font-bold">谜底：{{ puzzleInfo.puzzleAnswer }}</text>
              <text class="text-3xs text-gray-400">
                {{ puzzleInfo.puzzleStatus === 'REVEALED' ? '已揭晓' : '进行中' }}
              </text>
            </view>
            <text v-if="puzzleInfo.puzzleHint" class="text-xs text-gray-400">
              提示内容：{{ puzzleInfo.puzzleHint }}
            </text>
            <text class="text-xs text-gray-400">
              自动揭晓：{{ puzzleInfo.autoRevealAt ? formatTime(puzzleInfo.autoRevealAt) : '手动揭晓' }}
            </text>
            <text class="text-xs text-gray-400">
              数据统计：{{ puzzleInfo.guessCount }} 人参与 · {{ puzzleInfo.solvedCount }} 人猜中
            </text>
          </view>

          <!-- 竞猜记录 -->
          <scroll-view :scroll-y="true" :show-scrollbar="false" class="h-[40vh] flex-1">
            <view
              v-for="record in puzzleInfo.records" :key="record.username"
              class="box-border flex items-center gap-x-2 border-b border-gray-100 px-1 py-2 last:border-b-0"
            >
              <wd-avatar
                :src="checkThumbnailUrl(record.avatar || '')"
                :text="(record.displayName || record.username || '?').slice(0, 1).toUpperCase()"
                shape="round" size="44rpx"
                custom-class="uh-global-card-glass !shadow-none !border" mode="aspectFill"
              />
              <text class="min-w-0 flex-1 truncate text-xs text-gray-700">
                {{ record.displayName || record.username }}
              </text>
              <text class="text-3xs text-gray-400">“{{ record.answer }}”</text>
              <text class="shrink-0 text-3xs font-semibold" :class="record.correct ? 'text-green-500' : 'text-gray-400'">
                {{ record.correct ? '猜中' : '未中' }}
              </text>
            </view>
            <uh-data-loading
              v-if="puzzleInfo.records.length === 0" size="small" min-height="30vh"
              loading-status="empty" :use-refresh-button="false" empty-text="暂无画谜记录" empty-sub-text=" 还没有人来猜，快分享给小伙伴吧～"
            />
          </scroll-view>

          <!-- 手动揭晓 -->
          <uh-button
            v-if="puzzleInfo.puzzleStatus !== 'REVEALED'"
            custom-class="uh-global-card-glass !shadow-none !border !rounded-xl !bg-primary !py-2 !text-sm !text-gray-900 active:opacity-80"
            @click="handleReveal"
          >
            手动揭晓
          </uh-button>
        </template>
      </view>
    </uh-glass-popup>
  </view>
</template>

<style scoped lang="scss">
.uh-translate-x-center {
  transform: translateX(-50%);
}
</style>
