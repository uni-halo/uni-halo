<script lang="ts" setup>
	import { computed, onMounted, ref, watch } from 'vue'
	import { getBanners } from '@/api/uni-halo'
	import { useAppConfigStore } from '@/store/appConfig'
	import { checkAvatarUrl, checkThumbnailUrl } from '@/utils/url'
	import { formatTime } from '@/utils/formatTime'
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

	const appConfigStore = useAppConfigStore()

	const haloConfigs = computed(() => appConfigStore.configs)
	const bannerConfig = computed(() => haloConfigs.value.featureConfig?.pages?.homeConfig?.bannerConfig)

	/* ---------------- 数据(高内聚:内部请求公开接口) ---------------- */
	const bannerList = ref<IBannerItem[]>([])
	const currentIndex = ref(0)
	const currentBanner = ref<IBannerItem | null>(null)

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
			date: formatTime({
				d: item.date,
				f: 'yyyy年MM月dd日 星期w'
			}),
			authorName: item.authorName,
			authorAvatar: item.authorAvatar ? checkAvatarUrl(item.authorAvatar) : '',
		}))
	}

	onMounted(async () => {
		try {
			const res = await getBanners()
			bannerList.value = mapBanners(res.data || [])
			handleBannerChange({
				detail: { current: 0 }
			})
		}
		catch (err) {
			console.error('获取轮播图失败', err)
		}
	})

	function handleBannerChange(e : any) {
		currentIndex.value = e?.detail?.current ?? 0
		currentBanner.value = bannerList.value[currentIndex.value]
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

	function handleToSearch() {
		uni.navigateTo({ url: '/pages-blog/search/search' })
	}
</script>

<template>
	<view v-if="bannerList.length > 0" class="relative w-full mb-6 box-border ">
		<view class="box-border relative w-full h-56 overflow-hidden">
			<swiper class="w-full h-56" :circular="true" :indicator-dots="false" :autoplay="true" :interval="3000"
				:duration="1000" @change="handleBannerChange">
				<swiper-item v-for="(item, index) in bannerList" :key="index" class="relative">
					<image :src="item.image || item.src" class="h-full w-full" mode="aspectFill"
						@click.stop="handleOnClick(item)" />
				</swiper-item>
			</swiper>
			<view v-if="currentBanner"
				class="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-y-2 bg-white/5 backdrop-blur-[2rpx]">
				<view class="box-border mt-3 flex items-center justify-center bg-secondary px-3 py-1 rounded-xl">
					<text class="text-2xs text-gray-900 font-semibold">
						{{ currentBanner.title }}
					</text>
				</view>
				<text
					class="text-xs text-white text-shadow-[0_2rpx_8rpx_rgba(0,0,0,0.4)]">{{ currentBanner.date }}</text>
			</view>
		</view>

		<view class="absolute bottom-0 left-0 right-0 h-12 w-full bg-gradient-to-b from-white/0 to-page" />
		<view class="absolute left-0 right-0 z-10 flex items-center justify-center uh-translate-y-n6">
			<view
				class="uh-global-card-glass border w-4/5 rounded-full px-4 py-2.5 text-gray-600 flex items-center justify-center gap-x-2"
				@click="handleToSearch()">
				<wd-icon name="search-line" size="32rpx"></wd-icon>
				<text class="text-2xs">哈喽，想看些什么 <text class="bg-secondary rounded-xl px-1">{ 内容 }</text> 呢~</text>
			</view>
		</view>
	</view>
</template>

<style scoped lang="scss">
/* 向上偏移定位 */
.uh-translate-y-n6 {
  transform: translateY(-1.5rem);
}
</style>