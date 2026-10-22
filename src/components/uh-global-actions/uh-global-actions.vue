<script setup lang="ts">
import { ref } from 'vue'
import { useSafeArea } from '@/hooks/useSafeArea'
import { getCache, setCache } from '@/utils/storage'

defineOptions({
  options: {
    styleIsolation: 'apply-shared',
  },
})
const props = withDefaults(defineProps<IProps>(), {
  visibleCount: 0,
  whenCountShowCollapsedButton: 1,
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

/* ---------------- 拖拽停靠(垂直拖动,右缘固定,底边锚定保证向上展开) ---------------- */
/**
 * 停靠位置:容器底边距屏幕底部的距离(px);null=默认位置(bottom-18)。
 * 用底边而非顶边锚定:底边固定后展开时内容向上生长,折叠按钮原地不动
 */
const DOCK_KEY = 'uh:global-actions-dock-b'
const windowHeight = uni.getSystemInfoSync().windowHeight || 800

const dockBottom = ref<number | null>(null)
const cachedBottom = getCache<number>(DOCK_KEY)
if (typeof cachedBottom === 'number' && cachedBottom >= 0 && cachedBottom <= windowHeight) {
  dockBottom.value = cachedBottom
}

const dockStyle = computed(() => (dockBottom.value === null ? {} : { bottom: `${dockBottom.value}px` }))

let dragStartY = 0
let dragBaseBottom = 0
let dragMoved = false
/** 拖动后短暂置真,吞掉折叠按钮误触的 click */
const justDragged = ref(false)
let justDraggedTimer: ReturnType<typeof setTimeout> | null = null
/** 容器当前高度(展开/折叠不同,clamp 用) */
let measuredHeight = 120
/** 默认停靠位置(挂载后实测的底边距;未测得时按 bottom-18 ≈ 72px 兜底) */
const defaultBottom = ref<number | null>(null)

/** 实测容器位置:更新高度;未停靠时顺带记录默认底边距(底边固定,展开/收起不影响该值) */
function measureRect() {
  const query = uni.createSelectorQuery().in(instance.proxy)
  query.select('#globalActions')
    .boundingClientRect((res: UniApp.NodeInfo) => {
      if (res && typeof res.top === 'number' && res.height) {
        measuredHeight = res.height
        if (dockBottom.value === null) {
          defaultBottom.value = windowHeight - res.top - res.height
        }
      }
    })
    .exec()
}

onMounted(() => {
  nextTick(() => {
    measureRect()
  })
})

// 展开/收起后容器高度变化,重测供 clamp 使用
watch(() => collapsedStatus.value, () => {
  nextTick(() => {
    measureRect()
  })
})

/** 边界钳制:容器整体保持在状态栏下 60px 到屏幕底 60px 之间 */
function clampBottom(bottom: number) {
  const min = 60
  const max = Math.max(min, windowHeight - measuredHeight - 60)
  return Math.min(Math.max(bottom, min), max)
}

function onDragStart(e: { touches?: Array<{ clientY: number }> }) {
  const touch = e.touches?.[0]
  if (!touch) {
    return
  }
  dragStartY = touch.clientY
  // 同步基准:已停靠用停靠值,否则用挂载实测的默认底边距(异步测量只刷高度,不做基准,避免竞态跳位)
  dragBaseBottom = dockBottom.value ?? defaultBottom.value ?? 72
  dragMoved = false
  measureRect()
}

function onDragMove(e: { touches?: Array<{ clientY: number }> }) {
  const touch = e.touches?.[0]
  if (!touch) {
    return
  }
  const dy = touch.clientY - dragStartY
  if (!dragMoved && Math.abs(dy) < 8) {
    return
  }
  dragMoved = true
  // 手指上移(dy<0)容器上移,底边距增大
  dockBottom.value = clampBottom(dragBaseBottom - dy)
}

function onDragEnd() {
  if (!dragMoved) {
    return
  }
  if (dockBottom.value !== null) {
    setCache(DOCK_KEY, dockBottom.value)
  }
  justDragged.value = true
  if (justDraggedTimer) {
    clearTimeout(justDraggedTimer)
  }
  justDraggedTimer = setTimeout(() => {
    justDragged.value = false
  }, 300)
}

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
  if (justDraggedTimer) {
    clearTimeout(justDraggedTimer)
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
  <view
    id="globalActions"
    class="fixed bottom-18 right-3 z-50 box-border flex flex-col gap-y-3 pb-safe"
    :style="[safeBottomStyle, dockStyle]"
    @touchstart="onDragStart"
    @touchmove.stop.prevent="onDragMove"
    @touchend="onDragEnd"
    @touchcancel="onDragEnd"
  >
    <view
      class="uhc-actions box-border flex flex-col gap-y-3"
      :class="[toggleActionsClass, collapsedStatus ? '!hidden' : 'flex']"
    >
      <slot />
    </view>
    <view
      v-if="isShowCollapsedButton"
      class="uh-global-card-glass h-10 w-10 flex origin-center items-center justify-center border rounded-full transition-all duration-300"
      :class="[toggleActionClass]" @click="!justDragged && toggleCollapsed()"
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
