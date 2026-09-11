<script lang="ts" setup>
	import { computed, onBeforeUnmount, ref } from 'vue'
	import { onLoad, onShow } from '@dcloudio/uni-app'
	import { useAppConfigStore } from '@/store/appConfig'
	import { checkAvatarUrl, checkImageUrl } from '@/utils/url'
	import { getPluginCaptcha, unlockLoveModule, type ICaptchaQuery, type IPluginCaptcha } from '@/api/uni-halo'
	import { getLoveModuleToken, setLoveModuleToken, type LoveModuleKey } from '@/utils/loveModuleToken'

	definePage({
		style: {
			navigationBarTitleText: '恋爱日记',
			navigationStyle: 'custom'
		},
	})

	const appConfigStore = useAppConfigStore()

	/* ---------------- 恋爱配置 ---------------- */
	interface ILoveConfigPage {
		enabled : boolean
		loveDateTitle : string
		loveDate : string
		loveInfo : {
			boyNickname : string
			boyAvatar : string
			girlNickname : string
			girlAvatar : string
		}
		pageImages : {
			bgImageUrl : string
			waveImageUrl : string
			heartImageUrl : string
		}
		loveDiary : { enabled : boolean, passwordEnabled ?: boolean }
		ourStory : { enabled : boolean, passwordEnabled ?: boolean }
		lovePhoto : { enabled : boolean, passwordEnabled ?: boolean }
		loveDaily : { enabled : boolean, passwordEnabled ?: boolean }
		navList ?: ILoveNavItem[]
		[key : string] : unknown
	}

	interface ILoveNavItem {
		key : string
		title ?: string
		subTitle ?: string
		priority ?: number
		visible ?: boolean
	}

	const loveConfig = ref<ILoveConfigPage>({
		enabled: false,
		loveDateTitle: '',
		loveDate: '',
		loveInfo: {
			boyNickname: '',
			boyAvatar: '',
			girlNickname: '',
			girlAvatar: '',
		},
		pageImages: {
			bgImageUrl: '',
			waveImageUrl: '',
			heartImageUrl: '',
		},
		loveDiary: { enabled: false, passwordEnabled: false },
		ourStory: { enabled: false, passwordEnabled: false },
		lovePhoto: { enabled: false, passwordEnabled: false },
		loveDaily: { enabled: false, passwordEnabled: false },
	})

	const loveDayCount = ref({ d: 0, h: 0, m: 0, s: 0 })
	let loveDayTimer : ReturnType<typeof setTimeout> | null = null

	interface ILoveNavRenderItem {
		key : string
		use : boolean
		locked: boolean
		iconPrefix : string
		icon : string
		title : string
		subTitle : string
	}

	const useLocalNav = false

	const DEFAULT_NAV_LIST : ILoveNavItem[] = [
		{ key: 'stories', title: '恋爱故事', subTitle: '我们一起度过的那些经历', priority: 1, visible: true },
		{ key: 'album', title: '恋爱相册', subTitle: '定格了我们的那些小美好', priority: 2, visible: true },
		{ key: 'list', title: '恋爱清单', subTitle: '你我之间的约定我们都在努力实现', priority: 3, visible: true },
	]

	const NAV_META: Record<string, { iconPrefix: string, icon: string, page: string }> = {
		stories: { iconPrefix: 'uhlove-icon', icon: 'gushi', page: 'stories' },
		album: { iconPrefix: 'uhlove-icon', icon: 'xiangce', page: 'album' },
		list: { iconPrefix: 'uhlove-icon', icon: 'liebiao', page: 'list' },
	}

	const navList = ref<ILoveNavRenderItem[]>([])

	/* ---------------- 数据加载 ---------------- */
	function syncLoveConfigFromStore() {
		const storeLove = appConfigStore.loveConfig
		const appConfigs = appConfigStore.configs

		loveConfig.value = {
			...loveConfig.value,
			...(storeLove.loveDateTitle ? { loveDateTitle: storeLove.loveDateTitle } : {}),
			...(storeLove.loveDate ? { loveDate: storeLove.loveDate } : {}),
			...(storeLove.enabled !== undefined ? { enabled: storeLove.enabled } : {}),
			loveInfo: {
				...loveConfig.value.loveInfo,
				...(storeLove.loveInfo || {}),
			},
		}

		const loveModuleConfig = appConfigs.loveConfig as Partial<ILoveConfigPage> | undefined
		// 恋爱页背景图：2026-09-11 起插件端由 loveConfig.pageImages 迁至
		// pageConfig.loveDiaryConfig.bgImageUrl，优先读新位置、兼容回退旧值
		const loveDiaryPageConfig = appConfigs.pageConfig?.loveDiaryConfig as
			{ bgImageUrl ?: string } | undefined
		const pageImagesBg =
			loveDiaryPageConfig?.bgImageUrl
			|| loveModuleConfig?.pageImages?.bgImageUrl
			|| loveConfig.value.pageImages.bgImageUrl
		if (loveModuleConfig || loveDiaryPageConfig) {
			loveConfig.value = {
				...loveConfig.value,
				pageImages: {
					...loveConfig.value.pageImages,
					bgImageUrl: pageImagesBg,
				},
				loveDiary: loveModuleConfig?.loveDiary || loveConfig.value.loveDiary,
				ourStory: loveModuleConfig?.ourStory || loveConfig.value.ourStory,
				lovePhoto: loveModuleConfig?.lovePhoto || loveConfig.value.lovePhoto,
				loveDaily: loveModuleConfig?.loveDaily || loveConfig.value.loveDaily,
				navList: loveModuleConfig?.navList || loveConfig.value.navList,
			}
		}

		initList()
		if (loveConfig.value.loveDate) {
			handleInitLoveDayCount()
		}
	}

	function initList() {
		const configs = loveConfig.value
		const configured = configs.navList
		let source : ILoveNavItem[]
		if (!useLocalNav && configured && configured.length) {
			source = configured
		} else {
			source = DEFAULT_NAV_LIST;
		}
		const sorted = [...source].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
		navList.value = sorted.map((item) => {
			const meta = NAV_META[item.key]
			if (!meta) {
				return null
			}
			const moduleKey = MODULE_KEY_MAP[item.key]
			const moduleCfg = moduleKey
				? (configs[moduleKey] as { enabled ?: boolean, passwordEnabled ?: boolean } | undefined)
				: undefined
			const fallback = DEFAULT_NAV_LIST.find((d) => d.key === item.key)
			return {
				key: item.key,
				use: !!moduleCfg?.enabled && item.visible !== false,
				// 模块设了密码且本地无有效 token → 显示 lock;解锁后恢复箭头
				locked: !!moduleCfg?.passwordEnabled && !(moduleKey && getLoveModuleToken(moduleKey)),
				iconPrefix: meta.iconPrefix,
				icon: meta.icon,
				title: item.title || fallback?.title || '',
				subTitle: item.subTitle || fallback?.subTitle || '',
			}
		}).filter((item): item is ILoveNavRenderItem => item !== null)
	}

	/* ---------------- 恋爱计时 ---------------- */
	function handleInitLoveDayCount() {
		if (loveDayTimer) {
			clearTimeout(loveDayTimer)
		}
		const countDownFn = () => {
			loveDayTimer = setTimeout(countDownFn, 1000)
			const formatStartDate = loveConfig.value.loveDate.replace(/-/g, '/')
			const start = new Date(formatStartDate)
			const now = new Date()
			const T = now.getTime() - start.getTime()
			const i = 24 * 60 * 60 * 1000
			const d = T / i
			const D = Math.floor(d)
			const h = (d - D) * 24
			const H = Math.floor(h)
			const m = (h - H) * 60
			const M = Math.floor(m)
			const s = (m - M) * 60
			const S = Math.floor(s)
			loveDayCount.value = { d: D, h: H, m: M, s: S }
		}
		countDownFn()
	}

	/* ---------------- 跳转（模块密码拦截） ---------------- */
	const MODULE_KEY_MAP: Record<string, LoveModuleKey> = {
		stories: 'ourStory',
		album: 'lovePhoto',
		list: 'loveDaily',
	}

	/** 模块密码弹窗状态 */
	const unlockModalVisible = ref(false)
	const pendingPage = ref('')
	const pendingModule = ref<LoveModuleKey>('ourStory')

	/** 恋爱日记入口（love 页本身）是否锁定：设了密码且本地无有效 token */
	const loveDiaryLocked = computed(() =>
		!!loveConfig.value.loveDiary?.passwordEnabled && !getLoveModuleToken('loveDiary'))

	function handleToPage(pageName : string) {
		const module = MODULE_KEY_MAP[pageName]
		const moduleCfg = module
			? (loveConfig.value[module] as { enabled ?: boolean, passwordEnabled ?: boolean })
			: undefined
		// 模块设了密码且本地无有效 token → 先弹密码框验证
		if (moduleCfg?.passwordEnabled && !getLoveModuleToken(module)) {
			pendingPage.value = pageName
			pendingModule.value = module
			unlockModalVisible.value = true
			return
		}
		uni.navigateTo({
			url: `/pages-blog/love/${pageName}`,
		})
	}

	/** 通用解锁弹窗请求：unlock 签发 token（插件端要求验证码，403 附新码由弹窗展示重试） */
	async function handleUnlockRequest(password : string, captcha ?: ICaptchaQuery | null) {
		const res = await unlockLoveModule(pendingModule.value, password, captcha)
		return res.data as { token ?: string, [key : string] : unknown } | null | undefined
	}

	/** 解锁成功：存 token；恋爱日记入口（loveDiary）重新拉取恋爱信息，其余进入模块 */
	function handleUnlockSuccess(data : { token ?: string }) {
		if (data.token) {
			setLoveModuleToken(pendingModule.value, data.token)
			if (pendingModule.value === 'loveDiary') {
				// 恋爱日记入口解锁：重新拉取 /love-config 并刷新页面状态
				appConfigStore.fetchLoveConfig().then(() => syncLoveConfigFromStore())
			}
			else {
				uni.navigateTo({ url: `/pages-blog/love/${pendingPage.value}` })
			}
		}
		else {
			uni.showToast({ icon: 'none', title: '解锁失败，请重试' })
		}
	}

	/* ---------------- 生命周期 ---------------- */
	onLoad(() => {
		syncLoveConfigFromStore()
	})

	onShow(async () => {
		await appConfigStore.bootstrap()
		syncLoveConfigFromStore()
		// 恋爱日记入口（love 页本身）设了密码且本地无 token → 先弹密码框验证
		if (loveDiaryLocked.value) {
			pendingPage.value = ''
			pendingModule.value = 'loveDiary'
			unlockModalVisible.value = true
		}
	})

	onBeforeUnmount(() => {
		if (loveDayTimer) {
			clearTimeout(loveDayTimer)
		}
	})
</script>

<template>
	<view class="bg-pink-50 min-h-screen w-screen">
		<uh-navbar default-title="恋爱日记" :need-placeholder="false" back-class="text-love"
			title-color="!text-love"></uh-navbar>

		<!-- 情侣信息 -->
		<view class="box-border pt-12 relative z-10 h-92 w-screen flex flex-col items-center justify-center">
			<view class="relative z-10 w-full h-full flex items-center justify-center rounded-xl">
				<view class="boy flex flex-col items-center justify-center translate-x-0.5">
					<image class="uh-global-card-glass border-3 box-border border-blue-400 h-26 w-26 rounded-full"
						:src="checkAvatarUrl(loveConfig.loveInfo.boyAvatar)" mode="aspectFill" />
					<view class="bg-blue-500 mt-2 text-center text-xs text-white font-bold px-2 py-1 rounded-lg">
						{{ loveConfig.loveInfo.boyNickname }}
					</view>
				</view>
				<!-- 心动呼吸动画 -->
				<text class="heart-beat absolute z-10"><wd-icon class-prefix="uhlove-icon" name="aixin" size="72rpx"></wd-icon></text>
				<view class="girl flex flex-col items-center justify-center -translate-x-0.5">
					<image class="uh-global-card-glass border-3 box-border border-love h-26 w-26 rounded-full"
						:src="checkAvatarUrl(loveConfig.loveInfo.girlAvatar)" mode="aspectFill" />
					<view class="bg-love mt-2 text-center text-xs text-white font-bold px-2 py-1 rounded-lg">
						{{ loveConfig.loveInfo.girlNickname }}
					</view>
				</view>
			</view>
			<image :src="checkImageUrl(loveConfig.pageImages.bgImageUrl)" class="absolute z-0 inset-0 w-full h-full"
				mode="aspectFill" />
			<view class="absolute z-2 left-0 bottom-0 w-full h-36 bg-gradient-to-b from-white/0 via-pink-50/50 to-pink-50" />
		</view>

		<!-- 恋爱记时 -->
		<view class="love-time-wrap mt-8 w-screen flex flex-col items-center justify-center">
			<view class="title text-xl text-love font-bold">
				{{ loveConfig.loveDateTitle }}
			</view>
			<view class="content mt-6 flex items-center justify-center">
				<text class="text text-sm">
					第
					<text class="number mx-2 text-2xl text-love font-bold">{{ loveDayCount.d }}</text>
					天
				</text>
				<text class="text text-sm">
					<text class="number mx-2 text-2xl text-blue-400 font-bold">{{ loveDayCount.h }}</text>
					小时
				</text>
				<text class="text text-sm">
					<text class="number mx-2 text-2xl text-love font-bold">{{ loveDayCount.m }}</text>
					分钟
				</text>
				<text class="text text-sm">
					<text class="number mx-2 text-2xl text-blue-400 font-bold">{{ loveDayCount.s }}</text>
					秒
				</text>
			</view>
		</view>

		<!-- 功能导航 -->
		<view class="mt-6 box-border flex flex-col items-center justify-center gap-y-4 px-4">
			<block v-for="(nav, index) in navList" :key="index">
				<view v-if="nav.use"
					class="box-border list-item uh-global-card-glass bg-white/60 p-3 w-full flex items-center justify-around gap-x-4 rounded-2xl"
					:class="`list-item-${index + 1}`" @click="handleToPage(nav.key)">
					<view class="flex items-center justify-center h-12 w-12 rounded-xl opacity-70" :class="[index%2===0?'bg-pink-100':'bg-blue-100']">
						<wd-icon :class-prefix="nav.iconPrefix" :name="nav.icon" size="66rpx" />
					</view>
					<view class="box-border flex flex-1 flex-col justify-center gap-y-1">
						<view class="name text-md font-bold" :class="[index%2===0?'text-love':'text-blue-400']">
							{{ nav.title }}
						</view>
						<view class="text-xs truncate" :class="[index%2===0?'text-love/60':'text-blue-300']">
							{{ nav.subTitle }}
						</view>
					</view>
					<view class="shrink-0">
						<wd-icon :name="nav.locked ? 'lock' : 'arrow-right'" :class="[index%2===0?'text-love':'text-blue-400']"
							size="32rpx"></wd-icon>
					</view>
				</view>
			</block>
		</view>
	</view>

	<!-- 模块密码验证弹窗(通用解锁弹窗;恋爱日记入口与模块共用;插件端要求验证码,403 附新码) -->
	<uh-unlock-popup v-model:show="unlockModalVisible" title="请输入访问密码" captcha-enabled
		:tip="`${pendingModule === 'loveDiary' ? '恋爱日记' : pendingModule === 'ourStory' ? '恋爱故事' : pendingModule === 'lovePhoto' ? '恋爱相册' : '恋爱清单'}已设置访问密码，输入后进入`"
		placeholder="请输入密码" confirm-text="进入" :request="handleUnlockRequest" @success="handleUnlockSuccess" />
</template>

<style scoped lang="scss">
	/* 心动呼吸动画:两次心跳 + 呼吸回落 */
	.heart-beat {
		animation: heartBeat 1.2s ease-in-out infinite;
	}

	@keyframes heartBeat {
		0%,
		100% {
			transform: translateY(-1rem) scale(1);
		}

		15% {
			transform: translateY(-1rem) scale(1.2);
		}

		30% {
			transform: translateY(-1rem) scale(0.95);
		}

		45% {
			transform: translateY(-1rem) scale(1.15);
		}

		60% {
			transform: translateY(-1rem) scale(1);
		}
	}

	.list-item-1 {
		animation: listItemAni1 3s ease-in-out infinite;
	}

	.list-item-2 {
		animation: listItemAni1 3s ease-in-out infinite;
		animation-delay: 1.5s;
	}

	.list-item-3 {
		animation: listItemAni1 3s ease-in-out infinite;
		animation-delay: 2s;
	}

	@keyframes likeani {
		0% {
			transform: scale(1);
		}

		25% {
			transform: scale(1.2);
		}

		50% {
			transform: scale(1.1);
		}

		75% {
			transform: scale(1.3);
		}

		100% {
			transform: scale(1);
		}
	}

	@keyframes listItemAni1 {
		0% {
			transform: translateY(0);
		}

		50% {
			transform: translateY(-10rpx);
		}

		100% {
			transform: translateY(0);
		}
	}
</style>