<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
	import { getLoveDailyItems } from '@/api/uni-halo'
	import { handleLoveModuleLocked } from '@/utils/loveModuleToken'
	import { checkImageUrl } from '@/utils/url'
	import { sleep } from '@/utils/common'
	import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
	import type { ILoveDailyItem } from '@/api/types/uni-halo'

	definePage({
		style: {
			navigationBarTitleText: '恋爱清单',
			navigationStyle: 'custom',
			enablePullDownRefresh: true,
		},
	})

	/* ---------------- 展示层类型 ---------------- */
	/** 清单展示卡片(script 预处理后的干净展示数据) */
	interface ILoveItemCard {
		/** 唯一 key(metadata.name,无则用索引) */
		name : string
		title : string
		content : string
		status : 'wait' | 'doing' | 'complete'
		planDate : string
		completeDate : string
		completeRemark : string
		/** 回忆图片(已预处理 URL) */
		images : string[]
		/** 是否展开详情 */
		open : boolean
	}

	/** 清单卡片映射:字段取值 + 图片路径预处理(模板不感知原始接口结构) */
	function mapItemCard(item : ILoveDailyItem, index : number) : ILoveItemCard {
		const spec = item.spec || {}
		return {
			name: item.metadata?.name || `item-${index}`,
			title: spec.title || '',
			content: spec.content || '',
			status: spec.status || 'wait',
			planDate: spec.planDate || '',
			completeDate: spec.completeDate || '',
			completeRemark: spec.completeRemark || '',
			images: (spec.images || []).map(img => checkImageUrl(img || '')),
			open: false,
		}
	}

	/* ---------------- 状态 ---------------- */
	const { loadingStatus, loadMoreStatus, updateLoadingStatus, updateLoadMoreStatus, resetLoadMoreStatus } = useDataLoadingStatus()
	const queryParams = ref({ page: 1, size: 10 })
	const list = ref<ILoveItemCard[]>([])

	/* ---------------- 筛选与排序 ---------------- */
	interface IFilterOption {
		label : string
		value : string
	}

	interface IFilterItem {
		key : 'status' | 'sort'
		label : string
		options : IFilterOption[]
	}

	/** 筛选维度:状态筛选 + 排序(参考投票列表页顶部胶囊设计,各自独立状态) */
	const filterConfig : IFilterItem[] = [
		{
			key: 'status',
			label: '状态',
			options: [
				{ label: '全部', value: '' },
				{ label: '待完成', value: 'wait' },
				{ label: '进行中', value: 'doing' },
				{ label: '已完成', value: 'complete' },
			],
		},
		{
			key: 'sort',
			label: '排序',
			options: [
				{ label: '默认排序', value: 'default' },
				{ label: '按状态', value: 'status' },
				{ label: '按计划时间', value: 'planDate' },
				{ label: '按完成时间', value: 'completeDate' },
			],
		},
	]

	/** 排序方向选项(顺序/倒序,排序弹层内选择) */
	const sortDirOptions : IFilterOption[] = [
		{ label: '顺序', value: 'asc' },
		{ label: '倒序', value: 'desc' },
	]

	/** 各维度当前选中值(空串/首项 = 默认) */
	const filterValues = ref<Record<string, string>>({ status: '', sort: 'default', sortDir: 'asc' })

	/** 当前选中中文标签(用于胶囊展示当前状态) */
	const filterLabels = computed(() => {
		const map : Record<string, string> = {}
		for (const f of filterConfig) {
			const cur = filterValues.value[f.key]
			map[f.key] = f.options.find(o => o.value === cur)?.label || f.options[0].label
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
		if (!item)
			return
		if (item.key === 'sort' && option.value === 'default') {
			// 选回默认排序:方向一并复位
			filterValues.value.sort = 'default'
			filterValues.value.sortDir = 'asc'
		}
		else {
			filterValues.value[item.key] = option.value
		}
		filterPopup.value.show = false
	}

	function handleSelectSortDir(option : IFilterOption) {
		filterValues.value.sortDir = option.value
	}

	/** 展示列表:状态筛选 + 排序(前端过滤,数据一次拉取) */
	const showList = computed(() => {
		const status = filterValues.value.status
		const dir = filterValues.value.sortDir === 'desc' ? -1 : 1
		const result = status
			? list.value.filter(item => item.status === status)
			: [...list.value]
		switch (filterValues.value.sort) {
			case 'status': {
				const order : Record<string, number> = { wait: 0, doing: 1, complete: 2 }
				result.sort((a, b) => (order[a.status] - order[b.status]) * dir)
				break
			}
			case 'planDate':
				result.sort((a, b) => (a.planDate || '').localeCompare(b.planDate || '') * dir)
				break
			case 'completeDate':
				result.sort((a, b) => (a.completeDate || '').localeCompare(b.completeDate || '') * dir)
				break
			default:
				break
		}
		return result
	})

	/* ---------------- 数据加载 ---------------- */
	async function handleGetList() {
		if (!loadMoreStatus.value.active) {
			updateLoadingStatus(DataLoadingStatusEnum.Loading)
		}
		try {
			const res = await getLoveDailyItems({ ...queryParams.value })
			const items = (res.data?.items || []).map(mapItemCard)
			list.value = loadMoreStatus.value.active
				? list.value.concat(items)
				: items
			if (!loadMoreStatus.value.active) {
				await sleep(600)
				updateLoadingStatus(list.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
			}
			updateLoadMoreStatus({
				active: false,
				status: res.data?.hasNext ? 'loadMore' : 'noMore',
				hasNext: !!res.data?.hasNext,
			})
		}
		catch (e) {
			console.error('获取清单失败', e)
			// 模块锁 401：清除 token 并提示
			handleLoveModuleLocked('loveDaily', e)
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

	function getCardStatusClass(item : ILoveItemCard) {
		switch (item.status) {
			case 'wait':
				return 'bg-yellow-300'
			case 'doing':
				return 'bg-love/30'
			case 'complete':
				return 'bg-blue-300'
			default:
				return 'bg-yellow-300'
		}
	}

	function getCardStatusText(item : ILoveItemCard) {
		switch (item.status) {
			case 'wait':
				return '待完成'
			case 'doing':
				return '进行中'
			case 'complete':
				return '已完成'
			default:
				return '待完成'
		}
	}

	/* ---------------- 交互 ---------------- */
	function handleOnItemOpen(item : ILoveItemCard) {
		item.open = !item.open
	}

	/** 预览回忆图片(基于已预处理 URL) */
	function handlePreviewImages(images : string[], index : number) {
		if (images.length === 0)
			return
		uni.previewImage({ current: images[index], urls: images })
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
	onLoad(() => {
		handleGetList()
	})

	onPullDownRefresh(() => {
		resetLoadMoreStatus()
		queryParams.value.page = 1
		handleGetList()
	})

	onReachBottom(() => {
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
			handleGetList()
		}
	})
</script>

<template>
	<view class="uh-global-love-page box-border min-h-screen w-screen flex flex-col">
		<uh-navbar default-title="恋爱清单" title-color="text-love" back-class="text-love"/>

		<wd-sticky>
			<view class="box-border px-3 pb-1 pt-2">
				<view class="box-border flex items-center justify-between gap-x-2">
					<view v-for="f in filterConfig" :key="f.key"
						class="uh-global-card-glass box-border flex flex-1 items-center justify-center gap-1 border rounded-full px-4 py-2 text-gray-500"
						:class="[filterValues[f.key] !== f.options[0].value ? 'bg-love/90 text-white font-bold' : 'bg-white/80 text-gray-600']"
						@click="handleOpenFilter(f)">
						<text class="truncate text-xs">{{ filterLabels[f.key] }}</text>
						<template v-if="f.key!=='status'">
							<wd-icon v-if="f.key === 'sort' && filterValues.sort !== 'default'"
								:name="filterValues.sortDir === 'desc' ? 'arrow-down' : 'arrow-up'" size="26rpx" />
							<wd-icon v-else name="arrow-down" size="26rpx" />
						</template>
					</view>
				</view>
			</view>
		</wd-sticky>

		<uh-data-loading v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus"
			min-height="60vh" empty-text="暂时还没有恋爱清单，快去制定你们的恋爱清单吧~" @refresh="handleGetList" />

		<view v-else class="box-border flex flex-1 flex-col gap-y-3 p-3 pb-safe">
			<block v-for="(item, index) in showList" :key="item.name">
				<view
					class="uh-global-card-glass uh-shadow-xs box-border w-full flex flex-col items-center rounded-xl p-3">
					<view class="box-border w-full flex items-center gap-x-3" @click="handleOnItemOpen(item)">
						<view
							class="uh-global-card-glass uh-shadow-xs text-md h-11 w-11 flex shrink-0 items-center justify-center rounded-full text-white font-bold"
							:class="[getCardStatusClass(item)]">
							{{ index + 1 }}
						</view>
						<view class="box-border flex-1">
							<view class="text-md truncate text-love font-bold">
								{{ item.title }}
							</view>
							<view class="mt-1 text-xs text-gray-500">
								完成状态：{{ getCardStatusText(item) }}
							</view>
						</view>
						<view
							class="h-6 w-6 flex shrink-0 items-center justify-center rounded-full text-love font-bold">
							<wd-icon :name="item.open ? 'up' : 'down'" size="32rpx" />
						</view>
					</view>
					<view v-if="item.open"
						class="uh-global-card-glass mt-4 box-border w-full rounded-xl p-3 text-xs shadow-none">
						<view v-if="item.content" class="desc mb-3 flex">
							<view class="desc-label w-16 shrink-0 text-gray-500 ">
								计划内容
							</view>
							<view class="desc-value w-0 flex-1 text-gray-900 leading-5">
								{{ item.content || '-' }}
							</view>
						</view>
						<view v-if="item.planDate" class="desc mb-3 flex">
							<view class="desc-label w-16 shrink-0 text-gray-500">
								计划时间
							</view>
							<view class="desc-value w-0 flex-1 text-gray-900 leading-4">
								{{ item.planDate || '-' }}
							</view>
						</view>
						<view v-if="item.completeDate" class="desc mb-3 flex">
							<view class="desc-label w-16 shrink-0 text-gray-500">
								完成时间
							</view>
							<view class="desc-value w-0 flex-1 text-gray-900 leading-4">
								{{ item.completeDate || '-' }}
							</view>
						</view>
						<view v-if="item.completeRemark" class="desc mb-3 flex">
							<view class="desc-label w-16 shrink-0 text-gray-500">
								完成感想
							</view>
							<view class="desc-value w-0 flex-1 text-gray-900 leading-4">
								{{ item.completeRemark || '-' }}
							</view>
						</view>
						<view v-if="item.images.length > 0" class="desc flex">
							<view class="desc-label w-16 shrink-0 text-gray-500">
								回忆图片
							</view>
							<view class="desc-value w-0 flex-1 text-gray-900 leading-4">
								<view class="grid grid-cols-3 gap-2">
									<view v-for="(img, imgIndex) in item.images" :key="imgIndex"
										class="h-16 w-full overflow-hidden rounded-lg"
										@click="handlePreviewImages(item.images, imgIndex)">
										<image class="h-full w-full" :src="img" mode="aspectFill" lazy-load />
									</view>
								</view>
							</view>
						</view>
					</view>
				</view>
			</block>
			<uh-data-loadmore :status="loadMoreStatus.status" :text="loadMoreStatus.text" />
			<uh-data-loading v-if="showList.length === 0" :loading-status="DataLoadingStatusEnum.Empty"
				min-height="42vh" empty-text="该筛选条件下暂无清单~" :use-refresh-button="false" />
		</view>

		<!-- 筛选弹层(状态/排序;排序附方向选择) -->
		<uh-glass-popup v-model="filterPopup.show" :z-index="99" position="bottom" custom-class="rounded-2xl">
			<view v-if="filterPopup.item" class="box-border p-4">
				<view class="text-md mb-4 text-center text-gray-900 font-bold">
					{{ filterPopup.item.label }}
				</view>
				<view class="flex flex-col gap-2">
					<view v-for="opt in filterPopup.item.options" :key="opt.label"
						class="uh-global-card-glass shadow-none box-border border rounded-xl px-5 py-2 text-center text-sm"
						:class="filterValues[filterPopup.item.key] === opt.value ? 'bg-love/90 text-white font-bold' : 'text-gray-700'"
						@click="handleSelectFilter(opt)">
						{{ opt.label }}
					</view>
				</view>
				<!-- 排序维度附加:方向选择(顺序/倒序) -->
				<template v-if="filterPopup.item.key === 'sort'">
					<view class="mb-2 mt-5 text-center text-xs text-gray-400">
						排序方向
					</view>
					<view class="flex gap-2">
						<view v-for="dir in sortDirOptions" :key="dir.value"
							class="uh-global-card-glass shadow-none box-border flex-1 border rounded-xl px-5 py-2 text-center text-sm"
							:class="filterValues.sortDir === dir.value ? 'bg-love/90 text-white font-bold' : 'text-gray-700'"
							@click="handleSelectSortDir(dir)">
							{{ dir.label }}
						</view>
					</view>
				</template>
			</view>
		</uh-glass-popup>
	</view>
</template>