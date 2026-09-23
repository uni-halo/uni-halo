<script lang="ts" setup>
	import { ref } from 'vue'
	import { onLoad, onPageScroll, onPullDownRefresh, onReachBottom, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
	import { getNoticeTypes, getNotices } from '@/api/uni-halo'
	import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
	import { usePageScroll } from '@/hooks/usePageScroll'
	import { usePageTitle } from '@/hooks/usePageTitle'
	import { useNavbarSticky } from '@/hooks/useNavbarSticky'
	import { checkImageUrl } from '@/utils/url'
	import { sleep } from '@/utils/common'
	import { formatTime } from '@/utils/formatTime'
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
	/** 请求并发锁(触底加载与重置加载互斥) */
	const fetching = ref(false)
	/** 请求序列号:切换分类/排序时丢弃过期响应,避免旧结果覆盖新筛选结果 */
	let requestSeq = 0
	/** 触底加载更多底部文案(加载中/上拉加载更多/没有更多/失败提示) */
	const loadMoreText = ref('')

	const SORT_OPTIONS : Array<{ id : SortKey, label : string }> = [
		{ id: 'latest', label: '最新在前' },
		{ id: 'earliest', label: '最早在前' },
		{ id: 'group', label: '按类型分组' },
	]

	/** 前端排序键 → 服务端 sort 参数(筛选与排序均由服务端完成) */
	const SORT_PARAM : Record<SortKey, string> = {
		latest: 'date_desc',
		earliest: 'date_asc',
		group: 'type',
	}

	/* ---------------- 分享 ---------------- */

	onShareAppMessage(() => ({
		title: pageTitle.value,
		path: '/pages-blog/notice/notice',
	}))

	onShareTimeline(() => ({
		title: pageTitle.value,
		query: '',
	}))

	/* ---------------- 分类列表 ---------------- */
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
 

	/* ---------------- 数据加载---------------- */
	async function loadNotices(reset : boolean) {
		// 触底加载受并发锁保护;重置加载(下拉刷新/切换筛选)优先执行
		if (!reset && fetching.value) { return }
		const seq = ++requestSeq
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
			const res = await getNotices({
				page: target,
				size: PAGE_SIZE,
				type: activeType.value || undefined,
				sort: SORT_PARAM[sortKey.value],
			})
			// 已被更新的请求(切换分类/排序)取代,丢弃本次结果
			if (seq !== requestSeq) { return }
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
			// 已被更新的请求取代,不写错误态
			if (seq !== requestSeq) { return }
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
			// 仅最新请求负责收尾,避免旧请求提前解锁
			if (seq === requestSeq) {
				setTimeout(() => {
					fetching.value = false
					uni.stopPullDownRefresh()
				}, 500)
			}
		}
	}

	/** 切换分类:重新请求服务端筛选结果(再次点击已选中的分类则回到「全部」) */
	function handleTypeChange(name : string) {
		const next = activeType.value === name ? '' : name
		if (activeType.value === next) { return }
		activeType.value = next
		loadNotices(true)
	}

	/** 切换排序:重新请求服务端排序结果 */
	function handleSortChange(key : SortKey) {
		if (sortKey.value === key) { return }
		sortKey.value = key
		loadNotices(true)
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
		// 重置加载可覆盖进行中的请求(旧响应按 requestSeq 丢弃)
		loadNotices(true)
	})

	/* ---------------- 跳转 ---------------- */
	function handleToDetail(item : INoticeListVo) {
		if (!item.name) { return }
		uni.navigateTo({ url: `/pages-blog/notice/detail?name=${item.name}` })
	}
</script>

<template>
	<view class="min-h-screen w-screen flex flex-col bg-page">
		<uh-navbar :scroll-y="scrollY" :default-title="pageTitle" title-color="text-gray-900" />

		<wd-sticky :offset-top="offsetTop">
			<view class="w-screen overflow-hidden">
				<scroll-view :scroll-x="true" :show-scrollbar="false" class="w-full whitespace-nowrap">
					<view
						class="uh-global-card-glass shadow-none mb-2 ml-3 inline-flex border rounded-2xl px-4 py-1.5 text-xs"
						:class="activeType === '' ? 'bg-primary text-gray-900 font-semibold' : 'text-gray-500'"
						@click="handleTypeChange('')">
						全部
					</view>
					<view v-for="(type) in noticeTypes" :key="type.metadata?.name"
						class="mb-2 ml-3 box-border uh-global-card-glass shadow-none inline-flex items-center gap-1 border rounded-2xl px-4 py-1.5 text-xs"
						:class="activeType === type.metadata?.name ? 'bg-primary text-gray-900 font-semibold' : 'text-gray-500'"
						@click="handleTypeChange(type.metadata?.name || '')">
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
							@click="handleSortChange(opt.id)">
							{{ opt.label }}
						</view>
					</view>
				</scroll-view>
			</view>
		</wd-sticky>

		<uh-data-loading v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus"
			empty-text="暂无公告" min-height="75vh" @refresh="loadNotices(true)" />

		<view v-else class="box-border pt-4">
			<view class="box-border flex flex-col gap-3 px-3">
				<view v-for="item in allItems" :key="item.name"
					class="box-border uh-global-card-glass uh-shadow-xs flex overflow-hidden rounded-xl p-3"
					@click="handleToDetail(item)">
					<!-- 有图，wd-img 如果加载空的地址 会一直处于loading状态，所以空值我们不加载 -->
					<wd-img v-if="item.cover" class="mr-3 h-18 w-24 shrink-0" :radius="8" :src="checkImageUrl(item.cover)"
						mode="aspectFill">
						<template #loading>
							<wd-loading size="64rpx" custom-class="text-primary" />
						</template>
					</wd-img>
					<!-- 无图 -->
					<view v-else
						class="mr-3 h-18 w-24 shrink-0 flex items-center justify-center from-[#ebfabf] to-[#f5fae8] bg-gradient-to-b text-gray-400">
						<wd-icon class-prefix="uhemoji-icon" name="-injury" size="48rpx" />
					</view>
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
								{{ formatTime({d:item.publishTime,f:'yyyy年MM月dd日 星期w'}) }}
							</text>
						</view>
					</view>
				</view>
				<view class="load-text py-5 text-center text-[24rpx] text-gray-500">
					{{ loadMoreText }}
				</view>
			</view>

		</view>
	</view>
</template>