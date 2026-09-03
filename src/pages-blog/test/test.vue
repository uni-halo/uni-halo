<script setup lang="ts">
	import { DataLoadingStatusEnum } from '@/hooks/useDataLoadingStatus'
	definePage({
		style: {
			navigationBarTitleText: '测试页面',
		},
	})
</script>

<template>
	<view class="w-full h-screen">
		<uh-data-loading :loading-status="DataLoadingStatusEnum.Empty"></uh-data-loading>
	</view>
</template>