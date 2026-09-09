<script setup lang="ts">
	interface IProps {
		customClass ?: string;
		fixed ?: boolean;
	}

	const props = withDefaults(defineProps<IProps>(), {
		customClass: '',
		fixed: true,
	})

	function handleScrollTop() {
		uni.pageScrollTo({ scrollTop: 0, duration: 500 })
	}

	// 黑名单模式
	const balckList = [
		'pages/maintenance/maintenance',
		'pages-blog/setting/setting',
		'pages-blog/love/love',
		'pages/tabbar/about/about'
	]
	const pages = getCurrentPages()
	const currentPage = pages[pages.length - 1]
	const visible = computed(() => {
		return !balckList.includes(currentPage.route)
	})

	const _customClass = computed(() => {
		const colorClass = currentPage.route.includes('/love/') ? 'text-love' : 'text-primary'
		return `${props.customClass} ${colorClass}`
	})
</script>

<template>
	<view v-if="visible" :class="[props.fixed?'fixed bottom-22 right-3 z-50 pb-safe':'']">
		<view class="uh-global-card-glass border h-11 w-11 flex items-center justify-center rounded-full"
			:class="_customClass" @click="handleScrollTop">
			<wd-icon name="arrow-up" size="42rpx" />
		</view>
	</view>
</template>