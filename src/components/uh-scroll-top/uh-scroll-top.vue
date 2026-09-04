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

	// 获取当前页面，并且设置黑名单模式，因为有的页面可能不需要滚动到顶部
	const balckList = ['pages/maintenance/maintenance','pages-blog/setting/setting']
	const pages = getCurrentPages()
	const currentPage = pages[pages.length - 1]
	const visible = computed(() => {
		return !balckList.includes(currentPage.route)
	})
</script>

<template>
	<view v-if="visible"
		class="uh-global-card-glass border fixed bottom-24 right-4 z-50 h-10 w-10 flex items-center justify-center rounded-full text-primary"
		:class="props.customClass" @click="handleScrollTop">
		<wd-icon name="arrow-up" size="20px" />
	</view>
</template>