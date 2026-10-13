<script lang="ts" setup>
/**
 * 画作卡片：封面图 + 标题 + 作者·日期，用于绘画作品列表
 */
import { computed } from 'vue'
import dayjs from 'dayjs'
import { checkThumbnailUrl } from '@/utils/url'
import type { IDraw } from '@/api/types/draw'

interface IProps {
  /** 画作数据 */
  draw: IDraw
}

const props = defineProps<IProps>()

const emit = defineEmits<{
  (e: 'tap'): void
}>()

const coverUrl = computed(() => checkThumbnailUrl(props.draw.spec.cover))
/** 竞猜作品未揭晓时隐藏标题，防止标题泄露谜底 */
const isPuzzle = computed(() => !!props.draw.spec.puzzleStatus)
const titleText = computed(() => {
  if (isPuzzle.value && props.draw.spec.puzzleStatus !== 'REVEALED') {
    return '作品标题已隐藏'
  }
  return props.draw.spec.title || '无题'
})
const puzzleLabel = computed(() =>
  props.draw.spec.puzzleStatus === 'REVEALED' ? '已揭晓' : '画谜')
const owner = computed(() => props.draw.owner)
const ownerText = computed(() => owner.value?.displayName || owner.value?.username || '佚名')
const ownerAvatar = computed(() => checkThumbnailUrl(owner.value?.avatar || ''))
const ownerFallbackText = computed(() => ownerText.value.slice(0, 1).toUpperCase())
const dateText = computed(() => {
  const time = props.draw.metadata?.creationTimestamp
  return time ? dayjs(time).format('YYYY年MM月DD日') : ''
})
</script>

<template>
  <view
    class="uh-global-card-glass uh-shadow-xs box-border w-full overflow-hidden rounded-xl bg-white/80"
    @click="emit('tap')"
  >
    <view v-if="coverUrl" class="relative h-32 w-full">
      <wd-img :src="coverUrl" mode="aspectFill" lazy-load class="h-full w-full">
        <template #loading>
          <wd-loading size="64rpx" custom-class="text-primary" />
        </template>
      </wd-img>
      <view
        v-if="isPuzzle"
        class="uh-global-card-glass absolute right-0 top-0 box-border flex items-center gap-x-0.5 rounded-lb-lg px-2 py-0.5 !border !border-r-none !border-t-none !bg-secondary"
      >
        <text class="text-xs text-gray-900">{{ puzzleLabel }}</text>
      </view>
    </view>
    <view class="box-border flex flex-col gap-y-1.5 overflow-hidden px-3 py-2.5">
      <text class="w-full truncate text-xs text-gray-900">{{ titleText }}</text>
      <text class="text-xs text-gray-500">{{ dateText }}</text>
      <view class="flex items-center gap-x-1 text-3xs text-gray-400">
        <wd-avatar
          :src="ownerAvatar"
          :text="ownerFallbackText"
          shape="round"
          size="42rpx"
          custom-class="uh-global-card-glass !shadow-none !border"
          mode="aspectFill"
        />
        <text class="truncate text-3xs text-gray-400">{{ ownerText }}</text>
      </view>
    </view>
  </view>
</template>
