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

interface IEmits {
  (e: 'click'): void
  (e: 'action-click'): void
}

function handleClick() {
  emits('action-click')
  emits('click')
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
