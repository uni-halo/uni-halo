<script setup lang="ts">
	import { ref } from 'vue'
	import { isPageTabbar } from './tabbar/store'
	import { currRoute } from './utils'
	import { useSettingsPopup } from '@/hooks/useSettingsPopup'
	import CustomTabbar from '@/tabbar/index.vue'

	const isCurrentPageTabbar = ref(true)
	const globalSettingsVisible = ref(false)

	const { settingsPopupVisible, openSettingsPopup } = useSettingsPopup()
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
			<uh-scrolltop-button :fixed="false" />
			<uh-settings-button :fixed="false" @action-click="openSettingsPopup()" />
		</uh-global-actions>

		<uh-settings-popup v-model="settingsPopupVisible" />

		<KuRootView />

		<CustomTabbar v-if="isCurrentPageTabbar" />
	</view>
</template>