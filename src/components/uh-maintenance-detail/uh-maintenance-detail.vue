<script lang="ts" setup>
import { computed } from 'vue'
import { markdownConfig } from '@/config/markdown'

defineOptions({
  options: {
    styleIsolation: 'apply-shared',
  },
})

const props = withDefaults(defineProps<{
  modelValue?: boolean
  content?: string
}>(), {
  modelValue: false,
  content: '',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const show = computed({
  get: () => props.modelValue,
  set: (value: boolean) => {
    emit('update:modelValue', value)
  },
})

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <uh-glass-popup
    v-model="show" position="bottom" :z-index="100"
    custom-class="rounded-xl"
  >
    <!-- 弹窗容器 -->
    <view class="box-border w-full flex flex-col gap-y-3 p-3">
      <!-- 顶部 -->
      <view class="text-center">
        <text class="text-sm text-gray-900 font-bold">
          维护详情
        </text>
      </view>
      <!-- 滚动区域 -->
      <scroll-view
        scroll-y :show-scrollbar="false"
        class="box-border max-h-[60vh] text-3xs text-gray-900 leading-5"
      >
        <mp-html
          :content="content" lazy-load :domain="markdownConfig.domain" :loading-img="markdownConfig.loadingGif" scroll-table selectable
          :tag-style="markdownConfig.tagStyle" :container-style="markdownConfig.containStyle"
          :markdown="true" :show-line-number="true"
          :show-language-name="true" copy-by-long-press
        />
      </scroll-view>
      <!-- 底部固定操作区域 -->
      <view class="box-border w-full flex items-center">
        <uh-button class="w-full flex-1" custom-class="w-full flex-1 uh-global-card-glass uh-shadow-xs border py-2 !rounded-xl bg-white text-primary" @click="close()">
          关闭
        </uh-button>
      </view>
    </view>
  </uh-glass-popup>
</template>
