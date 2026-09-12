<script lang="ts" setup>
	defineOptions({
		options: {
			styleIsolation: 'apply-shared',
		},
	})

	const props = withDefaults(defineProps<IProps>(), {
		position: 'center',
		zIndex: 10,
		closable: false,
		modal: true,
		closeOnClickModal: true,
		safeAreaInsetBottom: false,
		radius: '',
		round: false,
		lazyRender: true,
		hideWhenClose: true,
		customStyle: '',
		customClass: '',
	})

	const emit = defineEmits<IEmits>()

	/** 动画时长(ms),与 wd-popup 默认一致 */
	const DURATION = 300

	interface IProps {
		/** v-model:是否显示 */
		modelValue : boolean
		/** 弹出位置 */
		position ?: 'center' | 'top' | 'right' | 'bottom' | 'left'
		/** 层级 */
		zIndex ?: number
		/** 是否显示右上角关闭图标 */
		closable ?: boolean
		/** 是否显示遮罩 */
		modal ?: boolean
		/** 点击遮罩是否关闭 */
		closeOnClickModal ?: boolean
		/** 底部安全距离适配(iphone X 类机型) */
		safeAreaInsetBottom ?: boolean
		/** 面板圆角(内联生效,优先级最高);与 round 二选一 */
		radius ?: string
		/** 位置自适应圆角(bottom→上圆角 / center→四圆角等),与 radius 二选一 */
		round ?: boolean
		/** 弹层内容懒渲染,首次显示时才渲染 */
		lazyRender ?: boolean
		/** 关闭动画结束后是否隐藏面板(display:none);false 时保留渲染(内部状态不丢) */
		hideWhenClose ?: boolean
		/** 追加到面板的内联样式,如宽度:width:640rpx; */
		customStyle ?: string
		/** 追加到面板的类名(如 UnoCSS 原子类) */
		customClass ?: string
	}

	interface IEmits {
		(e : 'update:modelValue', value : boolean) : void
		(e : 'close') : void
		(e : 'open') : void
		(e : 'click-modal') : void
	}

	/* ---------------- 动画状态机 ---------------- */
	/** 首次显示后才渲染(lazyRender) */
	const inited = ref(false)
	/** 是否渲染显示(关闭动画结束后 hideWhenClose 时置 false) */
	const display = ref(false)
	/** 动画阶段: enter / enter-to / leave / leave-to / '' */
	const phase = ref('')

	/** 动画名称(按位置):center 组合 zoom-in + fade */
	const transitionName = computed(() => {
		switch (props.position) {
			case 'center':
				return ['zoom-in', 'fade']
			case 'left':
				return 'slide-left'
			case 'right':
				return 'slide-right'
			case 'top':
				return 'slide-down'
			default:
				return 'slide-up'
		}
	})

	const isShow = computed(() => !props.lazyRender || inited.value)

	const panelClasses = computed(() => {
		const names = Array.isArray(transitionName.value) ? transitionName.value : [transitionName.value]
		let cls = `uh-glass-popup-panel uh-glass-popup-panel--${props.position} ${props.customClass}`
		if (props.round) { cls += ' is-round' }
		if (phase.value) {
			const act = phase.value.startsWith('enter') ? 'enter-active' : 'leave-active'
			for (const name of names) {
				cls += ` uh-glass-popup-anim--${name}-${phase.value} uh-glass-popup-anim--${name}-${act}`
			}
		}
		return cls
	})

	const maskClasses = computed(() => {
		if (!phase.value) { return 'uh-glass-popup__mask' }
		const act = phase.value.startsWith('enter') ? 'enter-active' : 'leave-active'
		return `uh-glass-popup__mask uh-glass-popup-anim--fade-${phase.value} uh-glass-popup-anim--fade-${act}`
	})

	/** 底部安全距离 */
	const safeBottom = ref(0)

	const panelStyle = computed(() => {
		let style = `z-index:${props.zIndex};`
		// hideWhenClose 且关闭动画结束:display:none 释放层级
		if (!display.value && props.hideWhenClose) { style += 'display:none;' }
		// 静止隐藏态(未开过或关闭后动画结束):透明 + 不拦截点击
		if (!props.modelValue && !phase.value) { style += 'opacity:0;' }
		if (!props.modelValue) { style += 'pointer-events:none;' }
		if (safeBottom.value) { style += `padding-bottom:${safeBottom.value}px;` }
		if (props.radius) { style += `border-radius:${props.radius};` }
		return style + props.customStyle
	})

	const maskStyle = computed(() => {
		let style = `z-index:${props.zIndex};`
		// 遮罩跟随面板的显隐
		if (!display.value && props.hideWhenClose) { style += 'display:none;' }
		if (!props.modelValue && !phase.value) { style += 'opacity:0;' }
		// 关闭后透明且不拦截点击(hideWhenClose=false 保留渲染时仍需可穿透)
		if (!props.modelValue) { style += 'pointer-events:none;' }
		return style
	})

	function sleep(ms : number) {
		return new Promise<void>(resolve => setTimeout(resolve, ms))
	}

	/** 状态机是否在运行(防重入) */
	let running = false

	/**
	 * 动画状态机:以 modelValue 为目标循环推进,
	 * 运行期间若目标变化(快速开关)则重新评估,直到状态稳定
	 */
	async function runTransition() {
		if (running) { return }
		running = true
		try {
			// 首次打开才渲染内容(lazyRender)
			if (props.modelValue) {
				inited.value = true
				display.value = true
			}
			// 循环推进直到与 modelValue 一致
			while (true) {
				const target = props.modelValue
				if (target) {
					phase.value = 'enter'
					await sleep(50)
					if (props.modelValue !== target) { continue }
					phase.value = 'enter-to'
					emit('open')
					await sleep(DURATION)
				}
				else {
					if (!display.value) {
						// 从未渲染,无需动画
						break
					}
					phase.value = 'leave'
					await sleep(50)
					if (props.modelValue !== target) { continue }
					phase.value = 'leave-to'
					await sleep(DURATION + 50)
					if (props.modelValue !== target) { continue }
					if (props.hideWhenClose) { display.value = false }
				}
				if (props.modelValue === target) {
					// 状态稳定	
					break
				}
			}
		}
		finally {
			running = false
		}
	}

	watch(
		() => props.modelValue,
		() => {
			runTransition()
		},
	)

	/* ---------------- 遮罩与安全区 ---------------- */
	function handleClickModal() {
		emit('click-modal')
		if (props.closeOnClickModal)
			close()
	}

	function close() {
		emit('close')
		emit('update:modelValue', false)
	}

	onBeforeMount(() => {
		if (props.safeAreaInsetBottom) {
			const { safeArea, screenHeight, safeAreaInsets } = uni.getWindowInfo()

			if (safeArea) {
				// #ifdef MP-WEIXIN
				safeBottom.value = screenHeight - (safeArea.bottom || 0)
				// #endif
				// #ifndef MP-WEIXIN
				safeBottom.value = safeAreaInsets ? safeAreaInsets.bottom : 0
				// #endif
			}
			else {
				safeBottom.value = 0
			}
		}
	})

	onMounted(() => { 
		// 初始即为打开状态:直接播放进入动画
		if (props.modelValue) { runTransition() }
	})

	// #ifdef H5
	// 锁定 body 滚动,防止弹层打开时页面穿透滚动
	watch(
		() => props.modelValue,
		(val) => {
			document.body.style.overflow = val ? 'hidden' : ''
		},
	)
	onBeforeUnmount(() => {
		// 卸载时若弹层仍打开,恢复 body 滚动,避免滚动锁残留
		document.body.style.overflow = ''
	})
	// #endif
</script>

<template>
	<view v-if="isShow">
		<!-- 遮罩层 -->
		<view v-if="modal" class="uh-glass-popup__mask" :class="maskClasses" :style="maskStyle"
			@click="handleClickModal" @touchmove.stop.prevent />
		<!-- 面板层 -->
		<view :class="panelClasses" :style="panelStyle">
			<slot />
			<view v-if="closable" class="uh-glass-popup__close" @click="close">
				<text class="uh-glass-popup__close-icon">×</text>
			</view>
		</view>
	</view>
</template>

<style scoped lang="scss">
	.uh-glass-popup__mask {
		position: fixed;
		left: 0;
		top: 0;
		right: 0;
		bottom: 0;
		background-color: rgb(0 0 0 / 55%);
		transition-timing-function: ease;
		transition-duration: 300ms;
	}

	.uh-glass-popup-panel {
		box-sizing: border-box;
		position: fixed;
		max-height: 100%;
		overflow-y: auto;
		background-color: rgb(255 255 255 / 85%);
		border: 4rpx solid rgb(255 255 255 / 90%);
		box-shadow:
			inset 0 1rpx 0 rgb(255 255 255 / 75%),
			0 8rpx 32rpx rgb(90 105 200 / 14%);
		backdrop-filter: blur(24rpx) saturate(160%);
		-webkit-backdrop-filter: blur(24rpx) saturate(160%);
		transition-timing-function: ease;
		transition-duration: 300ms;

		/* 低端 WebView 不支持 backdrop-filter 的兜底:提高不透明度保证可读性 */
		@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
			background-color: rgb(255 255 255 / 88%);
		}
	}

	/* 位置 */
	.uh-glass-popup-panel--center {
		left: 50%;
		top: 50%;
		transform: translate3d(-50%, -50%, 0);
		transform-origin: 0 0;
	}

	.uh-glass-popup-panel--top {
		top: 0;
		left: 0;
		right: 0;
	}

	.uh-glass-popup-panel--bottom {
		left: 24rpx;
		bottom: 24rpx;
		right: 24rpx;
	}

	.uh-glass-popup-panel--left {
		left: 0;
		top: 0;
		bottom: 0;
	}

	.uh-glass-popup-panel--right {
		right: 0;
		top: 0;
		bottom: 0;
	}

	/* 位置自适应圆角(round) */
	.uh-glass-popup-panel--bottom.is-round {
		border-radius: 16rpx 16rpx 0 0;
	}

	.uh-glass-popup-panel--top.is-round {
		border-radius: 0 0 16rpx 16rpx;
	}

	.uh-glass-popup-panel--left.is-round {
		border-radius: 0 16rpx 16rpx 0;
	}

	.uh-glass-popup-panel--right.is-round {
		border-radius: 16rpx 0 0 16rpx;
	}

	.uh-glass-popup-panel--center.is-round {
		border-radius: 16rpx;
	}

	/* 动画帧(enter 与 leave-to) */
	.uh-glass-popup-anim--slide-up-enter,
	.uh-glass-popup-anim--slide-up-leave-to {
		transform: translate3d(0, 100%, 0);
	}

	.uh-glass-popup-anim--slide-down-enter,
	.uh-glass-popup-anim--slide-down-leave-to {
		transform: translate3d(0, -100%, 0);
	}

	.uh-glass-popup-anim--slide-left-enter,
	.uh-glass-popup-anim--slide-left-leave-to {
		transform: translate3d(-100%, 0, 0);
	}

	.uh-glass-popup-anim--slide-right-enter,
	.uh-glass-popup-anim--slide-right-leave-to {
		transform: translate3d(100%, 0, 0);
	}

	.uh-glass-popup-anim--zoom-in-enter,
	.uh-glass-popup-anim--zoom-in-leave-to {
		opacity: 0;
		transform: scale(0.8);
	}

	.uh-glass-popup-anim--fade-enter,
	.uh-glass-popup-anim--fade-leave-to {
		opacity: 0;
	}

	/* 动画激活态(transition-property) */
	.uh-glass-popup-anim--slide-up-enter-active,
	.uh-glass-popup-anim--slide-up-leave-active,
	.uh-glass-popup-anim--slide-down-enter-active,
	.uh-glass-popup-anim--slide-down-leave-active,
	.uh-glass-popup-anim--slide-left-enter-active,
	.uh-glass-popup-anim--slide-left-leave-active,
	.uh-glass-popup-anim--slide-right-enter-active,
	.uh-glass-popup-anim--slide-right-leave-active {
		transition-property: transform;
	}

	.uh-glass-popup-anim--zoom-in-enter-active,
	.uh-glass-popup-anim--zoom-in-leave-active,
	.uh-glass-popup-anim--fade-enter-active,
	.uh-glass-popup-anim--fade-leave-active {
		transition-property: opacity, transform;
	}

	/* center 缩放需叠加居中位移 */
	.uh-glass-popup-panel--center.uh-glass-popup-anim--zoom-in-enter,
	.uh-glass-popup-panel--center.uh-glass-popup-anim--zoom-in-leave-to {
		transform: scale(0.8) translate3d(-50%, -50%, 0);
	}

	/* 右上角关闭按钮 */
	.uh-glass-popup__close {
		position: absolute;
		top: 32rpx;
		right: 32rpx;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48rpx;
		height: 48rpx;
	}

	.uh-glass-popup__close-icon {
		font-size: 48rpx;
		line-height: 1;
		color: rgb(0 0 0 / 45%);
	}
</style>