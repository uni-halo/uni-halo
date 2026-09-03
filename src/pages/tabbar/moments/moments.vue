<script lang="ts" setup>
	/**
 * 瞬间页(源自旧项目 pages/tabbar/moments/moments.vue,新建复刻)
 * 功能:瞬间卡片列表(头像/内容/图片/音频/视频/标签) + 分页加载
 * 设计:社交信息流(实心白纸卡 + 着色昵称 + 朋友圈式不缩进正文),区别于工具页的玻璃拟态
 */
	import { computed, ref } from 'vue'
	import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
	import { getMomentList } from '@/api/halo'
	import { useAppConfigStore } from '@/store/appConfig'
	import { checkAvatarUrl, checkThumbnailUrl } from '@/utils/url'
	import { generateUUID } from '@/utils/uuid'
	import { formatTime as formatTimeUtil } from '@/utils/formatTime'
	import { randomTagColor } from '@/utils/random'
	import { t } from '@/locale'
	import { usePluginAvailable } from '@/utils/plugin'
	import { markdownConfig } from '@/config/markdown'
	import type { IMoment } from '@/api/types/halo'

	definePage({
		style: {
			navigationBarTitleText: '瞬间',
			enablePullDownRefresh: true,
			// 下拉/回弹露出的窗口底色对齐页面底色
			backgroundColor: '#f6f3ee',
		},
	})

	const appConfigStore = useAppConfigStore()
	const haloConfigs = computed(() => appConfigStore.configs)
	const calcAuditModeEnabled = computed(() => appConfigStore.auditModeEnabled)
	const calcUseTagRandomColor = computed(() => !!haloConfigs.value.pageConfig?.momentConfig?.useTagRandomColor)

	const bloggerInfo = computed(() => {
		const blogger = haloConfigs.value.authorConfig?.blogger as { nickname ?: string, avatar ?: string } | undefined
		return {
			nickname: blogger?.nickname || '',
			avatar: checkAvatarUrl(blogger?.avatar),
		}
	})

	/** 站点名称(原 startConfig.title 已随启动页下线,改读 appConfig.appInfo.name) */
	const siteName = computed(() => {
		const appInfo = haloConfigs.value.appConfig?.appInfo as { name ?: string } | undefined
		return appInfo?.name || bloggerInfo.value.nickname || 'uni-halo'
	})

	/** 依赖插件(plugin-moments) */
	const uniHaloPluginId = 'plugin-moments'
	const uniHaloPluginAvailable = ref(true)

	/* ---------------- 状态 ---------------- */
	const loading = ref<'loading' | 'success' | 'error'>('loading')
	const queryParams = ref({ size: 10, page: 1 })
	const hasNext = ref(false)
	/** 列表卡片:medium 已按类型拆为 images/videos/audios + 正文 tag 清理 */
	type MomentCard = IMoment & {
		images ?: { type ?: string, url : string }[]
		videos ?: { id ?: string, url : string }[]
		audios ?: { type ?: string, url : string }[]
		spec : IMoment['spec'] & { newHtml ?: string }
	}
	const dataList = ref<MomentCard[]>([])
	const isLoadMore = ref(false)
	const loadMoreText = ref(t('common.loading'))
	const videoContexts = ref<Record<string, UniApp.VideoContext | undefined>>({})
	const currentVideoId = ref<string | null>(null)

	/** 标签颜色(随机模式下按数据稳定,避免每次渲染重新随机变色) */
	const calcTagColors = computed(() => {
		return dataList.value.map(moment =>
			(moment.spec.tags || []).map(() => (calcUseTagRandomColor.value ? randomTagColor() : '#4d7c0f')),
		)
	})

	/** 移除内容中的 tag 链接 */
	function removeTagLinksCompletely(htmlString : string) : string {
		const regex = /<a\b[^>]+class=(['"])[^'"]*\btag\b[^'"]*\1[^>]*>[\s\S]*?<\/a>/gi
		return htmlString.replace(regex, '')
	}

	/** 瞬间项映射(spec.content.medium 拆分为 images/videos/audios + 内容 tag 清理 + 作者兜底) */
	function mapMomentItem(item : IMoment) : MomentCard {
		const medium = (item.spec.content?.medium || [])
			.map(x => ({ ...x, url: x.url || '' }))
		const owner = item.owner
		return {
			...item,
			// 无顶层 owner(如个别历史接口)时兜底为博主信息
			owner: owner?.displayName
				? owner
				: { displayName: bloggerInfo.value.nickname || '', name: bloggerInfo.value.nickname || '', avatar: bloggerInfo.value.avatar },
			spec: {
				...item.spec,
				newHtml: removeTagLinksCompletely(item.spec.content?.html || ''),
			},
			images: medium.filter(x => x.type === 'PHOTO').map(x => ({ ...x, url: checkThumbnailUrl(x.url, true) })),
			videos: medium.filter(x => x.type === 'VIDEO').map(x => ({ ...x, id: generateUUID() })),
			audios: medium.filter(x => x.type === 'AUDIO'),
		}
	}

	/* ---------------- 数据加载 ---------------- */
	async function handleGetData() {
		if (calcAuditModeEnabled.value) {
			// 审核模式:真实瞬间按 audit-data moments 过滤(数组顺序即展示顺序)
			const auditMomentNames = appConfigStore.auditData.spec?.moments || []
			try {
				const res = await getMomentList({ page: 1, size: 0 })
				const filtered = res.data.items
					.filter(x => x.spec.visible === 'PUBLIC' && auditMomentNames.includes(x.metadata.name))
				const orderMap = new Map(auditMomentNames.map((name, index) => [name, index]))
				filtered.sort((a, b) => (orderMap.get(a.metadata.name) ?? 999) - (orderMap.get(b.metadata.name) ?? 999))
				const tempItems = filtered.map(mapMomentItem)
				dataList.value = tempItems
				nextTick(() => {
					createVideoContexts(tempItems)
				})
				loading.value = 'success'
				loadMoreText.value = t('common.noMore')
				uni.hideLoading()
				uni.stopPullDownRefresh()
			}
			catch (err) {
				console.error(err)
				loading.value = 'error'
				loadMoreText.value = t('common.loadFailed')
			}
			return
		}

		uni.showLoading({ mask: true, title: t('common.loading') })
		if (!isLoadMore.value) {
			loading.value = 'loading'
		}
		loadMoreText.value = t('common.loading')

		try {
			const res = await getMomentList({ ...queryParams.value })
			loading.value = 'success'
			loadMoreText.value = res.data.hasNext ? t('common.loadMore') : t('common.noMore')
			hasNext.value = res.data.hasNext

			const tempItems = res.data.items
				.filter(x => x.spec.visible === 'PUBLIC')
				.map(mapMomentItem)

			dataList.value = isLoadMore.value
				? dataList.value.concat(tempItems)
				: tempItems

			nextTick(() => {
				createVideoContexts(tempItems)
			})
		}
		catch (err) {
			console.error(err)
			loading.value = 'error'
			loadMoreText.value = t('common.loadFailed')
		}
		finally {
			setTimeout(() => {
				uni.hideLoading()
				uni.stopPullDownRefresh()
			}, 500)
		}
	}

	/* ---------------- 视频互斥 ---------------- */
	function createVideoContexts(list : { videos ?: { id ?: string }[] }[]) {
		stopAllVideos()
		list.map(item => item.videos || []).flat().forEach((item) => {
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

	function handleToMomentDetail(moment : IMoment) {
		if (calcAuditModeEnabled.value)
			return
		uni.navigateTo({
			url: `/pages-blog/moment-detail/moment-detail?name=${moment.metadata.name}`,
			animationType: 'slide-in-right',
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

	/** 格式化瞬间时间 */
	function formatMomentTime(time ?: string) : string {
		// 与旧项目一致:yyyy年MM月dd日 星期w
		return time ? formatTimeUtil({ d: time, f: 'yyyy年MM月dd日 星期w' }) : ''
	}

	/* ---------------- 生命周期 ---------------- */
	onLoad(async () => {
		uni.setNavigationBarTitle({ title: t('page.moments.title') })
		uniHaloPluginAvailable.value = await usePluginAvailable(uniHaloPluginId)
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
		videoContexts.value = {}
		currentVideoId.value = null
		handleGetData()
	})

	onReachBottom(() => {
		if (!uniHaloPluginAvailable.value)
			return
		if (calcAuditModeEnabled.value) {
			uni.showToast({ icon: 'none', title: t('common.noMoreData') })
			return
		}
		if (hasNext.value) {
			queryParams.value.page += 1
			isLoadMore.value = true
			handleGetData()
		}
		else {
			uni.showToast({ icon: 'none', title: t('common.noMoreData') })
		}
	})
</script>

<template>
	<view class="box-border min-h-screen w-screen flex flex-col bg-page py-4">
		<uh-plugin-unavailable v-if="!uniHaloPluginAvailable" :plugin-id="uniHaloPluginId"
			error-text="检测到当前插件没有安装或者启用，无法使用瞬间功能哦，请联系管理员" @on-refresh="handleGetData" />
		<template v-else>
			<!-- 加载中 -->
			<view v-if="loading === 'loading'" class="loading-wrap p-3">
				<wd-skeleton :row="3" :animated="true" />
			</view>

			<!-- 加载失败(可重试) -->
			<uh-data-loading v-else-if="loading === 'error'" :loading-status="loading" min-height="60vh"
				error-text="瞬间加载失败，请点击重试" @refresh="handleGetData" />

			<view v-else class="flex flex-col gap-3 px-4">
				<view v-if="dataList.length === 0"
					class="min-h-[70vh] w-full flex items-center justify-center content-empty">
					<wd-empty :description="t('common.empty')" />
				</view>

				<block v-else>
					<!-- 瞬间卡片(社交信息流:着色昵称 + 朋友圈式不缩进正文 + 媒体九宫格 + 内嵌互动脚注) -->
					<view v-for="(moment, mIndex) in dataList" :key="moment.metadata.name"
						class="moment-card uh-shadow-xs overflow-hidden rounded-[24rpx] bg-white">
						<!-- 作者 -->
						<view class="box-border flex items-center px-4 pt-4">
							<view class="flex-1 flex items-center">
								<image class="avatar h-[72rpx] w-[72rpx] shrink-0 rounded-full"
									:src="checkAvatarUrl(moment.owner?.avatar || bloggerInfo.avatar)"
									mode="aspectFill" />
								<view class="ml-3 flex flex-col">
									<view class="text-sm text-gray-900 font-bold">
										{{ moment.owner?.displayName || bloggerInfo.nickname }}
									</view>
									<view class="mt-0.5 text-xs text-gray-400">
										{{ formatMomentTime(moment.spec.releaseTime) }}
									</view>
								</view>
							</view>
							<view class="shrink-0">
								<uh-button custom-class="!py-1 bg-secondary font-semibold">详情</uh-button>
							</view>
						</view>

						<!-- 正文-->
						<view class="moment-content px-4 pt-3 ">

							<view v-if="moment.spec.tags && moment.spec.tags.length !== 0"
								class="mb-3 flex flex-wrap gap-x-2">
								<text v-for="(tag, tagIndex) in moment.spec.tags" :key="tagIndex"
									class="py-1 px-2 text-xs rounded-xl bg-secondary">
									# {{ tag }}
								</text>
							</view>

							<mp-html lazy-load :domain="markdownConfig.domain ?? ''"
								:loading-img="markdownConfig.loadingGif" scroll-table selectable
								:tag-style="markdownConfig.tagStyle" :container-style="markdownConfig.containStyle"
								:content="moment.spec.newHtml || ''" :markdown="true" :show-line-number="true"
								:show-language-name="true" copy-by-long-press
								@click.stop="handleToMomentDetail(moment)" />
						</view>

						<!-- 图片 -->
						<view v-if="moment.images && moment.images.length !== 0"
							class="images flex flex-wrap items-start px-4 pt-3">
							<view v-for="(image, mediumIndex) in moment.images" :key="mediumIndex"
								class="image-item box-border p-1"
								:class="moment.images && moment.images.length === 1 ? 'h-[350rpx] w-full' : (moment.images && moment.images.length === 2 ? 'h-[250rpx] w-1/2' : 'h-[200rpx] w-1/3')">
								<image mode="aspectFill" class="image-src h-full w-full rounded-lg" :src="image.url"
									@click="handlePreview(mediumIndex, moment.images || [])" />
							</view>
						</view>

						<!-- 音频 -->
						<view v-if="moment.audios && moment.audios.length !== 0"
							class="audio-list flex flex-col gap-3 px-4 pt-3">
							<uh-audio-player v-for="audio in moment.audios" :key="audio.url" :src="audio.url"
								:poster="bloggerInfo.avatar" :name="`来自${siteName}的声音`"
								:author="bloggerInfo.nickname" />
						</view>

						<!-- 视频 -->
						<view v-if="moment.videos && moment.videos.length !== 0"
							class="video-list flex flex-col gap-3 px-4 pt-3">
							<video v-for="(video, index) in moment.videos" :id="`video_${video.id}`" :key="index"
								class="video-src h-[400rpx] w-full rounded-xl" :src="video.url" :show-mute-btn="true"
								:controls="true" :show-center-play-btn="true" :enable-progress-gesture="true"
								@play="onVideoPlay(video.id || '')" @pause="onVideoPause(video.id || '')"
								@ended="onVideoEnded" />
						</view>

						<!--  (点赞/评论) -->
						<view
							class="mt-3 mb-1 box-border w-full flex items-center justify-center gap-x-12 border-t border-black/5 py-3 text-xs text-gray-400">
							<view class="flex items-center gap-x-2">
								<wd-icon class-prefix="uhemoji-icon" name="-kiss-" size="32rpx" />
								<text class="text-sm text-gray-600">点赞 {{ moment.stats.upvote || 0 }}</text>
							</view>
							<view class="flex items-center gap-x-2">
								<wd-icon class-prefix="uhemoji-icon" name="-thinking" size="32rpx" />
								<text class="text-sm text-gray-600">评论 {{ moment.stats.totalComment || 0 }}</text>
							</view>
						</view>

					</view>

					<view class="load-text pb-5 pt-1 text-center text-xs text-gray-500">
						{{ loadMoreText }}
					</view>
				</block>
			</view>
		</template>
	</view>
</template>