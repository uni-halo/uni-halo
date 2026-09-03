<script setup lang="ts">
import type { DataLoadingStatus } from '@/hooks/useDataLoading'

interface IProps {
  /** 加载状态(取值同 useDataLoading 返回的 status) */
  loadingStatus?: DataLoadingStatus
  /** 占位区最小高度 */
  minHeight?: string
  loadingText?: string
  errorText?: string
  emptyText?: string
}

const props = withDefaults(defineProps<IProps>(), {
  loadingStatus: 'loading',
  minHeight: '60vh',
  loadingText: '稍等，正在努力加载中哦...',
  errorText: '哎呀，加载失败了呢~',
  emptyText: '啊偶，暂时没有数据呢~',
})

const emit = defineEmits<{ (e: 'refresh'): void }>()
</script>

<template>
  <view
    class="w-full flex flex-col items-center justify-center gap-y-4 text-sm"
    :style="{ minHeight: props.minHeight }"
  >
    <!-- 加载中 -->
    <template v-if="props.loadingStatus === 'loading'">
      <!-- 表情上下漂浮动画 -->
      <text class="bob-icon">
        <wd-icon class-prefix="uhemoji-icon" name="-happy-1" size="100rpx" />
      </text>
      <view class="text-primary">
        {{ props.loadingText }}
      </view>
    </template>

    <!-- 加载错误(可重试) -->
    <template v-else-if="props.loadingStatus === 'error'">
      <!-- 表情上下漂浮动画 -->
      <text class="bob-icon">
        <wd-icon class-prefix="uhemoji-icon" name="-injury" size="100rpx" />
      </text>
      <view class="text-red-400">
        {{ props.errorText }}
      </view>
      <uh-button @click="emit('refresh')">
        刷新试试
      </uh-button>
    </template>

    <!-- 无数据 -->
    <template v-else>
      <!-- 表情上下漂浮动画 -->
      <text class="bob-icon">
        <wd-icon class-prefix="uhemoji-icon" name="-confused" size="120rpx" />
      </text>
      <view class="text-gray-900">
        {{ props.emptyText }}
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
/* 状态表情上下漂浮动画：@keyframes 无法用 UnoCSS / wot-ui 原子类表达，保留 scoped 样式 */
@keyframes bob-icon-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-18rpx);
  }
}

.bob-icon {
  display: inline-block;
  animation: bob-icon-float 2s ease-in-out infinite;
}
</style>
