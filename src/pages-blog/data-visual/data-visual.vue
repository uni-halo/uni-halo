<script lang="ts" setup>
/**
 * 数据看板页(源自旧项目 pagesA/data-visual,新建复刻)
 * 标签统计/分类统计(环形图)、文章发布趋势(热度图)、评论活跃用户(柱状图)、热门文章 Top10(柱状图)
 */
import { ref } from 'vue'
import { onPullDownRefresh } from '@dcloudio/uni-app'
import { getChartData } from '@/api/uni-halo'
import { usePluginAvailable } from '@/utils/plugin'
import type { IDataStatistics } from '@/api/uni-halo'

definePage({
  style: {
    navigationBarTitleText: '数据看板',
    enablePullDownRefresh: true,
  },
})

/** 依赖插件(plugin-data-statistics) */
const uniHaloPluginId = 'plugin-data-statistics'
const uniHaloPluginAvailable = ref(true)

/* ---------------- 状态 ---------------- */
const loading = ref<'loading' | 'success' | 'error'>('loading')
const statistics = ref<IDataStatistics>({
  tags: [],
  categories: [],
  articles: [],
  comments: [],
  top10Articles: [],
})

/* ---------------- 图表配置 ---------------- */
const chartColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#ea7ccc', '#0EA5E9']

/** 标签统计(环形图) */
const tagChart = ref({
  isExpand: true,
  type: 'ring',
  data: { series: [{ data: [] as { name: string, value: number }[] }] },
})

/** 分类统计(柱状图) */
const categoryChart = ref({
  isExpand: true,
  type: 'column',
  data: { categories: [] as string[], series: [{ name: '分类', data: [] as number[] }] },
})

/** 文章发布趋势(热度图) */
const trandArticleChart = ref({
  isExpand: true,
  type: 'hotmap',
  data: [] as { date: string, count: number }[],
})

/** 评论活跃用户(柱状图) */
const userCommentsChart = ref({
  isExpand: true,
  type: 'column',
  data: { categories: [] as string[], series: [{ name: '评论', data: [] as number[] }] },
})

/** 热门文章 Top10(柱状图) */
const top10ArticlesChart = ref({
  isExpand: true,
  type: 'column',
  data: { categories: [] as string[], series: [{ name: '访问量', data: [] as number[] }] },
})

/* ---------------- 数据处理 ---------------- */
function handleTagChart() {
  const data = [...statistics.value.tags].sort((a, b) => b.count - a.count)
  tagChart.value.data = {
    series: [
      {
        data: data.map(item => ({ name: item.name, value: item.count })),
      },
    ],
  }
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
    count: item.count,
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
  uni.showLoading({ mask: true, title: '加载中...' })
  loading.value = 'loading'
  try {
    const res = await getChartData()
    statistics.value = res.data
    handleTagChart()
    handleCategoriesChart()
    handleTrendArticlesChart()
    handleUserCommentsChart()
    handleTop10ArticlesChart()
    loading.value = 'success'
  }
  catch (err) {
    console.error(err)
    loading.value = 'error'
  }
  finally {
    setTimeout(() => {
      uni.hideLoading()
      uni.stopPullDownRefresh()
    }, 100)
  }
}

/* ---------------- 生命周期 ---------------- */
async function init() {
  uniHaloPluginAvailable.value = await usePluginAvailable(uniHaloPluginId)
  if (!uniHaloPluginAvailable.value) {
    uni.stopPullDownRefresh()
    return
  }
  handleGetData()
}

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
  <view class="app-page box-border min-h-screen w-screen p-6 text-[#353437]" style="background-color: #fafafd;">
    <uh-plugin-unavailable
      v-if="!uniHaloPluginAvailable"
      :plugin-id="uniHaloPluginId"
      error-text="阿偶，检测到当前插件没有安装或者启用，无法使用功能哦，请联系管理员"
      @on-refresh="handleGetData"
    />
    <template v-else>
      <!-- 加载/错误占位 -->
      <view v-if="loading !== 'success'">
        <uh-data-loading :loading-status="loading" @refresh="handleGetData" />
      </view>

      <!-- 内容区域 -->
      <view v-else class="content flex flex-col gap-6">
        <!-- 标签统计 -->
        <view class="card box-border rounded-xl bg-white/95 p-6" style="box-shadow: 0 0 12rpx rgb(226 232 240 / 35%);">
          <view class="card-head flex items-center justify-between" @click="tagChart.isExpand = !tagChart.isExpand">
            <view class="card-head-title flex items-baseline gap-2">
              <text class="card-head-text relative box-border pl-6 text-[30rpx] font-bold">标签统计</text>
              <text class="card-head-subtext text-[26rpx] text-[#6b7280] font-normal">（全部标签的文章数量占比）</text>
            </view>
            <wd-icon :name="tagChart.isExpand ? 'arrow-up' : 'arrow-down'" size="16px" color="#909399" />
          </view>
          <view v-show="tagChart.isExpand" class="card-body mt-6 box-border w-full overflow-hidden border-2 border-[#e9eef3] rounded-xl bg-[#fcfdfe] p-3">
            <qiun-data-charts
              type="ring"
              :chart-data="tagChart.data"
              :opts="{ color: chartColors, padding: [5, 5, 5, 5], dataLabel: false, legend: { show: false }, extra: { ring: { ringWidth: 36, offsetAngle: -90, border: true, borderWidth: 1, borderColor: '#FFFFFF' } } }"
            />
          </view>
        </view>

        <!-- 分类统计 -->
        <view class="card box-border rounded-xl bg-white/95 p-6" style="box-shadow: 0 0 12rpx rgb(226 232 240 / 35%);">
          <view class="card-head flex items-center justify-between" @click="categoryChart.isExpand = !categoryChart.isExpand">
            <view class="card-head-title flex items-baseline gap-2">
              <text class="card-head-text relative box-border pl-6 text-[30rpx] font-bold">分类统计</text>
              <text class="card-head-subtext text-[26rpx] text-[#6b7280] font-normal">（全部分类的文章数量占比）</text>
            </view>
            <wd-icon :name="categoryChart.isExpand ? 'arrow-up' : 'arrow-down'" size="16px" color="#909399" />
          </view>
          <view v-show="categoryChart.isExpand" class="card-body mt-6 box-border w-full overflow-hidden border-2 border-[#e9eef3] rounded-xl bg-[#fcfdfe] p-3">
            <qiun-data-charts
              type="column"
              :chart-data="categoryChart.data"
              :opts="{ color: chartColors, padding: [20, 15, 10, 15], legend: { show: false }, xAxis: { disableGrid: true, fontSize: 10, itemCount: 6 }, yAxis: { gridType: 'dash', dashLength: 4 }, extra: { column: { type: 'group', width: 22, linearType: 'custom', seriesGap: 5, barBorderCircle: true, customColor: ['#F59E0B'] } } }"
            />
          </view>
        </view>

        <!-- 文章发布趋势 -->
        <view class="card box-border rounded-xl bg-white/95 p-6" style="box-shadow: 0 0 12rpx rgb(226 232 240 / 35%);">
          <view class="card-head flex items-center justify-between" @click="trandArticleChart.isExpand = !trandArticleChart.isExpand">
            <view class="card-head-title flex items-baseline gap-2">
              <text class="card-head-text relative box-border pl-6 text-[30rpx] font-bold">文章发布趋势</text>
              <text class="card-head-subtext text-[26rpx] text-[#6b7280] font-normal">（按日期统计文章发布数量）</text>
            </view>
            <wd-icon :name="trandArticleChart.isExpand ? 'arrow-up' : 'arrow-down'" size="16px" color="#909399" />
          </view>
          <view v-show="trandArticleChart.isExpand" class="card-body mt-6 box-border w-full overflow-hidden border-2 border-[#e9eef3] rounded-xl bg-[#fcfdfe] p-3">
            <uh-heatmap :chart-data="trandArticleChart.data" />
          </view>
        </view>

        <!-- 评论活跃用户 -->
        <view class="card box-border rounded-xl bg-white/95 p-6" style="box-shadow: 0 0 12rpx rgb(226 232 240 / 35%);">
          <view class="card-head flex items-center justify-between" @click="userCommentsChart.isExpand = !userCommentsChart.isExpand">
            <view class="card-head-title flex items-baseline gap-2">
              <text class="card-head-text relative box-border pl-6 text-[30rpx] font-bold">评论活跃用户</text>
              <text class="card-head-subtext text-[26rpx] text-[#6b7280] font-normal">（按评论作者统计评论数量）</text>
            </view>
            <wd-icon :name="userCommentsChart.isExpand ? 'arrow-up' : 'arrow-down'" size="16px" color="#909399" />
          </view>
          <view v-show="userCommentsChart.isExpand" class="card-body mt-6 box-border w-full overflow-hidden border-2 border-[#e9eef3] rounded-xl bg-[#fcfdfe] p-3">
            <qiun-data-charts
              type="column"
              :chart-data="userCommentsChart.data"
              :opts="{ color: chartColors, padding: [20, 15, 10, 10], legend: { show: false }, xAxis: { disableGrid: true, fontSize: 10, itemCount: 5 }, yAxis: { gridType: 'dash', dashLength: 4 }, extra: { column: { type: 'group', width: 22, linearType: 'custom', seriesGap: 5, barBorderCircle: true, customColor: ['#F59E0B'] } } }"
            />
          </view>
        </view>

        <!-- 热门文章 Top10 -->
        <view class="card box-border rounded-xl bg-white/95 p-6" style="box-shadow: 0 0 12rpx rgb(226 232 240 / 35%);">
          <view class="card-head">
            <view class="card-head-title flex items-baseline gap-2">
              <text class="card-head-text relative box-border pl-6 text-[30rpx] font-bold">热门文章前10</text>
              <text class="card-head-subtext text-[26rpx] text-[#6b7280] font-normal">（按访问量排序的热门文章）</text>
            </view>
          </view>
          <view class="card-body mt-6 box-border w-full overflow-hidden border-2 border-[#e9eef3] rounded-xl bg-[#fcfdfe] p-3">
            <qiun-data-charts
              type="column"
              :chart-data="top10ArticlesChart.data"
              :opts="{ color: chartColors, padding: [20, 15, 10, 10], legend: { show: false }, xAxis: { disableGrid: true, fontSize: 10, itemCount: 5 }, yAxis: { gridType: 'dash', dashLength: 4 }, extra: { column: { type: 'group', width: 22, linearType: 'custom', seriesGap: 5, barBorderCircle: true, customColor: ['#F59E0B'] } } }"
            />
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.card-head-text {
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 8rpx;
    height: 70%;
    background-color: #03a9f4;
    border-radius: 12rpx;
  }
}
</style>
