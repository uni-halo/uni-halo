<script setup lang="ts">
	interface IProps {
		customClass?: string;
	}
	
	const props = withDefaults(defineProps<IProps>(), {
		customClass: ''
	})

	function handleScrollTop() {
		uni.pageScrollTo({ scrollTop: 0, duration: 500 })
	}

	// 获取当前页面，并且设置黑名单模式，因为有的页面可能不需要滚动到顶部
	const balckList = ['pages/maintenance/maintenance', 'pages-blog/setting/setting', 'pages-blog/love/love']
	const pages = getCurrentPages()
	const currentPage = pages[pages.length - 1]
	const visible = computed(() => {
		return !balckList.includes(currentPage.route)
	})
	
	const _customClass = computed(() => {
		const colorClass = currentPage.route.includes('/love/')?'text-love':'text-primary'
		return `${props.customClass} ${colorClass}`
	})
</script>

<template>
	<view v-if="visible" class="fixed bottom-22 right-3 z-50 pb-safe">
		<view class="uh-global-card-glass border h-11 w-11 flex items-center justify-center rounded-full"
			:class="_customClass" @click="handleScrollTop">
			<wd-icon name="arrow-up" size="42rpx" />
		</view>
	</view>
</template>