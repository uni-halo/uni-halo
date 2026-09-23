<script lang="ts" setup>
	import { onLoad } from '@dcloudio/uni-app'
	import { storeToRefs } from 'pinia'
	import { getQRCodeInfo } from '@/api/uni-halo'
	import { useAppConfigStore } from '@/store/appConfig'
	import { useSettingStore } from '@/store/setting'
	import { collectSiteDefaults } from '@/utils/preference'
	import { useMaintenanceIntercept } from '@/hooks/useMaintenanceIntercept'

	definePage({
		// 使用 type: "home" 属性设置首页，其他页面不需要设置，默认为page
		type: 'home',
		style: {
			navigationStyle: 'custom',
			navigationBarTitleText: '初始页面',
		},
	})

	/* ---------------- 常量 ---------------- */
	const homePagePath = '/pages/tabbar/home/home'
	const articleDetailPath = '/pages-blog/article-detail/article-detail'

	// 本地开发快速跳转页面,发布请置为 false
	const DEV_MODE = false
	const DEV_TO_TYPE = 'page' as 'page' | 'tabbar'
	const DEV_TO_PATH = `/pages-blog/love/love`

	/* ---------------- 状态 ---------------- */
	const appConfigStore = useAppConfigStore()
	const { configs } = storeToRefs(appConfigStore)
	const { bootstrap } = appConfigStore
	const { applySiteDefaults } = useSettingStore()
	// 维护拦截
	const { reason, interceptOrContinue, redirectToMaintenance } = useMaintenanceIntercept()

	/** 通过二维码 scene 获取笔记 id */
	async function getPostIdByQRCode(key : string) : Promise<string | null> {
		try {
			const response = await getQRCodeInfo(key)
			if (response.data?.postId)
				return response.data.postId as string
		}
		catch (err) {
			console.error('二维码解析失败', err)
		}
		return null
	}

	onLoad(async (options) => {
		// 本地开发,快速跳转页面,发布请设置 DEV_MODE = false
		if (DEV_MODE && DEV_TO_PATH) {
			if (DEV_TO_TYPE === 'tabbar') {
				uni.switchTab({ url: DEV_TO_PATH })
			}
			else {
				uni.navigateTo({ url: DEV_TO_PATH })
			}
			return
		}

		// 获取配置
		try {
			const { ok } = await bootstrap()
			if (!ok) {
				uni.switchTab({ url: homePagePath })
				return
			}

			// 二维码 scene 进入:解析 postId 跳笔记详情
			if (options.scene && options.scene !== '') {
				const postId = await getPostIdByQRCode(decodeURIComponent(options.scene))
				if (postId) {
					uni.redirectTo({
						url: `${articleDetailPath}?name=${postId}`,
						animationType: 'slide-in-right',
					})
					return
				}
			}

			// 审核模式数据已随 bootstrap 拉取
			applySiteDefaults(collectSiteDefaults(configs.value))

			// 拦截:主插件未激活 或 维护模式开启(任一命中)→ 跳转维护页
			if (await interceptOrContinue()) { 
				return
			}
			uni.switchTab({ url: homePagePath })
		}
		catch (err) {
			console.error('入口页初始化失败', err)
			redirectToMaintenance(reason.value)
		}
	})
</script>

<template>
	<view class="relative min-h-screen w-screen flex flex-col items-center justify-center overflow-hidden bg-[#f5fae8]">
		<view
			class="fixed left-0 top-0 z-0 h-[46vh] w-full from-[#d9f77f] via-[#e8fbaf] to-[#f5fae8] bg-gradient-to-b" />

		<view
			class="breathe pointer-events-none absolute left-[-60rpx] top-[16vh] z-0 h-[260rpx] w-[260rpx] rounded-full bg-white/40 uh-blur-52" />
		<view
			class="pointer-events-none absolute right-[-48rpx] top-[8vh] z-0 h-[200rpx] w-[200rpx] rounded-full bg-[rgba(184,236,63,0.28)] uh-blur-52" />
		<view
			class="pointer-events-none absolute bottom-[14vh] right-[72rpx] z-0 h-[160rpx] w-[160rpx] rounded-full bg-white/40 uh-blur-52" />
		<view
			class="pointer-events-none absolute bottom-[6vh] left-[48rpx] z-0 h-[140rpx] w-[140rpx] rounded-full bg-[#ebfabf] opacity-90 uh-blur-52" />

		<view class="relative z-10 h-28 w-28">
			<view
				class="bob absolute inset-0 flex items-center justify-center rounded-full border-4 border-solid border-white from-[#ebfabf] to-[#b8ec3f] bg-gradient-to-br uh-global-card-glass">
				<wd-icon class-prefix="uhemoji-icon" name="-flushed" size="120rpx" class="text-gray-900" />
			</view>
		</view>

		<view class="relative z-10 mt-8 text-lg font-black leading-8">
			<uh-text-underline>正在初始化...</uh-text-underline>
		</view>
		<view class="mt-4 flex flex-col items-center">
			<text class="text-center text-xs text-gray-600 font-medium leading-6">
				稍等，正在加载所需要的资源
				<text class="block">
					马上就好~
				</text>
			</text>
		</view>
	</view>
</template>

<style scoped lang="scss">
	.uh-blur-52 {
		filter: blur(52rpx);
	}

	/* 光斑呼吸 */
	.breathe {
		animation: breathe 5s ease-in-out infinite;
	}

	@keyframes breathe {

		0%,
		100% {
			transform: scale(1);
			opacity: 0.28;
		}

		50% {
			transform: scale(1.18);
			opacity: 0.4;
		}
	}

	/* 表情圆浮动 */
	.bob {
		animation: bob 3.2s ease-in-out infinite;
	}

	@keyframes bob {

		0%,
		100% {
			transform: translateY(0) rotate(-2deg);
		}

		50% {
			transform: translateY(-14rpx) rotate(2deg);
		}
	}
</style>