<script lang="ts" setup>
	/**
 * 用户协议/隐私政策独立页(?type=userAgreement|privacyPolicy)
 * 内容由插件端「功能设置 → 页面设置 → 用户协议/隐私政策」维护,
 * 经 getConfigs 下发 featureConfig.pages.agreement;注册页协议弹窗与此共用同一内容
 */
	import { computed, ref } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import { storeToRefs } from 'pinia'
	import { useAppConfigStore } from '@/store/appConfig'
	import { markdownConfig } from '@/config/markdown'

	/** 协议内容类型(与插件端 agreement 字段名一致) */
	type AgreementType = 'userAgreement' | 'privacyPolicy'

	definePage({
		style: {
			navigationBarTitleText: '用户协议',
			navigationStyle: 'custom',
		},
	})

	const appConfigStore = useAppConfigStore()
	const { configs } = storeToRefs(appConfigStore)

	const type = ref<AgreementType>('userAgreement')

	/** 页面标题(注册页标题注册表不含协议页,按内容类型内置) */
	const title = computed(() => type.value === 'privacyPolicy' ? '隐私政策' : '用户协议')
	const fallbackTitle = usePageTitle('disclaimers', '用户协议')

	/** 协议内容(富文本 HTML,留空 = 站点未配置,展示空态) */
	const content = computed(() => {
		const agreement = configs.value.featureConfig?.pages?.agreement
		return (agreement?.[type.value] || '').trim()
	})

	onLoad((query) => {
		uni.hideShareMenu({ hideShareItems: [] })
		type.value = query?.type === 'privacyPolicy' ? 'privacyPolicy' : 'userAgreement'
		uni.setNavigationBarTitle({ title: title.value })
	})
</script>

<template>
	<view class="box-border min-h-screen bg-page p-3 pt-2">
		<!-- 自定义导航 -->
		<uh-navbar :default-title="title" title-color="text-gray-900" />

		<view class="w-full uh-global-card-glass uh-shadow-xs rounded-xl box-border p-4">
			<!-- 协议内容(mp-html 渲染,与笔记详情/公告详情同套路,domain 补齐相对路径图片) -->
			<mp-html v-if="content" :content="content" lazy-load :domain="markdownConfig.domain"
				:loading-img="markdownConfig.loadingGif" scroll-table selectable />

			<!-- 站点未配置协议内容时的空态 -->
			<view v-else class="box-border py-16 text-center text-sm text-black/40">
				暂未配置{{ title }}内容
			</view>
		</view>
	</view>
</template>
