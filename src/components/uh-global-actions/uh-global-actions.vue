<script setup lang="ts">
import { watchEffect } from 'vue'

defineOptions({
  options: {
    styleIsolation: 'apply-shared',
  },
})
const props = withDefaults(defineProps<IProps>(), {
  whenCountShowCollapsedButton: 2,
  defaultCollapsed: true,
})

const instance = getCurrentInstance()

interface IProps {
  defaultCollapsed?: boolean
  whenCountShowCollapsedButton?: number
}

// 折叠状态
const isToggle = ref(false)
const isFirstToggle = ref(true)
const isCollapsed = ref(props.defaultCollapsed)
const isShowCollapsedButton = ref(true)

const toggleActionsClass = computed(() => {
  if (isShowCollapsedButton.value && props.defaultCollapsed && isFirstToggle.value) {
    return 'uhc-collapse-no-animation'
  }
  if (!isToggle.value || isFirstToggle.value) {
    return 'uhc-expand-no-animation'
  }
  return isCollapsed.value ? 'uhc-collapse' : 'uhc-expand'
})

const pages = getCurrentPages()
const currentPage = pages[pages.length - 1]

const toggleActionClass = computed(() => {
  return currentPage.route.includes('/love/') ? 'text-love' : 'text-primary'
})

// 切换折叠状态
function toggleCollapsed() {
  if (isFirstToggle.value) {
    isFirstToggle.value = false
  }
  isCollapsed.value = !isCollapsed.value
}

// actions组件内，DOM查询函数
function resolveRenderContent() {
  nextTick(() => {
    const query = uni.createSelectorQuery().in(instance.proxy)
    query.selectAll('.uhc-actions > *').boundingClientRect((res) => {
      const childrenCount = (res as UniApp.NodeInfo[]).length + 1
      if (childrenCount > props.whenCountShowCollapsedButton) {
        isShowCollapsedButton.value = true
        isToggle.value = true
      }
      else {
        isToggle.value = false
        isShowCollapsedButton.value = false
        isCollapsed.value = false
      }
    }).exec()
  })
}

watchEffect(() => {
  resolveRenderContent()
})

onMounted(() => {
  resolveRenderContent()
})
</script>

<template>
  <view class="fixed bottom-18 right-3 z-50 box-border flex flex-col gap-y-3 pb-safe">
    <view
      class="uhc-actions box-border flex flex-col gap-y-3 transition-all duration-300" :class="[
        toggleActionsClass,
      ]"
    >
      <slot />
    </view>
    <view
      v-if="isShowCollapsedButton"
      class="uh-global-card-glass h-11 w-11 flex items-center justify-center border rounded-full"
      :class="[toggleActionClass]"
      @click="toggleCollapsed"
    >
      <wd-icon :name="isCollapsed ? 'up' : 'down'" size="42rpx" />
    </view>
  </view>
</template>

<style scoped lang="scss">
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
