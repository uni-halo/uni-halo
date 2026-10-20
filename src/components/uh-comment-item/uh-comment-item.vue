<script lang="ts" setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { checkAvatarUrl } from '@/utils/url'
import { getAvatarFallbackText } from '@/utils/avatar'
import { useUserProfilePopup } from '@/hooks/useUserProfilePopup'
import { useSettingStore } from '@/store/setting'
import { useAppConfigStore } from '@/store/appConfig'
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
const { commentWidgetConfig } = storeToRefs(useAppConfigStore())
const { openUserProfilePopup } = useUserProfilePopup()

function resolveAvatarUrlHash(url: string, comment: ICommentReply) {
  const hash = comment.spec.owner?.annotations?.['email-hash'] ?? Date.now().toString()
  return url.replace('{hash}', hash)
}

const avatar = computed(() => {
  const avatarConfig = commentWidgetConfig.value.avatar

  if (avatarConfig.enable) {
    // 所有头像
    if (avatarConfig.policy === 'allUser') {
      return resolveAvatarUrlHash(avatarConfig.providerMirror, props.comment)
    }
    // 匿名头像
    if (avatarConfig.policy === 'anonymousUser' && props.comment.owner.kind === 'Email') {
      return resolveAvatarUrlHash(avatarConfig.providerMirror, props.comment)
    }
    // 匿名且无头像
    if (avatarConfig.policy === 'noAvatarUser' && props.comment.owner.kind === 'Email' && !props.comment.owner.avatar) {
      return resolveAvatarUrlHash(avatarConfig.providerMirror, props.comment)
    }
  }

  // 默认头像
  return checkAvatarUrl(props.comment.owner.avatar)
})

/** 昵称首字(无头像/加载失败时 wd-avatar 回退占位) */
const avatarText = computed(() =>
  getAvatarFallbackText(props.comment.owner.displayName, '?'))

const avatarClass = computed(() => {
  if (settings.value.avatarShape === 'circle') {
    return '!rounded-full'
  }
  return '!rounded-xl'
})

/** 引用回复标识(被引用人在父级已加载回复映射中可查到时显示) */
const quoteReplyText = computed(() => {
  const quoteName = props.comment.spec.quoteReply
  if (!quoteName) { return '' }
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

/**
 * 头像/昵称点击：展示个人资料卡。
 * 注册用户（kind=User 且有 name）识别为常规模式（可查看主页）；
 * 其他一律匿名（guest）访客，附带可选主页网址 website，
 * 资料卡回落匿名模式（灰色「匿名用户」标牌 + 复制网址）。
 */
function handleOnUser() {
  // 由于目前评论功能未返回用户metadata.name，无法展示用户主页
  return
  const owner = props.comment.spec.owner
  // 头像复用条目自身解析结果（含头像策略/镜像头像服务回退；popup 内无头像再取首字）
  // 注：resolveAvatarUrlHash 依赖 avatarConfig.enable + policy 逻辑，已包含于 avatar computed
  if (owner.kind === 'User' && owner.name) {
    openUserProfilePopup({
      username: owner.name,
      nickname: owner.displayName,
      avatar: avatar.value,
    })
    return
  }
  openUserProfilePopup({
    anonymous: true,
    nickname: owner.displayName,
    avatar: avatar.value,
    website: owner.website || '',
  })
}
</script>

<template>
  <view
    v-if="comment" class="box-border flex pt-4" :class="{
      'pl-10': props.isChild,
    }"
  >
    <view class="flex shrink-0" @click="handleOnUser()">
      <wd-avatar
        :src="avatar" :text="avatarText" :shape="settings.avatarShape === 'circle' ? 'round' : 'square'"
        custom-class="uh-global-card-glass uh-shadow-xs !bg-[#bbe52a6b] !h-10 !w-10 !text-sm !font-bold !text-gray-900"
        :class="avatarClass" mode="aspectFill"
      />
    </view>
    <view class="box-border flex-1 pl-2">
      <view class="text-sm text-gray-500">
        <text class="text-grey text-xs" @click="handleOnUser()">{{ comment.spec.owner.displayName }}</text>
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
