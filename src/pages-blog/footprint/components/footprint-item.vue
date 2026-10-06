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
  (e: 'open'): void
  (e: 'locate', footprint: IFootprint): void
}>()

const spec = computed(() => props.footprint?.spec)
const image = computed(() => checkImageUrl(spec.value?.image))
const dateText = computed(() => (spec.value?.createTime ? formatTime({ d: spec.value.createTime, f: 'yyyy/MM/dd' }) : ''))
const imageError = ref(false)

/** 定位：仅让地图聚焦该点，不开详情 */
function handleLocate() {
  if (props.footprint) {
    emit('locate', props.footprint)
  }
}
</script>

<template>
  <view
    class="uh-global-card-glass relative overflow-hidden border rounded-xl !shadow-none"
    @click="emit('open')"
  >
    <!-- <view class="absolute right-0 top-0 flex items-center gap-2">
      <text
        v-if="spec?.footprintType"
        class="shrink-0 rounded-bl-lg bg-primary px-2 py-0.5 text-xs text-gray-900"
      >
        {{ spec.footprintType }}
      </text>
    </view> -->
    <image
      v-if="image && !imageError"
      :src="image"
      class="absolute z-0 block h-full w-full"
      mode="aspectFill"
      lazy-load
    />
    <view class="uh-filter-blur-xs relative z-10 box-border w-full flex items-center gap-3 bg-black/50 p-3">
      <view class="uh-global-card-glass h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white !border !shadow-none">
        <image
          v-if="image && !imageError"
          :src="image"
          class="block h-full w-full"
          mode="aspectFill"
          lazy-load
          @error="imageError = true"
        />
        <view v-else class="h-full w-full flex items-center justify-center text-gray-500">
          <wd-icon name="image" size="52rpx" />
        </view>
      </view>
      <view class="min-w-0 flex flex-1 flex-col gap-1">
        <view class="flex flex-1 items-center gap-x-1">
          <text
            v-if="spec?.footprintType"
            class="shrink-0 rounded-md bg-secondary px-1.5 py-0.5 text-xs text-gray-900 font-normal"
          >
            {{ spec.footprintType }}
          </text>
          <text class="truncate text-sm text-white font-bold">{{ spec?.name }}</text>
        </view>
        <view v-if="spec?.address" class="flex items-center gap-1">
          <wd-icon name="location" size="24rpx" class="shrink-0 text-gray-100" />
          <text class="flex-1 truncate text-xs text-gray-100">{{ spec.address }}</text>
        </view>
        <view class="flex items-center justify-between">
          <view v-if="dateText" class="flex flex-1 items-center gap-1">
            <wd-icon name="clock-circle" size="24rpx" class="shrink-0 text-gray-100" />
            <text class="flex-1 text-xs text-gray-100">{{ dateText }}</text>
          </view>
          <view class="flex shrink-0 items-end gap-1.5">
            <view
              class="uh-global-card-glass uh-shadow-xs box-border flex items-center justify-center gap-0.5 text-xs !border !rounded-full !bg-primary !px-2 !py-0.5 !text-gray-900"
              @click.stop="emit('open')"
            >
              <text class="flex-1 text-xs text-gray-900">详情</text>
            </view>
            <view
              class="uh-global-card-glass uh-shadow-xs box-border flex items-center justify-center gap-0.5 text-xs !border !rounded-full !bg-primary !px-2 !py-0.5 !text-gray-900"
              @click.stop="handleLocate"
            >
              <text class="flex-1 text-xs text-gray-900">定位</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.uh-filter-blur-xs {
  backdrop-filter: blur(4rpx);
}
</style>
