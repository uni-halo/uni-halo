<script lang="ts" setup>
/**
 * 画作详情弹窗（普通作品）：封面预览 + 标题/简介 + 作者/日期。
 * 从 draw-list 页面抽离，与竞猜弹窗（uh-draw-guess-popup）平级复用。
 */
import { computed, ref, watch } from 'vue'
import { checkThumbnailUrl } from '@/utils/url'
import { formatTime } from '@/utils/formatTime'
import type { IDraw } from '@/api/types/draw'

const props = defineProps<{
  /** 画作数据（公开数据，不含谜底） */
  draw: IDraw | null
}>()

const visible = defineModel<boolean>({ default: false })

const ownerAvatar = computed(() => checkThumbnailUrl(props.draw?.owner?.avatar || ''))
const ownerText = computed(() =>
  props.draw?.owner?.displayName || props.draw?.owner?.username || '佚名')
const ownerInitial = computed(() => ownerText.value.slice(0, 1).toUpperCase())
const cover = ref('')

watch(() => [visible.value, props.draw], ([value]) => {
  if (value && props.draw) {
    cover.value = props.draw.spec.cover || ''
  }
})

function handlePreviewCover() {
  if (!cover.value) { return }
  uni.previewImage({ urls: [cover.value] })
}

function handleToDetailPage(draw: IDraw) {
  uni.navigateTo({
    url: `/pages-blog/draw-detail/draw-detail?name=${draw.metadata.name}`,
    success: () => {
      visible.value = false
    },
  })
}
</script>

<template>
  <uh-glass-popup
    v-model="visible" position="bottom" custom-class="rounded-2xl" :z-index="110"
    @close="visible = false"
  >
    <view v-if="draw" class="box-border flex flex-col gap-y-3 p-3">
      <!-- 顶部 -->
      <view class="relative box-border w-full flex items-center justify-center">
        <view class="flex gap-y-1">
          <text class="text-md font-bold">作品详情</text>
        </view>
        <view
          class="uh-global-card-glass absolute right-0 top-0 h-6 w-6 flex items-center justify-center border rounded-lg shadow-none"
          @click="visible = false"
        >
          <wd-icon name="close" size="28rpx" class="text-gray-500" />
        </view>
      </view>
      <view
        class="uh-global-card-glass h-64 flex items-center justify-center overflow-hidden rounded-xl !border !shadow-none"
      >
        <wd-img :src="cover" mode="widthFix" class="w-full" @click="handlePreviewCover">
          <template #loading>
            <wd-loading size="64rpx" custom-class="text-primary" />
          </template>
        </wd-img>
      </view>
      <view class="flex flex-col gap-y-1.5">
        <text class="text-sm text-gray-900 font-medium">{{ draw.spec.title || '无题' }}</text>
        <text v-if="draw.spec.description" class="text-xs text-gray-500 leading-relaxed">
          {{ draw.spec.description }}
        </text>
        <view class="flex items-center justify-between text-xs text-gray-400">
          <view class="w-full flex items-center gap-x-1">
            <text class="text-xs text-gray-500">作者：</text>
            <wd-avatar
              :src="ownerAvatar"
              :text="ownerInitial"
              shape="round" size="42rpx"
              custom-class="uh-global-card-glass !shadow-none !border" mode="aspectFill"
            />
            <text>{{ ownerText }}</text>
          </view>
          <text class="shrink-0">
            {{ formatTime({ d: draw.metadata.creationTimestamp, f: 'yyyy年MM月dd日' }) }}
          </text>
        </view>
      </view>
      <!-- #ifdef MP -->
      <view class="w-full flex items-center">
        <uh-button
          class="w-full flex-1"
          custom-class="uh-global-card-glass !border !shadow-none !text-3xs !rounded-xl !bg-primary !py-2.5 !text-gray-900"
          @action-click="handleToDetailPage(draw)"
        >
          去分享
        </uh-button>
      </view>
      <!-- #endif -->
    </view>
  </uh-glass-popup>
</template>
