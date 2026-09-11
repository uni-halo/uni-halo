<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
	import { getVoteList } from '@/api/uni-halo'
	import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
	import { NeedPluginIds } from '@/hooks/usePluginAvailable'
	import { useAppConfigStore } from '@/store/appConfig'
	import { debounce } from '@/utils/debounce'
	import { sleep } from '@/utils/common'
	import { calcVoteState, VOTE_TYPES, voteCacheUtil } from '@/utils/vote'
	import type { IVoteItem } from '@/api/types/uni-halo'

	definePage({
		style: {
			navigationBarTitleText: '投票中心',
			enablePullDownRefresh: true,
			navigationStyle: 'custom',
		},
	})

	const appConfigStore = useAppConfigStore()
	const calcAuditModeEnabled = computed(() => appConfigStore.auditModeEnabled)

	const { pluginId, checking, tips, available: uniHaloPluginAvailable, check: checkPluginAvailable } = usePluginAvailable({
		pluginId: NeedPluginIds.PluginVote,
		tips: '啊偶，功能正在维护中...', 
		callback: (isAvailable) => {
			if (!isAvailable) { return }
			uni.pageScrollTo({
				scrollTop: 0,
				duration: 0,
			})
			handleGetData()
		}
	})

	/** 重新检测插件:可用则拉取数据(供 uh-plugin-unavailable 刷新按钮) */
	async function handlePluginRefresh() {
		if (await checkPluginAvailable()) { handleGetData() }
	}

	/* ---------------- 状态 ---------------- */
	const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()
	const dataList = ref<IVoteItem[]>([])
	const hasNext = ref(false)
	const isLoadMore = ref(false)
	const loadMoreText = ref('加载中...')
	const filterIsVoted = ref<boolean | undefined>(undefined)
	const queryParams = ref<Record<string, unknown>>({
		keyword: '',
		page: 1,
		size: 10,
		sort: undefined,
		type: undefined,
		hasEnded: undefined,
	})

	/* ---------------- 筛选 ---------------- */
	interface IFilterOption {
		label : string
		value : string
	}

	interface IFilterItem {
		key : 'type' | 'hasEnded' | 'sort' | 'isVoted'
		label : string
		options : IFilterOption[]
	}

	/** 筛选维度 */
	const filterConfig : IFilterItem[] = [
		{
			key: 'type',
			label: '类型',
			options: [
				{ label: '全部', value: '' },
				{ label: '单选', value: 'single' },
				{ label: '多选', value: 'multiple' },
				{ label: '双选PK', value: 'pk' },
			],
		},
		{
			key: 'hasEnded',
			label: '状态',
			options: [
				{ label: '全部', value: '' },
				{ label: '进行中', value: 'false' },
				{ label: '已结束', value: 'true' },
			],
		},
		{
			key: 'sort',
			label: '排序',
			options: [
				{ label: '默认排序', value: '' },
				{ label: '较近创建', value: 'metadata.creationTimestamp,desc' },
				{ label: '较早创建', value: 'metadata.creationTimestamp,asc' },
			],
		},
		{
			key: 'isVoted',
			label: '是否已投',
			options: [
				{ label: '全部', value: '' },
				{ label: '未投票', value: 'false' },
				{ label: '已投票', value: 'true' },
			],
		},
	]

	/** 各维度当前选中值(空串 = 全部) */
	const filterValues = ref<Record<string, string>>({ type: '', hasEnded: '', sort: '', isVoted: '' })

	/** 当前选中中文标签(用于筛选栏展示) */
	const filterLabels = computed(() => {
		const map : Record<string, string> = {}
		for (const f of filterConfig) {
			const cur = filterValues.value[f.key]
			map[f.key] = f.options.find(o => o.value === cur)?.label || '全部'
		}
		return map
	})

	/** 筛选弹层 */
	const filterPopup = ref<{ show : boolean, item : IFilterItem | null }>({ show: false, item: null })

	function handleOpenFilter(item : IFilterItem) {
		filterPopup.value = { show: true, item }
	}

	function handleSelectFilter(option : IFilterOption) {
		const item = filterPopup.value.item
		if (!item) { return }
		filterValues.value[item.key] = option.value
		filterPopup.value.show = false

		if (item.key === 'isVoted') {
			filterIsVoted.value = option.value === '' ? undefined : option.value === 'true'
		}
		else if (item.key === 'hasEnded') {
			queryParams.value.hasEnded = option.value === '' ? undefined : option.value === 'true'
		}
		else {
			queryParams.value[item.key] = option.value === '' ? undefined : option.value
		}

		queryParams.value.page = 1
		isLoadMore.value = false
		handleGetData()
	}

	/* ---------------- 搜索 ---------------- */
	/** 实时搜索:输入防抖 400ms 后触发 */
	const handleOnInput = debounce(() => {
		queryParams.value.page = 1
		isLoadMore.value = false
		handleGetData()
	}, 400)

	function handleOnSearch() {
		queryParams.value.page = 1
		isLoadMore.value = false
		handleGetData()
	}

	/* ---------------- 数据加载 ---------------- */
	async function handleGetData() {
		if (calcAuditModeEnabled.value) {
			updateLoadingStatus(
				dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success,
			)
			loadMoreText.value = '呜呜，没有更多数据啦~'
			uni.stopPullDownRefresh()
			return
		}

		if (!isLoadMore.value) {
			updateLoadingStatus(DataLoadingStatusEnum.Loading)
		}
		loadMoreText.value = '加载中...'

		try {
			const res = await getVoteList({ ...queryParams.value })
			hasNext.value = res.data.hasNext || false

			const tempItems = res.data.items.map((item) => {
				item.spec = item.spec || {}
				item.spec.disabled = true
				item.spec.isVoted = voteCacheUtil.has(item.metadata?.name || '')
				item.spec._uh_state = calcVoteState(item)
				item.spec._uh_type = VOTE_TYPES[item.spec.type || ''] || item.spec.type
				return item
			})

			dataList.value = isLoadMore.value
				? dataList.value.concat(tempItems)
				: tempItems

			// 未投优先排序
			dataList.value = dataList.value.sort((a, b) => {
				return Number(a.spec?.isVoted) - Number(b.spec?.isVoted)
			})

			// 是否已投过滤
			if (filterIsVoted.value !== undefined) {
				dataList.value = dataList.value.filter(x => x.spec?.isVoted === filterIsVoted.value)
			}
			await sleep(600)
			updateLoadingStatus(
				dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success,
			)
			loadMoreText.value = hasNext.value ? '上拉加载更多' : '呜呜，没有更多数据啦~'
		}
		catch (err) {
			console.error(err)
			updateLoadingStatus(DataLoadingStatusEnum.Error)
			loadMoreText.value = '加载失败，请下拉刷新！'
		}
		finally {
			uni.stopPullDownRefresh()
		}
	}

	/** 卡片点击跳详情 */
	function handleOnVoteClick(vote : IVoteItem) {
		const name = vote.metadata?.name
		if (!name)
			return
		uni.navigateTo({
			url: `/pages-blog/vote-detail/vote-detail?name=${name}`,
		})
	}

	function handleToTopPage(duration = 500) {
		uni.pageScrollTo({
			scrollTop: 0,
			duration,
			fail: (err) => {
				console.error('回顶失败', err)
			},
		})
	}

	/* ---------------- 生命周期 ---------------- */
	onLoad(async () => {
		await checkPluginAvailable()
		if (!uniHaloPluginAvailable.value) {
			uni.stopPullDownRefresh()
			return
		}
		handleGetData()
	})

	onPullDownRefresh(() => {
		if (!uniHaloPluginAvailable.value) {
			uni.stopPullDownRefresh()
			return
		}
		isLoadMore.value = false
		queryParams.value.page = 1
		handleGetData()
	})

	onReachBottom(() => {
		if (!uniHaloPluginAvailable.value)
			return
		if (calcAuditModeEnabled.value) {
			uni.showToast({ icon: 'none', title: '没有更多数据了' })
			return
		}
		if (hasNext.value) {
			queryParams.value.page = Number(queryParams.value.page) + 1
			isLoadMore.value = true
			handleGetData()
		}
		else {
			uni.showToast({ icon: 'none', title: '没有更多数据了' })
		}
	})
</script>

<template>
	<view class="app-page min-h-screen w-screen flex flex-col bg-page">
		<uh-navbar default-title="投票中心" title-color="text-gray-900" />

		<uh-plugin-unavailable v-if="!uniHaloPluginAvailable" :plugin-id="pluginId" :error-text="tips"
			:checking="checking" @on-refresh="handlePluginRefresh" />

		<template v-else>
			<view class="box-border w-screen px-3 pt-2">
				<view class="uh-global-card-glass flex h-9 items-center gap-3 rounded-full px-5">
					<wd-icon name="search" size="16px" />
					<input v-model="queryParams.keyword" class="flex-1 text-[26rpx] text-gray-900"
						placeholder="搜索投票..." placeholder-class="text-gray-400" confirm-type="search"
						@input="handleOnInput" @confirm="handleOnSearch">
					<view v-if="queryParams.keyword" class="flex items-center"
						@click="queryParams.keyword = ''; handleOnSearch()">
						<wd-icon name="close" size="14px" />
					</view>
				</view>
				<!-- 筛选栏 -->
				<view class="box-border flex items-center justify-between mt-1 py-2 gap-x-2">
					<view v-for="f in filterConfig" :key="f.key"
						class="uh-global-card-glass border rounded-full box-border flex flex-1 items-center justify-center gap-1 px-2 py-1 text-gray-500"
						:class="[filterValues[f.key]?'bg-secondary text-gray-900 font-bold':'bg-white/80 text-gray-600']"
						@click="handleOpenFilter(f)">
						<text class="text-xs truncate">
							{{ filterLabels[f.key] }}
						</text>
						<wd-icon name="arrow-down" size="24rpx" />
					</view>
				</view>
			</view>

			<uh-data-loading v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus"
				empty-text="还没有任何投票哦~" min-height="70vh" @refresh="handleGetData" />

			<view v-else class="box-border flex flex-col gap-4 p-3">
				<block v-if="dataList.length !== 0">
					<uh-vote-card v-for="vote in dataList" :key="vote.metadata?.name" :vote="vote"
						@click="handleOnVoteClick(vote)" />
					<view class="box-border py-5 text-center text-xs text-gray-400">
						{{ loadMoreText }}
					</view>
				</block>
			</view>
		</template>

		<!-- 筛选弹层 -->
		<uh-glass-popup v-model="filterPopup.show" :z-index="99" position="bottom" custom-class="rounded-2xl">
			<view v-if="filterPopup.item" class="box-border p-4">
				<view class="mb-4 text-center text-md font-bold text-gray-900">
					{{ filterPopup.item.label }}
				</view>
				<view class="flex flex-col gap-2">
					<view v-for="opt in filterPopup.item.options" :key="opt.label"
						class="uh-global-card-glass shadow-none border box-border rounded-xl px-5 py-2 text-center text-sm"
						:class="filterValues[filterPopup.item.key] === opt.value ? 'bg-primary text-gray-900 font-bold' : 'text-gray-700'"
						@click="handleSelectFilter(opt)">
						{{ opt.label }}
					</view>
				</view>
			</view>
		</uh-glass-popup>
	</view>
</template>