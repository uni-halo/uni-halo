<script lang="ts" setup>
	import { computed, ref, watch } from 'vue'
	import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
	import { getPhotoGroupList, getPhotoListByGroupName } from '@/api/halo'
	import { useAppConfigStore } from '@/store/appConfig'
	import { checkImageUrl } from '@/utils/url'
	import { t } from '@/locale'
	import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
	import type { IPhoto, IPhotoGroup } from '@/api/types/halo'

	definePage({
		style: {
			navigationBarTitleText: '图库',
			navigationStyle: 'custom',
			enablePullDownRefresh: true,
		},
	})

	const appConfigStore = useAppConfigStore()
	const haloConfigs = computed(() => appConfigStore.configs)
	const calcAuditModeEnabled = computed(() => appConfigStore.auditModeEnabled)

	const galleryConfig = computed(() => haloConfigs.value.pageConfig?.galleryConfig)

	/** 依赖插件(PluginPhotos) */
	const { pluginId, checking, tips, available: uniHaloPluginAvailable, check: checkPluginAvailable } = usePluginAvailable({
		pluginId: 'PluginPhotos',
		tips: '很抱歉，功能正在维护中...',
		callback: (isAvailable) => {
			if (!isAvailable) { return }
			uni.pageScrollTo({
				scrollTop: 0,
				duration: 0,
			})
			handleGetCategory()
		}
	})

	/* ---------------- 状态 ---------------- */
	const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()
	const category = ref<{ activeIndex : number, list : IPhotoGroup[] }>({
		activeIndex: 0,
		list: [],
	})
	const queryParams = ref({ size: 10, page: 1, group: '' })
	const isLoadMore = ref(false)
	const loadMoreText = ref('')
	const hasNext = ref(false)
	const dataList = ref<IPhoto[]>([])
	const lock = ref(false)

	/* ---------------- 数据加载 ---------------- */
	async function handleGetCategory() {
		if (calcAuditModeEnabled.value) {
			// 审核模式:仅展示所选图库分组(galleryGroups)内的照片,未分组照片不展示
			const auditGroupNames = appConfigStore.auditData.spec?.galleryGroups || []
			try {
				const res = await getPhotoGroupList({ page: 1, size: 0 })
				const filtered = ((res.data as unknown as IPhotoGroup[] | undefined) || [])
					.filter(item => auditGroupNames.includes(item.metadata.name))
					.sort((a, b) => a.spec.priority - b.spec.priority)
				category.value.list = filtered
				if (category.value.list.length !== 0) {
					queryParams.value.group = category.value.list[0].metadata.name || ''
					handleGetData(true)
				}
				else {
					loadMoreText.value = t('common.noMore')
					uni.stopPullDownRefresh()
				}
			}
			catch (e) {
				console.error(e)
				category.value = { activeIndex: 0, list: [] }
			}
			return
		}
		try {
			const res = await getPhotoGroupList({ page: 1, size: 0 })
			category.value.list = ((res.data as unknown as IPhotoGroup[] | undefined) || [])
				.sort((a, b) => a.spec.priority - b.spec.priority)
			category.value.list.unshift({ metadata: { name: undefined }, spec: { displayName: '全部', priority: 0 } })
			if (category.value.list.length !== 0) {
				queryParams.value.group = category.value.list[0].metadata.name || ''
				handleGetData(true)
			}
		}
		catch (e) {
			console.error(e)
			category.value = { activeIndex: 0, list: [] }
		}
	}

	async function handleGetData(isClearList = false) {
		if (isClearList) {
			dataList.value = []
			queryParams.value.page = 1
		}

		if (!isLoadMore.value) {
			updateLoadingStatus(DataLoadingStatusEnum.Loading)
		}
		loadMoreText.value = ''

		try {
			const res = await getPhotoListByGroupName({ ...queryParams.value })
			hasNext.value = res.data.hasNext
			if (res.data.items.length !== 0) {
				const list = res.data.items.map(item => ({
					...item,
					spec: { ...item.spec, url: checkImageUrl(item.spec.url || item.spec.cover) },
				}))
				dataList.value = isLoadMore.value
					? dataList.value.concat(list)
					: list
			}
			updateLoadingStatus(dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
			loadMoreText.value = res.data.hasNext ? t('common.loadMore') : t('common.noMore')
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
				lock.value = false
			}, 500)
		}
	}

	function handleGetDataByCategory(index : number, cate : IPhotoGroup) {
		queryParams.value.group = cate.metadata.name || ''
		queryParams.value.page = 1
		uni.pageScrollTo({ scrollTop: 0, duration: 500 })
		dataList.value = []
		category.value.activeIndex = index
		handleGetData(true)
	}

	/* ---------------- 图片预览 ---------------- */
	function handlePreview(data : IPhoto) {
		const current = dataList.value.findIndex(x => x.metadata.name === data.metadata.name)
		uni.previewImage({
			current,
			urls: dataList.value.map(x => x.spec.url),
			indicator: 'number',
			loop: true,
		})
	}

	/* ---------------- 生命周期 ---------------- */
	onLoad(async () => {
		// 检查插件可用性
		await checkPluginAvailable()
		if (!uniHaloPluginAvailable.value) {
			uni.stopPullDownRefresh()
			return
		}
		handleGetCategory()
	})

	onPullDownRefresh(() => {
		if (!uniHaloPluginAvailable.value) {
			uni.stopPullDownRefresh()
			return
		}
		dataList.value = []
		isLoadMore.value = false
		queryParams.value.page = 1
		handleGetData(true)
	})

	onReachBottom(() => {
		if (!uniHaloPluginAvailable.value) { return }
		if (calcAuditModeEnabled.value) {
			uni.showToast({ icon: 'none', title: t('common.noMoreData') })
			return
		}
		if (hasNext.value) {
			queryParams.value.page += 1
			isLoadMore.value = true
			handleGetData(false)
		}
		else {
			uni.showToast({ icon: 'none', title: t('common.noMoreData') })
		}
	})
</script>

<template>
	<view class="min-h-screen w-screen flex flex-col bg-page pb-6">
		<uh-navbar :use-back="false" default-title="我的图库" title-color="text-gray-900"></uh-navbar>

		<uh-plugin-unavailable v-if="!uniHaloPluginAvailable" :plugin-id="pluginId" :error-text="tips"
			:checking="checking" @on-refresh="checkPluginAvailable" />
		<template v-else>
			<wd-sticky v-if="category.list.length!==0" class="w-full">
				<scroll-view :scroll-x="true" class="w-full whitespace-nowrap pt-2">
					<view v-for="(cate, index) in category.list" :key="cate.spec.displayName"
						class="uh-global-card-glass uh-shadow-xs mb-1 ml-3 inline-block border rounded-2xl px-4 py-1 text-sm"
						:class="{ 'bg-primary text-gray-900 font-bold': index === category.activeIndex }"
						@click="handleGetDataByCategory(index, cate)">
						{{ cate.spec.displayName }} <text
							v-if="cate.spec.displayName!=='全部'">({{ cate.status?.photoCount ?? 0 }})</text>
					</view>
				</scroll-view>
			</wd-sticky>

			<!-- 加载/错误占位 -->
			<uh-data-loading v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus"
				@refresh="handleGetCategory" />

			<!-- 内容区域 -->
			<view v-else class="box-border w-full p-3">
				<view class="grid grid-cols-2 gap-2.5">
					<view v-for="(item, index) in dataList" :key="index"
						class="relative uh-global-card-glass h-38 w-full overflow-hidden rounded-xl">
						<image class="h-full w-full" :src="item.spec.url" mode="aspectFill" lazy-load
							@click="handlePreview(item)" />
						<view v-if="item.spec.displayName"
							class="absolute bottom-0 w-full box-border p-3 pt-6 z-2 bg-gradient-to-b from-white/0 to-black/40 text-xs text-white">
							{{item.spec.displayName}}
						</view>
					</view>
				</view>
				<view class="load-text w-full py-4 text-center text-xs text-gray-500">
					{{ loadMoreText }}
				</view>
			</view>
		</template>
	</view>
</template>