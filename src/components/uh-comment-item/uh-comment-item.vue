<script lang="ts" setup>
/**
 * 评论条目(源自旧项目 components/comment-item,新建复刻)
 */
import { computed } from 'vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { checkAvatarUrl } from '@/utils/url'
import { useSettingStore } from '@/store/setting'
import type { IComment } from '@/api/types/halo'

const props = withDefaults(defineProps<{
  comment: IComment
  isChild?: boolean
  useActions?: boolean
  useSolid?: boolean
  useContentBg?: boolean
  disallowComment?: boolean
  postName?: string
  classItem?: string[]
}>(), {
  isChild: false,
  useActions: true,
  useSolid: true,
  useContentBg: true,
  disallowComment: false,
  postName: '',
  classItem: () => [],
})
const emit = defineEmits<{
  (e: 'on-comment', data: { type: string, comment: IComment }): void
  (e: 'on-copy', raw: string): void
  (e: 'on-detail', comment: IComment): void
}>()
dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const settingStore = useSettingStore()
const globalAppSettings = computed(() => settingStore.settings)

const avatar = computed(() => checkAvatarUrl(props.comment.spec.owner.avatar))

/** 评论时间 */
const createTimeText = computed(() => {
  const time = props.comment.spec.creationTime
  return time ? dayjs(time).format('YYYY年MM月DD日') : ''
})

const createTimeAgo = computed(() => {
  const time = props.comment.spec.creationTime
  return time ? `${dayjs(time).fromNow(true)}前` : ''
})

function handleOnImageError() {
  // 头像加载失败时回退默认头像(由 checkAvatarUrl 兜底,此处保持简单)
}

function handleOnCopy() {
  emit('on-copy', props.comment.spec.raw)
}

function handleOnReply() {
  emit('on-comment', { type: 'user', comment: props.comment })
}

function handleOnDetail() {
  emit('on-detail', props.comment)
}
</script>

<template>
  <view
    v-if="comment"
    class="comment-item mt-7 box-border flex flex-col pt-6"
    :class="{ 'child-comment-item': isChild, 'no-solid': !useSolid, ...classItem }"
  >
    <view class="comment-item-user flex items-center">
      <image
        class="user-avatar box-border h-[70rpx] w-[70rpx] shrink-0 border-4 border-white shadow-sm"
        :class="{ 'is-radius': globalAppSettings.isAvatarRadius }"
        :src="avatar"
        mode="aspectFill"
        @error="handleOnImageError"
      />
      <view class="user-info w-0 flex-1 pl-7">
        <view class="author text-[26rpx] text-[#606266]">
          <text class="text-grey text-size-m">{{ comment.spec.owner.displayName }}</text>
        </view>
        <view class="mt-1 flex">
          <view class="time text-grey text-[22rpx] text-[#999]">
            <text>{{ createTimeText }}</text>
            <text class="ml-3">{{ createTimeAgo }}</text>
          </view>
        </view>
      </view>
      <view v-if="useActions" class="actions flex gap-4">
        <view v-if="!disallowComment" class="action-btn px-1 py-0.5 text-[24rpx] text-blue" @click="handleOnReply">
          回复
        </view>
        <view class="action-btn text-grey px-1 py-0.5 text-[24rpx]" @click="handleOnCopy">
          复制
        </view>
      </view>
    </view>

    <view
      class="comment-item-content ml-[98rpx] mt-3 box-border text-[28rpx] text-[#303133] leading-[1.8]"
      :class="{ 'has-bg': useContentBg, 'not-ml': isChild }"
      @click="handleOnDetail"
      v-html="comment.spec.raw"
    />
  </view>
</template>

<style scoped lang="scss">
.comment-item {
  border-top: 2rpx solid #f5f5f5;

  &.child-comment-item {
    padding-top: 0;
    margin-left: 80rpx;
    border: 0;
  }

  &.no-solid {
    border: 0;
    margin-top: 0 !important;
  }

  .comment-item-user {
    .user-avatar {
      border-radius: 12rpx;

      &.is-radius {
        border-radius: 50%;
      }
    }

    .user-info {
      .time {
        margin-top: 8rpx;
      }
    }
  }

  .comment-item-content {
    &.has-bg {
      background-color: #fafafa;
      padding: 6rpx 24rpx;
    }

    &.not-ml {
      margin-left: 98rpx;
    }
  }
}
</style>
