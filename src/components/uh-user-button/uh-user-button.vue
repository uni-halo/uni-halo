<script setup lang="ts">
	import { storeToRefs } from 'pinia'
	import { useTokenStore} from '@/store/token'
	
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
	
	// 白名单模式
	const blackList = []
	const pages = getCurrentPages()
	const currentPage = pages[pages.length - 1]
	const visible = computed(() => {
		return hasLogin.value && !blackList.includes(currentPage.route)
	})

	function handleClick() {
		emits('action-click')
	}
</script>

<template>
	<view v-if="visible" :class="[props.fixed?'fixed bottom-22 right-3 z-50 pb-safe':'',props.containerClass]"
		@click="handleClick">
		<view class="uh-global-card-glass border h-11 w-11 flex items-center justify-center rounded-full text-primary"
			:class="props.customClass">
			<wd-icon name="user" size="42rpx" />
		</view>
	</view>
</template>