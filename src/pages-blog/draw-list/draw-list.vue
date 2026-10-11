<script lang="ts" setup>
/**
 * 绘画作品列表页（匿名可看）：参考豆瓣列表页标准设计（双列卡片 + 分页加载 + 分享）；
 * 底部悬浮「画一幅」入口需登录且具备绘画权限
 */
import { computed, ref } from 'vue'
import { onLoad, onPageScroll, onPullDownRefresh, onReachBottom, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { getDrawList } from '@/api/draw'
import { usePageScroll } from '@/hooks/usePageScroll'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useNavbarSticky } from '@/hooks/useNavbarSticky'
import { usePermission } from '@/hooks/usePermission'
import { useTokenStore } from '@/store/token'
import { useAppConfigStore } from '@/store/appConfig'
import { NeedPluginIds, usePluginAvailable } from '@/hooks/usePluginAvailable'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { sleep } from '@/utils/common'
import { checkThumbnailUrl } from '@/utils/url'
import type { IDraw } from '@/api/types/draw'

definePage({
  style: {
    navigationBarTitleText: '绘画作品',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
  },
})

const { scrollY, updatePageScrollValue } = usePageScroll()
/** 吸顶偏移（分类 tab 吸顶用，同装备列表） */
const { height: offsetTop } = useNavbarSticky()
/** 页面标题（插件端可配置，留空回退内置默认） */
const pageTitle = usePageTitle('drawList', '绘画作品')

const tokenStore = useTokenStore()
const appConfigStore = useAppConfigStore()
const { can } = usePermission()

/** 应用登录整体开关（与登录页同语义：密码/微信两开关全关 = 登录不可用） */
const loginEnabled = computed(() => {
  const client = appConfigStore.configs?.loginConfig?.client
  return client?.passwordLoginEnabled !== false || client?.wechatLoginEnabled === true
})

/** 猜画玩法总开关（插件端「绘画设置」下发；关闭时隐藏竞猜入口，缺省开启） */
const guessModeEnabled = computed(() =>
  appConfigStore.configs?.featureConfig?.pages?.draw?.guessEnabled !== false)

async function handleGoDraw() {
  if (!tokenStore.updateNowTime().hasLogin) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    await sleep(2500)
    uni.navigateTo({ url: '/pages/auth/login' })
    return
  }
  if (!can('DRAW_MANAGE')) {
    uni.showToast({ title: '您没有权限', icon: 'none' })
    return
  }
  uni.navigateTo({ url: '/pages-blog/draw-canvas/draw-canvas' })
}

const siteName = ref('uni-halo')

/** 依赖插件(uni-halo)，不可用时展示占位并可重试 */
const { pluginId, checking, tips, available: uniHaloPluginAvailable, check: checkPluginAvailable } = usePluginAvailable({
  pluginId: NeedPluginIds.PluginUniHalo,
  tips: '啊偶，功能正在维护中...',
  callback: (isAvailable) => {
    if (!isAvailable) { return }
    handleGetData()
  },
})

/* ---------------- 分享 ---------------- */
onShareAppMessage(() => ({
  title: `${pageTitle.value} - ${siteName.value}`,
  path: '/pages-blog/draw-list/draw-list',
}))

onShareTimeline(() => ({
  title: `${pageTitle.value} - ${siteName.value}`,
  query: '',
}))

/* ---------------- 数据加载 ---------------- */
const { loadingStatus, loadMoreStatus, updateLoadingStatus, updateLoadMoreStatus, resetLoadMoreStatus } = useDataLoadingStatus()
const drawList = ref<IDraw[]>([])
const queryParams = ref({ size: 10, page: 1, type: 'all' })

/** 分类 tab：全部 / 普通作品 / 竞猜作品（站点关闭猜画玩法时去掉竞猜项） */
const typeTabs = computed(() => {
  const tabs: { label: string, value: 'all' | 'normal' | 'puzzle' }[] = [
    { label: '全部', value: 'all' },
    { label: '普通作品', value: 'normal' },
    { label: '画谜作品', value: 'puzzle' },
  ]
  if (!guessModeEnabled.value) {
    return []
  }
  return tabs
})
const activeType = ref<'all' | 'normal' | 'puzzle'>('all')

function handleSwitchType(value: 'all' | 'normal' | 'puzzle') {
  if (activeType.value === value) { return }
  activeType.value = value
  queryParams.value.type = value
  // 切换分类回到列表顶部（同装备列表）
  uni.pageScrollTo({ scrollTop: 0, duration: 300 })
  handleRetry()
}

/** 是否竞猜作品（公开数据无谜底，用竞猜状态判定） */
function isPuzzleDraw(draw: IDraw) {
  return !!draw.spec.puzzleStatus
}

async function handleGetData() {
  if (!loadMoreStatus.value.active) {
    updateLoadingStatus(DataLoadingStatusEnum.Loading)
  }
  try {
    if (!guessModeEnabled.value) {
      queryParams.value.type = 'normal'
    }
    const res = await getDrawList({ ...queryParams.value })
    const items = (res.data?.items || []).map((item) => {
      item.spec.cover = checkThumbnailUrl(item.spec.cover)
      return item
    })
    drawList.value = loadMoreStatus.value.active
      ? drawList.value.concat(items)
      : items
    if (!loadMoreStatus.value.active) {
      await sleep(600)
      updateLoadingStatus(drawList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
    }
    updateLoadMoreStatus({
      active: false,
      status: res.data?.hasNext ? 'loadMore' : 'noMore',
      hasNext: !!res.data?.hasNext,
    })
  }
  catch (err) {
    console.error('获取画作列表失败', err)
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
  resetLoadMoreStatus()
  drawList.value = []
  queryParams.value.page = 1
  handleGetData()
}

onLoad(async () => {
  await checkPluginAvailable()
  if (!uniHaloPluginAvailable.value) {
    uni.stopPullDownRefresh()
  }
})

onPullDownRefresh(() => {
  if (!uniHaloPluginAvailable.value) {
    uni.stopPullDownRefresh()
    return
  }
  handleRetry()
})

onReachBottom(() => {
  if (!uniHaloPluginAvailable.value) { return }
  if (loadMoreStatus.value.active) {
    return
  }
  if (loadMoreStatus.value.hasNext) {
    queryParams.value.page += 1
    updateLoadMoreStatus({
      active: true,
      status: 'loading',
    })
    handleGetData()
  }
})

onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})

/* ---------------- 双列分列（封面等高，按索引交替分列即可） ---------------- */
const leftColumn = computed(() => drawList.value.filter((_, i) => i % 2 === 0))
const rightColumn = computed(() => drawList.value.filter((_, i) => i % 2 === 1))

/* ---------------- 详情/竞猜弹层（组件化：uh-draw-detail-popup / uh-draw-guess-popup） ---------------- */
const detailVisible = ref(false)
const currentDraw = ref<IDraw | null>(null)
const currentCover = ref('')

/* ---------------- 竞猜弹层 ---------------- */
const guessVisible = ref(false)
function handleOpenDetail(draw: IDraw) {
  // 竞猜作品打开竞猜弹窗，普通作品走原详情弹窗
  currentDraw.value = draw
  currentCover.value = draw.spec.cover || ''
  if (isPuzzleDraw(draw)) {
    guessVisible.value = true
    return
  }
  detailVisible.value = true
}

/* ---------------- 排行榜弹层 ---------------- */
const rankVisible = ref(false)

/** 竞猜状态变化后静默刷新列表计数 */
function handleGuessSolved() {
  queryParams.value.page = 1
  loadMoreStatus.value.active = false
  handleGetData()
}
</script>

<template>
  <view class="min-h-screen w-screen flex flex-col bg-page">
    <uh-navbar :scroll-y="scrollY" :use-back="true" :default-title="pageTitle" title-color="text-gray-900" />

    <uh-plugin-unavailable
      v-if="!uniHaloPluginAvailable" custom-class="h-[70vh]" :plugin-id="pluginId"
      :error-text="tips" :checking="checking" @on-refresh="checkPluginAvailable"
    />

    <template v-else>
      <!-- 分类 tab（吸顶，样式对齐装备列表：横向滚动 + 胶囊） -->
      <wd-sticky v-if="typeTabs.length !== 0" :offset-top="offsetTop">
        <scroll-view :scroll-x="true" :show-scrollbar="false" class="w-screen whitespace-nowrap">
          <view
            v-for="tab in typeTabs" :key="tab.value"
            class="uh-global-card-glass ml-3 inline-flex border rounded-2xl px-4 py-1.5 text-xs shadow-none"
            :class="{ '!bg-primary text-gray-900 font-semibold': activeType === tab.value }"
            @click="handleSwitchType(tab.value)"
          >
            {{ tab.label }}
          </view>
        </scroll-view>
      </wd-sticky>

      <uh-data-loading
        v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus"
        empty-text="啊偶，还没有任何画作哦~" min-height="75vh" @refresh="handleRetry"
      />

      <view v-else class="box-border w-full flex gap-3 p-3">
        <view class="flex flex-1 flex-col gap-3">
          <uh-draw-card
            v-for="draw in leftColumn" :key="draw.metadata.name" :draw="draw"
            @tap="handleOpenDetail(draw)"
          />
        </view>
        <view class="flex flex-1 flex-col gap-3">
          <uh-draw-card
            v-for="draw in rightColumn" :key="draw.metadata.name" :draw="draw"
            @tap="handleOpenDetail(draw)"
          />
        </view>
      </view>
      <uh-data-loadmore
        v-if="loadingStatus === DataLoadingStatusEnum.Success" :status="loadMoreStatus.status"
        :text="loadMoreStatus.text" class="w-full"
      />
    </template>

    <!-- 底部悬浮：画一幅（登录 + 绘画权限） -->
    <view class="uh-translate-x-center fixed bottom-0 left-1/2 z-10 box-border w-fit pb-safe">
      <view
        class="uh-global-card-glass uh-shadow-xs box-border flex flex-1 items-center justify-center gap-x-3 border rounded-full p-1"
      >
        <view
          v-if="loginEnabled"
          class="uh-global-card-glass box-border flex shrink-0 items-center justify-center gap-x-1 overflow-hidden border rounded-full px-3 py-2 text-primary !shadow-none"
          @click="handleGoDraw"
        >
          <wd-icon name="plus" size="28rpx" />
          <text class="shrink-0 text-3xs font-semibold">画一幅</text>
        </view>
        <view
          v-if="guessModeEnabled"
          class="uh-global-card-glass box-border flex shrink-0 items-center justify-center gap-x-1 overflow-hidden border rounded-full px-3 py-2 text-primary !shadow-none"
          @click="rankVisible = true"
        >
          <wd-icon name="crown" size="28rpx" />
          <text class="shrink-0 text-3xs font-semibold">画谜排行榜</text>
        </view>
      </view>
    </view>

    <!-- 详情弹层（普通作品，抽离组件） -->
    <uh-draw-detail-popup v-model="detailVisible" :draw="currentDraw" />

    <!-- 竞猜弹层（独立弹窗，复制详情结构 + 竞猜面板） -->
    <uh-draw-guess-popup v-model="guessVisible" :draw="currentDraw" @solved="handleGuessSolved" />

    <!-- 猜画积分排行榜弹层（匿名可看） -->
    <uh-draw-rank-popup v-model="rankVisible" />
  </view>
</template>

<style scoped lang="scss">
.uh-translate-x-center {
  transform: translateX(-50%);
}
</style>
