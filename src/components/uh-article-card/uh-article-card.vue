<script lang="ts" setup>
	import { computed } from 'vue'
	import { storeToRefs } from 'pinia'
	import { checkAvatarUrl, checkThumbnailUrl } from '@/utils/url'
	import { useSettingStore } from '@/store/setting'
	import { formatTime } from '@/utils/formatTime'
	import type { ICategory, IPost } from '@/api/types/halo'

	type CardLayout = 'image_top' | 'image_right' | 'image_bottom' | 'image_left'

	interface CardLayoutClasses {
		container : string
		cover : string
		contentWrapper : string
		footer : string
		authorGroup : string
		avatar : string
		nickname : string
		infoCol : string
		time : string
		tagCategory : string
		visits : string
		pinned : string
	}

	const props = withDefaults(defineProps<{
		from ?: 'home' | 'articles' | 'archives' | ''
		auditMode ?: boolean
		article : IPost
		variant ?: 'list' | 'grid'
		layout ?: CardLayout
	}>(), {
		auditMode: false,
		from: '',
		variant: 'list',
	})

	const { settings } = storeToRefs(useSettingStore())

	const isGrid = computed(() => props.variant === 'grid')

	const CARD_LAYOUTS = computed(()=> ({
		image_top: {
			container: `flex flex-col gap-y-2 ${isGrid.value ? '!p-0' : ''}`,
			cover: `mb-1 ${isGrid.value ? 'rounded-lb-0 rounded-rb-0' : ''} ${props.article.spec.cover?'':'pt-2'}`,
			contentWrapper: `box-border w-full ${isGrid.value ? 'p-2 pt-0' : ''}`,
			footer: 'flex items-center',
			authorGroup: 'flex-1 items-center justify-start gap-x-1',
			avatar: '',
			nickname: '',
			infoCol: 'items-center gap-x-1',
			time: 'flex-1 text-center',
			tagCategory: '',
			visits: 'flex-1 justify-end',
			pinned: `${isGrid.value ? 'right-2 top-2' : 'right-4 top-4'}`,
		},
		image_bottom: {
			container: 'flex flex-col gap-y-2',
			cover: 'order-2',
			contentWrapper: 'w-full',
			footer: 'order-first flex items-center mb-1',
			authorGroup: 'items-center gap-x-2',
			avatar: '!h-9 !w-9 !rounded-xl',
			nickname: '!text-xs mb-0.5',
			infoCol: 'leading-tight',
			time: '',
			tagCategory: '',
			visits: '',
			pinned: 'right-3 top-3',
		},
		image_left: {
			container: 'flex gap-x-3 !p-3',
			cover: 'shrink-0 !w-36 !h-24',
			contentWrapper: 'w-0 flex-1 justify-between',
			footer: 'flex items-center justify-between',
			authorGroup: 'items-center gap-x-1',
			avatar: '',
			nickname: '',
			infoCol: 'items-center gap-x-1',
			time: '!hidden',
			tagCategory: '!hidden',
			visits: '',
			pinned: 'left-4 top-4',
		},
		image_right: {
			container: 'flex gap-x-3 !p-3',
			cover: 'order-2 shrink-0 !w-36 !h-24',
			contentWrapper: 'order-1 w-0 flex-1 justify-between',
			footer: 'flex items-center justify-between',
			authorGroup: 'items-center gap-x-1',
			avatar: '',
			nickname: '',
			infoCol: 'items-center gap-x-1',
			time: '!hidden',
			tagCategory: '!hidden',
			visits: '',
			pinned: 'right-4 top-4',
		},
	}) as Record<CardLayout, CardLayoutClasses>)

	/** 各页面卡片样式字段名(与插件端 preferences 字段一致) */
	const CARD_TYPE_KEY : Record<'home' | 'articles' | 'archives', string> = {
		home: 'homeCardType',
		articles: 'articleCardType',
		archives: 'archivesCardType',
	}

	/** 实际生效布局:显式 layout > 按页面读取全局 cardType(首页/文章列表/文章归档)> image_top;窄列场景左右布局回退上图下文 */
	const effectiveLayout = computed<CardLayout>(() => {
		const globalSettings = settings.value
		const page = props.from === 'home' || props.from === 'articles' || props.from === 'archives'
			? props.from
			: null
		let raw = props.layout
		if (!raw) {
			raw = page
				? (globalSettings[CARD_TYPE_KEY[page]] as CardLayout)
				: 'image_top'
		}
		const narrow = isGrid.value || (props.from === 'home' && globalSettings.homeListLayout === 'double')
		if (narrow && raw !== 'image_top') {
			return 'image_top'
		}
		return raw
	})

	const cardLayout = computed(() => CARD_LAYOUTS.value[effectiveLayout.value] ?? CARD_LAYOUTS.value.image_top)

	/** 社交卡片形态(封面在下):左上用户信息(头像 + 昵称/日期垂直)、右上浏览数 */
	const isSocialCard = computed(() => effectiveLayout.value === 'image_bottom')

	const publishTimeText = computed(() => {
		const time = props.article.spec.publishTime
		return time ? formatTime({ d: time, f: 'yyyy/MM/dd' }) : ''
	})

	const visitCount = computed(() => {
		return props.article.status?.stats?.visits ?? props.article.stats?.visit ?? 0
	})

	function handleToArticleDetail() {
		if (props.auditMode) {
			return
		}
		uni.navigateTo({
			url: `/pages-blog/article-detail/article-detail?name=${props.article.metadata.name}`,
			animationType: 'slide-in-right',
		})
	}
</script>

<template>
	<view class="uh-global-card-glass uh-shadow-xs relative overflow-hidden rounded-xl p-3"
		:class="cardLayout.container" @click.stop="handleToArticleDetail()">
		<text v-if="article.spec.pinned"
			class="box-border uh-global-card-glass border text-gray-900 absolute z-1 rounded-md bg-secondary px-1.5 py-0.5 text-xs"
			:class="cardLayout.pinned">
			置顶
		</text>
		<view v-if="article.spec.cover" class="relative overflow-hidden" :class="[isGrid ? 'w-full h-24 rounded-lg' : 'w-full h-36 rounded-lg', cardLayout.cover]">
			<image class="w-full h-full block" :src="checkThumbnailUrl(article.spec.cover)" mode="aspectFill" lazy-load />
		</view>
		
		<view class="flex flex-col gap-y-3 text-sm" :class="cardLayout.contentWrapper">
			<view class="truncate font-bold text-3xs">
				{{ article.spec.title }}
			</view>
			<view class="text-xs leading-5" :class="isGrid ? 'line-clamp-1 text-gray-600' : 'line-clamp-2 text-gray-600'">
				{{ article.status?.excerpt }}
			</view>
			<view v-if="!isGrid" class="box-border flex flex-wrap gap-2" :class="cardLayout.tagCategory">
				<template v-if="article.categories && article.categories.length !== 0">
					<text v-for="cate in article.categories" :key="cate.metadata.name"
						class="box-border uh-global-card-glass border uh-shadow-xs rounded-xl bg-secondary px-2 py-0.5 text-xs">
						{{ cate.spec.displayName }}
					</text>
				</template>
				<template v-if="article.tags && article.tags.length !== 0">
					<text v-for="tag in article.tags" :key="tag.metadata.name"
						class="box-border uh-global-card-glass border uh-shadow-xs rounded-xl bg-secondary px-2 py-0.5 text-xs">
						# {{ tag.spec.displayName }}
					</text>
				</template>
			</view>
			<view class="flex items-center text-xs text-gray-500" :class="cardLayout.footer">
				<view class="flex items-center" :class="cardLayout.authorGroup">
					<image :src="checkAvatarUrl(article.owner?.avatar || '')"
						class="uh-global-card-glass h-5 w-5 rounded-full" :class="cardLayout.avatar"
						mode="aspectFill" />
					<template v-if="isSocialCard">
						<view :class="cardLayout.infoCol">
							<text class="block truncate"
								:class="cardLayout.nickname">{{ article.owner.displayName }}</text>
							<view class="flex items-center gap-x-2">
								<text class="text-gray-400" :class="cardLayout.time">{{ publishTimeText }}</text>
								<view class="visits flex items-center gap-x-1 text-gray-400">
									浏览
									<text class="number">{{ visitCount }}</text>
									次
								</view>
							</view>
						</view>
					</template>
					<text v-else class="min-w-0 flex-1 truncate">{{ article.owner.displayName }}</text>
				</view>
				<text v-if="!isGrid && !isSocialCard" class="text-gray-400"
					:class="cardLayout.time">{{ publishTimeText }}</text>
				<view v-if="!isGrid && !isSocialCard" class="visits flex items-center gap-x-1"
					:class="cardLayout.visits">
					浏览
					<text class="number">{{ visitCount }}</text>
					次
				</view>
			</view>
		</view>
	</view>
</template>