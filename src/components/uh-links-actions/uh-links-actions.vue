<script lang="ts" setup>
/**
 * 友链底部悬浮操作栏(通用组件)
 * 参考瞬间详情页底部悬浮按钮设计;通过 :actions 控制显示的按钮,事件回调 emit('apply') / emit('info')
 * 站点 tab / 小程序 tab 分别引入(如 :actions="['apply','info']" @apply=... @info=...)
 */
withDefaults(defineProps<{
  /** 需要显示的按钮:apply=提交申请,info=友链信息;包含即显示 */
  actions?: string[]
}>(), {
  actions: () => ['apply', 'info'],
})

const emit = defineEmits<{
  (e: 'apply'): void
  (e: 'info'): void
}>()
</script>

<template>
  <view class="fixed bottom-8 left-1/2 z-10 flex items-center justify-center pb-safe -translate-x-1/2">
    <view class="uh-global-card-glass box-border flex items-center justify-center gap-2 border rounded-full p-1 text-primary">
      <view
        v-if="actions.includes('apply')"
        class="uh-global-card-glass box-border h-9 flex flex-1 items-center justify-center gap-x-1 border rounded-full px-8 shadow-none"
        @click="emit('apply')"
      >
        <wd-icon name="edit" size="36rpx" />
        <text class="shrink-0 text-sm text-gray-900 font-semibold">提交申请</text>
      </view>
      <view
        v-if="actions.includes('info')"
        class="uh-global-card-glass box-border h-9 flex flex-1 items-center justify-center gap-x-1 border rounded-full px-8 shadow-none"
        @click="emit('info')"
      >
        <wd-icon name="info" size="36rpx" />
        <text class="shrink-0 text-sm text-gray-900 font-semibold">友链信息</text>
      </view>
    </view>
  </view>
</template>
