<script lang="ts" setup>
/**
 * 分类小卡片(源自旧项目 components/category-mini-card,新建复刻)
 */
import { computed } from 'vue'
import { checkThumbnailUrl } from '@/utils/url'
import type { ICategory } from '@/api/types/halo'

const props = defineProps<{
  category: ICategory
}>()

const cover = computed(() => checkThumbnailUrl(props.category.spec.cover))
</script>

<template>
  <view class="uh-category-mini-card relative inline-block h-[180rpx] w-[260rpx] overflow-hidden rounded-xl text-center text-white">
    <image class="img" :src="cover" mode="aspectFill" lazy-load />
    <view class="content absolute inset-0 z-3 flex flex-col items-center justify-center">
      <view class="name text-[30rpx] font-bold">
        {{ category.spec.displayName }}
      </view>
      <text class="label mt-1 text-[24rpx]">共 {{ category.postCount ?? 0 }} 篇</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.uh-category-mini-card {
  background-color: #fff;
  box-shadow: 0 2rpx 24rpx rgb(0 0 0 / 3%);

  &::before {
    content: '';
    position: absolute;
    z-index: 1;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgb(0 0 0 / 25%);
    backdrop-filter: blur(3rpx);
  }

  .img {
    width: 100%;
    height: 100%;
  }

  .name {
    color: inherit;
  }
}
</style>
