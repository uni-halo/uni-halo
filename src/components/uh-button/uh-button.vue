<script setup lang="ts">
defineOptions({
  options: {
    styleIsolation: 'apply-shared',
  },
})

const props = defineProps<IProps>()

const emits = defineEmits<IEmits>()

interface IProps {
  customClass?: string | Array<string>
}

// 事件需透传给 emit：组件事件默认不带 DOM 事件对象，
// 调用方写 @click.stop 时修饰符包装器对 undefined 事件调 stopPropagation 会抛
// Unhandled error，且原生点击仍会继续冒泡
interface IEmits {
  (e: 'click', event?: any): void
  (e: 'action-click', event?: any): void
}

function handleClick(e: any) {
  emits('action-click', e)
  emits('click', e)
}
</script>

<template>
  <view
    class="uh-shadow-xs box-border flex items-center justify-center rounded-lg bg-primary px-4 text-sm text-black"
    :class="props.customClass" @click="handleClick"
  >
    <slot />
  </view>
</template>
