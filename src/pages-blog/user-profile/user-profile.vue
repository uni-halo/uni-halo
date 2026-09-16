<script lang="ts" setup>
	import { computed, ref, shallowRef } from 'vue'
	import { onLoad, onPageScroll, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
	import dayjs from 'dayjs'
	import { getMomentList, getPostList, getUcMyPostList } from '@/api/halo'
	import { useAppConfigStore } from '@/store/appConfig'
	import { useCustomNavbarPlaceholder } from '@/hooks/useCustomNavbarPlaceholder'
	import { usePageScroll } from '@/hooks/usePageScroll'
	import { useTokenStore } from '@/store/token'
	import { useUserStore } from '@/store/user'
	import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
	import { checkAvatarUrl, checkImageUrl, checkUrl } from '@/utils/url'
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
	const { height: offsetTop } = useCustomNavbarPlaceholder()
	const appConfigStore = useAppConfigStore()
	const tokenStore = useTokenStore()
	const userStore = useUserStore()

	const calcAuditModeEnabled = computed(() => appConfigStore.auditModeEnabled)

	/* ---------------- 目标用户(onLoad 参数 username=metadata.name;缺省为当前登录用户) ---------------- */
	const pageUsername = ref('')
	const isSelf = computed(() => !!pageUsername.value && pageUsername.value === userStore.userInfo.username)

	/* ---------------- 头部资料(全部居中展示在封面图区域) ---------------- */
	/**
	 * 头像/昵称存原始地址,渲染时 check 补全。
	 * 本人视角:取 user store;他人视角:Halo 2.26 无公开用户资料 REST,
	 * 从文章/瞬间列表返回的顶层 owner 字段回填(IPost.owner / IMoment.owner 均含 avatar/displayName/bio)。
	 */
	const ownerInfo = ref<{ displayName ?: string, avatar ?: string, bio ?: string }>({})

	const headerUser = computed(() => ({
		nickname: (isSelf.value ? userStore.userInfo.nickname : ownerInfo.value.displayName) || pageUsername.value,
		username: pageUsername.value,
		avatar: (isSelf.value ? userStore.userInfo.avatar : ownerInfo.value.avatar) || '',
		role: isSelf.value
			? (userStore.userInfo.roles?.includes('super-role') ? '超级管理员' : '普通用户')
			: '',
		bio: ownerInfo.value.bio || '这个人很懒~什么都没有留下',
	}))

	/** 封面图:复用 mine.vue(关于页)的 aboutConfig.bgImageUrl;空时 checkImageUrl 自动回落默认背景图 */
	const profileStyle = computed(() => ({
		backgroundImage: `url(${checkImageUrl(appConfigStore.configs.featureConfig?.pages?.aboutConfig?.bgImageUrl)})`,
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
		auditFilter: items => auditFilterBy(appConfigStore.auditData.spec?.posts || [])(items),
	})

	/* ---------- 瞬间 Tab(公开接口原生支持 ownerName 过滤) ---------- */
	type MomentCard = IMoment
	const momentState = usePagedList<MomentCard>({
		fetcher: (page, size) => getMomentList({
			page,
			size,
			ownerName: pageUsername.value,
		}).then((res) => {
			const items = res.data.items || []
			backfillOwner(items)
			return { items, hasNext: res.data.hasNext }
		}),
		auditFilter: items => auditFilterBy(appConfigStore.auditData.spec?.moments || [])(items),
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

	/* ---------------- 瞬间展示辅助 ---------------- */
	function momentMedias(moment : IMoment) {
		return (moment.spec?.content?.medium || []).map(m => ({
			type: m.type || 'PHOTO',
			url: m.url || '',
		}))
	}

	function formatMomentTime(moment : IMoment) {
		const time = moment.spec?.releaseTime || moment.metadata?.creationTimestamp
		return time ? dayjs(time).format('YYYY-MM-DD HH:mm') : ''
	}

	/* ---------------- 跳转 ---------------- */
	function handleToMoment(moment : IMoment) {
		uni.navigateTo({
			url: `/pages-blog/moment-detail/moment-detail?name=${moment.metadata.name}`,
			animationType: 'slide-in-right',
		})
	}

	function handlePreviewMedias(moment : IMoment, index : number) {
		uni.previewImage({
			current: index,
			urls: momentMedias(moment).map(m => checkImageUrl(m.url)),
		})
	}

	/* ---------------- 生命周期 ---------------- */
	onPageScroll((option : Page.PageScrollOption) => {
		updatePageScrollValue(option.scrollTop)
	})

	onLoad((query) => {
		// 路由参数 username = 用户的 metadata.name;未传则回退为当前登录用户
		pageUsername.value = (query as Record<string, string> | undefined)?.username || userStore.userInfo.username || ''
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
		<!-- 顶部导航不占位,封面图直接顶到状态栏下,做沉浸式头部 -->
		<uh-navbar :scroll-y="scrollY" default-title="个人主页" title-color="text-white" :need-placeholder="false" />

		<!-- 头部封面图 + 黑色模糊遮罩 + 用户信息居中 + 底部渐变过渡(参考 mine.vue) -->
		<view class="box-border relative h-76 w-full overflow-hidden pt-10">
			<!-- 封面背景图(空时 checkImageUrl 回落默认背景图) -->
			<view class="absolute left-0 top-0 h-full w-full bg-cover bg-center" :style="profileStyle" />
			<!-- 黑色半透明遮罩 + backdrop-filter 模糊 -->
			<view class="uh-profile-mask pointer-events-none absolute left-0 top-0 h-full w-full" />
			<!-- 用户信息(垂直水平居中) -->
			<view class="relative z-10 flex h-full flex-col items-center justify-center px-6">
				<image :src="checkAvatarUrl(headerUser.avatar)"
					class="uh-global-card-glass uh-shadow-xs h-20 w-20 rounded-full border-2 border-white/40" mode="aspectFill" />
				<view class="mt-3 text-md text-white font-black drop-shadow">{{ headerUser.nickname || headerUser.username }}</view>
				<view class="mt-1.5 flex items-center gap-x-2">
					<text v-if="headerUser.role"
						class="rounded-full bg-white/20 px-2 py-0.5 text-20rpx text-white backdrop-blur-sm">{{ headerUser.role }}</text>
				</view>
				<text class="mt-2 max-w-[85%] text-center text-2xs text-white/80">{{ headerUser.bio }}</text>
			</view>
			<!-- 底部渐变过渡到内容区背景(参考 mine.vue 的 wave 区渐变) -->
			<view class="pointer-events-none absolute bottom-0 left-0 z-20 h-18 w-full from-black/0 to-page bg-gradient-to-b" />
		</view>

		<!-- 分段 Tab(文章 / 瞬间):wd-sticky 吸顶,offset-top 对齐导航栏高度(同 gallery.vue 用法) -->
		<wd-sticky :offset-top="offsetTop">
			<view class="w-screen box-border px-16">
				<view class="flex items-center w-full uh-global-card-glass mt-4 shadow-none flex rounded-xl p-1">
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

		<!-- 文章 Tab(全局卡片 uh-article-card) -->
		<template v-if="activeTab === 'post'">
			<uh-data-loading v-if="postState.loadingStatus.value !== DataLoadingStatusEnum.Success"
				:loading-status="postState.loadingStatus.value" empty-text="啊偶，还没有发布过文章哦~" min-height="50vh"
				@refresh="postState.refresh()" />
			<view v-else class="box-border flex flex-col gap-3 p-3">
				<uh-article-card v-for="article in postState.list.value" :key="article.metadata.name"
					from="articles" variant="list" :article="article" :audit-mode="calcAuditModeEnabled" />
				<uh-data-loadmore :status="postState.loadMoreStatus.value.status"
					:text="postState.loadMoreStatus.value.text" />
			</view>
		</template>

		<!-- 瞬间 Tab(全局卡片样式,后续再封装独立组件) -->
		<template v-else>
			<uh-data-loading v-if="momentState.loadingStatus.value !== DataLoadingStatusEnum.Success"
				:loading-status="momentState.loadingStatus.value" empty-text="啊偶，还没有发布过瞬间哦~" min-height="50vh"
				@refresh="momentState.refresh()" />
			<view v-else class="box-border flex flex-col gap-3 p-3">
				<view v-for="moment in momentState.list.value" :key="moment.metadata.name"
					class="uh-global-card-glass uh-shadow-xs overflow-hidden rounded-2xl p-4"
					@click="handleToMoment(moment)">
					<!-- 正文 HTML(瞬间内容为服务端渲染 HTML) -->
					<rich-text :nodes="moment.spec?.content?.html || ''" />
					<!-- 媒体(渲染时 check 补全,存原始地址) -->
					<view v-if="momentMedias(moment).length" class="mt-3 grid grid-cols-3 gap-1.5">
						<template v-for="(media, index) in momentMedias(moment)" :key="index">
							<video v-if="media.type === 'VIDEO'" :src="checkUrl(media.url)"
								class="aspect-square w-full rounded-xl object-cover" :controls="false" />
							<image v-else :src="checkImageUrl(media.url)"
								class="aspect-square w-full rounded-xl object-cover" mode="aspectFill"
								@click.stop="handlePreviewMedias(moment, index)" />
						</template>
					</view>
					<view class="mt-3 flex items-center justify-between">
						<text class="text-2xs text-gray-400">{{ formatMomentTime(moment) }}</text>
						<view class="flex items-center gap-x-3 text-2xs text-gray-400">
							<text v-if="moment.stats?.upvote">❤️ {{ moment.stats?.upvote }}</text>
							<text v-if="moment.stats?.totalComment">💬 {{ moment.stats?.totalComment }}</text>
						</view>
					</view>
				</view>
				<uh-data-loadmore :status="momentState.loadMoreStatus.value.status"
					:text="momentState.loadMoreStatus.value.text" />
			</view>
		</template>
	</view>
</template>

<style scoped>
	/* 黑色遮罩:半透明底色 + 背景模糊(部分小程序环境不支持 backdrop-filter,底色兜底保证可读性) */
	.uh-profile-mask {
		background-color: rgba(0, 0, 0, 0.35);
		backdrop-filter: blur(8rpx);
		-webkit-backdrop-filter: blur(8rpx);
	}
</style>
