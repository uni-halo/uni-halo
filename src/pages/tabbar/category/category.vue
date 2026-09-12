<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onPageScroll, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
	import { getCategoryList } from '@/api/halo'
	import { useAppConfigStore } from '@/store/appConfig'
	import { checkThumbnailUrl } from '@/utils/url'
	import { sleep } from '@/utils/common'
	import { usePageScroll } from '@/hooks/usePageScroll'
	import { t } from '@/locale'
	import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
	import type { ICategory } from '@/api/types/halo'

	definePage({
		style: {
			navigationBarTitleText: '分类',
			navigationStyle: 'custom',
			enablePullDownRefresh: true,
			backgroundColor: '#f6f3ee',
		},
	})

	const { scrollY, updatePageScrollValue } = usePageScroll()
	
	const appConfigStore = useAppConfigStore()
	
	const haloConfigs = computed(() => appConfigStore.configs)
	const calcAuditModeEnabled = computed(() => appConfigStore.auditModeEnabled)

	const categoryConfig = computed(() => haloConfigs.value.pageConfig?.categoryConfig)

	/* ---------------- 状态 ---------------- */
	const { loadingStatus, loadMoreStatus, updateLoadingStatus, updateLoadMoreStatus, resetLoadingStatus, resetLoadMoreStatus } = useDataLoadingStatus()
	const queryParams = ref({
		size: 10,
		page: 1,
		fieldSelector: ['spec.hideFromList=false'],
	})
	const dataList = ref<ICategory[]>([])

	function handleResetInit() {
		dataList.value = []
		queryParams.value.page = 1
		resetLoadingStatus()
	}

	function handleInitPage() {
		handleResetInit()
		handleGetData()
	}

	/* ---------------- 数据加载 ---------------- */
	async function handleGetData() {
		if (!loadMoreStatus.value.active) {
			updateLoadingStatus(DataLoadingStatusEnum.Loading)
		}
		// 审核模式
		if (calcAuditModeEnabled.value) {
			resetLoadMoreStatus()
			const auditCategoryDetails = appConfigStore.auditData.categoryDetails || []
			try {
				dataList.value = auditCategoryDetails.map(item => ({
					metadata: { name: item.name },
					spec: {
						displayName: item.title || item.name,
						slug: '',
						cover: checkThumbnailUrl(item.cover, true),
						priority: item.priority,
					},
					postCount: item.postCount ?? 0,
				} as ICategory))
				await sleep(600)
				updateLoadingStatus(dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
				updateLoadMoreStatus({
					active: false,
					status: 'noMore',
					hasNext: false
				})
				uni.stopPullDownRefresh()
			}
			catch (err) {
				console.error(err)
				updateLoadingStatus(DataLoadingStatusEnum.Error)
			}
			return
		}

		try {
			const res = await getCategoryList({ ...queryParams.value })

			const tempItems = res.data.items.map(item => ({
				...item,
				postCount: item.postCount ?? 0,
				spec: { ...item.spec, cover: checkThumbnailUrl(item.spec.cover, true) },
			}))

			dataList.value = loadMoreStatus.value.active
				? dataList.value.concat(tempItems)
				: tempItems

			if (!loadMoreStatus.value.active) {
				await sleep(600)
				updateLoadingStatus(dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
			}

			updateLoadMoreStatus({
				active: false,
				status: res.data.hasNext ? 'loadMore' : 'noMore',
				hasNext: res.data.hasNext
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

	function handleToCategory(category : ICategory) {
		if (calcAuditModeEnabled.value) {
			return
		}
		uni.navigateTo({
			url: `/pages-blog/category-articles/category-articles?name=${category.metadata.name}&title=${category.spec.displayName}`,
		})
	}

	onMounted(() => {
		handleInitPage()
	})

	onPageScroll((option : Page.PageScrollOption) => {
		updatePageScrollValue(option.scrollTop)
	})

	onPullDownRefresh(() => {
		handleResetInit()
		handleGetData()
	})

	onReachBottom(() => {
		// 如果正在请求，需要阻止继续发起请求
		if (loadMoreStatus.value.active && loadMoreStatus.value.loading) {
			return;
		}
		// 有更多数据时，继续加载数据
		if (loadMoreStatus.value.hasNext) {
			queryParams.value.page += 1
			updateLoadMoreStatus({
				active: true,
				status: 'loading'
			})
			handleGetData()
		} 
	})
</script>

<template>
	<view class="box-border min-h-screen w-screen flex flex-col bg-page">
		<uh-navbar :scroll-y="scrollY" :use-back="false" default-title="分类" title-color="text-gray-900"></uh-navbar>

		<uh-data-loading v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus" />

		<block v-else>
			<view class="box-border grid grid-cols-2 gap-2.5 p-3 pt-0">
				<view v-for="(item, index) in dataList" :key="index"
					class="uh-global-card-glass relative box-border w-full overflow-hidden rounded-xl"
					@click="handleToCategory(item)">
					<image v-if="item.spec.cover" class="block h-32 w-full" :src="item.spec.cover" mode="aspectFill" />
					<view
						class="absolute bottom-0 left-0 h-[140rpx] w-full from-black/0 to-black/30 bg-gradient-to-b" />
					<view class="absolute bottom-0 left-0 box-border w-full flex flex-col gap-1 p-2.5">
						<text class="truncate text-2xs text-white font-bold">
							{{ item.spec.displayName }}
						</text>
						<text class="text-xs text-white opacity-80">
							共 {{ item.postCount }} 篇文章
						</text>
					</view>
				</view>
			</view>
			<uh-data-loadmore :status="loadMoreStatus.status" :text="loadMoreStatus.text"></uh-data-loadmore>
		</block>
	</view>
</template>