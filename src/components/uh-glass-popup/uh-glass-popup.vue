<script lang="ts" setup>
	/**
	 * 玻璃质感弹窗:对 wd-popup 的二层封装。
	 * wd-popup 无背景/边框配置能力(index.scss 仅暴露 --wot-popup-bg 纯色变量),
	 * 故通过 custom-class 落到面板根元素后,用 :deep 覆盖为 uh-global-card-glass 同款效果。
	 */
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
		/** 面板圆角(内联生效,优先级最高);传 wot 自带 round 时圆角由位置自动适配 */
		radius ?: string
		/** 是否开启 wot 位置自适应圆角(bottom→上圆角 / center→四圆角等),与 radius 二选一 */
		round ?: boolean
		lazyRender ?: boolean
		hideWhenClose?: boolean
		/** 追加到面板的内联样式,如宽度:width:640rpx; */
		customStyle ?: string
		customClass? :string 
	}

	interface IEmits {
		(e : 'update:modelValue', value : boolean) : void
		(e : 'close') : void
		(e : 'click-modal') : void
	}

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
		customClass:''
	})

	const emit = defineEmits<IEmits>()

	const panelStyle = computed(() => {
		return props.customStyle
	})
	
	const panelClass = computed(() =>{
		return `uh-glass-popup-panel ${props.customClass}` 
	})
</script>

<template>
	<wd-popup
		:model-value="modelValue"
		:position="position"
		:z-index="zIndex"
		:closable="closable"
		:modal="modal"
		:close-on-click-modal="closeOnClickModal"
		:hide-when-close="hideWhenClose"
		:safe-area-inset-bottom="safeAreaInsetBottom"
		:round="round"
		:custom-style="panelStyle"
		:custom-class="panelClass"
		:lazy-render="lazyRender"
		@update:model-value="(value: boolean) => emit('update:modelValue', value)"
		@close="emit('close')"
		@click-modal="emit('click-modal')"
	>
		<slot></slot>
	</wd-popup>
</template>

<style scoped lang="scss">
	/* 面板根元素(.wd-popup)同挂 custom-class,双类选择器提高优先级,覆盖 wot 默认纯白底 */
	:deep(.wd-popup.uh-glass-popup-panel) {
		box-sizing: border-box;
		background-color: rgb(255 255 255 / 85%);
		border: 4rpx solid rgb(255 255 255 / 90%);
		box-shadow: inset 0 1rpx 0 rgb(255 255 255 / 75%), 0 8rpx 32rpx rgb(90 105 200 / 14%);
		backdrop-filter: blur(24rpx) saturate(160%);
		-webkit-backdrop-filter: blur(24rpx) saturate(160%);
	}

	/* 低端 WebView 不支持 backdrop-filter 的兜底:提高不透明度保证可读性 */
	@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
		:deep(.wd-popup.uh-glass-popup-panel) {
			background-color: rgb(255 255 255 / 88%);
		}
	}
	
	:deep(.wd-popup--bottom){
		left:24rpx;
		bottom:24rpx;
		right:24rpx;
	}
</style>
