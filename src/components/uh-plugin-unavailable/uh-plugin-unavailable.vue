<script lang="ts" setup>
import { computed } from 'vue'
import { NeedPlugins } from '@/hooks/usePluginAvailable'

const props = withDefaults(defineProps<{
  pluginId: string
  errorText?: string
  checking: boolean
  customClass?: string
}>(), {
  errorText: '',
})

const emit = defineEmits<{
  (e: 'on-refresh'): void
}>()

/** 插件信息(未在清单中时兜底) */
const pluginInfo = computed(() => {
  return NeedPlugins.get(props.pluginId) ?? { pluginId: props.pluginId, name: '未找到插件' }
})

function handleRefresh() {
  if (props.checking) { return }
  emit('on-refresh')
}
</script>

<template>
  <view
    v-if="pluginInfo"
    class="mx-auto my-auto box-border max-w-3/5 flex flex-col items-center justify-center gap-6 text-sm"
    :class="props.customClass"
  >
    <wd-icon class-prefix="uhemoji-icon" name="-cry" size="140rpx" />

    <view class="box-border text-sm text-gray-900 font-bold">
      {{ pluginInfo.name }}
    </view>

    <view v-if="errorText" class="text-2xs text-yellow-500">
      {{ errorText }}
    </view>

    <view class="w-full flex flex-col gap-y-4">
      <uh-button custom-class="!rounded-full text-xs py-2 !uh-shadow-xs" @click="handleRefresh()">
        {{ props.checking ? '正在刷新' : '刷新试试' }}
      </uh-button>
      <!-- #ifdef MP-WEIXIN -->
      <!-- 微信端客服会话只能由原生 button 的 open-type="contact" 唤起,故此处不用 uh-button(view 实现) -->
      <button
        class="uh-button-native w-full flex items-center justify-center bg-white px-4 py-2.5 text-xs text-black leading-none !rounded-full"
        open-type="contact" hover-class="none"
      >
        提交反馈
      </button>
      <!-- #endif -->
    </view>
  </view>
</template>
