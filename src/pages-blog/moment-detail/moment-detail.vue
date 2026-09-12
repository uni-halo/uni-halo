<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad, onPageScroll, onPullDownRefresh, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
	import { getMomentByName } from '@/api/halo'
	import { useUpvote } from '@/hooks/useUpvote'
	import { useAppConfigStore } from '@/store/appConfig'
	import { useFavoritesStore } from '@/store/favorites'
	import { checkAvatarUrl, checkThumbnailUrl } from '@/utils/url'
	import { buildMomentFavoriteItem } from '@/utils/favorite'
	import { generateUUID } from '@/utils/uuid'
	import { formatTime as formatTimeUtil } from '@/utils/formatTime'
	import { randomTagColor } from '@/utils/random'
	import { markdownConfig } from '@/config/markdown'
	import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
	import { usePageScroll } from '@/hooks/usePageScroll'
	import type { IMoment } from '@/api/types/halo'

	definePage({
		style: {
			navigationBarTitleText: '瞬间详情',
			enablePullDownRefresh: true,
			navigationStyle: 'custom',
		},
	})

	const { scrollY, updatePageScrollValue } = usePageScroll()
	const appConfigStore = useAppConfigStore()
	const favoritesStore = useFavoritesStore()
	const haloConfigs = computed(() => appConfigStore.configs)

	const bloggerInfo = computed(() => {
		const blogger = haloConfigs.value.authorConfig?.blogger as { nickname ?: string, avatar ?: string } | undefined
		return {
			nickname: blogger?.nickname || '',
			avatar: checkAvatarUrl(blogger?.avatar),
		}
	})

	const calcUseTagRandomColor = computed(() => !!haloConfigs.value.pageConfig?.momentConfig?.useTagRandomColor)

	const siteName = computed(() => {
		const appInfo = haloConfigs.value.appConfig?.appInfo as { name ?: string } | undefined
		return appInfo?.name || bloggerInfo.value.nickname || 'uni-halo'
	})

	/* ---------------- 状态 ---------------- */
	const queryName = ref('')
	const videoContexts = ref<Record<string, UniApp.VideoContext | undefined>>({})
	const currentVideoId = ref<string | null>(null)

	type MomentCard = IMoment & {
		images ?: { type ?: string, url : string }[]
		videos ?: { id ?: string, url : string }[]
		audios ?: { type ?: string, url : string }[]
		spec : IMoment['spec'] & { newHtml ?: string }
	}

	/** 移除 tag 链接 */
	function removeTagLinksCompletely(htmlString : string) : string {
		const regex = /<a\b[^>]+class=(['"])[^'"]*\btag\b[^'"]*\1[^>]*>[\s\S]*?<\/a>/gi
		return htmlString.replace(regex, '')
	}

	/** 瞬间详情 */
	function buildMomentCard(res : IMoment) : MomentCard {
		const medium = (res.spec.content?.medium || [])
			.map(x => ({ ...x, url: x.url || '' }))
		const owner = res.owner
		return {
			...res,
			// 无顶层 owner(如个别历史接口)时兜底为博主信息
			owner: owner?.displayName
				? owner
				: { displayName: bloggerInfo.value.nickname || '', name: bloggerInfo.value.nickname || '', avatar: bloggerInfo.value.avatar },
			spec: {
				...res.spec,
				newHtml: removeTagLinksCompletely(res.spec.content?.html || ''),
			},
			images: medium.filter(x => x.type === 'PHOTO').map(x => ({ ...x, url: checkThumbnailUrl(x.url, true) })),
			videos: medium.filter(x => x.type === 'VIDEO').map(x => ({ ...x, id: generateUUID() })),
			audios: medium.filter(x => x.type === 'AUDIO'),
		}
	}

	/* ---------------- 数据加载(useDataLoadingStatus 状态机接管) ---------------- */
	const moment = ref<MomentCard | null>(null)
	const { loadingStatus: status, updateLoadingStatus } = useDataLoadingStatus()

	async function loadMoment() {
		updateLoadingStatus(DataLoadingStatusEnum.Loading)
		try {
			const res = await getMomentByName(queryName.value)
			const card = buildMomentCard(res.data)
			moment.value = card 
			
			updateLoadingStatus(
				Object.keys(card).length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success,
			)
			nextTick(() => {
				createVideoContexts(card.videos || [])
			})
		}
		catch (err) {
			console.error('[moment-detail] 加载失败', err)
			updateLoadingStatus(DataLoadingStatusEnum.Error)
		}
	}

	/** 标签颜色(随机模式下按数据稳定,避免每次渲染重新随机变色) */
	const calcTagColors = computed(() => {
		const tags = moment.value?.spec.tags || []
		return tags.map(() => (calcUseTagRandomColor.value ? randomTagColor() : '#4d7c0f'))
	})

	/** 刊头大字日期(如 09月03日) */
	const calcMastheadDate = computed(() => {
		const time = moment.value?.spec.releaseTime
		return time ? formatTimeUtil({ d: time, f: 'MM月dd日' }) : ''
	})

	/** 刊头辅助信息(如 2026年 · 星期四) */
	const calcMastheadMeta = computed(() => {
		const time = moment.value?.spec.releaseTime
		return time ? formatTimeUtil({ d: time, f: 'yyyy年 · 星期w' }) : ''
	})

	/* ---------------- 收藏 ---------------- */
	/** 当前瞬间是否已收藏(悬浮胶囊高亮) */
	const momentFavorited = computed(() => {
		const name = moment.value?.metadata.name
		return !!name && favoritesStore.isFavorite('moment', name)
	})

	/** 切换收藏(收藏/取消),收藏时按当前详情内容生成快照入库 */
	function handleToggleMomentFavorite() {
		const card = moment.value
		if (!card) { return }
		const favorited = favoritesStore.toggle(buildMomentFavoriteItem(card))
		uni.showToast({ icon: 'none', title: favorited ? '收藏成功' : '已取消收藏' })
	}

	/* ---------------- 点赞 ---------------- */
	const { hasUpvoted, handleDoLikes } = useUpvote('moments', () => moment.value?.metadata.name)

	function handleDoLikesClick() {
		handleDoLikes((name) => {
			const current = moment.value
			if (current?.stats) {
				current.stats.upvote = (current.stats.upvote || 0) + 1
			}
		})
	}

	/* ---------------- 评论 ---------------- */
	const commentModal = ref({
		show: false,
		isComment: false,
		postName: '',
		title: '',
		quoteReply: '',
	})
	/** 评论列表组件实例(评论成功后刷新) */
	const commentListRef = ref<{ refresh : () => void } | null>(null)

	function handleToComment() {
		const current = moment.value
		if (!current)
			return
		if (!current.spec.allowComment) {
			uni.showToast({ icon: 'none', title: '瞬间已开启禁止评论！' })
			return
		}
		commentModal.value = {
			show: true,
			isComment: true,
			postName: current.metadata.name,
			title: '新增评论',
			quoteReply: '',
		}
	}

	/** 评论列表触发(回复某条评论/新增) */
	function handleOnComment(data : { isComment : boolean, postName : string, title : string, quoteReply ?: string }) {
		commentModal.value = {
			show: true,
			isComment: data.isComment,
			postName: data.postName,
			title: data.title,
			quoteReply: data.quoteReply ?? '',
		}
	}

	function handleOnCommentModalClose(data : { refresh : boolean, isSubmit : boolean }) {
		commentModal.value.show = false
		if (data.isSubmit) {
			// 评论成功后刷新评论列表与计数
			commentListRef.value?.refresh()
			loadMoment()
		}
	}

	/* ---------------- 视频互斥 ---------------- */
	function createVideoContexts(videos : { id ?: string }[]) {
		stopAllVideos()
		videos.forEach((item) => {
			if (item.id) {
				videoContexts.value[item.id] = uni.createVideoContext(`video_${item.id}`)
			}
		})
	}

	function stopAllVideos(excludesVideoId : string | null = null) {
		Object.keys(videoContexts.value).forEach((videoId) => {
			if (!excludesVideoId || excludesVideoId !== videoId) {
				videoContexts.value[videoId]?.pause()
			}
		})
	}

	function onVideoPlay(videoId : string) {
		currentVideoId.value = videoId
		stopAllVideos(videoId)
	}

	function onVideoPause(videoId : string) {
		if (currentVideoId.value === videoId) {
			currentVideoId.value = null
		}
	}

	function onVideoEnded() {
		currentVideoId.value = null
	}

	/* ---------------- 交互 ---------------- */
	function handlePreview(index : number, list : { url : string }[]) {
		uni.previewImage({
			current: index,
			urls: list.map(item => item.url),
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
	onPageScroll((option : Page.PageScrollOption) => {
		updatePageScrollValue(option.scrollTop)
	})

	onLoad((options) => {
		queryName.value = options?.name || ''
		loadMoment()
	})

	onPullDownRefresh(async () => {
		videoContexts.value = {}
		currentVideoId.value = null
		await loadMoment()
		uni.stopPullDownRefresh()
	})

	onShareAppMessage(() => ({
		path: `/pages-blog/moment-detail/moment-detail?name=${moment.value?.metadata.name}`,
		title: moment.value?.owner?.displayName || '',
	}))

	onShareTimeline(() => ({
		title: moment.value?.owner?.displayName || '',
		query: moment.value ? `name=${moment.value.metadata.name}` : '',
	}))
</script>

<template>
	<view class="app-page box-border min-h-screen w-screen bg-page pb-safe">
		<uh-navbar :scroll-y="scrollY" default-title="瞬间详情" title-color="text-gray-900" />

		<uh-data-loading v-if="status !== 'success'" :loading-status="status" min-height="60vh" error-text="瞬间内容加载失败"
			empty-text="瞬间不存在或已被删除" @refresh="loadMoment" />

		<view v-else-if="moment" class="box-border px-3 pt-2 pb-12">
			<view class="mb-3 uh-global-card-glass uh-shadow-xs overflow-hidden rounded-2xl  box-border pb-4">
				<!-- 刊头:大字日期 -->
				<view v-if="moment.spec.releaseTime" class="px-4 pt-4">
					<view class="text-[56rpx] text-gray-900 font-bold leading-tight">
						{{ calcMastheadDate }}
					</view>
					<view class="mt-1 text-[24rpx] text-gray-400">
						{{ calcMastheadMeta }}
					</view>
					<view class="mt-4 h-[8rpx] w-[96rpx] rounded-full bg-secondary" />
				</view>

				<!-- 作者 -->
				<view class="flex items-center px-4 pt-6">
					<image class="h-[80rpx] w-[80rpx] shrink-0 rounded-full"
						:src="checkAvatarUrl(moment.owner?.avatar || bloggerInfo.avatar)" mode="aspectFill" />
					<view class="ml-3 flex flex-col">
						<view class="text-[30rpx] text-[#5c7c0f] font-bold">
							{{ moment.owner?.displayName || bloggerInfo.nickname }}
						</view>
						<view class="mt-0.5 text-[22rpx] text-gray-400">
							记录了这美好的一刻
						</view>
					</view>
				</view>

				<!-- 正文 -->
				<view class="content px-4 mt-6 text-gray-900 text-sm">
					<mp-html lazy-load :domain="markdownConfig.domain ?? ''" :loading-img="markdownConfig.loadingGif"
						scroll-table selectable :tag-style="markdownConfig.tagStyle"
						:container-style="markdownConfig.containStyle" :content="moment.spec.newHtml || ''"
						:markdown="true" :show-line-number="true" :show-language-name="true" copy-by-long-press />
				</view>

				<!-- 图片附件 -->
				<view v-if="moment.images && moment.images.length !== 0" class="px-3 mt-4">
					<view class="images flex flex-wrap items-start">
						<view v-for="(image, mediumIndex) in moment.images" :key="mediumIndex"
							class="image-item box-border p-1.5"
							:class="moment.images && moment.images.length === 1 ? 'h-[350rpx] w-full' : (moment.images && moment.images.length === 2 ? 'h-[250rpx] w-1/2' : 'h-[200rpx] w-1/3')">
							<image mode="aspectFill" class="image-src h-full w-full rounded-lg" :src="image.url"
								@click="handlePreview(mediumIndex, moment.images || [])" />
						</view>
					</view>
				</view>

				<!-- 音频附件 -->
				<view v-if="moment.audios && moment.audios.length !== 0" class="px-4 mt-4">
					<view class="audio-list flex flex-col gap-3">
						<uh-audio-player v-for="audio in moment.audios" :key="audio.url" :src="audio.url"
							:poster="bloggerInfo.avatar" :name="`来自${siteName}的声音`" :author="bloggerInfo.nickname" />
					</view>
				</view>

				<!-- 视频附件 -->
				<view v-if="moment.videos && moment.videos.length !== 0" class="px-4 mt-4">
					<view class="video-list w-full flex flex-col gap-3">
						<video v-for="(video, index) in moment.videos" :id="`video_${video.id}`" :key="index"
							class="video-src h-[400rpx] w-full rounded-xl" :src="video.url" :show-mute-btn="true"
							:controls="true" :show-center-play-btn="true" :enable-progress-gesture="true"
							@play="onVideoPlay(video.id || '')" @pause="onVideoPause(video.id || '')"
							@ended="onVideoEnded" />
					</view>
				</view>

				<!-- 标签 -->
				<view v-if="moment.spec.tags && moment.spec.tags.length !== 0"
					class="tags flex flex-wrap gap-2 px-4 pt-6">
					<view v-for="(tag, tagIndex) in moment.spec.tags" :key="tagIndex"
						class="rounded-full bg-primary px-3 py-1 text-xs font-bold">
						# {{ tag }}
					</view>
				</view>
			</view>

			<!-- 评论列表(瞬间评论,kind=Moment) -->
			<uh-comment-list v-if="moment" ref="commentListRef" :post-name="moment.metadata.name" :post="moment"
				kind="Moment" :disallow-comment="!moment.spec.allowComment" @on-comment="handleOnComment" />
		</view>

		<!-- 悬浮操作 -->
		<view v-if="moment"
			class="fixed bottom-8 left-1/2 z-10 flex items-center justify-center pb-safe uh-translate-x-center">
			<view
				class="uh-global-card-glass box-border flex items-center justify-center gap-2 border rounded-full p-1 text-primary">
				<!-- 点赞 -->
				<view
					class="uh-global-card-glass box-border h-[72rpx] flex flex-1 items-center justify-center gap-x-1 border rounded-full px-4 shadow-none"
					:class="[hasUpvoted()?'text-primary':'text-gray-900']" @click="handleDoLikesClick">
					<wd-icon class-prefix="uhemoji-icon" name="-kiss-" size="36rpx" />
					<text class="shrink-0 text-sm text-gray-900 font-semibold">点赞</text>
				</view>
				<!-- 评论 -->
				<view v-if="moment.spec.allowComment"
					class="uh-global-card-glass box-border h-[72rpx] flex flex-1 items-center justify-center gap-x-1 border rounded-full px-4 shadow-none"
					@click="handleToComment()">
					<wd-icon class-prefix="uhemoji-icon" name="-thinking" size="36rpx" />
					<text class="shrink-0 text-sm text-gray-900 font-semibold">评论</text>
				</view>
				<!-- 收藏 -->
				<view
					class="uh-global-card-glass box-border h-[72rpx] flex flex-1 items-center justify-center gap-x-1 border rounded-full px-4 shadow-none"
					@click="handleToggleMomentFavorite">
					<wd-icon class-prefix="uhemoji-icon" name="-smile-" size="36rpx" />
					<text class="shrink-0 text-sm font-semibold"
						:class="[momentFavorited ? 'text-primary' : 'text-gray-900']">{{ momentFavorited ? '已收藏' : '收藏' }}</text>
				</view>
			</view>
		</view>

		<!-- 评论弹窗 -->
		<uh-comment-modal v-if="commentModal.show" :show="commentModal.show" :is-comment="commentModal.isComment"
			:title="commentModal.title" :post-name="commentModal.postName" subject-kind="Moment"
			:quote-reply="commentModal.quoteReply" @on-close="handleOnCommentModalClose" />
	</view>
</template>

<style scoped lang="scss">
	/* 水平居中定位 */
	.uh-translate-x-center {
		transform: translateX(-50%);
	}
</style>