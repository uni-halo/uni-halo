<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onMounted, ref } from 'vue'
import { useSafeArea } from '@/hooks/useSafeArea'

defineOptions({
  options: {
    styleIsolation: 'apply-shared',
  },
})

const props = withDefaults(defineProps<IProps>(), {
  customClass: 'bottom-0',
  customContentClass: '',
  needPlaceholder: false,
  needGlassWrapper: true,
  zIndex: 50,
})

const { safeBottomStyle } = useSafeArea()

interface IProps {
  customClass?: string
  customContentClass?: string
  needPlaceholder?: boolean
  needGlassWrapper?: boolean
  zIndex?: number
}

const instance = getCurrentInstance()

const contentClass = computed(() => {
  if (props.needGlassWrapper) {
    return `uh-global-card-glass box-border flex items-center justify-center gap-2 !border !rounded-full p-1 text-primary ${props.customContentClass}`
  }
  return `box-border flex items-center justify-center gap-2 ${props.customContentClass}`
})

const toolbarHeight = ref(0)
const toolbarSafeAreaStyle = computed(() => {
  if (!props.needPlaceholder) { return {} }
  return {
    height: `${toolbarHeight.value}px`,
  }
})

function getElementRect() {
  const query = uni.createSelectorQuery().in(instance.proxy)
  query.select('#floatToolbar')
    .boundingClientRect((res: UniApp.NodeInfo) => {
      if (res) {
        toolbarHeight.value = res.height
      }
    })
    .exec()
}

onMounted(() => {
  nextTick(() => {
    getElementRect()
  })
})
</script>

<template>
  <view
    id="floatToolbar"
    class="pointer-events-none fixed left-0 right-0 z-10 box-border w-full flex items-center justify-center overflow-hidden pb-safe"
    :class="[props.customClass]" :style="[safeBottomStyle]"
  >
    <view class="pointer-events-auto" :class="[contentClass]">
      <slot />
    </view>
  </view>
  <view v-if="props.needPlaceholder" class="w-full bg-page" :style="[toolbarSafeAreaStyle]" />
</template>
