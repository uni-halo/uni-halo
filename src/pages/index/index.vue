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

	/** 通过二维码 scene 获取文章 id */
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

			// 二维码 scene 进入:解析 postId 跳文章详情
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

			// 审核模式数据已随 bootstrap 拉取(auditData/auditModeEnabled 即可用)
			applySiteDefaults(collectSiteDefaults(configs.value))

			// 拦截:主插件未激活 或 维护模式开启(任一命中)→ 跳转维护页
			if (await interceptOrContinue()) { return }
			uni.switchTab({ url: homePagePath })
		}
		catch (err) {
			console.error('入口页初始化失败', err)
			redirectToMaintenance(reason.value)
		}
	})
</script>

<template>
	<view>
		<!-- 初始化页面 -->
	</view>
</template>