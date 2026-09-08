<script setup lang="ts">
import { computed } from 'vue'

/** 单列选项(wd-picker PickerOption 的宽松形态,label/value 与 wot 一致) */
interface IPickerOption {
  label?: string | number
  value?: string | number
  disabled?: boolean
  children?: IPickerOption[]
  [key: string]: unknown
}

interface IProps {
  /** v-model:visible 是否显示 */
  visible: boolean
  /** 弹层标题 */
  title?: string
  /** 选择器数据(单列/多列;与 wd-picker columns 一致) */
  columns?: Array<IPickerOption | IPickerOption[]>
  /** 选中项(单列如 ['value']) */
  modelValue?: (string | number)[]
  /** 确认/取消按钮文案 */
  confirmButtonText?: string
  cancelButtonText?: string
  /** 自定义层级 */
  zIndex?: number
  /** 点击遮罩是否关闭 */
  closeOnClickModal?: boolean
  /** 底部安全距离适配 */
  safeAreaInsetBottom?: boolean
  /** 追加到选择器根元素的自定义类 */
  customClass?: string
}

interface IEmits {
  (e: 'update:visible', value: boolean): void
  (e: 'update:modelValue', value: (string | number)[]): void
  (e: 'confirm', payload: { value: (string | number)[] }): void
  (e: 'open'): void
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<IProps>(), {
  title: '',
  columns: () => [],
  modelValue: () => [],
  confirmButtonText: '确定',
  cancelButtonText: '取消',
  zIndex: 15,
  closeOnClickModal: true,
  safeAreaInsetBottom: true,
  customClass: '',
})

const emit = defineEmits<IEmits>()

const pickerClass = computed(() => `uh-picker ${props.customClass}`.trim())

/* ---------------- wd-picker 事件转发(在 script 处理,模板只做绑定) ---------------- */
function handleUpdateVisible(value: boolean) {
  emit('update:visible', value)
}

function handleUpdateModelValue(value: (string | number)[]) {
  emit('update:modelValue', value)
}

function handleConfirm(payload: { value: (string | number)[] }) {
  emit('confirm', payload)
}

function handleOpen() {
  emit('open')
}

function handleCancel() {
  emit('cancel')
}
</script>

<template>
  <wd-picker
    :visible="visible" :title="title" :columns="columns" :model-value="modelValue"
    :confirm-button-text="confirmButtonText" :cancel-button-text="cancelButtonText" :z-index="zIndex"
    :close-on-click-modal="closeOnClickModal" :safe-area-inset-bottom="safeAreaInsetBottom"
    :custom-class="pickerClass" @update:visible="handleUpdateVisible" @update:model-value="handleUpdateModelValue"
    @confirm="handleConfirm" @open="handleOpen" @cancel="handleCancel"
  >
    <slot />
  </wd-picker>
</template>

<style scoped lang="scss">
  /* 弹层面板玻璃质感(与 uh-glass-popup 同款;wd-picker 内层 popup 挂 .wd-picker__popup) */
:deep(.wd-picker__popup .wd-popup) {
  box-sizing: border-box;
  background-color: rgb(255 255 255 / 85%);
  border: 4rpx solid rgb(255 255 255 / 90%);
  box-shadow:
    inset 0 1rpx 0 rgb(255 255 255 / 75%),
    0 8rpx 32rpx rgb(90 105 200 / 14%);
  backdrop-filter: blur(24rpx) saturate(160%);
  -webkit-backdrop-filter: blur(24rpx) saturate(160%);
}

/* 低端 WebView 不支持 backdrop-filter 的兜底:提高不透明度保证可读性 */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  :deep(.wd-picker__popup .wd-popup) {
    background-color: rgb(255 255 255 / 88%);
  }
}

:deep(.wd-popup--bottom) {
  left: 24rpx;
  bottom: 24rpx;
  right: 24rpx;
}
</style>
