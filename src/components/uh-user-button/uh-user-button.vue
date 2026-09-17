<script setup lang="ts">
	import { storeToRefs } from 'pinia'
	import { useTokenStore } from '@/store/token'

	interface IProps {
		containerClass ?: string;
		customClass ?: string;
		fixed ?: boolean;
	}

	const emits = defineEmits<{
		(e : 'action-click') : void
	}>()

	const props = withDefaults(defineProps<IProps>(), {
		customClass: '',
		fixed: true,
	})

	const { hasLogin } = storeToRefs(useTokenStore())

	// 黑名单模式(入口页/维护页等过渡页不展示)
	const blackList = [
		'pages/index/index',
		'pages/maintenance/maintenance',
	]
	const pages = getCurrentPages()
	const currentPage = pages[pages.length - 1]
	const visible = computed(() => {
		return hasLogin.value && !blackList.includes(currentPage.route)
	})

	const _customClass = computed(() => {
		const colorClass = currentPage.route.includes('/love/') ? 'text-love' : 'text-primary'
		return `${props.customClass} ${colorClass}`
	})

	function handleClick() {
		emits('action-click')
	}
</script>

<template>
	<view v-if="visible" :class="[props.fixed?'fixed bottom-22 right-3 z-50 pb-safe':'',props.containerClass]"
		@click="handleClick">
		<view class="uh-global-card-glass border h-11 w-11 flex items-center justify-center rounded-full"
			:class="_customClass">
			<wd-icon name="user" size="42rpx" />
		</view>
	</view>
</template>