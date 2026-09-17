<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { storeToRefs } from 'pinia'
	import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
	import { getPostList } from '@/api/halo'
	import { useAppConfigStore } from '@/store/appConfig'
	import { useSettingStore } from '@/store/setting'
	import { checkAvatarUrl, checkImageUrl } from '@/utils/url'
	import { sleep } from '@/utils/common'
	import { t } from '@/locale'
	import { useMaintenanceIntercept } from '@/hooks/useMaintenanceIntercept'
	import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
	import type { IPost } from '@/api/types/halo'

	definePage({
		style: {
			enablePullDownRefresh: true,
			navigationStyle: 'custom',
		},
	})

	const appConfigStore = useAppConfigStore()
	const { configs: haloConfigs, auditData, auditModeEnabled: calcAuditModeEnabled } = storeToRefs(appConfigStore)
	const { settings: globalAppSettings } = storeToRefs(useSettingStore())
	const { interceptOrContinue } = useMaintenanceIntercept()
	/** 是否已被拦截(配置已带维护键时同步置位,避免首载闪跳) */
	const intercepted = ref(!!haloConfigs.value.maintenance)

	/* ---------------- 状态 ---------------- */
	const { loadingStatus, loadMoreStatus, updateLoadingStatus, updateLoadMoreStatus, resetLoadMoreStatus } = useDataLoadingStatus()
	const articleList = ref<IPost[]>([])

	const queryParams = ref({
		size: 10,
		page: 1,
		sort: ['spec.pinned,desc', 'spec.publishTime,desc'],
	})

	/* ---------------- 最新推荐模式(默认/置顶/最新/最旧) ---------------- */
	const recommendTabs = [
		{ label: '默认', value: 'default' },
		{ label: '置顶', value: 'pinned' },
		{ label: '最新', value: 'latest' },
		{ label: '最旧', value: 'oldest' },
	]

	const recommendMode = ref<'default' | 'pinned' | 'latest' | 'oldest'>('default')

	/** 各模式对应排序参数(默认 = 置顶优先 + 发布时间倒序) */
	const recommendSortMap : Record<string, string[]> = {
		default: ['spec.pinned,desc', 'spec.publishTime,desc'],
		pinned: ['spec.pinned,desc'],
		latest: ['spec.publishTime,desc'],
		oldest: ['spec.publishTime,asc'],
	}

	/** 切换推荐模式:重置分页并重新查询 */
	function handleRecommendModeChange(mode : 'default' | 'pinned' | 'latest' | 'oldest') {
		if (recommendMode.value === mode)
			return
		recommendMode.value = mode
		resetLoadMoreStatus()
		articleList.value = []
		queryParams.value.page = 1
		queryParams.value.sort = recommendSortMap[mode]
		handleGetArticleList()
	}

	/* ---------------- 计算属性 ---------------- */
	const appInfo = computed(() => {
		const appInfoData = haloConfigs.value.featureConfig?.profile?.appInfo
		return {
			name: appInfoData?.name || 'uni-halo',
			logo: checkImageUrl(appInfoData?.logo),
		}
	})

	const bloggerInfo = computed(() => {
		const blogger = haloConfigs.value.featureConfig?.profile?.blogger
		return {
			nickname: blogger?.nickname || '',
			avatar: checkAvatarUrl(blogger?.avatar),
		}
	})

	/** 首页列表布局(偏好设置驱动:single=单列 / double=双列) */
	const homeListLayout = computed(() => globalAppSettings.value.homeListLayout)

	/* ---------------- 数据加载 ---------------- */
	async function handleQuery() {
		handleGetArticleList()
	}

	/** 文章列表 */
	async function handleGetArticleList() {
		if (calcAuditModeEnabled.value) {
			// 审核模式:真实文章按 audit-data posts 过滤(数组顺序即展示顺序),一次拉取不分页
			resetLoadMoreStatus()
			const auditPostNames = appConfigStore.auditNamesOf('posts')
			try {
				const res = await getPostList({ page: 1, size: 0, sort: ['spec.publishTime,desc'] })
				const filtered = res.data.items.filter(item => auditPostNames.includes(item.metadata.name))
				// 按审核配置顺序展示(数组顺序即展示顺序)
				const orderMap = new Map(auditPostNames.map((name, index) => [name, index]))
				filtered.sort((a, b) => (orderMap.get(a.metadata.name) ?? 999) - (orderMap.get(b.metadata.name) ?? 999))
				articleList.value = filtered.map((item) => {
					item.owner.avatar = checkAvatarUrl(item.owner.avatar)
					return item
				})
				updateLoadingStatus(articleList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
				updateLoadMoreStatus({
					active: false,
					status: 'noMore',
					hasNext: false,
				})
			}
			catch (err) {
				console.error('获取审核文章失败', err)
				updateLoadingStatus(DataLoadingStatusEnum.Error)
				updateLoadMoreStatus({
					active: false,
					status: 'error',
				})
			}
			finally {
				uni.hideLoading()
				uni.stopPullDownRefresh()
			}
			return
		}

		if (!loadMoreStatus.value.active) {
			updateLoadingStatus(DataLoadingStatusEnum.Loading)
		}

		try {
			const res = await getPostList({ ...toRaw(queryParams.value) })
			articleList.value = (loadMoreStatus.value.active
				? articleList.value.concat(res.data.items)
				: res.data.items).map((item) => {
					item.owner.avatar = checkAvatarUrl(item.owner.avatar)
					return item
				})
			if (!loadMoreStatus.value.active) {
				await sleep(600)
				updateLoadingStatus(articleList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
			}
			updateLoadMoreStatus({
				active: false,
				status: res.data.hasNext ? 'loadMore' : 'noMore',
				hasNext: res.data.hasNext,
			})
		}
		catch (err) {
			console.error('获取文章失败', err)
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
			uni.hideLoading()
			uni.stopPullDownRefresh()
		}
	}

	/* ---------------- 跳转 ---------------- */

	function handleToArticles() {
		uni.navigateTo({ url: '/pages-blog/articles/articles' })
	}

	function handleOnLogoToPage() {
		uni.switchTab({ url: '/pages/tabbar/about/about' })
	}

	function init() {
		if (!intercepted.value) {
			handleQuery()
		}
	}
	init()

	/* ---------------- 生命周期 ---------------- */

	// 维护检查
	onShow(async () => {
		intercepted.value = await interceptOrContinue()
		console.log('拦截状态', intercepted.value)
	})

	onPullDownRefresh(() => {
		resetLoadMoreStatus()
		queryParams.value.page = 1
		handleQuery()
	})

	onReachBottom(() => {
		// 审核模式:一次拉取不分页,直接提示到底
		if (calcAuditModeEnabled.value) {
			uni.showToast({ icon: 'none', title: t('common.noMoreData') })
			return
		}
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
			handleGetArticleList()
		}
	})
</script>

<template>
	<view class="min-h-screen w-screen flex flex-col bg-page">
		<!-- 轮播 -->
		<uh-home-banner />

		<!-- 公告 -->
		<uh-home-notify />

		<!-- 快捷导航 -->
		<uh-home-quick-nav />

		<!-- 精选分类 -->
		<uh-home-category />

		<!-- 最新文章 -->
		<view class="mb-4 box-border px-3">
			<uh-section-title>
				最新推荐
				<template #right>
					<view class="flex items-center gap-2">
						<view class="uh-global-card-glass uh-shadow-xs flex items-center border rounded-lg p-0.5">
							<view v-for="tab in recommendTabs" :key="tab.value" class="rounded-md px-2 py-0.5 text-10px"
								:class="recommendMode === tab.value ? 'bg-secondary text-gray-900' : 'text-gray-500'"
								@click="handleRecommendModeChange(tab.value as 'default' | 'pinned' | 'latest' | 'oldest')">
								{{ tab.label }}
							</view>
						</view>
						<view
							class="uh-global-card-glass uh-shadow-xs border flex items-center justify-center rounded-md p-1 text-gray-400"
							@click="handleToArticles()">
							<wd-icon name="arrow-right" size="14px" />
						</view>
					</view>
				</template>
			</uh-section-title>
		</view>

		<uh-data-loading v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus"
			min-height="36vh" @refresh="handleQuery" />

		<block v-else>
			<view class="box-border p-3 pt-0"
				:class="homeListLayout === 'double' ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-y-3'">
				<uh-article-card v-for="(article, index) in articleList" :key="index" from="home" :article="article"
					:variant="homeListLayout === 'double' ? 'grid' : 'list'" :audit-mode="calcAuditModeEnabled" />
			</view>
			<uh-data-loadmore :status="loadMoreStatus.status" :text="loadMoreStatus.text" />
		</block>
	</view>

	<uh-notify-dialog />
</template>