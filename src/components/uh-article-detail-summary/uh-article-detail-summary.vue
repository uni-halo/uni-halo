<script lang="ts" setup>
/**
 * 文章详情摘要组件
 * 有 excerpt 内容时展示摘要卡片（打字机效果，支持收起展开）
 */
import { ref } from 'vue'
import { useTypewriter } from '@/hooks/useTypewriter'

interface IProps {
  /** 摘要内容（文章 excerpt.raw） */
  content?: string
}

const props = withDefaults(defineProps<IProps>(), {
  content: '',
})

const { displayText } = useTypewriter(() => props.content, { speed: 30 })

const expanded = ref(true)
</script>

<template>
  <view
    v-if="content"
    class="uh-global-card-glass relative box-border overflow-hidden border border-[#EFF1C9] rounded-xl border-solid p-4 pb-3.5 !shadow-none"
  >
    <view class="hk-glow" />
    <view class="relative flex items-center justify-between">
      <view class="hk-tag relative flex items-center gap-2 text-xs text-primary font-semibold tracking-0.5 before:bg-primary">
        摘要
      </view>
      <view
        class="flex items-center justify-center text-gray-400 active:text-primary"
        @click="expanded = !expanded"
      >
        <wd-icon
          :name="expanded ? 'up' : 'down'"
          size="28rpx"
        />
      </view>
    </view>
    <view
      class="relative mt-3 text-3xs text-gray-900 leading-5.5"
      :class="{ 'line-clamp-2': !expanded }"
    >
      {{ displayText }}
    </view>
  </view>
</template>

<style scoped lang="scss">
.hk-glow {
  position: absolute;
  right: -36rpx;
  top: -44rpx;
  width: 168rpx;
  height: 168rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(185, 228, 36, 0.18), transparent 68%);
}

.hk-tag::before {
  content: '';
  width: 28rpx;
  height: 4rpx;
  border-radius: 4rpx;
}
</style>
