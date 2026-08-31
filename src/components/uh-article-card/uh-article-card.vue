<script lang="ts" setup>
/**
 * 文章卡片(源自旧项目 components/article-card,新建复刻)
 * 支持布局:左图右文(lr_image_text)/左文右图(lr_text_image)/上图下文(tb_image_text)/上文下图(tb_text_image)/仅文字(only_text)
 */
import { computed } from 'vue'
import dayjs from 'dayjs'
import { checkThumbnailUrl } from '@/utils/url'
import { useSettingStore } from '@/store/setting'
import type { IPost } from '@/api/types/halo'

const props = withDefaults(defineProps<{
  /** 来源页面(home 时跟随首页布局) */
  from?: string
  article: IPost
}>(), {
  from: '',
})

const emit = defineEmits<{
  (e: 'on-click', article: IPost): void
}>()

const settingStore = useSettingStore()

/** 卡片布局 class(由全局设置 layout 决定) */
const cardType = computed(() => {
  const layout = settingStore.settings.layout
  // 首页双列时强制上图下文布局,除非显式指定其他
  if (props.from === 'home' && layout.home === 'h_row_col2') {
    if (!['tb_image_text', 'tb_text_image', 'only_text'].includes(layout.cardType)) {
      return [props.from, layout.home, 'tb_image_text']
    }
    return [props.from, layout.home, layout.cardType]
  }
  return [layout.home, layout.cardType]
})

/** 发布时间格式化 yyyy-MM-dd */
const publishTimeText = computed(() => {
  const time = props.article.spec.publishTime
  return time ? dayjs(time).format('YYYY-MM-DD') : ''
})

/** 阅读数(兼容 status.stats.visits 与旧版顶层 stats.visit) */
const visitCount = computed(() => {
  return props.article.status?.stats?.visits ?? props.article.stats?.visit ?? 0
})

function handleClick() {
  emit('on-click', props.article)
}
</script>

<template>
  <view class="uh-article-card mb-3 flex overflow-hidden rounded-xl bg-white p-2.5 shadow-sm" :class="cardType" @click="handleClick">
    <view class="left">
      <image class="thumbnail" :src="checkThumbnailUrl(article.spec.cover)" mode="aspectFill" lazy-load />
    </view>
    <view class="right">
      <view class="title">
        <text v-if="article.spec.pinned" class="is-top">置顶</text>
        <text class="title-text text-overflow">{{ article.spec.title }}</text>
      </view>
      <view class="content text-overflow-2">
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
.uh-article-card {
  box-sizing: border-box;
  margin: 0 24rpx;

  &.h_row_col1 {
    align-items: center;
  }

  &.home.h_row_col2 {
    margin: 12rpx;

    .left {
      width: 100%;
      height: 200rpx;

      .thumbnail :deep(uni-image) {
        border-radius: 6rpx 6rpx 0 0 !important;
      }
    }

    .right {
      .title {
        display: flex;
        align-items: center;
        font-size: 26rpx;
        font-weight: bold;

        .is-top {
          height: 36rpx;
          margin-right: 10rpx;
          line-height: 36rpx;
          transform: scale(0.9);
        }
      }

      .foot {
        justify-content: space-between;

        .create-time {
          font-size: 24rpx;

          .time-label {
            display: none;
          }
        }

        .visits {
          font-size: 24rpx;
          margin-left: 0;
        }
      }
    }

    &.tb_text_image {
      padding: 12rpx;

      .left .thumbnail :deep(uni-image) {
        border-radius: 6rpx !important;
      }
    }

    &.only_text {
      padding: 24rpx;

      .right .foot {
        .create-time .time-label {
          display: none;
        }

        .visits {
          font-size: 24rpx;
        }
      }
    }
  }

  &.lr_text_image {
    .left {
      order: 2;
      padding-left: 30rpx;
    }

    .right {
      order: 1;
      padding-left: 0;
    }
  }

  &.tb_image_text {
    flex-direction: column;
    padding: 24rpx;

    .left {
      width: 100%;
      height: 340rpx;

      .thumbnail :deep(uni-image) {
        border-radius: 6rpx 6rpx 0 0 !important;
      }
    }

    .right {
      padding-left: 0;
      padding: 24rpx 0 0;
      width: 100%;

      .foot {
        justify-content: flex-start;

        .create-time .time-label {
          display: inline-block;
        }

        .visits {
          margin-left: 24rpx;
        }
      }
    }
  }

  &.tb_text_image {
    flex-direction: column;

    .left {
      width: 100%;
      height: 340rpx;
      order: 2;
      margin-top: 24rpx;
    }

    .right {
      padding-left: 0;
      width: 100%;
      order: 1;

      .foot {
        justify-content: flex-start;

        .create-time .time-label {
          display: inline-block;
        }

        .visits {
          margin-left: 24rpx;
        }
      }
    }
  }

  &.only_text {
    padding: 36rpx;

    .left {
      display: none;
    }

    .right {
      padding-left: 0;

      .content {
        margin-top: 24rpx;
      }

      .foot {
        justify-content: flex-start;
        margin-top: 24rpx;

        .create-time .time-label {
          display: inline-block;
        }

        .visits {
          margin-left: 24rpx;
        }
      }
    }
  }

  .left {
    width: 240rpx;
    height: 180rpx;

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
    padding-left: 30rpx;
    box-sizing: border-box;

    .title {
      display: flex;
      align-items: center;
      font-size: 30rpx;

      .is-top {
        height: 40rpx;
        padding: 0 12rpx;
        margin-right: 10rpx;
        line-height: 40rpx;
        font-size: 24rpx;
        white-space: nowrap;
        vertical-align: 4rpx;
        color: #fff;
        background-color: rgba(33, 150, 243, 1);
        border-radius: 6rpx 12rpx;
      }

      &-text {
        color: #303133;
      }
    }

    .content {
      display: -webkit-box;
      font-size: 26rpx;
      color: #909399;
      height: 80rpx;
      margin-top: 14rpx;
      line-height: 42rpx;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .foot {
      display: flex;
      font-size: 24rpx;
      justify-content: space-between;
      align-items: center;
      color: #909399;
      margin-top: 18rpx;

      .create-time {
        font-size: 26rpx;

        .time-label {
          display: none;
        }
      }

      .visits .number {
        padding: 0 6rpx;
        font-size: 26rpx;
      }
    }
  }
}
</style>
