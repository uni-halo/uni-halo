<script lang="ts" setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { onLoad, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { getAllFootprints } from '@/api/halo-plugin-third/footprint'
import { useAppConfigStore } from '@/store/appConfig'
import { usePageTitle } from '@/hooks/usePageTitle'
import { NeedPluginIds, usePluginAvailable } from '@/hooks/usePluginAvailable'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { sleep } from '@/utils/common'
import FootprintMap from './components/footprint-map.vue'
import FootprintSheet from './components/footprint-sheet.vue'
import type { IFootprint } from '@/api/types/halo-plugin-third/footprint'

definePage({
  style: {
    navigationBarTitleText: '足迹',
    navigationStyle: 'custom',
  },
})

const appConfigStore = useAppConfigStore()
const siteName = computed(() => appConfigStore.configs.featureConfig?.profile?.appInfo?.name || 'uni-halo')
/** 页面标题（插件端可配置，留空回退内置默认） */
const pageTitle = usePageTitle('footprint', '足迹')

/** 依赖插件(footprint)，不可用时展示占位并可重试 */
const { pluginId, checking, tips, available: pluginAvailable, check: checkPlugin } = usePluginAvailable({
  pluginId: NeedPluginIds.PluginFootprint,
  tips: '啊偶，足迹功能正在维护中...',
  callback: (isAvailable) => {
    if (isAvailable) {
      handleGetData()
    }
  },
})

/* ---------------- 分享 ---------------- */
onShareAppMessage(() => ({
  title: `${pageTitle.value} - ${siteName.value}`,
  path: '/pages-blog/footprint/footprint',
}))

onShareTimeline(() => ({
  title: `${pageTitle.value} - ${siteName.value}`,
  query: '',
}))

/* ---------------- 状态 ---------------- */
const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()
const footprints = ref<IFootprint[]>([])
/** 首次加载成功(后续刷新不再走整页加载态，避免地图与操作栏被销毁重建) */
const firstLoaded = ref(false)
/** 弹层模式：list=列表 / detail=详情 / null=关闭 */
const sheetMode = ref<'list' | 'detail' | null>(null)
/** 选中的足迹（详情内容载体，与地图聚焦点相互独立） */
const selected = ref<IFootprint | null>(null)
const mapRef = ref<InstanceType<typeof FootprintMap> | null>(null)

const sheetOpen = computed(() => sheetMode.value !== null)

/**
 * 地图可见性：App 端原生地图层级最高，弹层打开期间需销毁地图
 * （打开后等滑入动画结束再销毁防闪空，关闭后等滑出动画结束再重挂载防盖层）
 */
const mapVisible = ref(true)
let mapTimer: ReturnType<typeof setTimeout> | null = null

// #ifdef APP-PLUS
watch(sheetOpen, (open) => {
  if (mapTimer) {
    clearTimeout(mapTimer)
  }
  mapTimer = setTimeout(() => {
    mapVisible.value = !open
  }, open ? 320 : 420)
})

onUnmounted(() => {
  if (mapTimer) {
    clearTimeout(mapTimer)
  }
})
// #endif

/* ---------------- 数据加载 ---------------- */
async function handleGetData() {
  // 重新拉取数据时清选中
  selected.value = null
  updateLoadingStatus(DataLoadingStatusEnum.Loading)
  try {
    const res = await getAllFootprints()
    footprints.value = Array.isArray(res.data) ? res.data : []
    firstLoaded.value = true
    await sleep(600)
    updateLoadingStatus(footprints.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
  }
  catch (err) {
    console.error('获取足迹列表失败', err)
    updateLoadingStatus(DataLoadingStatusEnum.Error)
  }
}

/* ---------------- 时间线分组 / 统计 ---------------- */
function yearOf(item: IFootprint) {
  const t = item.spec?.createTime
  const d = t ? new Date(t) : null
  return d && !Number.isNaN(d.getTime()) ? d.getFullYear() : 0
}

const timelineGroups = computed(() => {
  const map = new Map<number, IFootprint[]>()
  footprints.value.forEach((item) => {
    const year = yearOf(item)
    const list = map.get(year) ?? []
    list.push(item)
    map.set(year, list)
  })
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, items]) => ({
      year: year > 0 ? `${year} 年` : '其他',
      items: items.sort((a, b) => (b.spec?.createTime || '').localeCompare(a.spec?.createTime || '')),
    }))
})

const stats = computed(() => {
  const valid = footprints.value.filter(item => item.spec?.name)
  const citySet = new Set(valid.map(item => item.spec?.address).filter(Boolean))
  const yearSet = new Set(valid.map(yearOf).filter(year => year > 0))
  return { count: valid.length, cityCount: citySet.size, yearSpan: yearSet.size }
})

/* ---------------- 交互 ---------------- */
function openListSheet() {
  sheetMode.value = 'list'
}

/** 地图 marker 点击：弹层原位切详情 */
function handleMarkerTap(footprint: IFootprint) {
  selected.value = footprint
  sheetMode.value = 'detail'
}

/** 列表条目点击：弹层原位切详情（不重挂动画） */
function handleItemTap(footprint: IFootprint) {
  selected.value = footprint
  sheetMode.value = 'detail'
}

/** 关闭弹层：地图保持当前视野（不自动还原全局，需要时点底部[还原]） */
function handleSheetClose() {
  selected.value = null
  sheetMode.value = null
}

/** 返回列表：弹层 detail 原位切回 list（不重挂动画） */
function handleBackToList() {
  sheetMode.value = 'list'
}

/** 定位：地图聚焦该点，不改变弹层状态 */
function handleLocate(footprint: IFootprint) {
  mapRef.value?.focusOn(footprint)
}

/** 还原：地图适配所有足迹点 */
function handleResetView() {
  mapRef.value?.resetView()
}

/** 放大：读取地图当前缩放级别后 +1 */
function handleZoomIn() {
  mapRef.value?.zoomIn()
}

/** 缩小：读取地图当前缩放级别后 -1 */
function handleZoomOut() {
  mapRef.value?.zoomOut()
}

/* ---------------- 生命周期 ---------------- */
onLoad(async () => {
  await checkPlugin()
})
</script>

<template>
  <view class="app-page h-screen w-screen flex flex-col overflow-hidden bg-page">
    <!-- 自定义导航 -->
    <uh-navbar :default-title="pageTitle" :need-placeholder="false" title-color="text-gray-900" />

    <!-- 插件不可用 -->
    <uh-plugin-unavailable
      v-if="!pluginAvailable"
      custom-class="h-[85vh]"
      :plugin-id="pluginId"
      :error-text="tips"
      :checking="checking"
      @on-refresh="checkPlugin"
    />

    <!-- 首次加载中 / 空 / 错误 -->
    <uh-data-loading
      v-if="!firstLoaded && loadingStatus !== DataLoadingStatusEnum.Success"
      :loading-status="loadingStatus"
      empty-text="啊偶，还没有任何足迹哦~"
      min-height="85vh"
      @refresh="handleGetData"
    />

    <!-- 地图区域 + 底部悬浮操作栏(首次加载成功后常驻，刷新只原地更新数据) -->
    <view v-else-if="firstLoaded" class="min-h-0 flex flex-1 flex-col">
      <view class="relative min-h-0 flex-1 overflow-hidden">
        <footprint-map
          v-if="mapVisible"
          ref="mapRef"
          class="h-full w-full"
          :footprints="footprints"
          @marker-tap="handleMarkerTap"
        />
      </view>
      <!-- 底部悬浮操作栏(参考文章详情悬浮样式)：列表/放大/缩小/刷新/还原 -->
      <view class="footprint-bar flex flex-shrink-0 items-center justify-center pt-2 pb-safe">
        <view class="uh-global-card-glass box-border flex items-center justify-center gap-2 border rounded-full p-1">
          <view
            class="uh-global-card-glass box-border h-9 flex flex-1 items-center justify-center gap-x-1 border rounded-full px-5 shadow-none"
            @click="openListSheet"
          >
            <wd-icon name="list" size="28rpx" class="text-gray-900" />
            <text class="shrink-0 text-xs text-gray-900 font-semibold">列表</text>
          </view>
          <view
            class="uh-global-card-glass box-border h-9 w-9 flex items-center justify-center border rounded-full shadow-none"
            @click="handleZoomIn"
          >
            <wd-icon name="zoom-in" size="36rpx" class="text-gray-900" />
          </view>
          <view
            class="uh-global-card-glass box-border h-9 w-9 flex items-center justify-center border rounded-full shadow-none"
            @click="handleZoomOut"
          >
            <wd-icon name="zoom-out" size="36rpx" class="text-gray-900" />
          </view>
          <view
            class="uh-global-card-glass box-border h-9 w-9 flex items-center justify-center border rounded-full shadow-none"
            @click="handleGetData"
          >
            <wd-icon name="sync" size="34rpx" class="text-gray-900" />
          </view>
          <view
            class="uh-global-card-glass box-border h-9 flex flex-1 items-center justify-center gap-x-1 border rounded-full px-5 shadow-none"
            @click="handleResetView"
          >
            <wd-icon name="refresh" size="28rpx" class="text-gray-900" />
            <text class="shrink-0 text-xs text-gray-900 font-semibold">还原</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部弹层 -->
    <footprint-sheet
      :visible="sheetOpen"
      :mode="sheetMode ?? 'list'"
      :stats="stats"
      :groups="timelineGroups"
      :selected="selected"
      @close="handleSheetClose"
      @item-tap="handleItemTap"
      @back-to-list="handleBackToList"
      @locate="handleLocate"
    />
  </view>
</template>

<style scoped lang="scss">
/* 底部操作栏定位的平台差异(uni-app style 条件编译)：
   App 端原生地图层级最高，fixed 栏会被地图盖住 → 正常流放地图下方；
   H5/微信小程序同层渲染 → 悬浮于地图底部上方 */
.footprint-bar {
  /* #ifdef APP-PLUS */
  position: relative;
  /* #endif */

  /* #ifndef APP-PLUS */
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 10;
  /* #endif */
}
</style>
