<script setup lang="ts">
	import { ref } from 'vue'
	import { isPageTabbar } from './tabbar/store'
	import { currRoute } from './utils'
	import { useOpenPopup } from '@/hooks/useOpenPopup'
	import CustomTabbar from '@/tabbar/index.vue'

	const isCurrentPageTabbar = ref(true)

	const { popupVisible:settingsPopupVisible, openPopup:openSettingsPopup } = useOpenPopup()
	const { popupVisible:userPopupVisible, openPopup:openUserPopup } = useOpenPopup()
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
			<uh-user-button :fixed="false" @action-click="openUserPopup()" />
		</uh-global-actions>

		<uh-settings-popup v-model="settingsPopupVisible" />
		<uh-user-popup v-model="userPopupVisible" />

		<KuRootView />

		<CustomTabbar v-if="isCurrentPageTabbar" />
	</view>
</template>