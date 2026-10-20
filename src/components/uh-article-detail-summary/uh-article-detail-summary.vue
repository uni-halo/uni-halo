<script lang="ts" setup>
/**
 * 文章详情摘要组件
 * 有 excerpt 内容时展示摘要卡片（打字机效果，支持收起展开）
 * 开关：插件端 preferences.articlesSummaryTypewriterEnabled（未配置视为开启），偏好设置「笔记详情」可覆盖
 */
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useTypewriter } from '@/hooks/useTypewriter'
import { useSettingStore } from '@/store/setting'

interface IProps {
  /** 摘要内容（文章 excerpt.raw） */
  content?: string
}

const props = withDefaults(defineProps<IProps>(), {
  content: '',
})

const { settings } = storeToRefs(useSettingStore())

/** 内容页-摘要打字机开关（未配置视为开启，与插件端默认值一致） */
const isEnabled = computed(() => settings.value.articlesSummaryTypewriterEnabled)

const expanded = ref(true)

// immediate: false，由下方 watch 同时接管「开关状态」与「内容到达/变化」
const { displayText, start, finish } = useTypewriter(() => props.content, { speed: 30, immediate: false })

watch(
  () => [isEnabled.value, props.content],
  ([enabled]) => {
    enabled ? start() : finish()
  },
  { immediate: true },
)
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
