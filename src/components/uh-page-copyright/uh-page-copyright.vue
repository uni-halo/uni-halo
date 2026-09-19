<script setup lang="ts">
	import { computed } from 'vue'
	import { storeToRefs } from 'pinia'
	import { useAppConfigStore } from '@/store/appConfig'

	const { configs } = storeToRefs(useAppConfigStore())
	const copyrightConfig = computed(() => configs.value?.featureConfig?.profile?.copyrightConfig)
</script>

<template>
	<view v-if="copyrightConfig?.enabled" class="box-border mt-6 px-6 text-center">
		<text class="text-11px text-black/40">{{copyrightConfig.content }}</text>
	</view>
</template>