<script setup lang="ts">
	import { onPageScroll } from '@dcloudio/uni-app'
	import { ref, computed, useSlots, onMounted } from 'vue'
	import { tabbarList } from '@/tabbar/config'

	interface IProps {
		useBack : boolean;
		useTitle : boolean;
		defaultTitle ?: string;
		titleColor ?: string;
		scrollTitle ?: string;
		needPlaceholder ?: boolean;
	}

	const props = withDefaults(defineProps<IProps>(), {
		useBack: true,
		useTitle: true,
		needPlaceholder: true,
	})

	const slots = useSlots()

	const scrollY = ref(0)
	const maxAlpha = ref(0.65)

	const customStyle = computed(() => {
		const alpha = Math.min(scrollY.value / 360, maxAlpha.value)
		return {
			backgroundColor: `rgba(255, 255, 255, ${alpha})`,
		}
	})
	const scrollThreshold = computed(() => {
		return scrollY.value / 360 <= 0.5;
	})

	const customCalss = computed(() => {
		const _class = []
		if (props.titleColor) {
			_class.push(props.titleColor)
			return
		}
		if (scrollThreshold.value) {
			_class.push('text-white')
		}
		else {
			_class.push('text-gray-900')
		}
		return _class;
	})

	const visibleTitle = computed(() => {
		if (!props.scrollTitle) {
			return props.defaultTitle;
		}
		if (scrollThreshold.value) {
			return props.defaultTitle;
		}
		return props.scrollTitle;
	})

	// 如果是从分享进来的，我们需要处理为返回 home页面
	const homePage = 'pages/index/index'

	const allEntryPages = computed<string[]>(() => {
		return [
			homePage,
			'pages/maintenance/maintenance',
			...tabbarList.map(item => item.pagePath),
		] as string[];
	})

	function handleBack() {
		const currentPage = getCurrentPages()[0]
		if (!allEntryPages.value.some(pagePath => pagePath == currentPage.route)) {
			uni.reLaunch({
				url: `/${homePage}`
			})
			return;
		}
		uni.navigateBack({ delta: 1 })
	}

	onPageScroll((e : any) => {
		scrollY.value = e.scrollTop
	})
</script>

<template>
	<view class="w-full box-border">
		<view class="box-border pt-safe w-full fixed left-0 top-0 z-100" :class="customCalss" :style="[customStyle]">
			<view class="w-full h-[46px] flex items-center gap-x-4 box-border px-3 backdrop-blur-[2rpx]">
				<!-- 左边 -->
				<view class="shrink-0 min-w-18" @click="handleBack()">
					<view v-if="props.useBack"
						class="uh-global-card-glass h-7 px-3 rounded-full border flex items-center gap-x-2 text-gray-900 text-sm">
						<wd-icon name="arrow-left" size="32rpx"></wd-icon>
						<view class="w-[1px] h-4 bg-white/60" />
						<text class="text-xs font-bold">返回</text>
					</view>
				</view>
				<!-- 中间 -->
				<view class="flex-1 truncate text-center font-bold transition-colors duration-300">
					<slot> {{visibleTitle}} </slot>
				</view>
				<!-- 右边 -->
				<view class="shrink-0 min-w-18">
					<slot name="right"></slot>
				</view>
			</view>
		</view>
		<view v-if="props.needPlaceholder" class="box-border w-full pt-safe">
			<view class="w-full h-[46px]"></view>
		</view>
	</view>
</template>