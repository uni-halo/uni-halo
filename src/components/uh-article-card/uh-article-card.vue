<script lang="ts" setup>
	import { computed } from 'vue'
	import { checkThumbnailUrl } from '@/utils/url'
	import { useSettingStore } from '@/store/setting'
	import { formatTime } from '@/utils/formatTime'
	import type { IPost,ICategory } from '@/api/types/halo'

	const props = withDefaults(defineProps<{
		from ?: string
		auditMode?: boolean
		article : IPost
	}>(), {
		auditMode: false,
		from: '',
	})

	const settingStore = useSettingStore()

	/** 卡片布局 class(由全局设置 layout 决定) */
	const cardType = computed(() => {
		const layout = settingStore.settings.layout
		// 首页双列时强制上图下文布局,除非显式指定其他
		if (props.from === 'home' && layout.home === 'h_row_col2') {
			if (!['tb_image_text', 'tb_text_image', 'only_text'].includes(layout.cardType)) {
				return [props.from, layout.home, 'tb_image_text']
			}
			return [props.from, layout.home, layout.cardType]
		}
		return [layout.home, layout.cardType]
	})

	/** 发布时间格式化 yyyy-MM-dd */
	const publishTimeText = computed(() => {
		const time = props.article.spec.publishTime
		return time ? formatTime({ d: time, f: 'yyyy-MM-dd' }) : ''
	})

	/** 阅读数(兼容 status.stats.visits 与旧版顶层 stats.visit) */
	const visitCount = computed(() => {
		return props.article.status?.stats?.visits ?? props.article.stats?.visit ?? 0
	})

	function handleToArticleDetail() {
		uni.navigateTo({
			url: `/pages-blog/article-detail/article-detail?name=${props.article.metadata.name}`,
			animationType: 'slide-in-right',
		})
	}
	
	function handleToCategory(category : ICategory) {
		if (props.auditMode) {
			return
		}
		uni.navigateTo({
			url: `/pages-blog/category-articles/category-articles?name=${category.metadata.name}&title=${category.spec.displayName}`,
		})
	}
</script>

<template>
	<view class="uh-global-card-glass uh-shadow-xs overflow-hidden relative rounded-xl p-3"
		@click.stop="handleToArticleDetail()">
		<text v-if="article.spec.pinned"
			class="absolute right-6 top-6 z-1 bg-secondary text-gray-60 text-xs px-2 py-1 rounded-lg"> 置顶 </text>
		<image class="w-full h-36 rounded-lg" :src="checkThumbnailUrl(article.spec.cover)" mode="aspectFill"
			lazy-load />
		<view class="flex flex-col w-full gap-y-2 text-sm">
			<view class="mt-2 font-bold truncate">
				{{ article.spec.title }}
			</view>
			<view class="content line-clamp-2 text-gray-600">
				{{ article.status?.excerpt }}
			</view>
			<view class="my-1 box-border flex flex-wrap gap-2">
				<template v-if="article.categories && article.categories.length !== 0">
					<text v-for="cate in article.categories" :key="cate.metadata.name"
						class="py-1 px-2 text-xs rounded-xl bg-secondary" @click.stop="handleToCategory(cate)">
						{{ cate.spec.displayName }}
					</text>
				</template>
				<template v-if="article.tags && article.tags.length !== 0">
					<text v-for="tag in article.tags" :key="tag.metadata.name"
						class="py-1 px-2 text-xs rounded-xl bg-secondary">
						# {{ tag.spec.displayName }}
					</text>
				</template>
			</view>
			<view class="flex items-center justify-between text-xs text-gray-500">
				<view class="flex items-center gap-x-1">
					<image :src="article.owner.avatar" class="uh-global-card-glass rounded-full w-5 h-5"
						mode="aspectFill"></image>
					<text>{{article.owner.displayName}}</text>
				</view>
				<view class="flex items-center gap-x-2">
					{{ publishTimeText }}
				</view>
				<view class="visits">
					浏览
					<text class="number">{{ visitCount }}</text>
					次
				</view>
			</view>
		</view>
	</view>
</template>