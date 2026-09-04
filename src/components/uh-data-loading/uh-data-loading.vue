<script setup lang="ts">
import { computed } from 'vue'
import type { DataLoadingStatus } from '@/hooks/useDataLoading'

interface IProps {
  /** 加载状态(取值同 useDataLoading 返回的 status) */
  loadingStatus?: DataLoadingStatus
  /** 占位区最小高度 */
  minHeight?: string
  loadingText?: string
  errorText?: string
  emptyText?: string
  /** 各态副文案(留空则不显示副行) */
  loadingSubText?: string
  errorSubText?: string
  emptySubText?: string
}

const props = withDefaults(defineProps<IProps>(), {
  loadingStatus: 'loading',
  minHeight: '75vh',
  loadingText: '稍等，正在加载中哦',
  errorText: '哎呀，加载失败了呢~',
  emptyText: '啊偶，暂时没有数据呢~',
  loadingSubText: '',
  errorSubText: '请检查网络连接，或稍后再试',
  emptySubText: '稍后再来看看吧～',
})

const emit = defineEmits<{ (e: 'refresh'): void }>()

const isLoading = computed(() => props.loadingStatus === 'loading')

const statusScene = computed(() => {
  switch (props.loadingStatus) {
    case 'error':
      return {
        icon: '-injury',
        stageClass: 'stage-error',
        mainTextClass: 'text-red-400',
        mainText: props.errorText,
        subText: props.errorSubText,
      }
    case 'empty':
      return {
        icon: '-confused',
        stageClass: 'stage-empty',
        mainTextClass: 'text-gray-600',
        mainText: props.emptyText,
        subText: props.emptySubText,
      }
    default:
      return {
        icon: '-happy-1',
        stageClass: 'stage-loading',
        mainTextClass: 'text-primary',
        mainText: props.loadingText,
        subText: props.loadingSubText,
      }
  }
})
</script>

<template>
  <view
    class="w-full flex flex-col items-center justify-center gap-y-4 text-sm"
    :style="{ minHeight: props.minHeight }"
  >
    <!-- 状态舞台:光晕 + 漂浮装饰点 + 毛玻璃表情珠 -->
    <view class="scene relative h-[250rpx] w-[250rpx] flex items-center justify-center" :class="statusScene.stageClass">
      <view class="glow absolute inset-0 m-auto h-[220rpx] w-[220rpx] rounded-full" />
      <view class="deco-dot dot-a absolute rounded-full" />
      <view class="deco-dot dot-b absolute rounded-full" />
      <view class="bubble relative h-[150rpx] w-[150rpx] flex items-center justify-center rounded-full">
        <text class="bubble-icon">
          <wd-icon class-prefix="uhemoji-icon" :name="statusScene.icon" size="120rpx" />
        </text>
      </view>
    </view>

    <!-- 文案区 -->
    <view class="flex flex-col items-center">
      <view class="flex items-center justify-center text-[28rpx] font-bold" :class="statusScene.mainTextClass">
        <text>{{ statusScene.mainText }}</text>
        <!-- 加载中三点跳动 -->
        <view v-if="isLoading" class="ml-1 flex items-end gap-1">
          <view v-for="n in 3" :key="n" class="typing-dot bg-primary" />
        </view>
      </view>
      <text v-if="statusScene.subText" class="mt-3 text-[24rpx] text-gray-400">
        {{ statusScene.subText }}
      </text>
      <uh-button class="mt-5" @click="emit('refresh')">
        刷新试试
      </uh-button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.bubble {
  animation: bubble-float 2s ease-in-out infinite;
}

.bubble-icon {
  display: inline-block;
}

.glow {
  animation: glow-pulse 2.4s ease-in-out infinite;
}

.stage-loading .glow {
  background: rgba(185, 228, 36, 0.32);
}

.stage-error .glow {
  background: rgba(248, 113, 113, 0.24);
}

.stage-empty .glow {
  background: rgba(217, 249, 157, 0.5);
}

.deco-dot {
  animation: deco-float 2s ease-in-out infinite;
}

.dot-a {
  top: 16rpx;
  left: 10rpx;
  width: 22rpx;
  height: 22rpx;
  background: rgba(163, 230, 53, 0.9);
}

.dot-b {
  top: 4rpx;
  right: 14rpx;
  width: 14rpx;
  height: 14rpx;
  background: rgba(217, 249, 157, 0.95);
  animation-delay: -0.7s;
}

/* —— 三态表情差异化动效(均无限循环,柔和不抢眼) —— */
.stage-loading .bubble-icon {
  animation: sway 1.6s ease-in-out infinite;
}

.stage-error .bubble-icon {
  animation: head-shake 2.8s ease-in-out infinite;
  transform-origin: 50% 85%;
}

.stage-empty .bubble-icon {
  animation: sigh 3s ease-in-out infinite;
  transform-origin: 50% 85%;
}

/* —— 加载中三点跳动 —— */
.typing-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%; 
  animation: dot-jump 1s ease-in-out infinite;

  &:nth-child(2) {
    animation-delay: 0.15s;
  }

  &:nth-child(3) {
    animation-delay: 0.3s;
  }
}

/* —— keyframes —— */
@keyframes bubble-float {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-14rpx);
  }
}

@keyframes glow-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.55;
  }

  50% {
    transform: scale(1.1);
    opacity: 0.9;
  }
}

@keyframes deco-float {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-12rpx);
  }
}

@keyframes dot-jump {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-8rpx);
  }
}

/* 歪头左右打量(loading) */
@keyframes sway {
  0%,
  100% {
    transform: rotate(-4deg);
  }

  50% {
    transform: rotate(4deg);
  }
}

/* 缓慢左右摇头(error) */
@keyframes head-shake {
  0%,
  100% {
    transform: rotate(0);
  }

  25% {
    transform: rotate(6deg);
  }

  75% {
    transform: rotate(-6deg);
  }
}

/* 轻轻叹气缩肩(empty) */
@keyframes sigh {
  0%,
  100% {
    transform: scaleY(1);
  }

  30%,
  70% {
    transform: scaleY(0.92);
  }
}
</style>
