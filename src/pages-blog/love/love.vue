<script lang="ts" setup>
	import { computed, onBeforeUnmount, ref } from 'vue'
	import { onLoad, onShow } from '@dcloudio/uni-app'
	import { useAppConfigStore } from '@/store/appConfig'
	import { checkAvatarUrl, checkImageUrl } from '@/utils/url'

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
		ourStory : { enabled : boolean, iconUrl : string }
		lovePhoto : { enabled : boolean, iconUrl : string }
		loveDaily : { enabled : boolean, iconUrl : string }
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
		ourStory: { enabled: false, iconUrl: '' },
		lovePhoto: { enabled: false, iconUrl: '' },
		loveDaily: { enabled: false, iconUrl: '' },
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
				key: 'story',
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

	/* ---------------- 跳转 ---------------- */
	function handleToPage(pageName : string) {
		uni.navigateTo({
			url: `/pages-blog/love/${pageName}`,
		})
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
				<!-- todo:加一个心动呼吸动画 -->
				<text class="absolute z-10 -translate-y-4"><wd-icon class-prefix="uhlove-icon" name="aixin" size="90rpx"></wd-icon></text>
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
</template>

<style scoped lang="scss">
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