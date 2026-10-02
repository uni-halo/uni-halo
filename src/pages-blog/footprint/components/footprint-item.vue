<script setup lang="ts">
import { computed, ref } from 'vue'
import { checkImageUrl } from '@/utils/url'
import { formatTime } from '@/utils/formatTime'
import type { IFootprint } from '@/api/types/halo-plugin-third/footprint'

/** 时间线条目：照片缩略图 + 名称/类型标签/地址/时间 */

const props = withDefaults(defineProps<{
  /** 足迹数据 */
  footprint?: IFootprint
}>(), {
  footprint: undefined,
})

const emit = defineEmits<{
  (e: 'tap'): void
}>()

const spec = computed(() => props.footprint?.spec)
const image = computed(() => checkImageUrl(spec.value?.image))
const dateText = computed(() => (spec.value?.createTime ? formatTime({ d: spec.value.createTime, f: 'yyyy/MM/dd' }) : ''))
const imageError = ref(false)
</script>

<template>
  <view class="uh-global-card-glass relative flex items-center gap-3 overflow-hidden border rounded-xl p-3 !shadow-none" @click="emit('tap')">
    <view class="absolute right-0 top-0 flex items-center gap-2">
      <text
        v-if="spec?.footprintType"
        class="shrink-0 rounded-bl-lg bg-primary px-2 py-0.5 text-xs text-gray-900"
      >
        {{ spec.footprintType }}
      </text>
    </view>

    <view class="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
      <image
        v-if="image && !imageError"
        :src="image"
        class="block h-full w-full"
        mode="aspectFill"
        lazy-load
        @error="imageError = true"
      />
      <view v-else class="h-full w-full flex items-center justify-center text-gray-300">
        <wd-icon name="image" size="36rpx" />
      </view>
    </view>
    <view class="min-w-0 flex flex-1 flex-col gap-1">
      <text class="min-w-0 flex-1 truncate text-sm text-gray-900 font-bold">{{ spec?.name }}</text>
      <view v-if="spec?.address" class="flex items-center gap-1">
        <wd-icon name="location" size="24rpx" class="shrink-0 text-gray-500" />
        <text class="flex-1 truncate text-xs text-gray-500">{{ spec.address }}</text>
      </view>
      <view class="flex items-center justify-between">
        <view v-if="dateText" class="flex flex-1 items-center gap-1">
          <wd-icon name="clock-circle" size="24rpx" class="shrink-0 text-gray-500" />
          <text class="flex-1 text-xs text-gray-500">{{ dateText }}</text>
        </view>
        <view class="flex shrink-0 items-end gap-1">
          <uh-button custom-class="uh-global-card-glass !rounded-full flex items-center gap-0.5 !border !px-2 !py-0.5 !bg-primary !text-gray-900">
            <wd-icon name="info-circle" class="text-xs" />
            <text class="flex-1 text-xs text-gray-900">详情</text>
          </uh-button>
          <uh-button custom-class="uh-global-card-glass !rounded-full flex items-center gap-0.5 !border !px-2 !py-0.5 !bg-primary !text-gray-900">
            <wd-icon name="location" class="text-xs" />
            <text class="flex-1 text-xs text-gray-900">定位</text>
          </uh-button>
        </view>
      </view>
    </view>
  </view>
</template>
