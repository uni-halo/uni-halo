<script lang="ts" setup>
	import { ref } from 'vue'
	import { onPageScroll, onPullDownRefresh } from '@dcloudio/uni-app'
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
		data: { series: [{ data: [] as { name : string, value : number }[] }] },
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

	/** 文章发布趋势(热度图) */
	const trandArticleChart = ref({
		isExpand: true,
		type: 'hotmap',
		data: [] as { date : string, count : number }[],
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
	/** 环形图最大展示标签数(标签过多时扇区过密,占比难读) */
	const TAG_CHART_TOP_N = 8

	function handleTagChart() {
		const data = [...statistics.value.tags].sort((a, b) => b.count - a.count).slice(0, TAG_CHART_TOP_N)
		tagChart.value.data = {
			series: [
				{
					data: data.map(item => ({ name: item.name, value: item.count })),
				},
			],
		}
		// 中间文案:文章总数(articles 按日 articleTotal 求和,避免多标签文章重复计数)
		const total = statistics.value.articles.reduce((sum, item) => sum + item.articleTotal, 0)
		tagChart.value.title = { name: '文章总数', fontSize: 13, color: '#909399' }
		tagChart.value.subtitle = { name: `${total} 篇`, fontSize: 24, color: themeColor }
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

	onPageScroll((option : Page.PageScrollOption) => {
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
	<view class="bg-page box-border min-h-screen w-screen p-3">
		<!-- 自定义导航 -->
		<uh-navbar :scroll-y="scrollY" :default-title="pageTitle" title-color="text-gray-900" />

		<uh-plugin-unavailable v-if="!uniHaloPluginAvailable" :plugin-id="pluginId" :error-text="tips"
			:checking="checking" @on-refresh="handlePluginRefresh" custom-class="h-[70vh]"/>
			
		<template v-else>
			<uh-data-loading v-if="loadingStatus !== 'success'" :loading-status="loadingStatus" empty-text="暂无统计数据"
				min-height="75vh" @refresh="handleGetData" />

			<!-- 内容区域 -->
			<view v-else class="content flex flex-col gap-3">
				<!-- 标签统计 -->
				<view class="uh-global-card-glass uh-shadow-xs box-border rounded-xl p-4">
					<uh-section-title>
						标签统计
						<template #right>
							<view class="flex items-center gap-x-2">
								<text class="text-xs text-gray-500">（全部标签的文章数量占比）</text>
								<wd-icon :name="tagChart.isExpand ? 'up' : 'down'" size="16px" color="#909399"
									@click="tagChart.isExpand = !tagChart.isExpand" />
							</view>
						</template>
					</uh-section-title>
					<view v-show="tagChart.isExpand" class="box-border w-full mt-3">
						<qiun-data-charts type="ring" :chart-data="tagChart.data"
							:opts="{ color: chartColors, padding: [5, 5, 5, 5], dataLabel: false, legend: { show: false }, title: tagChart.title, subtitle: tagChart.subtitle, extra: { ring: { ringWidth: 36, offsetAngle: -90, border: true, borderWidth: 1, borderColor: '#FFFFFF' } } }" />
					</view>
				</view>

				<!-- 分类统计 -->
				<view class="uh-global-card-glass uh-shadow-xs box-border rounded-xl p-4">
					<uh-section-title>
						分类统计
						<template #right>
							<view class="flex items-center gap-x-2">
								<text class="text-xs text-gray-500">（全部分类的文章数量占比）</text>
								<wd-icon :name="categoryChart.isExpand ? 'up' : 'down'" size="16px" color="#909399"
									@click="categoryChart.isExpand = !categoryChart.isExpand" />
							</view>
						</template>
					</uh-section-title>
					<view v-show="categoryChart.isExpand" class="box-border w-full mt-3">
						<qiun-data-charts type="column" :chart-data="categoryChart.data"
							:opts="{ color: chartColors, padding: [20, 15, 10, 15], legend: { show: false }, xAxis: { disableGrid: true, fontSize: 10, itemCount: 6 }, yAxis: { gridType: 'dash', dashLength: 4 }, extra: { column: { type: 'group', width: 22, linearType: 'custom', seriesGap: 5, barBorderCircle: true, customColor: [themeColor] } } }" />
					</view>
				</view>

				<!-- 文章发布趋势 -->
				<view class="uh-global-card-glass uh-shadow-xs box-border rounded-xl p-4">
					<uh-section-title>
						文章发布趋势
						<template #right>
							<view class="flex items-center gap-x-2">
								<text class="text-xs text-gray-500">（按日期统计文章发布数量）</text>
								<wd-icon :name="trandArticleChart.isExpand ? 'up' : 'down'" size="16px" color="#909399"
									@click="trandArticleChart.isExpand = !trandArticleChart.isExpand" />
							</view>
						</template>
					</uh-section-title>
					<view v-show="trandArticleChart.isExpand" class="box-border w-full mt-3">
						<uh-heatmap :chart-data="trandArticleChart.data" />
					</view>
				</view>

				<!-- 评论活跃用户 -->
				<view class="uh-global-card-glass uh-shadow-xs box-border rounded-xl p-4">
					<uh-section-title>
						评论活跃用户
						<template #right>
							<view class="flex items-center gap-x-2">
								<text class="text-xs text-gray-500">（按评论作者统计评论数量）</text>
								<wd-icon :name="userCommentsChart.isExpand ? 'up' : 'down'" size="16px" color="#909399"
									@click="userCommentsChart.isExpand = !userCommentsChart.isExpand" />
							</view>
						</template>
					</uh-section-title>
					<view v-show="userCommentsChart.isExpand" class="box-border w-full mt-3">
						<qiun-data-charts type="column" :chart-data="userCommentsChart.data"
							:opts="{ color: chartColors, padding: [20, 15, 10, 10], legend: { show: false }, xAxis: { disableGrid: true, fontSize: 10, itemCount: 5 }, yAxis: { gridType: 'dash', dashLength: 4 }, extra: { column: { type: 'group', width: 22, linearType: 'custom', seriesGap: 5, barBorderCircle: true, customColor: [themeColor] } } }" />
					</view>
				</view>

				<!-- 热门文章 Top10 -->
				<view class="uh-global-card-glass uh-shadow-xs box-border rounded-xl p-4">
					<uh-section-title>
						热门文章前10
						<template #right>
							<view class="flex items-center gap-x-2">
								<text class="text-xs text-gray-500">（按访问量排序的热门文章）</text>
								<wd-icon :name="top10ArticlesChart.isExpand ? 'up' : 'down'" size="16px" color="#909399"
									@click="top10ArticlesChart.isExpand = !top10ArticlesChart.isExpand" />
							</view>
						</template>
					</uh-section-title>
					<view v-show="top10ArticlesChart.isExpand" class="box-border w-full mt-3">
						<qiun-data-charts type="column" :chart-data="top10ArticlesChart.data"
							:opts="{ color: chartColors, padding: [20, 15, 10, 10], legend: { show: false }, xAxis: { disableGrid: true, fontSize: 10, itemCount: 5 }, yAxis: { gridType: 'dash', dashLength: 4 }, extra: { column: { type: 'group', width: 22, linearType: 'custom', seriesGap: 5, barBorderCircle: true, customColor: [themeColor] } } }" />
					</view>
				</view>
			</view>
		</template>
	</view>
</template>