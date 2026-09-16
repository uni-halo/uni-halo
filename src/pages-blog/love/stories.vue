<script lang="ts" setup>
	import { ref } from 'vue'
	import { onLoad, onPageScroll, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
	import dayjs from 'dayjs'
	import { getLoveStories } from '@/api/uni-halo'
	import { getLoveModuleToken, handleLoveModuleLocked } from '@/utils/loveModuleToken'
	import { useAppConfigStore } from '@/store/appConfig'
	import { useLoveModuleUnlock } from '@/hooks/useLoveModuleUnlock'
	import { checkImageUrl } from '@/utils/url'
	import { sleep } from '@/utils/common'
	import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
	import { usePageScroll } from '@/hooks/usePageScroll'
	import type { ILoveStory } from '@/api/types/uni-halo'

	definePage({
		style: {
			navigationBarTitleText: '恋爱故事',
			navigationStyle: 'custom',
			enablePullDownRefresh: true,
		},
	})

	const { scrollY, updatePageScrollValue } = usePageScroll()
	const appConfigStore = useAppConfigStore()

	/* ---------------- 展示层类型 ---------------- */
	/** 时间轴故事卡片(script 预处理后的干净展示数据) */
	interface IStoryCard {
		/** 唯一 key(metadata.name,无则用索引) */
		key : string
		title : string
		date : string
		/** 日期拆分:年(如"2023") */
		year : string
		/** 日期拆分:月(如"5") */
		month : string
		/** 日期拆分:日(如"20") */
		day : string
		/** 日期拆分:星期(如"周六") */
		weekend : string
		location : string
		/** 故事正文(HTML) */
		content : string
		/** 全部图片(已预处理 URL) */
		images : string[]
		/** 时间轴封面图(最多 3 张,已预处理 URL) */
		coverImages : string[]
		/** 排序优先级(仅脚本跨页排序用,模板不展示) */
		priority : number
	}

	/** 空故事占位(弹窗未打开时) */
	const EMPTY_STORY : IStoryCard = {
		key: '',
		title: '',
		date: '',
		year: '',
		month: '',
		day: '',
		weekend: '',
		location: '',
		content: '',
		images: [],
		coverImages: [],
		priority: 0,
	}

	/** 中文星期(dayjs day():0=周日) */
	const WEEKDAY_TEXT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

	/** 从日期字符串拆分年月日星期(解析失败返回空) */
	function splitStoryDate(dateStr : string) {
		const d = dateStr ? dayjs(dateStr) : null
		if (!d || !d.isValid()) {
			return { year: '', month: '', day: '', weekend: '' }
		}
		return {
			year: `${d.year()}`,
			month: `${d.month() + 1}`,
			day: `${d.date()}`,
			weekend: WEEKDAY_TEXT[d.day()],
		}
	}

	/** 故事卡片映射:字段取值 + 日期拆分 + 图片路径预处理(模板不感知原始接口结构) */
	function mapStoryCard(story : ILoveStory, index : number) : IStoryCard {
		const spec = story.spec || {}
		const images = (spec.images || []).map(img => checkImageUrl(img || ''))
		return {
			key: story.metadata?.name || `story-${index}`,
			title: spec.title || '',
			date: spec.date || '',
			...splitStoryDate(spec.date || ''),
			location: spec.location || '',
			content: spec.content || '',
			images,
			coverImages: images.slice(0, 3),
			priority: spec.priority || 0,
		}
	}

	/** 故事列表排序(priority 越大越靠前;跨页 concat 后整体重排) */
	function sortStories(list : IStoryCard[]) : IStoryCard[] {
		return [...list].sort((a, b) => (b.priority || 0) - (a.priority || 0))
	}

	/* ---------------- 状态 ---------------- */
	const { loadingStatus, loadMoreStatus, updateLoadingStatus, updateLoadMoreStatus, resetLoadMoreStatus } = useDataLoadingStatus()
	const queryParams = ref({ page: 1, size: 10 })
	const stories = ref<IStoryCard[]>([])
	const showDetail = ref(false)
	const currentStory = ref<IStoryCard>(EMPTY_STORY)
	const storyImageIndex = ref(0)

	/* ---------------- 恋爱模块解锁（防分享直达：锁定未解锁时不加载数据） ---------------- */
	const {
		unlockModalVisible,
		unlockTip,
		isModuleLocked,
		openUnlock,
		handleUnlockRequest,
		handleUnlockSuccess,
	} = useLoveModuleUnlock()

	/** 是否放行数据加载（锁定未解锁时为 false，解锁成功置 true） */
	const canLoad = ref(false)

	/** 锁定则弹不可关闭解锁弹窗，返回是否放行 */
	function ensureUnlocked() : boolean {
		if (isModuleLocked('ourStory')) {
			openUnlock('ourStory')
			return false
		}
		return true
	}

	/** 解锁成功：存 token 后恢复数据加载 */
	function handlePageUnlockSuccess(data : { token ?: string }) {
		handleUnlockSuccess(data)
		if (getLoveModuleToken('ourStory')) {
			canLoad.value = true
			handleGetStories()
		}
	}

	/* ---------------- 数据加载 ---------------- */
	async function handleGetStories() {
		if (!loadMoreStatus.value.active) {
			updateLoadingStatus(DataLoadingStatusEnum.Loading)
		}
		try {
			const res = await getLoveStories({ ...queryParams.value })
			const items = res.data?.items || []
			if (loadMoreStatus.value.active) {
				// 分页加载:追加并按 priority 整体重排(跨页保持全局有序)
				stories.value = sortStories([...stories.value, ...items.map(mapStoryCard)])
				updateLoadMoreStatus({
					active: false,
					status: res.data?.hasNext ? 'loadMore' : 'noMore',
					hasNext: !!res.data?.hasNext,
				})
			}
			else if (items.length > 0) {
				// 首屏:按 priority 排序(越大越靠前)
				stories.value = sortStories(items.map(mapStoryCard))
				await sleep(600)
				updateLoadingStatus(DataLoadingStatusEnum.Success)
				updateLoadMoreStatus({
					active: false,
					status: res.data?.hasNext ? 'loadMore' : 'noMore',
					hasNext: !!res.data?.hasNext,
				})
			}
			else {
				// 降级:从旧配置读取单条故事
				handleLoadFromLegacy()
			}
		}
		catch (e) {
			console.error('获取故事失败', e)
			// 模块锁 401：清除 token 并弹不可关闭解锁弹窗（解锁后恢复加载）；命中 locked 不做旧配置降级
			if (handleLoveModuleLocked('ourStory', e)) {
				openUnlock('ourStory')
			}
			else {
				handleLoadFromLegacy()
			}
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

	function handleLoadFromLegacy() {
		const loveModuleConfig = appConfigStore.configs.featureConfig?.love as { ourStory ?: { content ?: string } } | undefined
		if (loveModuleConfig?.ourStory?.content) {
			stories.value = [{
				key: 'legacy-story',
				title: '我们的故事',
				date: '',
				year: '',
				month: '',
				day: '',
				weekend: '',
				location: '',
				content: loveModuleConfig.ourStory.content,
				images: [],
				coverImages: [],
				priority: 0,
			}]
			updateLoadingStatus(DataLoadingStatusEnum.Success)
			return
		}
		stories.value = []
		updateLoadingStatus(DataLoadingStatusEnum.Empty)
	}

	/* ---------------- 交互 ---------------- */
	function handleOnStoryClick(story : IStoryCard) {
		currentStory.value = story
		storyImageIndex.value = 0
		showDetail.value = true
	}

	function handleOnStoryImageChange(e : { detail : { current : number } }) {
		storyImageIndex.value = e.detail.current
	}

	/** 预览时间轴封面图(基于已预处理 URL) */
	function handlePreviewStoryImages(story : IStoryCard, index : number) {
		if (story.images.length === 0)
			return
		uni.previewImage({ current: story.images[index], urls: story.images })
	}

	/** 预览弹窗内大图 */
	function handlePreviewImage(index : number) {
		const urls = currentStory.value.images
		if (urls.length > 0) {
			uni.previewImage({ current: urls[index], urls })
		}
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
	onPageScroll((option : Page.PageScrollOption) => {
		updatePageScrollValue(option.scrollTop)
	})

	onLoad(() => {
		handlePageInit()
	})

	/** 页面初始化：先判定模块锁定（防分享直达），解锁或未设密码才加载数据 */
	async function handlePageInit() {
		await appConfigStore.bootstrap()
		if (!ensureUnlocked()) { return }
		canLoad.value = true
		handleGetStories()
	}

	onPullDownRefresh(() => {
		resetLoadMoreStatus()
		queryParams.value.page = 1
		handleGetStories()
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
			handleGetStories()
		}
	})
</script>

<template>
	<view class="app-page box-border min-h-screen w-screen flex flex-col">
		<!-- 自定义导航 -->
		<uh-navbar :scroll-y="scrollY" default-title="恋爱故事" title-color="text-love" back-class="text-love" />

		<!-- 加载/错误/空占位(状态机) -->
		<uh-data-loading v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus"
			min-height="75vh" empty-text="还没有故事，敬请期待吧~" @refresh="handleGetStories" />

		<!-- 时间轴 -->
		<view v-else class="box-border flex-1 p-3 pb-safe">
			<view class="relative box-border flex flex-col gap-y-3">
				<view v-for="(story, index) in stories" :key="story.key" class="relative flex"
					:class="index === stories.length - 1 ? '-last' : ''">
					<view class="shrink-0 box-border pr-2">
						<view class="flex flex-col items-center">
							<text class="text-2xl text-love font-bold">
								{{ story.day }} <text class="text-lg">号</text>
							</text>
							<text class=" mt-2 text-sm text-love">{{ story.year }}/{{ story.month }}月</text>
							<text class=" mt-1 text-xs text-gray-500">{{ story.weekend }}</text>
						</view>
					</view>
					<view class="relative overflow-hidden uh-global-card-glass box-border flex-1 rounded-xl p-3">
						<text v-if="false"
							class="absolute right-2 top-1 z-10 text-6xl text-love font-bold opacity-5">{{ story.day }}</text>
						<view class="flex items-start justify-between gap-x-2">
							<view class="text-md text-gray-900 font-bold truncate">
								{{ story.title }}
							</view>
							<uh-button custom-class="uh-global-card-glass shadow-none !bg-love/90 border text-white !py-1 px-2 text-xs !rounded-md"
								@click="handleOnStoryClick(story)">详情</uh-button>
						</view>
						<view v-if="story.location" class="mt-2 flex items-center text-xs text-gray-600">
							<wd-icon name="location"></wd-icon> <text>{{ story.location }}</text>
						</view>
						<view v-if="story.coverImages.length" class="relative mt-3 grid grid-cols-3 gap-2">
							<view v-for="(img, imgIndex) in story.coverImages" :key="imgIndex"
								class="h-16 w-full overflow-hidden rounded-lg"
								@click.stop="handlePreviewStoryImages(story, imgIndex)">
								<image class="timeline-cover-img h-full w-full" :src="img" mode="aspectFill"
									lazy-load />
							</view>
							<view v-if="story.images.length > 3"
								class="box-border px-1 py-0.5 rounded-lt-lg absolute bottom-0 right-0 flex items-center justify-center bg-black/30"
								@click.stop="handleOnStoryClick(story)">
								<text class="text-xs text-white">
									+{{ story.images.length - 3 }}
								</text>
							</view>
						</view>
					</view>
				</view>
			</view>
			<uh-data-loadmore :status="loadMoreStatus.status" :text="loadMoreStatus.text" />
		</view>

		<!-- 故事详情弹窗 -->
		<uh-glass-popup v-model="showDetail" :z-index="100" position="bottom" custom-class="rounded-xl">
			<view class="box-border p-3 h-full w-full flex flex-col overflow-hidden rounded-xl bg-white">
				<view class="story-detail-header box-border shrink-0 mb-4">
					<view class="story-detail-title text-lg text-gray-900 font-bold">
						{{ currentStory.title }}
					</view>
					<view v-if="currentStory.date || currentStory.location"
						class="mt-2 flex items-center text-xs text-gray-500">
						<text v-if="currentStory.date">
							<wd-icon name="time-line"></wd-icon> {{ currentStory.date }}
						</text>
						<text v-if="currentStory.location" class="ml-6">
							<wd-icon name="location"></wd-icon> {{ currentStory.location }}
						</text>
					</view>
				</view>
				<!-- 故事图片:多图 swiper 轮播 -->
				<view v-if="currentStory.images.length > 0" class="story-images shrink-0">
					<swiper v-if="currentStory.images.length > 1" class="h-32 w-full rounded-lg overflow-hidden" circular
						indicator-dots indicator-color="rgba(255,255,255,0.4)" indicator-active-color="#f83856"
						:current="storyImageIndex" @change="handleOnStoryImageChange">
						<swiper-item v-for="(img, imgIndex) in currentStory.images" :key="imgIndex"
							class="story-images-item h-full w-full">
							<image :src="img" mode="aspectFill" class="h-full w-full"
								@click="handlePreviewImage(imgIndex)" />
						</swiper-item>
					</swiper>
					<image v-else :src="currentStory.images[0]" mode="aspectFill"
						class="h-32 w-full" @click="handlePreviewImage(0)" />
				</view>
				<scroll-view scroll-y :show-scrollbar="false" class="mt-4 box-border max-h-[50vh] flex-1">
					<view class="story-html text-sm text-gray-900 leading-7" v-html="currentStory.content" />
				</scroll-view>
				<view class="w-full mt-3">
					<uh-button custom-class="uh-global-card-glass border !bg-love/90 !py-2 text-white" @click="showDetail = false">关闭</uh-button>
				</view>
			</view>
		</uh-glass-popup>

		<!-- 模块级密码解锁弹窗(强制不可关闭,防分享直达) -->
		<uh-unlock-popup v-model:show="unlockModalVisible" title="请解锁" captcha-enabled
			:tip="unlockTip" placeholder="请输入密码" confirm-text="进入" :closeable="false"
			:request="handleUnlockRequest" @success="handlePageUnlockSuccess" />
	</view>
</template>

<style scoped>
	.app-page {
		background: linear-gradient(-45deg, rgb(247 149 51 / 10%), rgb(243 112 85 / 10%) 15%, rgb(239 78 123 / 10%) 30%, rgb(161 102 171 / 10%) 44%, rgb(80 115 184 / 10%) 58%, rgb(16 152 173 / 10%) 72%, rgb(7 179 155 / 10%) 86%, rgb(109 186 130 / 10%));
		color: rgb(26 26 26);
	}
</style>