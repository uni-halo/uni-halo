<script lang="ts" setup>
/**
 * 绘画审核管理页（需 draws 管理角色）：全量画作列表 + 通过/拒绝/删除
 */
import { computed, ref } from 'vue'
import { onPageScroll, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import {
  approveDraw,
  deleteManageDraw,
  getManageDrawList,
  getManagePuzzle,
  rejectDraw,
  revealManagePuzzle,
  setManageDrawHidden,
} from '@/api/draw'
import { useDialog } from '@wot-ui/ui'
import { DIALOG_CANCEL_BUTTON_PROPS, DIALOG_CONFIRM_BUTTON_PROPS } from '@/config/dialog'
import { usePageScroll } from '@/hooks/usePageScroll'
import { useNavbarSticky } from '@/hooks/useNavbarSticky'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useTokenStore } from '@/store/token'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { checkThumbnailUrl } from '@/utils/url'
import type { IDraw, IDrawStatus, IPuzzleInfo } from '@/api/types/draw'

const dialog = useDialog()

definePage({
  style: {
    navigationBarTitleText: '绘画审核',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
  },
})

const tokenStore = useTokenStore()
const { scrollY, updatePageScrollValue } = usePageScroll()
/** 页面标题（插件端可配置，留空回退内置默认） */
const pageTitle = usePageTitle('drawReview', '绘画审核')
const { height: offsetTop } = useNavbarSticky()

onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})

/* ---------------- 状态筛选 ---------------- */
const STATUS_TABS: { label: string, value?: IDrawStatus }[] = [
  { label: '待审核', value: 'PENDING' },
  { label: '全部' },
  { label: '已通过', value: 'APPROVED' },
  { label: '未通过', value: 'REJECTED' },
]
const activeStatus = ref<IDrawStatus | undefined>('PENDING')

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
    const res = await getManageDrawList({ ...queryParams.value, status: activeStatus.value })
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

/* ---------------- 展示辅助 ---------------- */
function statusText(draw: IDraw) {
  switch (draw.spec.status) {
    case 'APPROVED':
      return '已通过'
    case 'REJECTED':
      return '未通过'
    default:
      return '待审核'
  }
}

function statusClass(draw: IDraw) {
  switch (draw.spec.status) {
    case 'APPROVED':
      return 'bg-green-100 text-green-600'
    case 'REJECTED':
      return 'bg-red-100 text-red-500'
    default:
      return 'bg-orange-100 text-orange-500'
  }
}

function ownerText(draw: IDraw) {
  return draw.owner?.displayName || draw.owner?.username || draw.spec.ownerName
}

/** 列表展示模型：图片相对路径补全 + 作者首字回退在数据层算好，模板不做判断 */
const displayList = computed(() => dataList.value.map(draw => ({
  draw,
  cover: checkThumbnailUrl(draw.spec.cover),
  ownerAvatar: checkThumbnailUrl(draw.owner?.avatar || ''),
  ownerInitial: (ownerText(draw) || 'A').slice(0, 1),
})))

function formatTime(time?: string) {
  return time?.slice(0, 16).replace('T', ' ') || ''
}

/* ---------------- 审核操作 ---------------- */
type ReviewMode = 'approve' | 'reject'
const reviewPopupVisible = ref(false)
const reviewMode = ref<ReviewMode>('approve')
const reviewTarget = ref<IDraw | null>(null)
const reviewText = ref('')
const submitting = ref(false)

/** 打开审核弹层（通过=备注选填，拒绝=原因必填） */
function handleOpenReview(draw: IDraw, mode: ReviewMode) {
  reviewTarget.value = draw
  reviewMode.value = mode
  reviewText.value = ''
  reviewPopupVisible.value = true
}

const reviewTitle = () => reviewMode.value === 'approve' ? '通过绘画' : '拒绝绘画'
function reviewPlaceholder() {
  return reviewMode.value === 'approve'
    ? '填写通过备注（选填）'
    : '请填写拒绝原因（必填，会通知作者）'
}
const reviewButtonText = () => reviewMode.value === 'approve' ? '确认通过' : '确认拒绝'

async function handleConfirmReview() {
  const text = reviewText.value.trim()
  if (reviewMode.value === 'reject' && !text) {
    uni.showToast({ title: '请填写拒绝原因', icon: 'none' })
    return
  }
  const name = reviewTarget.value?.metadata.name
  if (!name)
    return
  await submitReview(() => reviewMode.value === 'approve'
    ? approveDraw(name, text || undefined)
    : rejectDraw(name, text))
  reviewPopupVisible.value = false
}

async function submitReview(request: () => Promise<unknown>) {
  if (submitting.value)
    return
  submitting.value = true
  try {
    await request()
    uni.showToast({ title: '操作成功', icon: 'none' })
    handleRetry()
  }
  catch (err: any) {
    uni.showToast({ title: err?.message || '操作失败', icon: 'none' })
  }
  finally {
    submitting.value = false
  }
}

/** 切换显隐（仅已通过的画作可切换；隐藏后公开列表/详情不展示） */
async function handleToggleHidden(draw: IDraw) {
  const target = !draw.spec.hidden
  try {
    const res = await setManageDrawHidden(draw.metadata.name, target)
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
      await deleteManageDraw(draw.metadata.name)
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

/* ---------------- 竞猜信息（审核员核对谜底合规性） ---------------- */
const isPuzzle = (draw: IDraw) => !!draw.spec.puzzleStatus

const puzzleVisible = ref(false)
const puzzleLoading = ref(false)
const puzzleInfo = ref<IPuzzleInfo | null>(null)
const puzzleTarget = ref<IDraw | null>(null)

async function handleOpenPuzzle(draw: IDraw) {
  puzzleTarget.value = draw
  puzzleInfo.value = null
  puzzleVisible.value = true
  puzzleLoading.value = true
  try {
    const res = await getManagePuzzle(draw.metadata.name)
    puzzleInfo.value = res.data || null
  }
  catch (err: any) {
    uni.showToast({ title: err?.message || '获取画谜信息失败', icon: 'none' })
  }
  finally {
    puzzleLoading.value = false
  }
}

/** 强制揭晓（管理员，幂等；用于处理争议画作） */
function handleReveal() {
  if (!puzzleTarget.value) { return }
  dialog.confirm({
    title: '强制揭晓',
    msg: '揭晓后谜底公开、画谜结束。确定强制揭晓吗？',
    zIndex: 9999,
    confirmButtonProps: DIALOG_CONFIRM_BUTTON_PROPS,
    cancelButtonProps: DIALOG_CANCEL_BUTTON_PROPS,
  }).then(async () => {
    try {
      await revealManagePuzzle(puzzleTarget.value!.metadata.name)
      uni.showToast({ title: '已揭晓', icon: 'none' })
      handleOpenPuzzle(puzzleTarget.value!)
    }
    catch (err: any) {
      uni.showToast({ title: err?.message || '揭晓失败', icon: 'none' })
    }
  }).catch(() => { })
}
</script>

<template>
  <wd-dialog />
  <view class="box-border min-h-screen w-screen flex flex-col bg-page">
    <uh-navbar :scroll-y="scrollY" :use-back="true" :default-title="pageTitle" title-color="text-gray-900" />

    <!-- 状态筛选(吸顶，默认待审核) -->
    <wd-sticky :offset-top="offsetTop">
      <scroll-view :scroll-x="true" :show-scrollbar="false" class="box-border w-screen whitespace-nowrap pt-2">
        <view
          v-for="tab in STATUS_TABS" :key="tab.label"
          class="uh-global-card-glass ml-3 inline-flex border rounded-2xl px-4 py-1.5 text-xs shadow-none"
          :class="activeStatus === tab.value ? '!bg-primary text-gray-900 font-semibold' : 'text-gray-500'"
          @click="handleSelectStatus(tab.value)"
        >
          {{ tab.label }}
        </view>
      </scroll-view>
    </wd-sticky>

    <uh-data-loading
      v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus"
      empty-text="没有待审核的画作啦~" min-height="65vh" @refresh="handleRetry"
    />

    <view v-else class="box-border flex flex-col gap-3 p-3">
      <view
        v-for="{ draw, cover, ownerAvatar, ownerInitial } in displayList" :key="draw.metadata.name"
        class="uh-global-card-glass uh-shadow-xs box-border flex flex-col gap-3 overflow-hidden rounded-xl p-3"
      >
        <view class="flex gap-3">
          <wd-img :src="cover" mode="aspectFill" class="h-24 w-24 shrink-0" :radius="8">
            <template #loading>
              <wd-loading size="64rpx" custom-class="text-primary" />
            </template>
          </wd-img>
          <view class="box-border min-w-0 flex flex-1 flex-col gap-y-1.5">
            <view class="flex items-center justify-between gap-2">
              <text class="min-w-0 flex-1 truncate text-sm text-gray-900 font-medium">
                {{ draw.spec.title || '无题' }}
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
                  :name="draw.spec.hidden ? 'eye-invisible' : 'eye'" size="28rpx"
                  :custom-class="draw.spec.hidden ? 'text-orange-400' : 'text-gray-400'"
                />
              </view>
            </view>
            <text v-if="draw.spec.description" class="line-clamp-2 text-3xs text-gray-500 leading-relaxed">
              {{ draw.spec.description }}
            </text>
            <view class="flex items-center gap-x-1 text-3xs text-gray-400">
              <wd-avatar
                :src="ownerAvatar" :text="ownerInitial" shape="round"
                size="36rpx" custom-class="uh-global-card-glass !shadow-none !border" mode="aspectFill"
              />
              <text class="truncate">{{ ownerText(draw) }}</text>
            </view>
            <text class="text-3xs text-gray-400">{{ formatTime(draw.metadata.creationTimestamp) }}</text>
            <text
              v-if="draw.spec.status === 'REJECTED' && draw.spec.reason"
              class="text-3xs text-red-400 leading-relaxed"
            >
              未通过原因：{{ draw.spec.reason }}
            </text>
          </view>
        </view>
        <view class="box-border w-full flex items-center justify-center gap-3 overflow-hidden">
          <template v-if="draw.spec.status === 'PENDING'">
            <uh-button
              class="w-full" custom-class="flex items-center gap-1 !bg-green-600 px-3 py-1.5 !text-xs !text-white "
              @click="handleOpenReview(draw, 'approve')"
            >
              <wd-icon name="check" size="26rpx" />
              <text>通过</text>
            </uh-button>
            <uh-button
              class="w-full" custom-class="flex items-center gap-1 !bg-orange-500 px-3 py-1.5 !text-xs !text-white "
              @click="handleOpenReview(draw, 'reject')"
            >
              <wd-icon name="close" size="26rpx" />
              <text>拒绝</text>
            </uh-button>
          </template>
          <uh-button
            v-if="isPuzzle(draw)"
            class="w-full" custom-class="flex items-center gap-1 !bg-orange-100 px-3 py-1.5 !text-xs !text-orange-500"
            @click="handleOpenPuzzle(draw)"
          >
            <wd-icon name="user" size="26rpx" />
            <text>画谜</text>
          </uh-button>
          <uh-button
            class="w-full" custom-class="flex items-center gap-1 !bg-red-100 px-3 py-1.5 !text-xs !text-red-500 "
            @click="handleDelete(draw)"
          >
            <wd-icon name="delete" size="26rpx" />
            <text>删除</text>
          </uh-button>
        </view>
      </view>
      <uh-data-loadmore :status="loadMoreStatus.status" :text="loadMoreStatus.text" />
    </view>

    <!-- 审核弹层（通过=备注选填 / 拒绝=原因必填） -->
    <uh-glass-popup
      v-model="reviewPopupVisible" position="bottom" :z-index="110" custom-class="!rounded-2xl"
      @close="reviewPopupVisible = false"
    >
      <view class="box-border flex flex-col gap-3 p-3">
        <view class="relative box-border w-full flex items-center justify-center">
          <text class="text-md font-bold">{{ reviewTitle() }}</text>
          <view
            class="uh-global-card-glass absolute right-0 top-0 h-6 w-6 flex items-center justify-center border rounded-lg shadow-none"
            @click="reviewPopupVisible = false"
          >
            <wd-icon name="close" size="28rpx" class="text-gray-500" />
          </view>
        </view>
        <text class="text-center text-3xs text-gray-400">
          作品：{{ reviewTarget?.spec.title || '无题' }}
        </text>
        <view class="uh-global-card-glass w-full flex items-start border rounded-xl px-4 py-2.5 !shadow-none">
          <textarea
            v-model="reviewText" :placeholder="reviewPlaceholder()" placeholder-class="text-gray-400"
            class="h-20 w-full text-sm" :maxlength="200"
          />
        </view>
        <uh-button
          class="w-full flex-1"
          custom-class="uh-global-card-glass uh-shadow-xs !border !rounded-xl !py-2 !text-sm !text-white active:opacity-80"
          :class="[reviewMode === 'approve' ? '!bg-green-500' : '!bg-orange-500', { 'opacity-60': submitting }]"
          @click="handleConfirmReview"
        >
          {{ reviewButtonText() }}
        </uh-button>
      </view>
    </uh-glass-popup>

    <!-- 竞猜信息弹层（谜底原文 + 竞猜记录 + 强制揭晓） -->
    <uh-glass-popup v-model="puzzleVisible" position="bottom" custom-class="rounded-2xl" :z-index="120">
      <view class="box-border flex flex-col gap-y-3 p-3">
        <view class="relative box-border w-full flex items-center justify-center">
          <text class="text-md font-bold">画谜信息</text>
          <view
            class="uh-global-card-glass absolute right-0 top-0 h-6 w-6 flex items-center justify-center border rounded-lg shadow-none"
            @click="puzzleVisible = false"
          >
            <wd-icon name="close" size="28rpx" class="text-gray-500" />
          </view>
        </view>

        <wd-loading v-if="puzzleLoading" size="64rpx" custom-class="text-primary py-8" />
        <template v-else-if="puzzleInfo">
          <view class="uh-global-card-glass flex flex-col gap-y-2 rounded-xl p-3 !border !shadow-none">
            <view class="flex items-center justify-between">
              <text class="text-sm text-gray-900 font-bold">谜底：{{ puzzleInfo.puzzleAnswer }}</text>
              <text class="text-3xs text-gray-400">
                {{ puzzleInfo.puzzleStatus === 'REVEALED' ? '已揭晓' : '进行中' }}
              </text>
            </view>
            <text v-if="puzzleInfo.puzzleHint" class="text-3xs text-gray-400">
              提示语：{{ puzzleInfo.puzzleHint }}
            </text>
            <text class="text-3xs text-gray-400">
              自动揭晓：{{ puzzleInfo.autoRevealAt ? formatTime(puzzleInfo.autoRevealAt) : '手动揭晓' }}
            </text>
            <text class="text-3xs text-gray-400">
              {{ puzzleInfo.guessCount }} 人参与 · {{ puzzleInfo.solvedCount }} 人猜中
            </text>
          </view>
          <uh-section-title>画谜记录</uh-section-title>
          <scroll-view :scroll-y="true" class="h-[40vh] flex-1" :show-scrollbar="false">
            <view
              v-for="record in puzzleInfo.records" :key="record.username"
              class="box-border flex items-center gap-x-2 border-b border-gray-100 px-1 py-2 last:border-b-0"
            >
              <text class="flex-1 truncate text-3xs text-gray-700 font-semibold">
                {{ record.displayName || record.username }}
              </text>
              <text class="shrink-0 truncate text-xs text-gray-400">“{{ record.answer }}”</text>
              <text class="shrink-0 text-xs font-semibold" :class="record.correct ? 'text-green-500' : 'text-orange-500'">
                {{ record.correct ? '已猜中' : '未猜中' }}
              </text>
            </view>
            <view v-if="puzzleInfo.records.length === 0" class="py-6 text-center text-xs text-gray-400">
              暂无画谜记录
            </view>
          </scroll-view>

          <uh-button
            v-if="puzzleInfo.puzzleStatus !== 'REVEALED'"
            custom-class="!bg-orange-500 !py-2  !text-white active:opacity-80"
            @click="handleReveal"
          >
            强制揭晓
          </uh-button>
        </template>
      </view>
    </uh-glass-popup>
  </view>
</template>
