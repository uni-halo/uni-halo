<script setup lang="ts">
import type { CustomTabBarItem } from './types'
import { getI18nText } from './i18n'
import { tabbarStore } from './store'

defineProps<{
  item: CustomTabBarItem
  index: number
  customClass?: string
}>()

function getImageByIndex(index: number, item: CustomTabBarItem) {
  if (!item.iconActive) {
    console.warn('image 模式下，需要配置 iconActive (高亮时的图片），否则无法切换高亮图片')
    return item.icon
  }
  return tabbarStore.curIdx === index ? item.iconActive : item.icon
}

function isActive(index: number) {
  return tabbarStore.curIdx === index
}
</script>

<template>
  <view class="box-border flex flex-col items-center justify-center overflow-hidden rounded-full px-3 py-0.5" :class="customClass">
    <template v-if="item.iconType === 'uiLib'">
      <!-- TODO: 以下内容请根据选择的UI库自行替换 -->
      <!-- 如：<wd-icon name="home" /> (https://wot-design-uni.cn/component/icon.html) -->
      <!-- 如：<uv-icon name="home" /> (https://www.uvui.cn/components/icon.html) -->
      <!-- 如：<sar-icon name="image" /> (https://sard.wzt.zone/sard-uniapp-docs/components/icon)(sar没有home图标^_^) -->
      <view class="text-primary">
        <wd-icon :name="item.icon" size="56rpx" />
      </view>
    </template>
    <template v-if="item.iconType === 'unocss' || item.iconType === 'iconfont'">
      <view class="flex-1 text-20px" :class="[item.icon]" />
    </template>
    <template v-if="item.iconType === 'image'">
      <image :src="getImageByIndex(index, item)" mode="scaleToFill" class="h-6 w-6 shrink-0" />
    </template>
    <view class="mt-1px shrink-0 text-10px">
      {{ getI18nText(item.text) }}
    </view>
    <!-- 角标显示 -->
    <view v-if="item.badge">
      <template v-if="item.badge === 'dot'">
        <view class="absolute right-0 h-2 w-2 rounded-full bg-red-400 -top-2" />
      </template>
      <template v-else>
        <view class="absolute z-20 box-border h-5 min-w-5 center rounded-full bg-red-400 px-1 text-center text-xs text-white -right-2 -top-2">
          {{ item.badge > 99 ? '99+' : item.badge }}
        </view>
      </template>
    </view>
  </view>
</template>
