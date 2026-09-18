<script lang="ts" setup>
/**
 * 笔记迷你卡片
 * 用于分类页 list-post 视图的笔记列表
 */
import { computed } from 'vue'
import dayjs from 'dayjs'
import { checkThumbnailUrl } from '@/utils/url'
import type { IPost } from '@/api/types/halo'

const props = defineProps<{
  article: IPost
}>()

const emit = defineEmits<{
  (e: 'on-click', article: IPost): void
}>()

const publishTimeText = computed(() => {
  const time = props.article.spec.publishTime
  return time ? dayjs(time).format('YYYY-MM-DD') : ''
})

const visitCount = computed(() => {
  return props.article.status?.stats?.visits ?? props.article.stats?.visit ?? 0
})

function handleClick() {
  emit('on-click', props.article)
}
</script>

<template>
  <view class="uh-article-min-card mx-6 mb-6 flex overflow-hidden rounded-xl bg-white p-2 shadow-sm" @click="handleClick">
    <view class="left">
      <image class="thumbnail" :src="checkThumbnailUrl(article.spec.cover)" mode="aspectFill" lazy-load />
    </view>
    <view class="right">
      <view class="title text-overflow">
        {{ article.spec.title }}
      </view>
      <view class="content text-overflow">
        {{ article.status?.excerpt }}
      </view>
      <view class="foot">
        <view class="create-time">
          <text class="time-label">发布时间：</text>
          {{ publishTimeText }}
        </view>
        <view class="visits">
          浏览
          <text class="number">{{ visitCount }}</text>
          次
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.uh-article-min-card {
  box-sizing: border-box;
  box-shadow: 0 2rpx 24rpx rgb(0 0 0 / 3%);

  .left {
    width: 180rpx;
    height: 130rpx;

    .thumbnail {
      width: 100%;
      height: 100%;
      border-radius: 12rpx;
    }
  }

  .right {
    width: 0;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    padding-left: 20rpx;

    .title {
      font-size: 28rpx;
      font-weight: 600;
      color: #303133;
    }

    .content {
      font-size: 26rpx;
      color: #909399;
      margin-top: 14rpx;
    }

    .foot {
      display: flex;
      font-size: 24rpx;
      justify-content: space-between;
      align-items: center;
      color: #909399;
      margin-top: 14rpx;

      .create-time {
        font-size: 24rpx;

        .time-label {
          display: none;
        }
      }

      .visits .number {
        padding: 0 6rpx;
        font-size: 24rpx;
      }
    }
  }
}
</style>
