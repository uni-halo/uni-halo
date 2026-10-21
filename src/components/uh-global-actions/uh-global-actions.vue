<script setup lang="ts">
import { ref } from 'vue'
import { useSafeArea } from '@/hooks/useSafeArea'

defineOptions({
  options: {
    styleIsolation: 'apply-shared',
  },
})
const props = withDefaults(defineProps<IProps>(), {
  visibleCount: 0,
  whenCountShowCollapsedButton: 3,
  defaultCollapsed: true,
})

const instance = getCurrentInstance()

interface IProps {
  visibleCount?: number
  defaultCollapsed?: boolean
  whenCountShowCollapsedButton?: number
}

const { safeBottomStyle } = useSafeArea()

// 折叠状态
const isCollapsed = ref(props.defaultCollapsed)
const collapsedStatus = ref(props.defaultCollapsed)
const isShowCollapsedButton = ref(true)
// 用户点击过才使用动画，动画结束后复位避免页面切换时动画重播
const hasToggled = ref(false)
let animationTimer: ReturnType<typeof setTimeout> | null = null

const toggleActionsClass = computed(() => {
  if (!hasToggled.value) {
    return isCollapsed.value ? 'uhc-collapse-no-animation' : 'uhc-expand-no-animation'
  }
  return isCollapsed.value ? 'uhc-collapse' : 'uhc-expand'
})

const pages = getCurrentPages()
const currentPage = pages[pages.length - 1]

const toggleActionClass = computed(() => {
  const textColor = currentPage.route.includes('/love/') ? 'text-love' : 'text-primary'
  const rotate = isCollapsed.value ? 'uhc-rotate-0' : 'uhc-rotate-45'
  return [textColor, rotate]
})

// 切换折叠状态
function toggleCollapsed() {
  if (animationTimer) {
    clearTimeout(animationTimer)
  }
  hasToggled.value = true
  isCollapsed.value = !isCollapsed.value
  if (!isCollapsed.value) {
    collapsedStatus.value = isCollapsed.value
  }
  animationTimer = setTimeout(() => {
    hasToggled.value = false
    animationTimer = null
    collapsedStatus.value = isCollapsed.value
  }, 300)
}

onUnmounted(() => {
  if (animationTimer) {
    clearTimeout(animationTimer)
  }
})

watch(() => props.visibleCount, (val) => {
  nextTick(() => {
    if (val >= props.whenCountShowCollapsedButton) {
      isShowCollapsedButton.value = true
      isCollapsed.value = true
      collapsedStatus.value = true
    }
    else {
      isShowCollapsedButton.value = false
      isCollapsed.value = false
      collapsedStatus.value = false
    }
  })
}, {
  immediate: true,
})
</script>

<template>
  <view class="fixed bottom-18 right-3 z-50 box-border flex flex-col gap-y-3 pb-safe" :style="[safeBottomStyle]">
    <view
      class="uhc-actions box-border flex flex-col gap-y-3"
      :class="[toggleActionsClass, collapsedStatus ? '!hidden' : 'flex']"
    >
      <slot />
    </view>
    <view
      v-if="isShowCollapsedButton"
      class="uh-global-card-glass h-10 w-10 flex origin-center items-center justify-center border rounded-full transition-all duration-300"
      :class="[toggleActionClass]" @click="toggleCollapsed"
    >
      <wd-icon :name="isCollapsed ? 'menu-unfold' : 'plus'" size="42rpx" />
    </view>
  </view>
</template>

<style scoped lang="scss">
.uhc-rotate-45 {
  transform: rotate(45deg);
}

.uhc-rotate-0 {
  transform: rotate(0deg);
}

.uhc-expand-no-animation {
  transform: scale(1) !important;
}

.uhc-collapse-no-animation {
  transform: scale(0) !important;
}

.uhc-collapse {
  animation: collapse 0.3s ease-in-out;
  animation-fill-mode: forwards;
  transform-origin: center bottom;
}

.uhc-expand {
  animation: expand 0.3s ease-in-out;
  animation-fill-mode: forwards;
  transform-origin: center bottom;
}

@keyframes collapse {
  0% {
    transform: scale(1);
  }

  100% {
    transform: scale(0);
  }
}

@keyframes expand {
  0% {
    transform: scale(0);
  }

  100% {
    transform: scale(1);
  }
}
</style>
