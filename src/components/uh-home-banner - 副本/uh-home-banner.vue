<script lang="ts" setup>
	/**
 * 轮播组件(源自旧项目 components/e-swiper,新建复刻)
 * 数据高内聚:默认内部请求 plugin-uni-halo 公开 banners 接口(getBanners),支持外部 list 覆盖
 * 支持:图片轮播、日期角标(useTop,显示当前条目 date 快照)、标题浮层(useTitle)、
 *      作者/日期信息浮层(useUser)、底部小图指示器(useDot)
 */
	import { computed, onMounted, ref, watch } from 'vue'
	import { getBanners } from '@/api/uni-halo'
	import { useAppConfigStore } from '@/store/appConfig'
	import { checkAvatarUrl, checkThumbnailUrl } from '@/utils/url'
	import type { IBannerPublicItem } from '@/api/types/uni-halo'

	export interface IBannerItem {
		/** 条目标识(Banner 为 metadata.name;兼容旧数据) */
		id ?: string | number
		/** Banner 条目 metadata.name(custom 详情页跳转用) */
		name ?: string
		title ?: string
		image ?: string
		src ?: string
		/** 来源:post=文章快照 / custom=自定义 */
		type ?: string
		/** 文章 id(source=post 时跳转文章详情) */
		postId ?: string
		content ?: string
		url ?: string
		/** 展示日期(ISO 快照) */
		date ?: string
		authorName ?: string
		authorAvatar ?: string
		[key : string] : unknown
	}

	const props = withDefaults(defineProps<{
		title ?: string
		height ?: string
		dotPosition ?: string
		/** 日期角标(显示当前条目 date) */
		useTop ?: boolean
		/** 底部小图指示器 */
		useDot ?: boolean
		/** 标题浮层 */
		useTitle ?: boolean
		/** 作者/日期信息浮层 */
		useUser ?: boolean
		/** 轮播数据列表(可选;不传时组件内部调公开 banners 接口拉取) */
		list ?: IBannerItem[]
		/** 当前选中的项(指示器坐标位置) */
		current ?: number
		/** 是否自动轮播 */
		autoplay ?: boolean
	}>(), {
		title: '',
		height: '450rpx',
		dotPosition: 'bottom',
		useTop: true,
		useDot: true,
		useTitle: true,
		useUser: true,
		current: 0,
		autoplay: false,
	})
	const appConfigStore = useAppConfigStore()

	const haloConfigs = computed(() => appConfigStore.configs)
	const bannerConfig = computed(() => haloConfigs.value.pageConfig?.homeConfig?.bannerConfig)

	/* ---------------- 状态 ---------------- */
	const currentIndex = ref(props.current)
	/** 是否禁止用户 touch 操作 */
	const disableTouch = ref(false)

	/* ---------------- 数据(高内聚:内部请求公开接口) ---------------- */
	const internalList = ref<IBannerItem[]>([])

	/** 展示列表:外部传入(list)优先,否则使用内部拉取数据 */
	const displayItems = computed<IBannerItem[]>(() =>
		props.list && props.list.length > 0 ? props.list : internalList.value,
	)

	/** 公开 Banner 条目 → 轮播展示项 */
	function mapBanners(items : IBannerPublicItem[]) : IBannerItem[] {
		return items.map(item => ({
			id: item.name,
			name: item.name,
			title: item.title || '',
			image: checkThumbnailUrl(item.cover),
			src: checkThumbnailUrl(item.cover),
			type: item.source,
			postId: item.postId,
			url: item.link,
			date: item.date,
			authorName: item.authorName,
			authorAvatar: item.authorAvatar ? checkAvatarUrl(item.authorAvatar) : '',
		}))
	}

	onMounted(async () => {
		// 外部已传数据时不再重复请求
		if (props.list && props.list.length > 0) {
			return
		}
		try {
			const res = await getBanners()
			internalList.value = mapBanners(res.data || [])
		}
		catch (err) {
			console.error('获取轮播图失败', err)
		}
	})

	// 列表变化(外部覆盖/接口返回)后索引越界时归零
	watch(displayItems, (val) => {
		if (currentIndex.value >= val.length) {
			currentIndex.value = 0
		}
	})

	/* ---------------- 计算属性 ---------------- */
	const currentItem = computed<IBannerItem>(() =>
		displayItems.value[currentIndex.value] || {},
	)

	/** 日期角标(useTop):当前条目 date 快照转换(年/月/日) */
	const dateParts = computed(() => {
		const dateStr = currentItem.value.date as string | undefined
		if (!dateStr) {
			return null
		}
		const d = new Date(dateStr)
		if (Number.isNaN(d.getTime())) {
			return null
		}
		const monthArray = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
		return {
			day: String(d.getDate()).padStart(2, '0'),
			month: String(d.getMonth() + 1).padStart(2, '0'),
			monthEn: monthArray[d.getMonth()],
			year: String(d.getFullYear()),
		}
	})

	const currentTitle = computed(() => currentItem.value.title || props.title || '')

	/** 作者日期展示(useUser 用) */
	const authorDateText = computed(() => {
		const dateStr = currentItem.value.date as string | undefined
		if (!dateStr) {
			return ''
		}
		const d = new Date(dateStr)
		if (Number.isNaN(d.getTime())) {
			return ''
		}
		const pad = (n : number) => String(n).padStart(2, '0')
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
	})

	/* ---------------- 交互 ---------------- */
	/** current 改变时会触发 change 事件,event.detail = {current, source} */
	function change(e : { detail : { current : number, source : string } }) {
		const { current, source } = e.detail
		// 只有页面自动切换、手动切换时才轮播,其他不允许
		if (source === 'autoplay' || source === 'touch') {
			const event = { current }
			currentIndex.value = current
		}
	}

	/** 手动点击了指示器[小图模式] */
	function swiperIndTap(index : number) {
		const event = { current: index }
		currentIndex.value = index
	}

	function handleOnClick(item : IBannerItem) {
		// 审核模式下照常展示 Banner,点击分发不拦截(详情页自行处理审核限制)
		if (item.type === 'custom') {
			// 自定义条目:跳转 Banner 详情页,页面内调公开详情接口展示 content/外链
			if (item.name) {
				uni.navigateTo({
					url: `/pages-blog/banner-detail/banner-detail?name=${item.name}`,
					animationType: 'slide-in-right',
				})
			}
			return
		}
		// 文章来源 
		uni.navigateTo({
			url: `/pages-blog/article-detail/article-detail?name=${item.postId}`,
			animationType: 'slide-in-right',
		})
	}
</script>

<template>
	<view v-if="displayItems.length > 0" class="relative w-full px-4 pt-12 mb-14 box-border">

		<view class="absolute inset-0 blur-[2rpx]">
			<image :src="displayItems[currentIndex].src" class="h-full w-full" mode="aspectFill"></image>
		</view>

		<view class="uh-global-card-glass box-border relative w-full overflow-hidden rounded-xl translate-y-12" :class="[dotPosition]">
			<swiper class="w-full" :style="{ height }" :circular="true" :indicator-dots="false"
				:autoplay="autoplay" :interval="3000" :duration="1000" :current="currentIndex"
				:disable-touch="disableTouch" @change="change">
				<swiper-item v-for="(item, index) in displayItems" :key="index">
					<image :src="item.image || item.src" class="h-full w-full" mode="aspectFill"
						@click.stop="handleOnClick(item)" />
				</swiper-item>
			</swiper>

			<!-- 指示器 [Top 日期角标]:显示当前条目 date(年/月/日) -->
			<view v-if="useTop && dateParts"
				class="box-border absolute inset-x-0 top-0 z-5 flex items-center px-[24rpx] py-[16rpx]">
				<text class="text-[40rpx] text-white font-bold text-shadow-[0_2rpx_8rpx_rgba(0,0,0,0.4)]">
					{{ dateParts.day }}
				</text>
				<view class="ml-[12rpx] h-[40rpx] w-[2rpx] bg-white/50" />
				<view class="ml-[12rpx] flex flex-col">
					<text class="text-[20rpx] text-white text-shadow-[0_2rpx_8rpx_rgba(0,0,0,0.4)]">
						{{ dateParts.monthEn }}
					</text>
					<text class="text-[16rpx] text-white/80">{{ dateParts.year }}</text>
				</view>
				<text
					class="text-overflow-2 ml-[20rpx] block flex-1 text-[24rpx] text-white text-shadow-[0_2rpx_8rpx_rgba(0,0,0,0.4)]">
					{{ title }}
				</text>
			</view>

			<!-- 指示器 标题区域 + 作者/日期信息(useUser) -->
			<view v-if="useTitle"
				class="absolute inset-x-0 bottom-0 z-5 from-black/45 to-transparent bg-gradient-to-t px-[24rpx] pb-[20rpx] pt-[48rpx]">
				<view v-if="useUser && (currentItem.authorName || authorDateText)"
					class="mb-[8rpx] flex items-center gap-[8rpx]">
					<view v-if="currentItem.authorAvatar"
						class="h-[36rpx] w-[36rpx] overflow-hidden border-[1rpx] border-white/60 rounded-full">
						<image :src="currentItem.authorAvatar" class="h-full w-full" mode="aspectFill" />
					</view>
					<text class="text-[22rpx] text-white/92 text-shadow-[0_1rpx_4rpx_rgba(0,0,0,0.4)]">
						{{ currentItem.authorName }}
					</text>
					<text v-if="authorDateText"
						class="text-[20rpx] text-white/70 text-shadow-[0_1rpx_4rpx_rgba(0,0,0,0.4)]">
						{{ authorDateText }}
					</text>
				</view>
				<text v-if="currentTitle"
					class="text-overflow-2 block text-[28rpx] text-white font-bold text-shadow-[0_2rpx_8rpx_rgba(0,0,0,0.4)]">
					{{ currentTitle }}
				</text>
			</view>

			<!-- 指示器 [底部小图列表] -->
			<view v-if="useDot" class="absolute inset-x-0 bottom-3 z-5 flex justify-end px-[24rpx]">
				<view class="flex gap-1">
					<view v-for="(item, index) in displayItems" :key="index"
						class="uh-global-card-glass h-[64rpx] w-[96rpx] overflow-hidden border-[2rpx] rounded-[8rpx]"
						:class="currentIndex === index ? 'opacity-100 border-white' : 'opacity-60 border-transparent'"
						@click="swiperIndTap(index)">
						<image :src="item.image || item.src" class="h-full w-full" mode="aspectFill" />
					</view>
				</view>
			</view>
		</view>
	</view>
</template>