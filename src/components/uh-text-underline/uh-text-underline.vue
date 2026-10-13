<script setup lang="ts">
interface IProps {
  customClass?: string
  lineClass?: string
  textClass?: string
}
const props = withDefaults(defineProps<IProps>(), {
  customClass: '',
  lineClass: '!h-2/5 uh-rotate-n5',
  textClass: 'font-bold',
})
</script>

<template>
  <text class="relative shrink-0" :class="[props.customClass]">
    <text class="relative z-2 font-bold" :class="[props.textClass]">
      <slot />
    </text>
    <text class="absolute z-1 h-3/5 w-4/5 transform rounded-xl bg-secondary -bottom-0.5 -right-1" :class="[props.lineClass]" />
  </text>
</template>

<style scoped lang="scss">
/* 下划线轻微旋转 */
.uh-rotate-n5 {
  transform: rotate(-5deg);
}
</style>
