<script setup lang="ts">
	import { ref } from 'vue'
	import { isPageTabbar } from './tabbar/store'
	import { currRoute } from './utils'
	import CustomTabbar from '@/tabbar/index.vue'

	const isCurrentPageTabbar = ref(true)
	const globalSettingsVisible = ref(false)
	onShow(() => {
		const { path } = currRoute()
		if (path === '/') {
			isCurrentPageTabbar.value = true
		}
		else {
			isCurrentPageTabbar.value = isPageTabbar(path)
		}
	})
</script>

<template>
	<view>
		<uh-global-actions>
			<uh-scrolltop-button :fixed="false"/>
			<uh-settings-button :fixed="false" @click="globalSettingsVisible = !globalSettingsVisible"/>
		</uh-global-actions>
		
		<uh-settings-popup v-model="globalSettingsVisible" @close="globalSettingsVisible = false" />

		<KuRootView />

		<CustomTabbar v-if="isCurrentPageTabbar" />
	</view>
</template>