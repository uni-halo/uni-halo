<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
	import dayjs from 'dayjs'
	import { getMomentList } from '@/api/halo'
	import { useAppConfigStore } from '@/store/appConfig'
	import { NeedPluginIds } from '@/hooks/usePluginAvailable'
	import { usePageScroll } from '@/hooks/usePageScroll'
	import { useFavoritesStore } from '@/store/favorites'
	import { checkAvatarUrl, checkThumbnailUrl } from '@/utils/url'
	import { buildMomentFavoriteItem } from '@/utils/favorite'
	import { generateUUID } from '@/utils/uuid'
	import { sleep } from '@/utils/common'
	import { formatTime } from '@/utils/formatTime'
	import { t } from '@/locale'
	import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
	import { useUpvote } from '@/hooks/useUpvote'
	import { markdownConfig } from '@/config/markdown'
	import type { IMoment } from '@/api/types/halo'

	definePage({
		style: {
			navigationBarTitleText: '瞬间',
			navigationStyle: 'custom',
			enablePullDownRefresh: true,
		},
	})

	const { scrollY } = usePageScroll()
	const appConfigStore = useAppConfigStore()
	const favoritesStore = useFavoritesStore()
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

	const siteName = computed(() => {
		const appInfo = haloConfigs.value.appConfig?.appInfo as { name ?: string } | undefined
		return appInfo?.name || bloggerInfo.value.nickname || 'uni-halo'
	})

	const { pluginId, checking, tips, available: uniHaloPluginAvailable, check: checkPluginAvailable } = usePluginAvailable({
		pluginId: NeedPluginIds.PluginMoments,
		tips: '啊偶，功能正在维护中...',
		callback: (isAvailable) => {
			if (!isAvailable) { return }
			uni.pageScrollTo({
				scrollTop: 0,
				duration: 0,
			})
			handleGetData()
		}
	})

	async function handlePluginRefresh() {
		if (await checkPluginAvailable()) { handleGetData() }
	}

	/* ---------------- 状态 ---------------- */
	const { loadingStatus, loadMoreStatus, updateLoadingStatus, updateLoadMoreStatus, resetLoadMoreStatus } = useDataLoadingStatus()
	const queryParams = ref({ size: 10, page: 1 })
	/** 列表卡片 */
	type MomentCard = IMoment & {
		images ?: { type ?: string, url : string }[]
		videos ?: { id ?: string, url : string }[]
		audios ?: { type ?: string, url : string }[]
		spec : IMoment['spec'] & { newHtml ?: string }
		year : string
		month : string
		day : string
		weekend : string
	}
	const dataList = ref<MomentCard[]>([])
	const videoContexts = ref<Record<string, UniApp.VideoContext | undefined>>({})
	const currentVideoId = ref<string | null>(null)

	function removeTagLinksCompletely(htmlString : string) : string {
		const regex = /<a\b[^>]+class=(['"])[^'"]*\btag\b[^'"]*\1[^>]*>[\s\S]*?<\/a>/gi
		return htmlString.replace(regex, '')
	}

	const WEEKDAY_TEXT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

	function splitMomentDate(timeStr ?: string) {
		const d = timeStr ? dayjs(timeStr) : null
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

	function mapMomentItem(item : IMoment) : MomentCard {
		const medium = (item.spec.content?.medium || [])
			.map(x => ({ ...x, url: x.url || '' }))
		const owner = item.owner
		return {
			...item,
			...splitMomentDate(item.spec?.releaseTime),
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
			// 审核模式:按 audit-data moments 顺序展示,一次拉取不分页
			resetLoadMoreStatus()
			const auditMomentNames = appConfigStore.auditData.spec?.moments || []
			try {
				const res = await getMomentList({ page: 1, size: 0 })
				const filtered = res.data.items
					.filter(x => x.spec.visible === 'PUBLIC' && auditMomentNames.includes(x.metadata.name))
				const orderMap = new Map(auditMomentNames.map((name, index) => [name, index]))
				filtered.sort((a, b) => (orderMap.get(a.metadata.name) ?? 999) - (orderMap.get(b.metadata.name) ?? 999))
				const tempItems = filtered.map(mapMomentItem)
				dataList.value = tempItems
				await sleep(600)
				updateLoadingStatus(dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
				updateLoadMoreStatus({
					active: false,
					status: 'noMore',
					hasNext: false,
				})
				uni.stopPullDownRefresh()
			}
			catch (err) {
				console.error(err)
				updateLoadingStatus(DataLoadingStatusEnum.Error)
				updateLoadMoreStatus({
					active: false,
					status: 'error',
				})
			}
			return
		}

		if (!loadMoreStatus.value.active) {
			updateLoadingStatus(DataLoadingStatusEnum.Loading)
		}

		try {
			const res = await getMomentList({ ...queryParams.value })

			const tempItems = res.data.items
				.filter(x => x.spec.visible === 'PUBLIC')
				.map(mapMomentItem)

			dataList.value = loadMoreStatus.value.active
				? dataList.value.concat(tempItems)
				: tempItems

			if (!loadMoreStatus.value.active) {
				await sleep(600)
				updateLoadingStatus(dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
			}

			updateLoadMoreStatus({
				active: false,
				status: res.data.hasNext ? 'loadMore' : 'noMore',
				hasNext: res.data.hasNext,
			})
		}
		catch (err) {
			console.error(err)
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

	function isMomentFavorite(moment : IMoment) : boolean {
		return favoritesStore.isFavorite('moment', moment.metadata.name)
	}

	function handleToggleMomentFavorite(moment : MomentCard) {
		if (!moment) { return }
		const favorited = favoritesStore.toggle(buildMomentFavoriteItem(moment))
		uni.showToast({ icon: 'none', title: favorited ? '收藏成功' : '已取消收藏' })
	}

	/* ---------------- 点赞(useUpvote 持久化防重复) ---------------- */
	const { hasUpvoted, likeByName } = useUpvote('moments', () => '')

	function handleMomentLike(moment : MomentCard) {
		if (!moment) { return }
		likeByName(moment.metadata.name, (name) => {
			if (moment.stats) {
				moment.stats.upvote = (moment.stats.upvote || 0) + 1
			}
		})
	}

	/* ---------------- 评论(列表内直接弹评论窗) ---------------- */
	const commentModal = ref({
		show: false,
		isComment: true,
		postName: '',
		title: '',
	})

	function handleMomentComment(moment : MomentCard) {
		if (!moment) { return }
		if (!moment.spec.allowComment) {
			uni.showToast({ icon: 'none', title: '瞬间已开启禁止评论！' })
			return
		}
		commentModal.value = {
			show: true,
			isComment: true,
			postName: moment.metadata.name,
			title: '新增评论',
		}
	}

	function handleOnCommentModalClose(data : { refresh : boolean, isSubmit : boolean }) {
		const postName = commentModal.value.postName
		commentModal.value.show = false
		if (data.isSubmit) {
			// 评论成功后列表计数 +1
			const target = dataList.value.find(item => item.metadata.name === postName)
			if (target?.stats) {
				target.stats.totalComment = (target.stats.totalComment || 0) + 1
			}
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

	/** 格式化瞬间时间 */
	function formatMomentTime(time ?: string) : string {
		return time ? formatTime({ d: time, f: 'yyyy年MM月dd日 星期w' }) : ''
	}

	/* ---------------- 生命周期 ---------------- */
	onLoad(async () => {
		uni.setNavigationBarTitle({ title: t('page.moments.title') })
		await checkPluginAvailable()
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
		resetLoadMoreStatus()
		queryParams.value.page = 1
		videoContexts.value = {}
		currentVideoId.value = null
		handleGetData()
	})

	onReachBottom(() => {
		if (!uniHaloPluginAvailable.value)
			return
		// 审核模式:一次拉取不分页,直接提示到底
		if (calcAuditModeEnabled.value) {
			uni.showToast({ icon: 'none', title: t('common.noMoreData') })
			return
		}
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
			handleGetData()
		}
	})
</script>

<template>
	<view class="box-border min-h-screen w-screen flex flex-col bg-page">
		<uh-navbar :scroll-y="scrollY" :use-back="false" default-title="我的日常" title-color="text-gray-900" />

		<uh-plugin-unavailable v-if="!uniHaloPluginAvailable" :plugin-id="pluginId" :error-text="tips"
			:checking="checking" @on-refresh="handlePluginRefresh" />

		<template v-else>
			<uh-data-loading v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus"
				min-height="75vh" @refresh="handleGetData" />

			<view v-else class="box-border flex flex-col gap-3 px-3">
				<!-- 瞬间卡片 -->
				<view v-for="moment in dataList" :key="moment.metadata.name" class="flex gap-x-2">
					<view class="shrink-0 flex flex-col gap-y-2 w-13">
						<view class="shrink-0 flex flex-col items-center font-bold">
							<text
								class="date-day text-xl text-primary leading-none">{{ moment.day }}/{{ moment.month }}</text>
							<text class="date-year-month mt-2 text-sm text-gray-600">{{ moment.year }}</text>
							<text class="date-weekend mt-1 text-xs text-gray-600">{{ moment.weekend }}</text>
						</view>
						<view class="flex-1 w-full flex flex-col items-center">
							<view class="shrink-0 w-4 h-4 bg-primary rounded-full uh-global-card-glass"></view>
							<view class="w-1 h-full flex-1 bg-primary uh-global-card-glass rounded-full border"></view>
						</view>
					</view>
					<view class="uh-global-card-glass uh-shadow-xs flex-1 overflow-hidden rounded-xl">
						<view class="box-border flex items-center px-4 pt-4">
							<view class="flex flex-1 items-center">
								<image class="avatar h-9 w-9 shrink-0 rounded-full"
									:src="checkAvatarUrl(moment.owner?.avatar || bloggerInfo.avatar)"
									mode="aspectFill" />
								<view class="ml-2 flex flex-col gap-y-1">
									<view class="text-3xs text-gray-900 font-bold">
										{{ moment.owner?.displayName || bloggerInfo.nickname }}
									</view>
									<view class="text-xs text-gray-400">
										{{ formatMomentTime(moment.spec.releaseTime) }}
									</view>
								</view>
							</view>
							<view class="shrink-0">
								<uh-button custom-class="!py-1.5 bg-secondary text-xs"
									@click="handleToMomentDetail(moment)">
									详情
								</uh-button>
							</view>
						</view>

						<!-- 正文 -->
						<view class="box-border px-4 pt-3">
							<view class="relative box-border rounded-lg bg-page p-3 text-gray-900 text-3xs">
								<mp-html lazy-load :domain="markdownConfig.domain ?? ''"
									:loading-img="markdownConfig.loadingGif" scroll-table selectable
									:tag-style="markdownConfig.tagStyle" :container-style="markdownConfig.containStyle"
									:content="moment.spec.newHtml || ''" :markdown="true" :show-line-number="true"
									:show-language-name="true" copy-by-long-press />
							</view>
						</view>

						<!-- 图片 -->
						<view v-if="moment.images && moment.images.length !== 0"
							class="box-border flex flex-wrap items-start px-3 pt-2">
							<view v-for="(image, mediumIndex) in moment.images" :key="mediumIndex"
								class="image-item box-border p-1"
								:class="moment.images && moment.images.length === 1 ? 'h-32 w-full' : (moment.images && moment.images.length === 2 ? 'h-[250rpx] w-1/2' : 'h-20 w-1/3')">
								<image mode="aspectFill" class="h-full w-full rounded-lg" :src="image.url"
									@click="handlePreview(mediumIndex, moment.images || [])" />
							</view>
						</view>

						<view v-if="moment.spec.tags && moment.spec.tags.length !== 0"
							class="mt-3 box-border flex flex-wrap gap-2 px-4">
							<text v-for="(tag, tagIndex) in moment.spec.tags" :key="tagIndex"
								class="rounded-xl bg-secondary px-2 py-1 text-xs">
								# {{ tag }}
							</text>
						</view>

						<!--  (点赞/评论) -->
						<view
							class="mb-1 mt-2 box-border w-full flex items-center  border-t border-black/5 px-4 py-3 text-xs text-gray-400"
							:class="[moment.spec.allowComment?'justify-between':'gap-x-6']">
							<view class="flex items-center gap-x-1" @click.stop="handleMomentLike(moment)">
								<wd-icon class-prefix="uhemoji-icon" name="-kiss-" size="32rpx" />
								<text class="text-3xs"
									:class="hasUpvoted(moment.metadata.name) ? 'text-primary' : 'text-gray-600'">
									点赞 {{ moment.stats.upvote || 0 }}
								</text>
							</view>
							<view v-if="moment.spec.allowComment" class="flex items-center gap-x-1"
								@click.stop="handleMomentComment(moment)">
								<wd-icon class-prefix="uhemoji-icon" name="-thinking" size="32rpx" />
								<text class="text-3xs text-gray-600">评论 {{ moment.stats.totalComment || 0 }}</text>
							</view>
							<view class="flex items-center gap-x-1" @click.stop="handleToggleMomentFavorite(moment)">
								<wd-icon class-prefix="uhemoji-icon" name="-smile-" size="32rpx" />
								<text class="text-3xs"
									:class="isMomentFavorite(moment) ? 'text-primary' : 'text-gray-600'">
									{{ isMomentFavorite(moment) ? '已收藏' : '收藏' }}
								</text>
							</view>
						</view>
					</view>
				</view>
				<uh-data-loadmore :status="loadMoreStatus.status" :text="loadMoreStatus.text" />
			</view>
		</template>
	</view>

	<!-- 评论弹窗(瞬间评论,subjectKind=Moment) -->
	<uh-comment-modal v-if="commentModal.show" :show="commentModal.show" :is-comment="commentModal.isComment"
		:title="commentModal.title" :post-name="commentModal.postName" subject-kind="Moment"
		@on-close="handleOnCommentModalClose" />
</template>