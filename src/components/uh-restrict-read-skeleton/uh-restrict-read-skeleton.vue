<script lang="ts" setup>
/**
 * 受限阅读骨架屏
 * 受限内容遮挡 + 提示文字 + 验证按钮
 */
withDefaults(defineProps<{
  loading?: boolean
  hover?: boolean
  buttonText?: string
  buttonColor?: string
  buttonSize?: 'small' | 'normal' | 'large'
  lines?: number
  skeletonColor?: string
  skeletonHighlight?: string
  animationDuration?: number
  showButton?: boolean
  tipText?: string
  tipColor?: string
  tipSize?: number
}>(), {
  loading: true,
  hover: false,
  buttonText: '刷新',
  buttonColor: '#07c160',
  buttonSize: 'normal',
  lines: 4,
  skeletonColor: '#f5f5f5',
  skeletonHighlight: '#e8e8e8',
  animationDuration: 1.5,
  showButton: true,
  tipText: '',
  tipColor: '#666666',
  tipSize: 24,
})

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'touchstart'): void
  (e: 'touchend'): void
}>()

function handleRefresh() {
  emit('refresh')
}

function onTouchStart() {
  emit('touchstart')
}

function onTouchEnd() {
  emit('touchend')
}
</script>

<template>
  <view class="container relative min-h-[200rpx] w-full overflow-hidden rounded-2xl bg-white" style="box-shadow: 0 4rpx 12rpx rgb(0 0 0 / 5%);">
    <view v-if="loading" class="skeleton box-border w-full p-3">
      <view class="skeleton-body my-5">
        <view
          v-for="(item, index) in Array(lines).fill(0)"
          :key="index"
          class="skeleton-line mb-5 h-[32rpx] rounded-lg"
          :class="{ short: index === lines - 2, shorter: index === lines - 1 }"
          :style="{
            background: `linear-gradient(90deg, ${skeletonColor} 25%, ${skeletonHighlight} 50%, ${skeletonColor} 75%)`,
            backgroundSize: '400% 100%',
            animationDuration: `${animationDuration}s`,
          }"
        />
      </view>
    </view>

    <view v-else>
      <slot />
    </view>

    <view v-if="showButton" class="button-container absolute left-1/2 top-1/2 z-2 flex flex-col items-center uh-translate-center">
      <text
        v-if="tipText"
        class="tip-text mb-5 text-center leading-[1.4]"
        :style="{ color: tipColor, fontSize: `${tipSize}rpx` }"
      >
        {{ tipText }}
      </text>
      <button
        class="overlay-button relative flex items-center justify-center text-white"
        :class="[buttonSize, { 'button-hover': hover }]"
        hover-class="none"
        :style="{ backgroundColor: buttonColor }"
        @touchstart="onTouchStart"
        @touchend="onTouchEnd"
        @click="handleRefresh"
      >
        {{ buttonText }}
      </button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.skeleton {
  &-line {
    width: 100%;
    animation: skeleton-loading 1.5s ease infinite;

    &.short {
      width: 70%;
    }

    &.shorter {
      width: 50%;
    }
  }
}

.overlay-button {
  border-radius: 50rpx;
  padding: 0 40rpx;
  height: 80rpx;
  line-height: 80rpx;
  font-size: 28rpx;
  box-shadow: 0 4rpx 12rpx rgb(0 0 0 / 10%);

  &:active {
    transform: scale(0.95);
  }

  &.small {
    height: 60rpx;
    line-height: 60rpx;
    font-size: 24rpx;
    padding: 0 30rpx;
  }

  &.large {
    height: 100rpx;
    line-height: 100rpx;
    font-size: 32rpx;
    padding: 0 50rpx;
  }
}

.button-hover {
  transform: translateY(-4rpx);
  box-shadow: 0 8rpx 16rpx rgb(0 0 0 / 15%);
}

@keyframes skeleton-loading {
  0% {
    background-position: 100% 50%;
  }

  100% {
    background-position: 0 50%;
  }
}

/* 完全居中定位 */
.uh-translate-center {
  transform: translate(-50%, -50%);
}
</style>
