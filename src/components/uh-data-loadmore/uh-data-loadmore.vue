<script setup lang="ts">
	import type { LoadMoreStatus } from '@/hooks/useDataLoadingStatus'
	interface IProps {
		text : string
		status : LoadMoreStatus
	}

	const props = defineProps<IProps>()
</script>

<template>
	<view class="w-full py-5 flex items-center justify-center gap-x-2 text-xs text-gray-400">
		<wd-loading v-if="props.status==='loading'" size="32rpx" color="#D7F94C"></wd-loading> {{ props.text }}
	</view>
</template>