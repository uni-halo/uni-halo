<script lang="ts" setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { onLoad, onPullDownRefresh, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
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
    enablePullDownRefresh: true,
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
/** 弹层模式：list=列表 / detail=详情 / null=关闭 */
const sheetMode = ref<'list' | 'detail' | null>(null)
const selected = ref<IFootprint | null>(null)

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
  updateLoadingStatus(DataLoadingStatusEnum.Loading)
  try {
    const res = await getAllFootprints()
    footprints.value = Array.isArray(res.data) ? res.data : []
    await sleep(600)
    updateLoadingStatus(footprints.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
  }
  catch (err) {
    console.error('获取足迹列表失败', err)
    updateLoadingStatus(DataLoadingStatusEnum.Error)
  }
  finally {
    uni.stopPullDownRefresh()
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

/** 关闭弹层：恢复全局视野 */
function handleSheetClose() {
  selected.value = null
  sheetMode.value = null
}

/** 重置视野：清除选中点，地图回到全局适配 */
function handleResetView() {
  selected.value = null
}

/* ---------------- 生命周期 ---------------- */
onLoad(async () => {
  await checkPlugin()
  if (!pluginAvailable.value) {
    uni.stopPullDownRefresh()
  }
})

onPullDownRefresh(() => {
  if (!pluginAvailable.value) {
    uni.stopPullDownRefresh()
    return
  }
  if (sheetOpen.value) {
    handleSheetClose()
  }
  handleGetData()
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

    <!-- 加载中 / 空 / 错误 -->
    <uh-data-loading
      v-else-if="loadingStatus !== DataLoadingStatusEnum.Success"
      :loading-status="loadingStatus"
      empty-text="啊偶，还没有任何足迹哦~"
      min-height="85vh"
      @refresh="handleGetData"
    />

    <!-- 地图区域 + 底部悬浮操作栏 -->
    <view v-else class="min-h-0 flex flex-1 flex-col">
      <view class="relative min-h-0 flex-1 overflow-hidden">
        <footprint-map
          v-if="mapVisible"
          class="h-full w-full"
          :footprints="footprints"
          :selected="selected"
          @marker-tap="handleMarkerTap"
        />
      </view>
      <!-- 底部悬浮操作栏(参考文章详情悬浮样式)：列表/定位 -->
      <view class="fixed bottom-0 left-0 right-0 flex flex-shrink-0 items-center justify-center pt-2 pb-safe">
        <view class="uh-global-card-glass box-border flex items-center justify-center gap-2 border rounded-full p-1">
          <view
            class="uh-global-card-glass box-border h-9 flex flex-1 items-center justify-center gap-x-1 border rounded-full px-5 shadow-none"
            @click="openListSheet"
          >
            <wd-icon name="list" size="36rpx" class="text-gray-900" />
            <text class="shrink-0 text-xs text-gray-900 font-semibold">列表</text>
          </view>
          <view
            class="uh-global-card-glass box-border h-9 flex flex-1 items-center justify-center gap-x-1 border rounded-full px-5 shadow-none"
            @click="handleResetView"
          >
            <wd-icon name="location" size="36rpx" class="text-gray-900" />
            <text class="shrink-0 text-xs text-gray-900 font-semibold">定位</text>
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
    />
  </view>
</template>
