<script setup lang="ts">
	import { computed } from 'vue'
	import { checkUrl } from '@/utils/url'
	import type { DataLoadingStatus } from '@/hooks/useDataLoadingStatus'

	interface IProps {
		loadingStatus ?: DataLoadingStatus
		size ?: 'mini' | 'small' | 'large'
		minHeight ?: string
		loadingText ?: string
		errorText ?: string
		emptyText ?: string
		loadingSubText ?: string
		errorSubText ?: string
		emptySubText ?: string
		useRefreshButton ?: boolean
	}

	const props = withDefaults(defineProps<IProps>(), {
		loadingStatus: 'loading',
		size: 'large',
		minHeight: '80vh',
		loadingText: '稍等，正在加载中哦~',
		errorText: '哎呀，加载失败了呢~',
		emptyText: '啊偶，暂时没有数据呢~',
		loadingSubText: '',
		errorSubText: '请检查网络连接，或稍后再试',
		emptySubText: '稍后再来看看吧～',
		useRefreshButton: true,
	})

	const emit = defineEmits<{ (e : 'refresh') : void }>()

	const SizeClasses = {
		mini: {
			icon: '60rpx',
			stage: 'h-16 w-16',
			glow: 'h-12 w-12',
			button: 'py-0.5'
		},
		small: {
			icon: '100rpx',
			stage: 'h-22 w-22',
			glow: 'h-18 w-18',
			button: ' py-1'
		},
		large: {
			icon: '120rpx',
			stage: 'h-32 w-32',
			glow: 'h-28 w-28',
			button: ''
		},
	}

	const sizeClasses = computed(() => {
		return SizeClasses[props.size] ?? SizeClasses.large
	})

	const isLoading = computed(() => props.loadingStatus === 'loading')

	const statusScene = computed(() => {
		switch (props.loadingStatus) {
			case 'error':
				return {
					icon: '-injury',
					stageClass: 'stage-error',
					mainTextClass: 'text-red-400',
					mainText: props.errorText,
					subText: props.errorSubText,
				}
			case 'empty':
				return {
					icon: '-confused',
					stageClass: 'stage-empty',
					mainTextClass: 'text-gray-900',
					mainText: props.emptyText,
					subText: props.emptySubText,
				}
			default:
				return {
					icon: '-happy-1',
					stageClass: 'stage-loading',
					mainTextClass: 'text-primary',
					mainText: props.loadingText,
					subText: props.loadingSubText,
				}
		}
	})
</script>

<template>
	<view class="relative w-full flex flex-col items-center justify-center gap-y-3 text-sm"
		:style="{ minHeight: props.minHeight }">

		<view class="scene relative z-1 flex items-center justify-center"
			:class="[statusScene.stageClass,sizeClasses.stage]">
			<view class="glow absolute inset-0 m-auto rounded-full" :class="sizeClasses.glow" />
			<view class="deco-dot dot-a absolute rounded-full" />
			<view class="deco-dot dot-b absolute rounded-full" />
			<view class="bubble">
				<view class="bubble-icon">
					<wd-icon class-prefix="uhemoji-icon" :name="statusScene.icon" :size="sizeClasses.icon" />
				</view>
			</view>
		</view>

		<!-- 文案区 -->
		<view class="relative z-2 flex flex-col items-center">
			<view class="flex items-center justify-center text-2xs font-medium" :class="statusScene.mainTextClass">
				<text>{{ statusScene.mainText }}</text>
				<view v-if="isLoading" class="ml-1 flex items-end gap-1">
					<view v-for="n in 3" :key="n" class="typing-dot bg-primary"
						:style="{ animationDelay: `${(n - 1) * 0.15}s` }" />
				</view>
			</view>
			<text v-if="statusScene.subText" class="mt-2 text-xs text-gray-500">
				{{ statusScene.subText }}
			</text>
			<view v-if="props.useRefreshButton" class="mt-4">
				<uh-button :custom-class="'uh-global-card-glass !text-xs !rounded-full py-2 uh-shadow-xs border' + sizeClasses.button"
					@click="emit('refresh')">
					刷新试试
				</uh-button>
			</view>
		</view>
	</view>
</template>

<style scoped lang="scss">
	.bubble {
		animation: bubble-float 2s ease-in-out infinite;
	}

	.bubble-icon {
		display: inline-block;
	}

	.glow {
		animation: glow-pulse 2.4s ease-in-out infinite;
	}

	.stage-loading .glow {
		background: rgba(185, 228, 36, 0.32);
	}

	.stage-error .glow {
		background: rgba(248, 113, 113, 0.24);
	}

	.stage-empty .glow {
		background: rgba(217, 249, 157, 0.5);
	}

	.deco-dot {
		animation: deco-float 2s ease-in-out infinite;
	}

	.dot-a {
		top: 16rpx;
		left: 10rpx;
		width: 22rpx;
		height: 22rpx;
		background: rgba(163, 230, 53, 0.9);
	}

	.dot-b {
		top: 4rpx;
		right: 14rpx;
		width: 14rpx;
		height: 14rpx;
		background: rgba(217, 249, 157, 0.95);
		animation-delay: -0.7s;
	}

	/* —— 三态表情差异化动效(均无限循环,柔和不抢眼) —— */
	.stage-loading .bubble-icon {
		animation: sway 1.6s ease-in-out infinite;
	}

	.stage-error .bubble-icon {
		animation: head-shake 2.8s ease-in-out infinite;
		transform-origin: 50% 85%;
	}

	.stage-empty .bubble-icon {
		animation: sigh 3s ease-in-out infinite;
		transform-origin: 50% 85%;
	}

	/* —— 加载中三点跳动(错峰延迟经模板 :style 注入,避开 WXSS 不支持的 :nth-child) —— */
	.typing-dot {
		width: 10rpx;
		height: 10rpx;
		border-radius: 50%;
		animation: dot-jump 1s ease-in-out infinite;
	}

	/* —— keyframes —— */
	@keyframes bubble-float {

		0%,
		100% {
			transform: translateY(0);
		}

		50% {
			transform: translateY(-14rpx);
		}
	}

	@keyframes glow-pulse {

		0%,
		100% {
			transform: scale(1);
			opacity: 0.55;
		}

		50% {
			transform: scale(1.1);
			opacity: 0.9;
		}
	}

	@keyframes deco-float {

		0%,
		100% {
			transform: translateY(0);
		}

		50% {
			transform: translateY(-12rpx);
		}
	}

	@keyframes dot-jump {

		0%,
		100% {
			transform: translateY(0);
		}

		50% {
			transform: translateY(-8rpx);
		}
	}

	/* 歪头左右打量(loading) */
	@keyframes sway {

		0%,
		100% {
			transform: rotate(-4deg);
		}

		50% {
			transform: rotate(4deg);
		}
	}

	/* 缓慢左右摇头(error) */
	@keyframes head-shake {

		0%,
		100% {
			transform: rotate(0);
		}

		25% {
			transform: rotate(6deg);
		}

		75% {
			transform: rotate(-6deg);
		}
	}

	/* 轻轻叹气缩肩(empty) */
	@keyframes sigh {

		0%,
		100% {
			transform: scaleY(1);
		}

		30%,
		70% {
			transform: scaleY(0.92);
		}
	}
</style>