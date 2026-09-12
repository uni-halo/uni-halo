<script setup lang="ts">
	import { onPageScroll } from '@dcloudio/uni-app'
	import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
	import { usePageScroll } from '@/hooks/usePageScroll'

	definePage({
		style: {
			navigationBarTitleText: '测试页面',
			navigationStyle: 'custom',
		},
	})
	const { scrollY, updatePageScrollValue } = usePageScroll()
	const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()

	onPageScroll((option : Page.PageScrollOption) => {
	 updatePageScrollValue(option.scrollTop)
	})

	setTimeout(() => {
		updateLoadingStatus(DataLoadingStatusEnum.Success)
	}, 3000)
</script>

<template>
	<view class="w-full min-h-screen bg-page">
		<uh-navbar :scroll-y="scrollY" default-title="测试页面" :need-placeholder="true" title-color="text-gray-900"></uh-navbar>

		<!-- 内容区：由于 uh-navbar 内置有占位，所以我们的页面的主要内容应该从这里开始，比如这里就可以设置内边距或者其他样式，最外层的 	<view class="w-full min-h-screen bg-page"> 仅作为容器-->
		<view class="box-border px-3">
			<!-- 加载状态 -->
			<uh-data-loading v-if="loadingStatus!==DataLoadingStatusEnum.Success" :loading-status="loadingStatus"
				min-height="80vh"></uh-data-loading>

			<!-- 实际内容 -->
			<view v-else>
				请求成功啦
			</view>
		</view>
	</view>
</template>