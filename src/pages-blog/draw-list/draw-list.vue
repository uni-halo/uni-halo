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
import { usePermission } from '@/hooks/usePermission'
import { useTokenStore } from '@/store/token'
import { NeedPluginIds, usePluginAvailable } from '@/hooks/usePluginAvailable'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { sleep } from '@/utils/common'
import { checkThumbnailUrl } from '@/utils/url'
import type { IDraw } from '@/api/types/draw'
import { formatTime } from '@/utils/formatTime'

definePage({
  style: {
    navigationBarTitleText: '绘画作品',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
  },
})

const { scrollY, updatePageScrollValue } = usePageScroll()
/** 页面标题（插件端可配置，留空回退内置默认） */
const pageTitle = usePageTitle('drawList', '绘画作品')

const tokenStore = useTokenStore()
const { can } = usePermission()

/** 悬浮绘画入口（登录且具备绘画权限才显示） */
const showDrawAction = computed(() =>
  tokenStore.updateNowTime().hasLogin && can('DRAW_MANAGE'))

function handleGoDraw() {
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
const queryParams = ref({ size: 10, page: 1 })

async function handleGetData() {
  if (!loadMoreStatus.value.active) {
    updateLoadingStatus(DataLoadingStatusEnum.Loading)
  }
  try {
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

/* ---------------- 详情弹层 ---------------- */
const detailVisible = ref(false)
const currentDraw = ref<IDraw | null>(null)
/** 详情弹窗作者信息：头像相对路径补全 + 首字回退在数据层算好，模板不做判断 */
const currentOwnerAvatar = computed(() => checkThumbnailUrl(currentDraw.value?.owner?.avatar || ''))
const currentOwnerText = computed(() =>
  currentDraw.value?.owner?.displayName || currentDraw.value?.owner?.username || '佚名')
const currentOwnerInitial = computed(() => currentOwnerText.value.slice(0, 1).toUpperCase())
const currentCover = ref('')

function handleOpenDetail(draw: IDraw) {
  currentDraw.value = draw
  currentCover.value = draw.spec.cover || ''
  detailVisible.value = true
}

function handlePreviewCover() {
  if (!currentCover.value) { return }
  uni.previewImage({ urls: [currentCover.value] })
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
    <view class="uh-translate-x-center fixed bottom-0 left-1/2 z-10 pb-safe">
      <view
        v-if="showDrawAction"
        class="uh-global-card-glass uh-shadow-xs box-border flex items-center justify-center gap-x-1 border rounded-full px-6 py-2.5 text-primary"
        @click="handleGoDraw"
      >
        <wd-icon name="plus" size="28rpx" />
        <text class="shrink-0 text-3xs font-semibold">画一幅</text>
      </view>

      <view
        v-else
        class="uh-global-card-glass uh-shadow-xs box-border flex items-center justify-center gap-x-1 border rounded-full px-6 py-2.5 text-primary"
      >
        <text class="text-3xs font-semibold">登录后，可以参与画作提交</text>
      </view>
    </view>

    <!-- 详情弹层 -->
    <uh-glass-popup
      v-model="detailVisible" position="bottom" custom-class="rounded-2xl" :z-index="110"
      @close="detailVisible = false"
    >
      <view v-if="currentDraw" class="box-border flex flex-col gap-y-3 p-3">
        <!-- 顶部 -->
        <view class="relative box-border w-full flex items-center justify-center">
          <view class="flex gap-y-1">
            <text class="text-md font-bold">作品详情</text>
          </view>
          <view
            class="uh-global-card-glass absolute right-0 top-0 h-6 w-6 flex items-center justify-center border rounded-lg shadow-none"
            @click="detailVisible = false"
          >
            <wd-icon name="close" size="28rpx" class="text-gray-500" />
          </view>
        </view>
        <view
          class="uh-global-card-glass h-64 flex items-center justify-center overflow-hidden rounded-xl !border !shadow-none"
        >
          <wd-img :src="currentCover" mode="widthFix" class="w-full" @click="handlePreviewCover">
            <template #loading>
              <wd-loading size="64rpx" custom-class="text-primary" />
            </template>
          </wd-img>
        </view>
        <view class="flex flex-col gap-y-1.5">
          <text class="text-sm text-gray-900 font-medium">{{ currentDraw.spec.title || '无题' }}</text>
          <text v-if="currentDraw.spec.description" class="text-xs text-gray-500 leading-relaxed">
            {{ currentDraw.spec.description }}
          </text>
          <view class="flex items-center justify-between text-xs text-gray-400">
            <view class="w-full flex items-center gap-x-2">
              <wd-avatar
                :src="currentOwnerAvatar"
                :text="currentOwnerInitial"
                shape="round" size="42rpx"
                custom-class="uh-global-card-glass !shadow-none !border" mode="aspectFill"
              />
              <text>{{ currentOwnerText }}</text>
            </view>
            <text class="shrink-0">
              {{ formatTime({ d: currentDraw.metadata.creationTimestamp, f: 'yyyy年MM月dd日' })
              }}
            </text>
          </view>
        </view>
      </view>
    </uh-glass-popup>
  </view>
</template>

<style scoped lang="scss">
.uh-translate-x-center {
  transform: translateX(-50%);
}
</style>
