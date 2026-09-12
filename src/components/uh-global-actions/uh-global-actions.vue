<script setup lang="ts">
	 defineOptions({
	 	options: {
	 		styleIsolation: 'apply-shared'
	 	}
	 })
</script>

<template>
	<view class="fixed right-3 bottom-18 z-50 flex flex-col gap-y-3 pb-safe">
		<slot></slot>
	</view>
</template>

