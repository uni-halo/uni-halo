<script setup lang="ts">
	interface IProps {
		containerClass ?: string;
		customClass ?: string;
		fixed ?: boolean;
	}

	const props = withDefaults(defineProps<IProps>(), {
		customClass: '',
		fixed: true,
	})

	// 白名单模式
	const whiteList = ['pages/tabbar/home/home', 'pages-blog/articles/articles', 'pages-blog/archives/archives']
	const pages = getCurrentPages()
	const currentPage = pages[pages.length - 1]
	const visible = computed(() => {
		return whiteList.includes(currentPage.route)
	})
</script>

<template>
	<view v-if="visible" :class="[props.fixed?'fixed bottom-22 right-3 z-50 pb-safe':'',props.containerClass]">
		<view class="uh-global-card-glass border h-11 w-11 flex items-center justify-center rounded-full text-primary"
			:class="props.customClass">
			<wd-icon name="settings" size="42rpx" />
		</view>
	</view>
</template>