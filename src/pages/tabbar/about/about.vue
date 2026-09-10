<script lang="ts" setup>
	/**
 * 关于页(源自旧项目 pages/tabbar/about/about.vue,新建复刻)
 * 功能:博主信息 + 站点统计 + 功能导航 + 版权
 * 风格:对齐全站设计语言(bg-page + uh-global-card-glass + uh-section-title + 彩色图标块)
 */
	import { computed, ref, watch } from 'vue'
	import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
	import { getBlogStatistics } from '@/api/halo'
	import { useAppConfigStore } from '@/store/appConfig'
	import { useFavoritesStore } from '@/store/favorites'
	import { NeedPluginIds } from '@/hooks/usePluginAvailable'
	import { checkAvatarUrl, checkImageUrl } from '@/utils/url'
	import { checkHasAdminLogin } from '@/utils/auth'
	import { t } from '@/locale'
	import type { IBlogStats } from '@/api/types/halo'

	definePage({
		style: {
			navigationBarTitleText: '关于',
			enablePullDownRefresh: true,
			navigationStyle: 'custom',
		},
	})

	const appConfigStore = useAppConfigStore()
	const favoritesStore = useFavoritesStore()
	const haloConfigs = computed(() => appConfigStore.configs)
	const calcAuditModeEnabled = computed(() => appConfigStore.auditModeEnabled)
	/** 数据看板插件可用性(供导航项显隐判断,参考 gallery 对象传参模式) */
	const { check: checkDataVisualPlugin } = usePluginAvailable({
		pluginId: NeedPluginIds.PluginDataStatistics,
	})
	/** 投票插件可用性（投票中心导航项显隐；pluginConfig.votePlugin 已下线，2026-09-10 改插件启用检测） */
	const { check: checkVotePluginAvailable } = usePluginAvailable({
		pluginId: NeedPluginIds.PluginVote,
	})
	/** 链接插件可用性（友情链接导航项显隐；pluginConfig.linksPlugin 已下线，2026-09-10 改插件启用检测） */
	const { check: checkLinksPluginAvailable } = usePluginAvailable({
		pluginId: NeedPluginIds.PluginLinks,
	})

	/* ---------------- 计算属性 ---------------- */
	const bloggerInfo = computed(() => {
		const blogger = haloConfigs.value.authorConfig?.blogger as
			| { nickname ?: string, avatar ?: string, description ?: string }
			| undefined
		return {
			nickname: blogger?.nickname || '',
			avatar: checkAvatarUrl(blogger?.avatar),
			description: blogger?.description || '',
		}
	})

	const pageConfig = computed(() => haloConfigs.value.pageConfig?.aboutConfig as
		| { bgImageUrl ?: string, waveImageUrl ?: string }
		| undefined)

	const calcProfileStyle = computed(() => ({
		backgroundImage: `url(${checkImageUrl(pageConfig.value?.bgImageUrl)})`,
	}))

	const calcWaveUrl = computed(() => checkImageUrl(pageConfig.value?.waveImageUrl))

	const basicConfig = computed(() => haloConfigs.value.basicConfig as
		| {
			copyrightConfig ?: { enabled ?: boolean, content ?: string }
			disclaimers ?: { enabled ?: boolean }
			showAboutSystem ?: boolean
		}
		| undefined)

	const copyrightConfig = computed(() => basicConfig.value?.copyrightConfig)

	const loveEnabled = computed(() => !!(haloConfigs.value.loveConfig as { loveEnabled ?: boolean } | undefined)?.loveEnabled)
	const socialEnabled = computed(() => !!(haloConfigs.value.authorConfig?.social as { enabled ?: boolean } | undefined)?.enabled)

	/* ---------------- 状态 ---------------- */
	const statisticsShowMore = ref(false)
	const statistics = ref<IBlogStats>({ post: 0, comment: 0, category: 0, visit: 0, upvote: 0 })

	/** 主行统计(常驻展示) */
	const allStats = computed(() => [
		{ key: 'post', label: '内容', value: statistics.value.post },
		{ key: 'visit', label: '访客', value: statistics.value.visit },
		{ key: 'category', label: '分类', value: statistics.value.category },
		{ key: 'comment', label: '评论', value: statistics.value.comment },
		{ key: 'upvote', label: '点赞', value: statistics.value.upvote },
	])

	interface INavItem {
		key : string
		title : string
		iconPrefix ?: string
		icon : string
		/** 图标块背景色(与首页快捷导航同色板,同一功能同色) */
		bgColor : string
		/** 图标颜色（插件端 myPageConfig 条目 color；本地默认缺省由 toSolidColor(bgColor) 派生） */
		color ?: string
		rightText : string
		path : string | null
		isAdmin ?: boolean
		openType ?: string
		show : boolean
		/** 分组:blog=博客功能 more=更多信息 */
		group : 'blog' | 'more'
	}

	/** 插件端 myPageConfig 条目（pageConfig.myPageConfig.commonFeatures/otherFeatures；
	 * 字段命名与插件端一致：key/title/subTitle/color/bgColor/iconPrefix/icon/path/visible） */
	interface IMyPageEntry {
		key ?: string
		title ?: string
		subTitle ?: string
		color ?: string
		bgColor ?: string
		iconPrefix ?: string
		icon ?: string
		path ?: string
		visible ?: boolean
	}

	// 是否使用本地的功能入口数据（true=忽略插件端 myPageConfig，用内置默认；便于二次开发本地定制）
	const useLocalNav = false

	/** 插件端 myPageConfig（additive：未配置/为空返回 null，回退本地内置默认） */
	const configuredFeatures = computed(() => {
		const mp = haloConfigs.value.pageConfig?.myPageConfig as
			| { commonFeatures ?: IMyPageEntry[], otherFeatures ?: IMyPageEntry[] }
			| undefined
		if (useLocalNav || !mp || (!mp.commonFeatures?.length && !mp.otherFeatures?.length)) {
			return null
		}
		return mp
	})

	const navList = ref<INavItem[]>([])

	/** 分组渲染(过滤后空组整组隐藏；组标题对齐插件端：常用功能/其他功能) */
	const calcNavGroups = computed(() => {
		const visible = navList.value.filter(n => n.show)
		const groupDefs : { key : 'blog' | 'more', title : string }[] = [
			{ key: 'blog', title: '常用功能' },
			{ key: 'more', title: '其他功能' },
		]
		return groupDefs
			.map(def => ({ ...def, items: visible.filter(n => n.group === def.key) }))
			.filter(group => group.items.length > 0)
	})

	/* ---------------- 功能导航 ---------------- */
	/** 图标块浅色背景:品牌深色 rgba 降透明度 → 轻量底色 */
	function toLightBg(rgba : string) {
		return rgba.replace('0.95)', '0.15)')
	}

	/** 图标颜色:品牌深色实色 */
	function toSolidColor(rgba : string) {
		return rgba.replace('0.95)', '1)')
	}

	/** 收藏导航项右侧文案跟随收藏总数(收藏页返回/切回时刷新) */
	function syncFavoritesNavText() {
		const nav = navList.value.find(n => n.key === 'favorites')
		if (nav) {
			nav.rightText = `共 ${favoritesStore.counts.total} 条收藏`
		}
	}

	async function handleGetNavList() {
		// 配置模式：插件端 myPageConfig 两组（常用功能→blog、其他功能→more），
		// 未配置/为空时回退本地内置默认（保留原显隐推导）
		const mp = configuredFeatures.value
		if (mp) {
			const mapEntry = (e : IMyPageEntry, group : 'blog' | 'more') : INavItem | null => {
				if (!e.key)
					return null
				return {
					key: e.key,
					title: e.title || '',
					iconPrefix: e.iconPrefix,
					icon: e.icon || '',
					bgColor: e.bgColor || 'rgba(150, 150, 150, 0.95)',
					color: e.color,
					rightText: e.subTitle || '',
					path: e.path || null,
					show: e.visible !== false,
					group,
				}
			}
			navList.value = [
				...(mp.commonFeatures || []).map(e => mapEntry(e, 'blog')).filter((n): n is INavItem => n !== null),
				...(mp.otherFeatures || []).map(e => mapEntry(e, 'more')).filter((n): n is INavItem => n !== null),
			]
			syncFavoritesNavText()
			return
		}

		const [dataVisualAvailable, voteAvailable, linksAvailable] = await Promise.all([
			checkDataVisualPlugin(),
			checkVotePluginAvailable(),
			checkLinksPluginAvailable(),
		])

		navList.value = [
			{
				key: 'favorites',
				title: '我的收藏',
				iconPrefix: 'uhemoji2-icon',
				icon: '-smiling',
				bgColor: 'rgba(255, 179, 0, 0.95)',
				rightText: '',
				path: '/pages-blog/favorites/favorites',
				show: true,
				group: 'blog',
			},
			{
				key: 'data-visual',
				title: '数据看板',
				iconPrefix: 'uhemoji2-icon',
				icon: '-surprised',
				bgColor: 'rgba(102, 60, 201, 0.95)',
				rightText: '站点数据可视化',
				path: '/pages-blog/data-visual/data-visual',
				show: dataVisualAvailable,
				group: 'blog',
			},
			{
				key: 'archives',
				title: calcAuditModeEnabled.value ? '内容归档' : '文章归档',
				iconPrefix: 'uhemoji2-icon',
				icon: '-mask',
				bgColor: 'rgba(3, 169, 244, 0.95)',
				rightText: calcAuditModeEnabled.value ? '全部已归档内容' : '全部已归档文章',
				path: '/pages-blog/archives/archives',
				show: true,
				group: 'blog',
			},
			{
				key: 'love',
				title: '恋爱日记',
				iconPrefix: 'uhemoji2-icon',
				icon: '-in-love',
				bgColor: 'rgba(255, 76, 103, 0.95)',
				rightText: '博主的恋爱日记',
				path: '/pages-blog/love/love',
				show: loveEnabled.value,
				// show: true,
				group: 'blog',
			},
			{
				key: 'vote',
				title: '投票中心',
				iconPrefix: 'uhemoji2-icon',
				icon: '-confused',
				bgColor: 'rgba(0, 188, 212, 0.95)',
				rightText: '查看和进行投票',
				path: '/pages-blog/votes/votes',
				show: !calcAuditModeEnabled.value && voteAvailable,
				// show: true,
				group: 'blog',
			},
			{
				key: 'friend-links',
				title: '友情链接',
				iconPrefix: 'uhemoji2-icon',
				icon: '-cool',
				bgColor: 'rgba(0, 150, 136, 0.95)',
				rightText: '看看博主朋友们吧',
				path: '/pages-blog/friend-links/friend-links',
				show: linksAvailable,
				// show: true,
				group: 'blog',
			},
			{
				key: 'disclaimers',
				title: '免责声明',
				iconPrefix: 'uhemoji2-icon',
				icon: '-smirking',
				bgColor: 'rgba(121, 85, 72, 0.95)',
				rightText: '博客内容免责声明',
				path: '/pages-blog/disclaimers/disclaimers',
				show: !!basicConfig.value?.disclaimers?.enabled,
				// show: true,
				group: 'more',
			},
			{
				key: 'contact-blogger',
				title: '联系博主',
				iconPrefix: 'uhemoji2-icon',
				icon: '-wink',
				bgColor: 'rgba(255, 152, 0, 0.95)',
				rightText: '博主常用联系方式',
				path: '/pages-blog/contact/contact',
				show: socialEnabled.value,
				// show: true,
				group: 'more',
			},
			{
				key: 'about',
				title: '关于项目',
				iconPrefix: 'uhemoji2-icon',
				icon: '-happy-',
				bgColor: 'rgba(96, 125, 139, 0.95)',
				rightText: '小莫唐尼开源项目',
				path: '/pages-blog/about/about',
				show: !!basicConfig.value?.showAboutSystem,
				// show: true,
				group: 'more',
			},
			{
				key: 'setting',
				title: '偏好设置',
				iconPrefix: 'uhemoji2-icon',
				icon: '-tired',
				bgColor: 'rgba(121, 134, 203, 0.95)',
				rightText: '首页布局、卡片样式等本地偏好',
				path: '/pages-blog/setting/setting',
				show: true,
				group: 'more',
			},
		]
		syncFavoritesNavText()
	}

	/* ---------------- 数据加载 ---------------- */
	async function handleGetData() {
		try {
			const res = await getBlogStatistics()
			statistics.value = res.data
		}
		catch (err) {
			console.error('获取统计失败', err)
			uni.showToast({ icon: 'none', title: t('common.loadFailedRetry') })
		}
		finally {
			uni.stopPullDownRefresh()
		}
	}

	/* ---------------- 交互 ---------------- */
	function handleOnNav(data : { path : string | null, isAdmin ?: boolean }) {
		const { path, isAdmin } = data
		if (!path)
			return

		// 拦截后台管理页面(需超管登录)
		if (isAdmin && !checkHasAdminLogin()) {
			uni.showModal({
				title: '提示',
				content: '未登录超管账号或登录状态已过期，是否立即登录？',
				showCancel: true,
				cancelText: '否',
				cancelColor: '#999999',
				confirmText: '是',
				confirmColor: '#03a9f4',
				success: (res) => {
					if (res.confirm) {
						uni.navigateTo({ url: '/pages/auth/login' })
					}
				},
			})
			return
		}

		uni.navigateTo({ url: path })
	}

	/* ---------------- 生命周期 ---------------- */
	watch(haloConfigs, () => {
		handleGetNavList()
	}, { deep: true, immediate: true })

	handleGetData()

	// 从收藏页返回/切回时刷新收藏数文案
	onShow(() => {
		syncFavoritesNavText()
	})

	onPullDownRefresh(() => {
		handleGetData()
	})
</script>

<template>
	<view class="box-border min-h-screen w-screen bg-page pb-8">
		<!-- 头部:博主信息(背景图 + 遮罩 + wave,内容区做状态栏适配) -->
		<view class="blogger-info relative h-76 w-full bg-cover bg-no-repeat" :style="[calcProfileStyle]">
			<!-- 背景遮罩 -->
			<view class="absolute left-0 top-0 z-0 h-full w-full bg-black/30 backdrop-blur-[2rpx]" />
			<view class="relative z-6 h-full flex flex-col items-center justify-center pb-[140rpx] pt-safe">
				<image class="uh-global-card-glass h-20 w-20 rounded-full" :src="bloggerInfo.avatar"
					mode="aspectFill" />
				<view class="mt-4 text-lg text-white font-bold text-shadow-[0_2rpx_8rpx_rgba(0,0,0,0.4)]">
					{{ bloggerInfo.nickname }}
				</view>
				<view
					class="desc mt-2 px-10 text-center text-[26rpx] text-white/90 leading-relaxed text-shadow-[0_2rpx_8rpx_rgba(0,0,0,0.4)]">
					{{ bloggerInfo.description || '这个博主很懒，竟然没写介绍~' }}
				</view>
			</view>
			<image v-if="calcWaveUrl" :src="calcWaveUrl" mode="scaleToFill"
				class="gif-wave absolute bottom-0 left-0 z-99 h-[100rpx] w-full" style="mix-blend-mode: screen;" />
		</view>

		<!-- 站点统计 -->
		<view class="uh-global-card-glass uh-shadow-xs relative z-100 mx-4 flex border rounded-2xl -mt-12">
			<view v-for="item in allStats" :key="item.key" class="flex-1 py-4 text-center">
				<wd-count-to
					:key="`${item.key}-${item.value}`" :start-val="0" :end-val="item.value"
					:duration="900" separator="" color="#111827" custom-class="text-lg font-bold"
				/>
				<view class="mt-1 text-xs text-gray-500">
					{{ item.label }}
				</view>
			</view>
		</view>

		<!-- 功能导航-->
		<template v-for="group in calcNavGroups" :key="group.key">
			<uh-section-title class="mx-4 mb-3 mt-8">
				{{ group.title }}
			</uh-section-title>
			<view class="uh-global-card-glass mx-4 overflow-hidden rounded-2xl">
				<view v-for="(nav, index) in group.items" :key="nav.key"
					class="nav-item flex items-center justify-between px-4"
					:class="index < group.items.length - 1 ? 'border-b border-b-solid border-black/5' : ''"
					@click="handleOnNav(nav)">
					<view class="nav-left flex items-center gap-3 py-3">
						<view
							class="uh-global-card-glass border uh-shadow-xs h-8 w-8 flex items-center justify-center rounded-xl"
							:style="{ backgroundColor: toLightBg(nav.bgColor) }">
							<wd-icon :class-prefix="nav.iconPrefix" :name="nav.icon" size="36rpx"
								:color="nav.color || toSolidColor(nav.bgColor)" />
						</view>
						<text class="nav-title text-sm text-gray-900 font-bold">{{ nav.title }}</text>
					</view>
					<view class="nav-right flex items-center gap-2">
						<text class="nav-right-text text-xs text-gray-400">{{ nav.rightText }}</text>
						<wd-icon name="arrow-right" size="12px" color="#c8c2b4" />
					</view>
				</view>
			</view>
		</template>

		<!-- 版权 -->
		<view v-if="copyrightConfig?.enabled" class="mt-6 px-6 text-center text-xs text-gray-400">
			<view>{{ copyrightConfig.content }}</view>
		</view>
	</view>
</template>