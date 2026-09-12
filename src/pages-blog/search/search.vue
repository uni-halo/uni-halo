<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad, onPageScroll, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
	import { getPostListByKeyword } from '@/api/halo'
	import { sleep } from '@/utils/common'
	import { useAppConfigStore } from '@/store/appConfig'
	import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
	import { usePageScroll } from '@/hooks/usePageScroll'
	import { useCustomNavbarPlaceholder } from '@/hooks/useCustomNavbarPlaceholder'
	import { NeedPluginIds } from '@/hooks/usePluginAvailable'
	import { markdownConfig } from '@/config/markdown'
	import { debounce } from '@/utils/debounce'

	definePage({
		style: {
			navigationBarTitleText: '内容搜索',
			enablePullDownRefresh: true,
			navigationStyle: 'custom',
		},
	})

	const { height: offsetTop } = useCustomNavbarPlaceholder()
	const { scrollY, updatePageScrollValue } = usePageScroll()
	const appConfigStore = useAppConfigStore()
	const calcAuditModeEnabled = computed(() => appConfigStore.auditModeEnabled)

	const { pluginId, checking, tips, available: uniHaloPluginAvailable, check: checkPluginAvailable } = usePluginAvailable({
		pluginId: NeedPluginIds.PluginSearchWidget,
		tips: '啊偶，功能正在维护中...',
		callback: (isAvailable) => {
			if (!isAvailable) { return }
			uni.pageScrollTo({
				scrollTop: 0,
				duration: 0,
			})
			handleOnSearch()
		}
	})

	async function handlePluginRefresh() {
		if (await checkPluginAvailable()) { handleOnSearch() }
	}

	/* ---------------- 状态 ---------------- */
	const { loadingStatus, loadMoreStatus, updateLoadingStatus, updateLoadMoreStatus, resetLoadMoreStatus } = useDataLoadingStatus()
	const queryParams = ref({
		keyword: '',
		page: 1,
		size: 10,
		highlightPreTag: '',
		highlightPostTag: '',
	})
	const dataList = ref<{
		metadataName ?: string
		type ?: string
		title ?: string
		description ?: string
		content ?: string
		updateTimestamp ?: string
	}[]>([])

	/* ---------------- 动画 ---------------- */
	/** 预计算列表项入场延迟(每 10 项重置一轮,每项递增 50ms);必须在渲染外算好,渲染中修改响应式状态会导致递归更新 */
	const calcAniDelays = computed(() => {
		let wait = 0
		return dataList.value.map((_, index) => {
			wait = (index + 1) % 10 === 0 ? 1 : wait + 1
			return wait * 50
		})
	})

	/** 空态文案(无关键词提示输入;有关键词提示未搜到) */
	const emptyText = computed(() =>
		queryParams.value.keyword ? `未搜到 ${queryParams.value.keyword} 相关内容` : '请输入关键词搜索',
	)

	/* ---------------- 搜索 ---------------- */
	async function handleGetData() {
		if (calcAuditModeEnabled.value)
			{return}
		if (!loadMoreStatus.value.active) {
			updateLoadingStatus(DataLoadingStatusEnum.Loading)
		}
		try {
			const res = await getPostListByKeyword({ ...queryParams.value })
			const hits = (res.data as unknown as { hits ?: typeof dataList.value }).hits || []
			dataList.value = loadMoreStatus.value.active
				? dataList.value.concat(hits)
				: hits
			if (!loadMoreStatus.value.active) {
				await sleep(600)
				updateLoadingStatus(
					dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success,
				)
			}
			updateLoadMoreStatus({
				active: false,
				status: res.data.hasNext ? 'loadMore' : 'noMore',
				hasNext: res.data.hasNext,
			})
		}
		catch (err) {
			console.error(err)
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

	function handleOnSearch() {
		if (!queryParams.value.keyword) {
			dataList.value = []
			resetLoadMoreStatus()
			updateLoadingStatus(DataLoadingStatusEnum.Empty)
		}
		else {
			resetLoadMoreStatus()
			queryParams.value.page = 1
			handleGetData()
		}
	}

	/** 实时搜索:输入防抖 400ms 后触发 */
	const handleOnInput = debounce(() => {
		handleOnSearch()
	}, 400)

	function isArticle(item : { type ?: string }) : boolean {
		return item.type === 'post.content.halo.run'
	}

	function handleToDetail(item : { metadataName ?: string, type ?: string }) {
		if (calcAuditModeEnabled.value) { return }
		if (isArticle(item)) {
			uni.navigateTo({
				url: `/pages-blog/article-detail/article-detail?name=${item.metadataName}`,
				animationType: 'slide-in-right',
			})
		}
		else {
			uni.navigateTo({
				url: `/pages-blog/moment-detail/moment-detail?name=${item.metadataName}`,
				animationType: 'slide-in-right',
			})
		}
	}

	function handleResetSearch() {
		queryParams.value.keyword = '';
		handleOnSearch()
	}

	/* ---------------- 生命周期 ---------------- */
	onPageScroll((option : Page.PageScrollOption) => {
		updatePageScrollValue(option.scrollTop)
	})

	onLoad(async () => {
		await checkPluginAvailable()
		if (!uniHaloPluginAvailable.value) {
			uni.stopPullDownRefresh()
			return
		}
		// 关键词非空(如带参进入)时自动搜索,否则展示空态
		if (!queryParams.value.keyword) {
			updateLoadingStatus(DataLoadingStatusEnum.Empty)
		}
		else {
			handleGetData()
		}
	})

	onPullDownRefresh(() => {
		if (!uniHaloPluginAvailable.value) {
			uni.stopPullDownRefresh()
			return
		}
		handleOnSearch()
	})

	onReachBottom(() => {
		if (!uniHaloPluginAvailable.value)
			return
		if (calcAuditModeEnabled.value)
			return
		// 无关键词不触发分页
		if (!queryParams.value.keyword)
			return
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
			handleGetData()
		}
	})
</script>

<template>
	<view class="box-border min-h-screen w-screen flex flex-col bg-page pb-6">
		<!-- 自定义导航 -->
		<uh-navbar :scroll-y="scrollY" default-title="内容搜索" title-color="text-gray-900" />

		<uh-plugin-unavailable v-if="!uniHaloPluginAvailable" custom-class="min-h-[80vh]" :plugin-id="pluginId" :error-text="tips"
			:checking="checking" @on-refresh="handlePluginRefresh" />

		<template v-else>
			<!-- 顶部搜索框(玻璃胶囊,与 gallery 吸顶胶囊同视觉) -->
			<wd-sticky :offset-top="offsetTop">
				<view class="w-screen box-border px-3 py-2">
					<view class="box-border uh-global-card-glass h-9 flex items-center gap-3 rounded-full border pl-3 pr-3">
						<wd-icon name="search" size="16px" />
						<input v-model="queryParams.keyword" class="flex-1 text-sm text-gray-900"
							placeholder="哈喽，想看些什么呢~" placeholder-class="text-gray-400" confirm-type="search"
							@input="handleOnInput" @confirm="handleOnSearch">
						<view v-if="queryParams.keyword" class="clear-btn flex items-center"
							@click="handleResetSearch()">
							<wd-icon name="close" size="28rpx" />
						</view>
					</view>
				</view>
			</wd-sticky>

			<!-- 加载/错误/空占位(状态机) -->
			<uh-data-loading v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus"
				min-height="70vh" error-text="搜索异常" :empty-text="emptyText" @refresh="handleOnSearch" />

			<!-- 内容区域(成功态) -->
			<view v-else class="box-border pt-2 px-3 flex flex-col gap-y-3">
				<block v-if="dataList.length !== 0">
					<view v-for="(item, index) in dataList" :key="index"
						class="uh-global-card-glass uh-shadow-xs border flex flex-col overflow-hidden rounded-2xl p-4"
						:style="{ animationDelay: `${calcAniDelays[index]}ms` }" @click="handleToDetail(item)">
						<view class="card-head mb-3 flex items-center">
							<view class="type-tag mr-3 shrink-0 rounded-md px-1.5 py-1 text-xs leading-none"
								:class="isArticle(item) ? 'bg-secondary text-gray-900' : 'bg-blue-500 text-gray-50'">
								{{ isArticle(item) ? '文章' : '瞬间' }}
							</view>
							<text
								class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-gray-900 font-bold">{{ item.title }}</text>
						</view>
						<mp-html class="evan-markdown" lazy-load :domain="markdownConfig.domain ?? ''"
							:loading-img="markdownConfig.loadingGif" scroll-table selectable
							:tag-style="markdownConfig.tagStyle" :container-style="markdownConfig.containStyle"
							:content="item.description || item.content || ''" :markdown="true" :show-line-number="true"
							:show-language-name="true" copy-by-long-press />
					</view>
				</block>
				<uh-data-loadmore :status="loadMoreStatus.status" :text="loadMoreStatus.text" />
			</view>
		</template>
	</view>
</template>

<style scoped lang="scss">
	.fade-up {
		animation: fade-up 0.4s ease-out both;

		@keyframes fade-up {
			from {
				opacity: 0;
				transform: translateY(24rpx);
			}

			to {
				opacity: 1;
				transform: translateY(0);
			}
		}
	}
</style>