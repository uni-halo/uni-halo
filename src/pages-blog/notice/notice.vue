<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad, onPageScroll, onPullDownRefresh, onReachBottom, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
	import { getNoticeTypes, getNotices } from '@/api/uni-halo'
	import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
	import { usePageScroll } from '@/hooks/usePageScroll'
	import { usePageTitle } from '@/hooks/usePageTitle'
	import { useNavbarSticky } from '@/hooks/useNavbarSticky'
	import { checkImageUrl } from '@/utils/url'
	import { sleep } from '@/utils/common'
	import type { INoticeListVo, INoticeType } from '@/api/types/uni-halo'

	definePage({
		style: {
			navigationBarTitleText: '公告中心',
			navigationStyle: 'custom',
			enablePullDownRefresh: true,
		},
	})

	const { height: offsetTop } = useNavbarSticky()
	const { scrollY, updatePageScrollValue } = usePageScroll()
	/** 页面标题（插件端可配置，留空回退内置默认） */
	const pageTitle = usePageTitle('notice', '公告中心')
	const PAGE_SIZE = 100

	/** 状态机:首屏/下拉刷新 loading、empty、error;触底加载失败仅提示,不切整页错误态 */
	const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()
	const allItems = ref<INoticeListVo[]>([])
	const page = ref(1)
	const total = ref(0)
	const activeType = ref('')
	type SortKey = 'latest' | 'earliest' | 'group'
	const sortKey = ref<SortKey>('latest')
	/** 请求并发锁(下拉刷新与触底加载互斥) */
	const fetching = ref(false)
	/** 触底加载更多底部文案(加载中/上拉加载更多/没有更多/失败提示) */
	const loadMoreText = ref('')

	const SORT_OPTIONS : Array<{ id : SortKey, label : string }> = [
		{ id: 'latest', label: '最新在前' },
		{ id: 'earliest', label: '最早在前' },
		{ id: 'group', label: '按类型分组' },
	]

	/* ---------------- 分享 ---------------- */

	onShareAppMessage(() => ({
		title: pageTitle.value,
		path: '/pages-blog/notice/notice',
	}))

	onShareTimeline(() => ({
		title: pageTitle.value,
		query: '',
	}))

	/* ---------------- 分类列表(公告分类接口,按 priority 排序) ---------------- */
	const noticeTypes = ref<INoticeType[]>([])

	async function loadNoticeTypes() {
		try {
			const res = await getNoticeTypes()
			noticeTypes.value = res.data?.items || []
		}
		catch (err) {
			console.error('获取公告分类失败', err)
		}
	}

	/* ---------------- 时间与排序 ---------------- */
	function formatDate(value ?: string) : string {
		if (!value)
			return ''
		const date = new Date(value)
		if (Number.isNaN(date.getTime()))
			return ''
		const pad = (n : number) => String(n).padStart(2, '0')
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
	}

	function timeOf(item : INoticeListVo) : number {
		const time = item.publishTime ? new Date(item.publishTime).getTime() : Number.NaN
		return Number.isNaN(time) ? 0 : time
	}

	/** 展示列表:先按类型筛选,再按排序键排序(时间倒序/正序/按类型分组) */
	const displayList = computed(() => {
		let list = allItems.value
		if (activeType.value !== '') {
			list = list.filter(item => (item.typeName || '') === activeType.value)
		}
		if (sortKey.value === 'latest') {
			list = [...list].sort((a, b) => timeOf(b) - timeOf(a))
		}
		else if (sortKey.value === 'earliest') {
			list = [...list].sort((a, b) => timeOf(a) - timeOf(b))
		}
		else {
			// 按类型分组:分类接口顺序,接口外的排最后,组内按发布时间倒序
			const groupOrder = new Map<string, number>()
			for (const t of noticeTypes.value) {
				const key = t.metadata?.name || ''
				if (key && !groupOrder.has(key)) {
					groupOrder.set(key, groupOrder.size)
				}
			}
			list = [...list].sort((a, b) => {
				const ka = a.typeName || ''
				const kb = b.typeName || ''
				const ga = groupOrder.get(ka) ?? Number.MAX_SAFE_INTEGER
				const gb = groupOrder.get(kb) ?? Number.MAX_SAFE_INTEGER
				if (ga !== gb)
					return ga - gb
				return timeOf(b) - timeOf(a)
			})
		}
		return list
	})

	/* ---------------- 数据加载(状态机:loading/empty/error/success) ---------------- */
	async function loadNotices(reset : boolean) {
		if (fetching.value)
			return
		fetching.value = true
		if (reset) {
			updateLoadingStatus(DataLoadingStatusEnum.Loading)
			loadMoreText.value = ''
		}
		else {
			loadMoreText.value = '加载中...'
		}
		try {
			const target = reset ? 1 : page.value + 1
			const res = await getNotices({ page: target, size: PAGE_SIZE })
			const body = res.data
			const items = body?.items || []
			if (reset) {
				allItems.value = items
				page.value = 1
			}
			else {
				allItems.value = [...allItems.value, ...items]
				page.value = target
			}
			total.value = body?.total ?? allItems.value.length
			loadMoreText.value = allItems.value.length >= total.value ? '呜呜，没有更多数据啦~' : '上拉加载更多'
			await sleep(600)
			updateLoadingStatus(
				allItems.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success,
			)
		}
		catch (err) {
			console.error('公告列表加载失败', err)
			if (reset) {
				updateLoadingStatus(DataLoadingStatusEnum.Error)
			}
			else {
				// 触底加载失败:保留已加载列表,仅底部提示,避免整页切错误态
				loadMoreText.value = '加载失败，请下拉刷新！'
			}
		}
		finally {
			setTimeout(() => {
				fetching.value = false
				uni.stopPullDownRefresh()
			}, 500)
		}
	}

	function loadMore() {
		if (fetching.value || allItems.value.length >= total.value) { return }
		loadNotices(false)
	}

	onPageScroll((option : Page.PageScrollOption) => {
		updatePageScrollValue(option.scrollTop)
	})

	onLoad(() => {
		loadNoticeTypes()
		loadNotices(true)
	})

	onReachBottom(() => {
		loadMore()
	})

	onPullDownRefresh(() => {
		if (fetching.value) {
			uni.stopPullDownRefresh()
			return
		}
		loadNotices(true)
	})

	/* ---------------- 跳转 ---------------- */
	function handleToDetail(item : INoticeListVo) {
		if (!item.name) { return }
		uni.navigateTo({ url: `/pages-blog/notice/detail?name=${item.name}` })
	}
</script>

<template>
	<view class="app-page min-h-screen w-screen flex flex-col bg-page">
		<!-- 自定义导航 -->
		<uh-navbar :scroll-y="scrollY" :default-title="pageTitle" title-color="text-gray-900" />

		<wd-sticky :offset-top="offsetTop">
			<view class="w-screen overflow-hidden">
				<scroll-view :scroll-x="true" :show-scrollbar="false" class="w-full whitespace-nowrap">
					<view class="uh-global-card-glass shadow-none mb-2 ml-3 inline-flex border rounded-2xl px-4 py-1.5 text-xs"
						:class="activeType === '' ? 'bg-primary text-gray-900 font-semibold' : 'text-gray-500'" @click="activeType = ''">
						全部
					</view>
					<view v-for="(type) in noticeTypes" :key="type.metadata?.name"
						class="mb-2 ml-3 box-border uh-global-card-glass shadow-none inline-flex items-center gap-1 border rounded-2xl px-4 py-1.5 text-xs"
						:class="activeType === type.metadata?.name ? 'bg-primary text-gray-900 font-semibold' : 'text-gray-500'"
						@click="activeType = activeType === type.metadata?.name ? '' : type.metadata?.name || ''">
						<view v-if="type.spec?.color" class="shrink-0 h-2 w-2 rounded-full"
							:style="{ backgroundColor: type.spec.color }" />
						<view class="shrink-0">{{ type.spec?.displayName }}</view>
					</view>
				</scroll-view>
				<scroll-view :scroll-x="true" :show-scrollbar="false" class="w-full whitespace-nowrap">
					<view class="box-border flex gap-2 px-3 pb-1.5">
						<view v-for="opt in SORT_OPTIONS" :key="opt.id"
							class="uh-global-card-glass shadow-none inline-flex border rounded-2xl px-4 py-1.5 text-xs"
							:class="{ 'bg-primary text-gray-900': sortKey === opt.id, 'text-gray-500': sortKey !== opt.id }"
							@click="sortKey = opt.id">
							{{ opt.label }}
						</view>
					</view>
				</scroll-view>
			</view>
		</wd-sticky>

		<uh-data-loading v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus"
			empty-text="暂无公告" empty-sub-text="" @refresh="loadNotices(true)" />

		<view v-else class="box-border pt-4">
			<template v-if="displayList.length > 0">
				<view class="box-border flex flex-col gap-3 px-3">
					<view v-for="item in displayList" :key="item.name"
						class="box-border uh-global-card-glass uh-shadow-xs flex overflow-hidden rounded-xl p-3"
						@click="handleToDetail(item)">
						<image v-if="item.cover" class="mr-3 h-18 w-24 shrink-0 rounded-lg"
							:src="checkImageUrl(item.cover)" mode="aspectFill" />
						<view class="min-w-0 flex-1 flex flex-col justify-between">
							<view class="truncate text-sm text-gray-900 font-bold leading-snug">
								{{ item.title }}
							</view>
							<view v-if="item.summary" class="truncate mt-1 text-[24rpx] text-gray-500 leading-relaxed">
								{{ item.summary }}
							</view>
							<view class="mt-2 flex items-center gap-2">
								<view v-if="item.typeDisplayName" class="rounded px-1.5 py-0.5 text-[20rpx]" :style="{
									color: item.typeColor || '#f83856',
									backgroundColor: item.typeColor ? `${item.typeColor}1a` : '#fdeef1',
								  }">
									{{ item.typeDisplayName }}
								</view>
								<text class="text-[22rpx] text-gray-500">
									{{ formatDate(item.publishTime) }}
								</text>
							</view>
						</view>
					</view>
					<view class="load-text py-5 text-center text-[24rpx] text-gray-500">
						{{ loadMoreText }}
					</view>
				</view>
			</template>

			<!-- 类型筛选后无匹配 -->
			<uh-data-loading v-else :loading-status="DataLoadingStatusEnum.Empty"></uh-data-loading>
		</view>
	</view>
</template>