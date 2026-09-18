<script lang="ts" setup>
	import { computed, ref, shallowRef } from 'vue'
	import { storeToRefs } from 'pinia'
	import { onLoad, onPageScroll, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
	import { getMomentList, getPostList, getUcMyPostList } from '@/api/halo'
	import { useAppConfigStore } from '@/store/appConfig'
	import { useCustomNavbarPlaceholder } from '@/hooks/useCustomNavbarPlaceholder'
	import { usePageScroll } from '@/hooks/usePageScroll'
	import { useTokenStore } from '@/store/token'
	import { useUserStore } from '@/store/user'
	import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
	import { useFavoritesStore } from '@/store/favorites'
	import { buildMomentFavoriteItem } from '@/utils/favorite'
	import { useUpvote } from '@/hooks/useUpvote'
	import { checkAvatarUrl, checkImageUrl, checkThumbnailUrl } from '@/utils/url'
	import { sleep } from '@/utils/common'
	import type { IMoment, IPost, IUcListedPost } from '@/api/types/halo'

	definePage({
		style: {
			navigationBarTitleText: '个人主页',
			navigationStyle: 'custom',
			enablePullDownRefresh: true,
		},
	})

	const PAGE_SIZE = 10

	const { scrollY, updatePageScrollValue } = usePageScroll()
	// wd-sticky 吸顶偏移(导航栏高度,同 tabbar/gallery.vue 用法)
	const { height } = useCustomNavbarPlaceholder()
	const appConfigStore = useAppConfigStore()
	const tokenStore = useTokenStore()
	const userStore = useUserStore()
	const { configs, auditData, auditModeEnabled: calcAuditModeEnabled } = storeToRefs(appConfigStore)
	const { userInfo } = storeToRefs(userStore)
	const offsetTop = computed(() => {
		return height.value - 12
	})

	/* ---------------- 目标用户(onLoad 参数 username=metadata.name;缺省为当前登录用户) ---------------- */
	const pageUsername = ref('')
	const isSelf = computed(() => !!pageUsername.value && pageUsername.value === userInfo.value.username)

	/* ---------------- 头部资料 ---------------- */
	const ownerInfo = ref<{ displayName ?: string, avatar ?: string, bio ?: string }>({})

	const headerUser = computed(() => ({
		nickname: (isSelf.value ? userInfo.value.nickname : ownerInfo.value.displayName) || pageUsername.value,
		username: pageUsername.value,
		avatar: (isSelf.value ? userInfo.value.avatar : ownerInfo.value.avatar) || '',
		role: isSelf.value
			? (userInfo.value.roles?.includes('super-role') ? '超级管理员' : '普通用户')
			: '',
		isAdmin: isSelf.value && userInfo.value.roles?.includes('super-role'),
		bio: ownerInfo.value.bio || '这个人很懒，什么都没有留下~',
	}))

	/** 封面图:复用 mine.vue(关于页)的 aboutConfig.bgImageUrl;空时 checkImageUrl 自动回落默认背景图 */
	const profileStyle = computed(() => ({
		backgroundImage: `url(${checkImageUrl(configs.value.featureConfig?.pages?.aboutConfig?.bgImageUrl)})`,
	}))

	/** 从列表数据回填他人资料(取第一条带 owner 的记录) */
	function backfillOwner<T extends { owner ?: { displayName ?: string, avatar ?: string, bio ?: string } }>(items : T[]) {
		if (isSelf.value)
			return
		const owner = items.find(item => item.owner)?.owner
		if (owner && (owner.displayName || owner.avatar || owner.bio)) {
			ownerInfo.value = {
				displayName: owner.displayName,
				avatar: owner.avatar,
				bio: owner.bio,
			}
		}
	}

	/* ---------------- 双 Tab 各自独立的数据状态 ---------------- */
	interface IPagedFetchResult<T> {
		items : T[]
		hasNext : boolean
	}

	/**
	 * 分页列表状态机(对齐 tabbar/moments.vue 的三态与加载更多写法):
	 * 三态 uh-data-loading + 加载更多 uh-data-loadmore + onReachBottom 翻页;
	 * 审核模式下一次拉取后本地过滤,不分页
	 */
	function usePagedList<T extends { metadata : { name : string } }>(options : {
		fetcher : (page : number, size : number) => Promise<IPagedFetchResult<T>>
		auditFilter : (items : T[]) => T[]
	}) {
		// 整组替换/拼接,无需深层响应式;shallowRef 同时保住泛型 T 的类型(避免 UnwrapRefSimple 深解包)
		const list = shallowRef<T[]>([])
		const page = ref(1)
		const { loadingStatus, loadMoreStatus, updateLoadingStatus, updateLoadMoreStatus, resetLoadMoreStatus } = useDataLoadingStatus()

		async function fetch(loadMore = false) {
			if (!loadMore) {
				updateLoadingStatus(DataLoadingStatusEnum.Loading)
			}
			try {
				if (calcAuditModeEnabled.value) {
					const res = await options.fetcher(1, 0)
					list.value = options.auditFilter(res.items)
					await sleep(600)
					updateLoadingStatus(list.value.length ? DataLoadingStatusEnum.Success : DataLoadingStatusEnum.Empty)
					updateLoadMoreStatus({ active: false, status: 'noMore', hasNext: false })
					return
				}
				const res = await options.fetcher(page.value, PAGE_SIZE)
				list.value = loadMore ? list.value.concat(res.items) : res.items
				if (!loadMore) {
					await sleep(600)
					updateLoadingStatus(list.value.length ? DataLoadingStatusEnum.Success : DataLoadingStatusEnum.Empty)
				}
				updateLoadMoreStatus({
					active: false,
					status: res.hasNext ? 'loadMore' : 'noMore',
					hasNext: res.hasNext,
				})
			}
			catch (err) {
				console.error('个人主页数据加载失败', err)
				if (loadMore) {
					updateLoadMoreStatus({ active: false, status: 'error' })
				}
				else {
					updateLoadingStatus(DataLoadingStatusEnum.Error)
				}
			}
			finally {
				uni.stopPullDownRefresh()
			}
		}

		function refresh() {
			resetLoadMoreStatus()
			page.value = 1
			fetch(false)
		}

		function loadMore() {
			if (calcAuditModeEnabled.value) {
				uni.showToast({ icon: 'none', title: '没有更多数据了' })
				return
			}
			// 正在加载时阻止重复请求
			if (loadMoreStatus.value.active) {
				return
			}
			// 有更多数据时继续加载
			if (loadMoreStatus.value.hasNext) {
				page.value += 1
				updateLoadMoreStatus({ active: true, status: 'loading' })
				fetch(true)
			}
		}

		return { list, loadingStatus, loadMoreStatus, refresh, loadMore }
	}

	/** 按审核模式引用清单本地过滤 */
	function auditFilterBy(names : string[]) {
		return <T extends { metadata : { name : string } }>(items : T[]) =>
			items.filter(item => names.includes(item.metadata.name))
	}

	/** UC ListedPost → 公开列表同构结构(IPost),uh-article-card 直接消费 */
	function mapUcListedPost(lp : IUcListedPost) : IPost {
		return {
			metadata: lp.post.metadata,
			spec: lp.post.spec,
			status: lp.post.status,
			owner: lp.owner || lp.post.owner,
			stats: lp.stats,
			categories: lp.categories,
			tags: lp.tags,
			contributors: lp.contributors,
		}
	}

	/* ---------- 文章 Tab(本人走 UC 端点;他人走公开接口 fieldSelector) ---------- */
	const postState = usePagedList<IPost>({
		fetcher: (page, size) => {
			if (isSelf.value) {
				// UC 端点服务端强制 owner=当前用户,固定只取已发布,与站点可见性一致
				return getUcMyPostList({ page, size, sort: ['spec.publishTime,desc'] }).then((res) => {
					const items = (res.data.items || []).map(mapUcListedPost)
					backfillOwner(items)
					return { items, hasNext: res.data.hasNext }
				})
			}
			return getPostList({
				page,
				size,
				sort: ['spec.publishTime,desc'],
				fieldSelector: [`spec.owner==${pageUsername.value}`],
			}).then((res) => {
				const items = res.data.items || []
				backfillOwner(items)
				return { items, hasNext: res.data.hasNext }
			})
		},
		auditFilter: items => auditFilterBy(appConfigStore.auditNamesOf('posts'))(items),
	})

	/* ---------- 瞬间 Tab(公开接口原生支持 ownerName 过滤,卡片复用全局 uh-moment-card) ---------- */
	type MomentCard = IMoment & {
		images ?: { type ?: string, url : string }[]
		spec : IMoment['spec'] & { newHtml ?: string }
	}

	/** 移除正文里的标签链接(同 moments.vue,避免卡片内可点进标签页) */
	function removeTagLinksCompletely(htmlString : string) : string {
		const regex = /<a\b[^>]+class=(['"])[^'"]*\btag\b[^'"]*\1[^>]*>[\s\S]*?<\/a>/gi
		return htmlString.replace(regex, '')
	}

	/** 映射成 uh-moment-card 需要的扩展结构(newHtml + images,渲染时 check 补全) */
	function mapMomentItem(item : IMoment) : MomentCard {
		const medium = item.spec?.content?.medium || []
		return {
			...item,
			stats: { ...(item.stats || {}) },
			spec: {
				...item.spec,
				newHtml: removeTagLinksCompletely(item.spec?.content?.html || ''),
			},
			images: medium
				.filter(x => x.type === 'PHOTO')
				.map(x => ({ ...x, url: checkThumbnailUrl(x.url || '', true) })),
		}
	}

	const momentState = usePagedList<MomentCard>({
		fetcher: (page, size) => getMomentList({
			page,
			size,
			ownerName: pageUsername.value,
		}).then((res) => {
			const items = (res.data.items || []).map(mapMomentItem)
			backfillOwner(items)
			return { items, hasNext: res.data.hasNext }
		}),
		auditFilter: items => auditFilterBy(appConfigStore.auditNamesOf('moments'))(items),
	})

	/* ---------------- Tab 切换(切换不重置已加载数据,首次进入才拉取) ---------------- */
	const activeTab = ref<'post' | 'moment'>('post')
	const loadedTabs = ref<Record<'post' | 'moment', boolean>>({ post: false, moment: false })

	function switchTab(key : 'post' | 'moment') {
		if (activeTab.value === key)
			return
		activeTab.value = key
		if (!loadedTabs.value[key]) {
			loadedTabs.value[key] = true
			if (key === 'post') {
				postState.refresh()
			}
			else {
				momentState.refresh()
			}
		}
	}

	/* ---------------- 瞬间交互(卡片内媒体/时间由 uh-moment-card 自渲染) ---------------- */

	/* ---------------- 跳转(详情页内可评论) ---------------- */
	function handleToMoment(moment : IMoment) {
		uni.navigateTo({
			url: `/pages-blog/moment-detail/moment-detail?name=${moment.metadata.name}`,
			animationType: 'slide-in-right',
		})
	}

	/* ---------------- 点赞/收藏(useUpvote 防重复,收藏走全局 favoritesStore) ---------------- */
	const favoritesStore = useFavoritesStore()
	const { likeByName } = useUpvote('moments', () => '')

	function handleMomentLike(moment : MomentCard) {
		likeByName(moment.metadata.name, () => {
			if (moment.stats) {
				moment.stats.upvote = (moment.stats.upvote || 0) + 1
			}
		})
	}

	function handleToggleMomentFavorite(moment : MomentCard) {
		const favorited = favoritesStore.toggle(buildMomentFavoriteItem(moment))
		uni.showToast({ icon: 'none', title: favorited ? '收藏成功' : '已取消收藏' })
	}

	/* ---------------- 生命周期 ---------------- */
	onPageScroll((option : Page.PageScrollOption) => {
		updatePageScrollValue(option.scrollTop)
	})

	onLoad((query) => {
		// 路由参数 username = 用户的 metadata.name;未传则回退为当前登录用户
		pageUsername.value = (query as Record<string, string> | undefined)?.username || userInfo.value.username || ''
		if (!tokenStore.updateNowTime().hasLogin || !pageUsername.value) {
			uni.showToast({ icon: 'none', title: '请先登录' })
			setTimeout(() => uni.navigateBack(), 600)
			return
		}
		loadedTabs.value.post = true
		postState.refresh()
	})

	onPullDownRefresh(() => {
		loadedTabs.value[activeTab.value] = true
		if (activeTab.value === 'post') {
			postState.refresh()
		}
		else {
			momentState.refresh()
		}
	})

	onReachBottom(() => {
		if (activeTab.value === 'post') {
			postState.loadMore()
		}
		else {
			momentState.loadMore()
		}
	})
</script>

<template>
	<view class="box-border min-h-screen w-screen flex flex-col bg-page">
		<uh-navbar :scroll-y="scrollY" default-title="个人主页" :scroll-title="headerUser.nickname"
			:need-placeholder="false" />

		<view class="box-border relative h-76 w-full overflow-hidden pt-10">
			<view class="absolute left-0 top-0 h-full w-full bg-cover bg-center" :style="profileStyle" />
			<view class="uh-profile-mask pointer-events-none absolute left-0 top-0 h-full w-full" />
			<view class="relative z-10 flex h-full flex-col items-center justify-center px-6">
				<image :src="checkAvatarUrl(headerUser.avatar)"
					class="uh-global-card-glass uh-shadow-xs h-20 w-20 rounded-full border-2 border-white/40"
					mode="aspectFill" />
				<view class="mt-3 text-md text-white font-black drop-shadow">
					{{ headerUser.nickname || headerUser.username }}</view>
				<view class="mt-1.5 flex items-center gap-x-2">
					<text v-if="headerUser.role"
						class="box-border rounded-full px-2 py-0.5 text-xs"
						:class="[headerUser.isAdmin?'bg-secondary text-gray-900':'bg-white/20 text-white']"
						>{{ headerUser.role }}</text>
				</view>
				<text class="mt-2 max-w-[85%] text-center text-2xs text-white/80">{{ headerUser.bio }}</text>
			</view>
			<view
				class="pointer-events-none absolute bottom-0 left-0 z-20 h-18 w-full from-black/0 to-page bg-gradient-to-b" />
		</view>

		<wd-sticky :offset-top="offsetTop">
			<view class="w-screen box-border px-16">
				<view class="flex items-center w-full uh-global-card-glass border mt-4 shadow-none flex rounded-xl p-1">
					<view class="flex-1 rounded-lg py-2 text-center text-2xs"
						:class="activeTab === 'post' ? 'bg-primary text-gray-900 font-bold' : 'text-gray-500'"
						@click="switchTab('post')">
						文章
					</view>
					<view class="flex-1 rounded-lg py-2 text-center text-2xs"
						:class="activeTab === 'moment' ? 'bg-primary text-gray-900 font-bold' : 'text-gray-500'"
						@click="switchTab('moment')">
						瞬间
					</view>
				</view>
			</view>
		</wd-sticky>

		<template v-if="activeTab === 'post'">
			<uh-data-loading v-if="postState.loadingStatus.value !== DataLoadingStatusEnum.Success"
				:loading-status="postState.loadingStatus.value" empty-text="啊偶，还没有发布过文章哦~" min-height="50vh"
				@refresh="postState.refresh()" />
			<view v-else class="box-border flex flex-col gap-3 p-3">
				<uh-article-card v-for="article in postState.list.value" :key="article.metadata.name" from="articles"
					variant="list" :article="article" :audit-mode="calcAuditModeEnabled" />
				<uh-data-loadmore :status="postState.loadMoreStatus.value.status"
					:text="postState.loadMoreStatus.value.text" />
			</view>
		</template>

		<template v-else>
			<uh-data-loading v-if="momentState.loadingStatus.value !== DataLoadingStatusEnum.Success"
				:loading-status="momentState.loadingStatus.value" empty-text="啊偶，还没有发布过瞬间哦~" min-height="50vh"
				@refresh="momentState.refresh()" />
			<view v-else class="box-border flex flex-col gap-3 p-3">
				<uh-moment-card v-for="moment in momentState.list.value" :key="moment.metadata.name" :moment="moment"
					:blogger="{ nickname: headerUser.nickname, avatar: checkAvatarUrl(headerUser.avatar) }"
					@detail="handleToMoment(moment)" @like="handleMomentLike(moment)" @comment="handleToMoment(moment)"
					@favorite="handleToggleMomentFavorite(moment)" />
				<uh-data-loadmore :status="momentState.loadMoreStatus.value.status"
					:text="momentState.loadMoreStatus.value.text" />
			</view>
		</template>
	</view>
</template>

<style scoped lang="scss">
	.uh-profile-mask {
		background-color: rgba(0, 0, 0, 0.35);
		backdrop-filter: blur(8rpx);
		-webkit-backdrop-filter: blur(8rpx);
	}
</style>