<script setup lang="ts">
	interface IProps {
		customClass : Array<string>;
	}
	const props = defineProps({
		customClass: () => {
			return []
		},
	})
	
	function handleScrollTop() {
		uni.pageScrollTo({ scrollTop: 0, duration: 500 })
	}
</script>

<template>
	<view
		class="uh-global-card-glass border fixed bottom-24 right-4 z-90 h-10 w-10 flex items-center justify-center rounded-full text-primary"
		:class="props.customClass" @click="handleScrollTop">
		<wd-icon name="arrow-up" size="20px" />
	</view>
</template>