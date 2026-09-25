<script setup lang="ts">
defineOptions({
  options: {
    styleIsolation: 'apply-shared',
  },
})
</script>

<template>
  <view class="fixed bottom-18 right-3 z-50 flex flex-col gap-y-3 pb-safe">
    <slot />
  </view>
</template>
