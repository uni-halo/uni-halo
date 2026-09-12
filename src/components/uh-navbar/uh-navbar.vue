<script setup lang="ts">
	import { computed, ref } from 'vue'
	import { tabbarList } from '@/tabbar/config'

	defineOptions({
		options: {
			styleIsolation: 'apply-shared'
		}
	})

	interface IProps {
		useBack : boolean
		useTitle : boolean
		defaultTitle ?: string
		titleColor ?: string
		scrollTitle ?: string
		needPlaceholder ?: boolean
		backClass ?: string
		backStyle ?: string
		scrollY ?: number
	}

	const props = withDefaults(defineProps<IProps>(), {
		useBack: true,
		useTitle: true,
		needPlaceholder: true,
		backClass: 'text-gray-900',
	})

	const maxAlpha = ref(0.75) 
	const customStyle = computed(() => {
		const alpha = Math.min(props.scrollY / 360, maxAlpha.value)
		return {
			backdropFilter: 'blur(2rpx)',
			backgroundColor: `rgba(255, 255, 255, ${alpha})`,
		}
	})
	const scrollThreshold = computed(() => {
		return props.scrollY / 360 <= 0.5
	})

	const customCalss = computed(() => {
		const _class = []
		if (scrollThreshold.value) {
			_class.push('text-white')
		}
		else {
			_class.push('text-gray-900')
		}
		return _class
	})

	const titleColorClass = computed(() => {
		return [props.titleColor]
	})

	const visibleTitle = computed(() => {
		if (!props.scrollTitle) {
			return props.defaultTitle
		}
		if (scrollThreshold.value) {
			return props.defaultTitle
		}
		return props.scrollTitle
	})

	// 如果是从分享进来的，我们需要处理为返回 home页面
	const homePage = 'pages/index/index'

	const allEntryPages = computed<string[]>(() => {
		return [
			homePage,
			'pages/maintenance/maintenance',
			...tabbarList.map((item : any) => item.pagePath),
		] as string[]
	})

	function handleBack() {
		const currentPage = getCurrentPages()[0]
		if (!allEntryPages.value.some(pagePath => pagePath == currentPage.route)) {
			uni.reLaunch({
				url: `/${homePage}`,
			})
			return
		}
		uni.navigateBack({ delta: 1 })
	}
</script>

<template>
	<view class="fixed left-0 top-0 z-100 box-border w-full pt-safe" :class="customCalss" :style="[customStyle]">
		<view class="box-border h-[46px] w-full flex items-center gap-x-4 px-3">
			<!-- 左边 -->
			<view class="min-w-18 shrink-0" @click="handleBack()">
				<view v-if="props.useBack"
					class="uh-global-card-glass uh-shadow-xs h-8 flex items-center gap-x-2 border rounded-full px-3 text-sm"
					:class="props.backClass" :style="[props.backStyle]">
					<wd-icon name="arrow-left" size="30rpx" />
					<view class="h-4 w-[1px] bg-white/60" />
					<text class="text-[26rpx] font-bold">返回</text>
				</view>
			</view>
			<!-- 中间 -->
			<view class="flex-1 truncate text-center font-bold transition-colors duration-300" :class="titleColorClass">
				<slot> {{ visibleTitle }} </slot>
			</view>
			<!-- 右边 -->
			<view class="min-w-18 shrink-0">
				<slot name="right" />
			</view>
		</view>
	</view>
	<view v-if="props.needPlaceholder" class="box-border w-full pt-safe">
		<view class="h-[46px] w-full" />
	</view>
</template>