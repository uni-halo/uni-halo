<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
	import { getCategoryList } from '@/api/halo'
	import { useAppConfigStore } from '@/store/appConfig'
	import { checkThumbnailUrl } from '@/utils/url'
	import { sleep } from '@/utils/common'
	import { t } from '@/locale'
	import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
	import type { ICategory } from '@/api/types/halo'

	definePage({
		style: {
			navigationBarTitleText: '分类',
			enablePullDownRefresh: true,
			backgroundColor: '#f6f3ee',
		},
	})

	const appConfigStore = useAppConfigStore()
	const haloConfigs = computed(() => appConfigStore.configs)
	const calcAuditModeEnabled = computed(() => appConfigStore.auditModeEnabled)

	const categoryConfig = computed(() => haloConfigs.value.pageConfig?.categoryConfig)

	/* ---------------- 状态 ---------------- */
	const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()
	const queryParams = ref({
		size: 20,
		page: 1,
		fieldSelector: ['spec.hideFromList=false'],
	})
	const hasNext = ref(false)
	const dataList = ref<ICategory[]>([])
	const isLoadMore = ref(false)
	const loadMoreText = ref(t('common.loading'))

	function handleResetInit() {
		dataList.value = []
		queryParams.value.page = 1
		hasNext.value = false
		isLoadMore.value = false
		loadMoreText.value = t('common.loading')
	}

	function handleInitPage() {
		handleResetInit()
		handleGetData()
	}

	/* ---------------- 数据加载 ---------------- */
	async function handleGetData() {
		updateLoadingStatus(DataLoadingStatusEnum.Loading)
		// 增加延迟，提升用户体验
		await sleep(800)
		// 审核模式
		if (calcAuditModeEnabled.value) {
			const auditCategoryNames = appConfigStore.auditData.spec?.categories || []
			try {
				const res = await getCategoryList({ page: 1, size: 99999 })
				const filtered = res.data.items
					.filter(item => auditCategoryNames.includes(item.metadata.name))
					.map(item => ({
						...item,
						postCount: item.postCount ?? 0,
						spec: { ...item.spec, cover: checkThumbnailUrl(item.spec.cover, true) },
					}))
				const orderMap = new Map(auditCategoryNames.map((name, index) => [name, index]))
				filtered.sort((a, b) => (orderMap.get(a.metadata.name) ?? 999) - (orderMap.get(b.metadata.name) ?? 999))
				dataList.value = filtered
				updateLoadingStatus(dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
				loadMoreText.value = t('common.noMore')
				uni.hideLoading()
				uni.stopPullDownRefresh()
			}
			catch (err) {
				console.error(err)
				updateLoadingStatus(DataLoadingStatusEnum.Error)
				loadMoreText.value = t('common.loadFailed')
			}
			return
		}

		if (!isLoadMore.value) {
			updateLoadingStatus(DataLoadingStatusEnum.Loading)
		}
		loadMoreText.value = t('common.loading')

		try {
			const res = await getCategoryList({ ...queryParams.value })

			loadMoreText.value = res.data.hasNext ? t('common.loadMore') : t('common.noMore')
			hasNext.value = res.data.hasNext

			const tempItems = res.data.items.map(item => ({
				...item,
				postCount: item.postCount ?? 0,
				spec: { ...item.spec, cover: checkThumbnailUrl(item.spec.cover, true) },
			}))

			dataList.value = isLoadMore.value
				? dataList.value.concat(tempItems)
				: tempItems
			updateLoadingStatus(dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
		}
		catch (err) {
			console.error(err)
			updateLoadingStatus(DataLoadingStatusEnum.Error)
			loadMoreText.value = t('common.loadFailed')
		}
		finally {
			setTimeout(() => {
				uni.hideLoading()
				uni.stopPullDownRefresh()
			}, 500)
		}
	}

	function handleToCategory(category : ICategory) {
		if (calcAuditModeEnabled.value) {
			return
		}
		uni.navigateTo({
			url: `/pages-blog/category-detail/category-detail?name=${category.metadata.name}&title=${category.spec.displayName}`,
		})
	}


	onMounted(() => {
		handleInitPage()
	})

	onPullDownRefresh(() => {
		handleResetInit()
		handleGetData()
	})

	onReachBottom(() => {
		if (calcAuditModeEnabled.value) {
			uni.showToast({ icon: 'none', title: t('common.noMoreData') })
			return
		}
		if (hasNext.value) {
			queryParams.value.page += 1
			isLoadMore.value = true
			handleGetData()
		}
		else {
			uni.showToast({ icon: 'none', title: t('common.noMoreData') })
		}
	})
</script>

<template>
	<view class="box-border min-h-screen w-screen flex flex-col bg-page p-3">
		<uh-data-loading v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus" />

		<block v-else>
			<view class="grid grid-cols-2 gap-2.5">
				<view v-for="(item, index) in dataList" :key="index"
					class="uh-global-card-glass relative box-border w-full overflow-hidden rounded-xl"
					@click="handleToCategory(item)">
					<image v-if="item.spec.cover" class="block h-32 w-full" :src="item.spec.cover" mode="aspectFill" />
					<view
						class="absolute bottom-0 left-0 h-[140rpx] w-full from-black/0 to-black/30 bg-gradient-to-b" />
					<view class="absolute bottom-0 left-0 box-border w-full flex flex-col gap-1 p-2.5">
						<text class="truncate text-sm text-white font-bold">
							{{ item.spec.displayName }}
						</text>
						<text class="text-xs text-white opacity-80">
							共 {{ item.postCount }} 篇文章
						</text>
					</view>
				</view>
			</view>
			<view class="w-full py-5 text-center text-xs text-gray-400">
				{{ loadMoreText }}
			</view>
		</block>
	</view>
</template>