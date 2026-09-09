<script lang="ts" setup>
	import { computed, onBeforeUnmount, ref } from 'vue'
	import { onLoad, onShow } from '@dcloudio/uni-app'
	import { useAppConfigStore } from '@/store/appConfig'
	import { checkAvatarUrl, checkImageUrl } from '@/utils/url'
	import { unlockLoveModule } from '@/api/uni-halo'
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
		ourStory : { enabled : boolean, passwordEnabled ?: boolean }
		lovePhoto : { enabled : boolean, passwordEnabled ?: boolean }
		loveDaily : { enabled : boolean, passwordEnabled ?: boolean }
		[key : string] : unknown
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
		ourStory: { enabled: false, passwordEnabled: false },
		lovePhoto: { enabled: false, passwordEnabled: false },
		loveDaily: { enabled: false, passwordEnabled: false },
	})

	const loveDayCount = ref({ d: 0, h: 0, m: 0, s: 0 })
	let loveDayTimer : ReturnType<typeof setTimeout> | null = null

	const navList = ref<{ key : string, use : boolean, iconPrefix : string, icon : string, title : string, desc : string }[]>([])


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

		// 从 getConfigs.loveConfig 取模块开关与页面图片(缺省保留默认)
		const loveModuleConfig = appConfigs.loveConfig as Partial<ILoveConfigPage> | undefined
		if (loveModuleConfig) {
			loveConfig.value = {
				...loveConfig.value,
				pageImages: loveModuleConfig.pageImages || loveConfig.value.pageImages,
				ourStory: loveModuleConfig.ourStory || loveConfig.value.ourStory,
				lovePhoto: loveModuleConfig.lovePhoto || loveConfig.value.lovePhoto,
				loveDaily: loveModuleConfig.loveDaily || loveConfig.value.loveDaily,
			}
		}

		initList()
		// 未配置纪念日(loveDate 为空)不启动倒计时,避免 NaN
		if (loveConfig.value.loveDate) {
			handleInitLoveDayCount()
		}
	}

	function initList() {
		const configs = loveConfig.value
		navList.value = [
			{
				key: 'stories',
				use: configs.ourStory.enabled,
				title: '恋爱故事',
				desc: '我们一起度过的那些经历',
				iconPrefix: 'uhlove-icon',
				icon: 'gushi',
			},
			{
				key: 'album',
				use: configs.lovePhoto.enabled,
				title: '恋爱相册',
				desc: '定格了我们的那些小美好',
				iconPrefix: 'uhlove-icon',
				icon: 'xiangce'
			},
			{
				key: 'list',
				use: configs.loveDaily.enabled,
				title: '恋爱清单',
				desc: '你我之间的约定我们都在努力实现',
				iconPrefix: 'uhlove-icon',
				icon: 'liebiao'
			},
		]
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
	/** 页面名 → 恋爱模块 scope 映射（stories→ourStory、album→lovePhoto、list→loveDaily） */
	const MODULE_KEY_MAP: Record<string, LoveModuleKey> = {
		stories: 'ourStory',
		album: 'lovePhoto',
		list: 'loveDaily',
	}

	/** 模块密码弹窗状态 */
	const passwordModalVisible = ref(false)
	const pendingPage = ref('')
	const pendingModule = ref<LoveModuleKey>('ourStory')
	const modulePassword = ref('')
	const unlocking = ref(false)

	function handleToPage(pageName : string) {
		const module = MODULE_KEY_MAP[pageName]
		const moduleCfg = module
			? (loveConfig.value[module] as { enabled ?: boolean, passwordEnabled ?: boolean })
			: undefined
		// 模块设了密码且本地无有效 token → 先弹密码框验证
		if (moduleCfg?.passwordEnabled && !getLoveModuleToken(module)) {
			pendingPage.value = pageName
			pendingModule.value = module
			modulePassword.value = ''
			passwordModalVisible.value = true
			return
		}
		uni.navigateTo({
			url: `/pages-blog/love/${pageName}`,
		})
	}

	/** 密码确认：unlock 签发 token 后进入模块 */
	async function handleConfirmPassword() {
		if (!modulePassword.value.trim()) {
			uni.showToast({ icon: 'none', title: '请输入密码' })
			return
		}
		try {
			unlocking.value = true
			const res = await unlockLoveModule(pendingModule.value, modulePassword.value)
			const token = res.data?.token
			if (token) {
				setLoveModuleToken(pendingModule.value, token)
				passwordModalVisible.value = false
				uni.navigateTo({ url: `/pages-blog/love/${pendingPage.value}` })
			}
			else {
				uni.showToast({ icon: 'none', title: '解锁失败，请重试' })
			}
		}
		catch {
			uni.showToast({ icon: 'none', title: '密码不正确' })
		}
		finally {
			unlocking.value = false
		}
	}

	/* ---------------- 生命周期 ---------------- */
	onLoad(() => {
		syncLoveConfigFromStore()
	})

	onShow(async () => {
		await appConfigStore.bootstrap()
		syncLoveConfigFromStore()
	})

	onBeforeUnmount(() => {
		if (loveDayTimer) {
			clearTimeout(loveDayTimer)
		}
	})
</script>

<template>
	<view class="bg-pink-100 min-h-screen w-screen">
		<uh-navbar default-title="恋爱日记" :need-placeholder="false" back-class="text-love"
			title-color="!text-love"></uh-navbar>

		<!-- 情侣信息 -->
		<view class="relative z-10 h-92 w-screen flex flex-col items-center justify-center">
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
			<view class="absolute z-2 left-0 bottom-0 w-full h-12 bg-gradient-to-b from-white/0 to-pink-100" />
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
							{{ nav.desc }}
						</view>
					</view>
					<view class="shrink-0">
						<wd-icon name="arrow-right" :class="[index%2===0?'text-love':'text-blue-400']"
							size="32rpx"></wd-icon>
					</view>
				</view>
			</block>
		</view>
	</view>

	<!-- 模块密码验证弹窗 -->
	<view v-if="passwordModalVisible" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
		@click="passwordModalVisible = false">
		<view class="box-border w-4/5 rounded-2xl bg-white p-6" @click.stop>
			<view class="text-center text-lg font-bold text-love">请输入访问密码</view>
			<view class="mt-2 text-center text-xs text-gray-500">
				{{ pendingModule === 'ourStory' ? '恋爱故事' : pendingModule === 'lovePhoto' ? '恋爱相册' : '恋爱清单' }}已设置访问密码，输入后进入
			</view>
			<input v-model="modulePassword" password
				class="mt-4 h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none"
				placeholder="请输入密码" />
			<view class="mt-5 flex items-center gap-3">
				<view class="flex-1 rounded-xl bg-gray-100 py-2.5 text-center text-sm text-gray-600"
					@click="passwordModalVisible = false">取消</view>
				<view class="flex-1 rounded-xl bg-love py-2.5 text-center text-sm text-white"
					:class="unlocking ? 'opacity-60' : ''" @click="handleConfirmPassword">
					{{ unlocking ? '验证中…' : '进入' }}
				</view>
			</view>
		</view>
	</view>
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