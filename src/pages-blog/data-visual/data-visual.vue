<script lang="ts" setup>
import { computed, ref } from 'vue'
import { onPageScroll, onPullDownRefresh, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import dayjs from 'dayjs'
import { getChartData } from '@/api/uni-halo'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { usePageScroll } from '@/hooks/usePageScroll'
import { usePageTitle } from '@/hooks/usePageTitle'
import { NeedPluginIds } from '@/hooks/usePluginAvailable'
import type { IDataStatistics } from '@/api/uni-halo'
import { sleep } from '@/utils/common'

definePage({
  style: {
    navigationBarTitleText: '数据看板',
    enablePullDownRefresh: true,
    navigationStyle: 'custom',
  },
})

/** 依赖插件(plugin-data-statistics,参考 gallery 对象传参模式) */
const { scrollY, updatePageScrollValue } = usePageScroll()
/** 页面标题（插件端可配置，留空回退内置默认） */
const pageTitle = usePageTitle('dataVisual', '数据看板')
const { pluginId, checking, tips, available: uniHaloPluginAvailable, check: checkPluginAvailable } = usePluginAvailable({
  pluginId: NeedPluginIds.PluginDataStatistics,
  tips: '阿偶，功能正在维护中...',
})

/** 重新检测插件:可用则拉取数据(供 uh-plugin-unavailable 刷新按钮) */
async function handlePluginRefresh() {
  if (await checkPluginAvailable()) {
    handleGetData()
  }
}

/* ---------------- 分享 ---------------- */

onShareAppMessage(() => ({
  title: pageTitle.value,
  path: '/pages-blog/data-visual/data-visual',
}))

onShareTimeline(() => ({
  title: pageTitle.value,
  query: '',
}))

/* ---------------- 状态 ---------------- */
const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()
const statistics = ref<IDataStatistics>({
  tags: [],
  categories: [],
  articles: [],
  comments: [],
  top10Articles: [],
})

/* ---------------- 图表配置 ---------------- */
/** 主题色(与 style/index.scss 的 --wot-color-theme 保持一致) */
const themeColor = '#b9e424'
/** 图表系列色板:以主题色为基调配色,黄→绿→青相邻色系,避免杂乱 */
const chartColors = [themeColor, '#8bc34a', '#4caf50', '#26a69a', '#ffd54f', '#d4e157', '#66bb6a', '#9ccc65', '#00bcd4', '#ffb300']

/** 标签统计(环形图) */
const tagChart = ref({
  isExpand: true,
  type: 'ring',
  data: { series: [{ data: [] as { name: string, value: number }[] }] },
  /** 环形图中间标题(默认会被 uCharts 填充"收益率",需显式覆盖) */
  title: { name: '', fontSize: 13, color: '#909399' },
  /** 环形图中间数值 */
  subtitle: { name: '', fontSize: 24, color: themeColor },
})

/** 分类统计(柱状图) */
const categoryChart = ref({
  isExpand: true,
  type: 'column',
  data: { categories: [] as string[], series: [{ name: '分类', data: [] as number[] }] },
})

/** 笔记发布趋势(热度图) */
const trandArticleChart = ref({
  isExpand: true,
  type: 'hotmap',
  data: [] as { date: string, count: number }[],
})

/* ---------------- 年份选择器 ---------------- */
const heatmapYear = ref(dayjs().year())
const yearSheetShow = ref(false)
const yearPickerValue = ref<(string | number)[]>([''])
/** 年份候选：今年往前推 10 年 */
const yearColumns = computed(() => {
  const nowYear = dayjs().year()
  return Array.from({ length: 10 }, (_, i) => ({
    label: `${nowYear - i}`,
    value: `${nowYear - i}`,
  }))
})

function handleOpenYearPicker() {
  yearPickerValue.value = [`${heatmapYear.value}`]
  yearSheetShow.value = true
}

function handleYearPickerCancel() {
  yearSheetShow.value = false
}

function handleYearPickerConfirm() {
  yearSheetShow.value = false
  heatmapYear.value = Number(yearPickerValue.value[0])
}

/** 评论活跃用户(柱状图) */
const userCommentsChart = ref({
  isExpand: true,
  type: 'column',
  data: { categories: [] as string[], series: [{ name: '评论', data: [] as number[] }] },
})

/** 热门笔记 Top10(柱状图) */
const top10ArticlesChart = ref({
  isExpand: true,
  type: 'column',
  data: { categories: [] as string[], series: [{ name: '访问量', data: [] as number[] }] },
})

/* ---------------- 数据处理 ---------------- */
/** 环形图最大展示标签数(标签过多时扇区过密,占比难读) */
const TAG_CHART_TOP_N = 8
/** 柱状图每屏最多显示的柱子数(超过则横向滚动) */
const COLUMN_ITEM_COUNT = 5
/** 柱状图 X 轴 label 最大字符数(超出省略号截断) */
const COLUMN_LABEL_MAX_LENGTH = 4

/** 柱状图通用配置(超过每屏数量才显示滚动条;label 超长省略) */
function columnOpts(categoriesCount: number) {
  return {
    background: '#f6f3ee',
    color: chartColors,
    padding: [20, 15, 10, 15],
    legend: { show: false },
    enableScroll: true,
    xAxis: {
      disableGrid: true,
      fontSize: 10,
      itemCount: COLUMN_ITEM_COUNT,
      ...(categoriesCount > COLUMN_ITEM_COUNT ? { scrollShow: true, scrollAlign: 'left' } : {}),
      formatter: (item: string) =>
        item.length > COLUMN_LABEL_MAX_LENGTH ? `${item.slice(0, COLUMN_LABEL_MAX_LENGTH)}…` : item,
    },
    yAxis: { gridType: 'dash', dashLength: 4, tofix: 0 },
    extra: { column: { type: 'group', width: 22, linearType: 'custom', seriesGap: 5, barBorderCircle: true, customColor: [themeColor] } },
  }
}

/** 点击柱子:toast 完整 label 与数值(formatter 截断后的补充) */
function handleColumnClick(index: number, chart: { data: { categories: string[], series: { name: string, data: number[] }[] } }) {
  const label = chart.data.categories[index]
  const value = chart.data.series[0]?.data[index]
  if (label === undefined) { return }
  uni.showToast({ title: `${label}: ${value}`, icon: 'none' })
}

function handleTagChart() {
  const data = [...statistics.value.tags].sort((a, b) => b.count - a.count).slice(0, TAG_CHART_TOP_N)
  tagChart.value.data = {
    series: [
      {
        data: data.map(item => ({ name: item.name, value: item.count })),
      },
    ],
  }
  // 中间文案:标签总数
  tagChart.value.title = { name: '标签总数', fontSize: 13, color: '#909399' }
  tagChart.value.subtitle = { name: `${statistics.value.tags.length} 个`, fontSize: 24, color: themeColor }
}

function handleCategoriesChart() {
  const data = [...statistics.value.categories].sort((a, b) => b.total - a.total)
  categoryChart.value.data = {
    categories: data.map(item => item.name),
    series: [{ name: '分类', data: data.map(item => item.total) }],
  }
}

function handleTrendArticlesChart() {
  trandArticleChart.value.data = statistics.value.articles.map(item => ({
    date: item.date,
    count: item.articleTotal,
  }))
}

function handleUserCommentsChart() {
  const data = [...statistics.value.comments].sort((a, b) => b.count - a.count).slice(0, 10)
  userCommentsChart.value.data = {
    categories: data.map(item => item.username),
    series: [{ name: '评论', data: data.map(item => item.count) }],
  }
}

function handleTop10ArticlesChart() {
  const data = [...statistics.value.top10Articles].sort((a, b) => b.views - a.views).slice(0, 10)
  top10ArticlesChart.value.data = {
    categories: data.map(item => item.name),
    series: [{ name: '访问量', data: data.map(item => item.views) }],
  }
}

/* ---------------- 数据加载 ---------------- */
async function handleGetData() {
  updateLoadingStatus(DataLoadingStatusEnum.Loading)
  try {
    const res = await getChartData()
    await sleep(500)
    statistics.value = res.data
    handleTagChart()
    handleCategoriesChart()
    handleTrendArticlesChart()
    handleUserCommentsChart()
    handleTop10ArticlesChart()
    // 五类统计数据全部为空 → 空态
    const hasData = [res.data.tags, res.data.categories, res.data.articles, res.data.comments, res.data.top10Articles]
      .some(list => list.length > 0)
    updateLoadingStatus(hasData ? DataLoadingStatusEnum.Success : DataLoadingStatusEnum.Empty)
  }
  catch (err) {
    console.error(err)
    updateLoadingStatus(DataLoadingStatusEnum.Error)
  }
  finally {
    setTimeout(() => {
      uni.stopPullDownRefresh()
    }, 100)
  }
}

/* ---------------- 生命周期 ---------------- */
async function init() {
  await checkPluginAvailable()
  if (!uniHaloPluginAvailable.value) {
    uni.stopPullDownRefresh()
    return
  }
  handleGetData()
}

onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})

onPullDownRefresh(() => {
  if (!uniHaloPluginAvailable.value) {
    uni.stopPullDownRefresh()
    return
  }
  handleGetData()
})

init()
</script>

<template>
  <view class="box-border min-h-screen w-screen bg-page p-3">
    <!-- 自定义导航 -->
    <uh-navbar :scroll-y="scrollY" :default-title="pageTitle" title-color="text-gray-900" />

    <uh-plugin-unavailable
      v-if="!uniHaloPluginAvailable" :plugin-id="pluginId" :error-text="tips"
      :checking="checking" custom-class="h-[70vh]" @on-refresh="handlePluginRefresh"
    />

    <template v-else>
      <uh-data-loading
        v-if="loadingStatus !== 'success'" :loading-status="loadingStatus" empty-text="暂无统计数据"
        min-height="75vh" @refresh="handleGetData"
      />

      <!-- 内容区域 -->
      <view v-else class="content flex flex-col gap-3">
        <!-- 笔记发布趋势 -->
        <view class="uh-global-card-glass uh-shadow-xs box-border rounded-xl p-4">
          <uh-section-title>
            笔记发布趋势
            <template #right>
              <view class="flex items-center gap-x-2">
                <text class="text-xs text-gray-500">（按日期统计笔记发布数量）</text>
                <wd-icon
                  :name="trandArticleChart.isExpand ? 'up' : 'down'" size="16px" color="#909399"
                  @click="trandArticleChart.isExpand = !trandArticleChart.isExpand"
                />
              </view>
            </template>
          </uh-section-title>
          <view v-show="trandArticleChart.isExpand" class="mt-3 box-border w-full">
            <uh-heatmap v-model:year="heatmapYear" :chart-data="trandArticleChart.data" @year-click="handleOpenYearPicker" />
          </view>
        </view>

        <!-- 热门笔记 Top10 -->
        <view class="uh-global-card-glass uh-shadow-xs box-border rounded-xl p-4">
          <uh-section-title>
            热门笔记前10
            <template #right>
              <view class="flex items-center gap-x-2">
                <text class="text-xs text-gray-500">（按访问量排序的热门笔记）</text>
                <wd-icon
                  :name="top10ArticlesChart.isExpand ? 'up' : 'down'" size="16px" color="#909399"
                  @click="top10ArticlesChart.isExpand = !top10ArticlesChart.isExpand"
                />
              </view>
            </template>
          </uh-section-title>
          <view v-show="top10ArticlesChart.isExpand" class="mt-3 box-border w-full">
            <qiun-data-charts
              type="column" :canvas2d="true" :ontouch="true" :chart-data="top10ArticlesChart.data" :opts="columnOpts(top10ArticlesChart.data.categories.length)"
              @get-index="(e: any) => handleColumnClick(e.currentIndex, top10ArticlesChart)"
            />
          </view>
        </view>

        <!-- 评论活跃用户 -->
        <view class="uh-global-card-glass uh-shadow-xs box-border rounded-xl p-4">
          <uh-section-title>
            评论活跃用户
            <template #right>
              <view class="flex items-center gap-x-2">
                <text class="text-xs text-gray-500">（按评论作者统计评论数量）</text>
                <wd-icon
                  :name="userCommentsChart.isExpand ? 'up' : 'down'" size="16px" color="#909399"
                  @click="userCommentsChart.isExpand = !userCommentsChart.isExpand"
                />
              </view>
            </template>
          </uh-section-title>
          <view v-show="userCommentsChart.isExpand" class="mt-3 box-border w-full">
            <qiun-data-charts
              type="column" :canvas2d="true" :ontouch="true" :chart-data="userCommentsChart.data" :opts="columnOpts(userCommentsChart.data.categories.length)"
              @get-index="(e: any) => handleColumnClick(e.currentIndex, userCommentsChart)"
            />
          </view>
        </view>

        <!-- 分类统计 -->
        <view class="uh-global-card-glass uh-shadow-xs box-border rounded-xl p-4">
          <uh-section-title>
            分类统计
            <template #right>
              <view class="flex items-center gap-x-2">
                <text class="text-xs text-gray-500">（全部分类的笔记数量占比）</text>
                <wd-icon
                  :name="categoryChart.isExpand ? 'up' : 'down'" size="16px" color="#909399"
                  @click="categoryChart.isExpand = !categoryChart.isExpand"
                />
              </view>
            </template>
          </uh-section-title>
          <view v-show="categoryChart.isExpand" class="mt-3 box-border w-full">
            <qiun-data-charts
              type="column" :canvas2d="true" :ontouch="true" :chart-data="categoryChart.data" :opts="columnOpts(categoryChart.data.categories.length)"
              @get-index="(e: any) => handleColumnClick(e.currentIndex, categoryChart)"
            />
          </view>
        </view>

        <!-- 标签统计 -->
        <view class="uh-global-card-glass uh-shadow-xs box-border rounded-xl p-4">
          <uh-section-title>
            标签统计
            <template #right>
              <view class="flex items-center gap-x-2">
                <text class="text-xs text-gray-500">（全部标签的笔记数量占比）</text>
                <wd-icon
                  :name="tagChart.isExpand ? 'up' : 'down'" size="16px" color="#909399"
                  @click="tagChart.isExpand = !tagChart.isExpand"
                />
              </view>
            </template>
          </uh-section-title>
          <view v-show="tagChart.isExpand" class="mt-3 box-border w-full">
            <qiun-data-charts
              type="ring" :chart-data="tagChart.data"
              :opts="{ color: chartColors, padding: [5, 5, 5, 5], dataLabel: false, legend: { show: false }, title: tagChart.title, subtitle: tagChart.subtitle, extra: { ring: { ringWidth: 36, offsetAngle: -90, border: true, borderWidth: 1, borderColor: '#FFFFFF' } } }"
            />
          </view>
        </view>
      </view>
    </template>

    <!-- 年份选择器 -->
    <uh-glass-popup
      v-model="yearSheetShow" :z-index="999" :hide-when-close="true" position="bottom"
      custom-class="!rounded-2xl"
    >
      <view class="box-border w-full flex flex-col gap-y-3 p-3">
        <!-- 顶部 -->
        <view class="flex items-center justify-between">
          <text class="text-md font-bold">选择年份</text>
          <view
            class="uh-global-card-glass box-border h-6 w-6 flex items-center justify-center border rounded-lg text-gray-500 shadow-none !bg-white/5"
            @click="handleYearPickerCancel"
          >
            <wd-icon name="close" size="28rpx" />
          </view>
        </view>
        <wd-picker-view
          v-model="yearPickerValue" :columns="yearColumns"
          custom-class="uh-picker-view !p-0 !bg-transparent !rounded-xl overflow-hidden"
          @change="(payload: { selectedValues: (string | number)[] }) => yearPickerValue = payload.selectedValues"
        />
        <!-- 底部固定操作区域 -->
        <view class="box-border w-full flex items-center gap-x-3">
          <uh-button
            class="flex-1"
            custom-class="flex-1 uh-global-card-glass uh-shadow-xs border !py-2.5 !rounded-xl !text-3xs !bg-white/90"
            @click="handleYearPickerCancel"
          >
            取消
          </uh-button>
          <uh-button
            class="flex-1"
            custom-class="flex-1 uh-global-card-glass uh-shadow-xs border !py-2.5 !rounded-xl !text-3xs !bg-primary text-gray-900"
            @click="handleYearPickerConfirm"
          >
            确定
          </uh-button>
        </view>
      </view>
    </uh-glass-popup>
  </view>
</template>

<style scoped lang="scss">
:deep(.uh-picker-view) {
  .wd-picker-view__mask {
    background: transparent !important;
  }

  .wd-picker-view__roller {
    border-radius: 16rpx !important;
  }
}
</style>
