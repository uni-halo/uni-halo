<script lang="ts" setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { checkAvatarUrl } from '@/utils/url'
import { getAvatarFallbackText } from '@/utils/avatar'
import { useSettingStore } from '@/store/setting'
import type { ICommentReply } from '@/api/types/halo'

const props = withDefaults(defineProps<{
  comment: ICommentReply
  isChild?: boolean
  useActions?: boolean
  useSolid?: boolean
  useContentBg?: boolean
  allowComment?: boolean
  postName?: string
  classItem?: string[]
  /** 回复引用名映射(quoteReply name -> 被引用人 displayName),命中时显示「回复 @xxx」 */
  quoteReplyMap?: Record<string, string>
}>(), {
  isChild: false,
  useActions: true,
  useSolid: true,
  useContentBg: true,
  allowComment: false,
  postName: '',
  classItem: () => [],
  quoteReplyMap: () => ({}),
})
const emit = defineEmits<{
  (e: 'on-comment', data: { type: string, comment: ICommentReply }): void
  (e: 'on-copy', raw: string): void
  (e: 'on-detail', comment: ICommentReply): void
}>()
dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const { settings } = storeToRefs(useSettingStore())

const avatar = computed(() => checkAvatarUrl(props.comment.spec.owner.avatar))

/** 昵称首字(无头像/加载失败时 wd-avatar 回退占位) */
const avatarText = computed(() =>
  getAvatarFallbackText(props.comment.spec.owner.displayName, '?'))

const avatarClass = computed(() => {
  if (settings.value.avatarShape === 'circle') {
    return '!rounded-full'
  }
  return '!rounded-xl'
})

/** 引用回复标识(被引用人在父级已加载回复映射中可查到时显示) */
const quoteReplyText = computed(() => {
  const quoteName = props.comment.spec.quoteReply
  if (!quoteName)
    return ''
  const displayName = props.quoteReplyMap[quoteName]
  return displayName ? `回复 @${displayName}` : ''
})

/** 评论时间 */
const createTimeText = computed(() => {
  const time = props.comment.spec.creationTime
  return time ? dayjs(time).format('YYYY年MM月DD日') : ''
})

const createTimeAgo = computed(() => {
  const time = props.comment.spec.creationTime
  return time ? `${dayjs(time).fromNow(true)}前` : ''
})

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
    v-if="comment" class="box-border flex pt-4" :class="{
      'pl-10': props.isChild,
    }"
  >
    <view class="flex shrink-0">
      <wd-avatar
        :src="avatar"
        :text="avatarText"
        :shape="settings.avatarShape === 'circle' ? 'round' : 'square'"
        custom-class="uh-global-card-glass uh-shadow-xs !bg-[#bbe52a6b] !h-10 !w-10 !text-sm !font-bold !text-gray-900"
        :class="avatarClass"
        mode="aspectFill"
      />
    </view>
    <view class="box-border flex-1 pl-2">
      <view class="text-sm text-gray-500">
        <text class="text-grey text-xs">{{ comment.spec.owner.displayName }}</text>
      </view>
      <view v-if="quoteReplyText" class="mt-1 text-xs text-gray-400">
        {{ quoteReplyText }}
      </view>
      <rich-text
        class="mt-0.5 box-border text-3xs text-gray-900 leading-5" :nodes="comment.spec.raw"
        @click="handleOnDetail"
      />
      <view class="mt-2 flex items-center gap-x-4">
        <text class="text-xs text-gray-600">{{ createTimeText }}</text>
        <view v-if="useActions" class="actions flex gap-2">
          <view v-if="props.allowComment" class="text-xs font-medium" @click="handleOnReply">
            回复
          </view>
          <view class="text-xs font-medium" @click="handleOnCopy">
            复制
          </view>
        </view>
      </view>
    </view>
  </view>
</template>
