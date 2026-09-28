<script setup lang="ts">
interface IProps {
  position?: 'left' | 'right'
}

const props = withDefaults(defineProps<IProps>(), {
  position: 'left',
})

const decorationClass = computed(() => {
  return props.position === 'left' ? 'left-0 h-2' : '-right-1 h-4'
})
</script>

<template>
  <view class="w-full flex items-center justify-between">
    <view class="relative shrink-0">
      <text class="relative z-2 text-2xs font-semibold">
        <slot />
      </text>
      <view class="absolute z-1 w-4/5 rounded-xl bg-secondary -bottom-0.5" :class="decorationClass" />
    </view>
    <view class="flex flex-1 items-center justify-end">
      <slot name="right" />
    </view>
  </view>
</template>
