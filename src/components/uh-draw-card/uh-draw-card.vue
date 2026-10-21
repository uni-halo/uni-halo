<script lang="ts" setup>
/**
 * 画作卡片：封面图 + 标题 + 作者·日期，用于绘画作品列表
 */
import { computed } from 'vue'
import dayjs from 'dayjs'
import { checkThumbnailUrl } from '@/utils/url'
import { useWornSlots } from '@/hooks/useWornSlots'
import { useUserProfilePopup } from '@/hooks/useUserProfilePopup'
import type { IDraw } from '@/api/types/draw'

interface IProps {
  /** 画作数据 */
  draw: IDraw
}

const props = defineProps<IProps>()

const emit = defineEmits<{
  (e: 'tap'): void
}>()

const coverUrl = computed(() => checkThumbnailUrl(props.draw.spec.cover))
/** 竞猜作品未揭晓时隐藏标题，防止标题泄露谜底 */
const isPuzzle = computed(() => !!props.draw.spec.puzzleStatus)
const titleText = computed(() => {
  if (isPuzzle.value && props.draw.spec.puzzleStatus !== 'REVEALED') {
    return '作品标题已隐藏'
  }
  return props.draw.spec.title || '无题'
})
const puzzleLabel = computed(() =>
  props.draw.spec.puzzleStatus === 'REVEALED' ? '已揭晓' : '画谜')
const owner = computed(() => props.draw.owner)
const ownerText = computed(() => owner.value?.displayName || owner.value?.username || '佚名')
const ownerAvatar = computed(() => checkThumbnailUrl(owner.value?.avatar || ''))
const ownerFallbackText = computed(() => ownerText.value.slice(0, 1).toUpperCase())
/** 作者互动增强装饰槽位(作者缺失/插件未启用/审核模式/站点开关关闭时全 invisible,静默降级) */
const authorSlots = useWornSlots(() => owner.value?.username || props.draw.spec.ownerName || '')
const { openUserProfilePopup } = useUserProfilePopup()

/** 点击作者:打开用户资料卡(不开进详情;审核模式下 hook 内直接忽略) */
function handleToAuthorCard() {
  const username = owner.value?.username || props.draw.spec.ownerName || ''
  openUserProfilePopup({
    username,
    nickname: owner.value?.displayName,
    avatar: owner.value?.avatar,
  })
}
const dateText = computed(() => {
  const time = props.draw.metadata?.creationTimestamp
  return time ? dayjs(time).format('YYYY年MM月DD日') : ''
})
</script>

<template>
  <view
    class="uh-global-card-glass uh-shadow-xs box-border w-full overflow-hidden rounded-xl bg-white/80"
    @click="emit('tap')"
  >
    <view v-if="coverUrl" class="relative h-32 w-full overflow-hidden">
      <wd-img :src="coverUrl" mode="aspectFill" lazy-load custom-class="!block h-full w-full">
        <template #loading>
          <wd-loading size="64rpx" custom-class="text-primary" />
        </template>
      </wd-img>
      <view
        v-if="isPuzzle"
        class="uh-global-card-glass absolute right-0 top-0 box-border flex items-center gap-x-0.5 rounded-lb-lg px-2 py-0.5 !border !border-r-none !border-t-none !bg-secondary"
      >
        <text class="text-xs text-gray-900">{{ puzzleLabel }}</text>
      </view>
    </view>
    <view class="box-border flex flex-col gap-y-1.5 overflow-hidden px-3 py-2.5">
      <text class="w-full truncate text-xs text-gray-900">{{ titleText }}</text>
      <text class="text-xs text-gray-500">{{ dateText }}</text>
      <view class="flex items-center gap-x-1 text-3xs text-gray-400" @click.stop="handleToAuthorCard()">
        <view class="relative mr-1.5 shrink-0">
          <wd-avatar
            :src="ownerAvatar"
            :text="ownerFallbackText"
            shape="round"
            size="42rpx"
            custom-class="uh-global-card-glass !shadow-none !border"
            mode="aspectFill"
          />
          <image
            v-if="authorSlots.avatarFrame.visible" :src="authorSlots.avatarFrame.url"
            class="uh-frame-center pointer-events-none absolute left-1/2 top-1/2 h-7 w-7"
            mode="aspectFit"
          />
        </view>
        <text class="truncate text-3xs text-gray-400">{{ ownerText }}</text>
        <image
          v-if="authorSlots.primaryBadge.visible" :src="authorSlots.primaryBadge.url"
          class="h-4 w-4 shrink-0 !block" mode="aspectFit"
        />
      </view>
    </view>
  </view>
</template>

<style scoped>
/* -translate-* 工具类在端内不支持,头像框居中经此类实现 */
.uh-frame-center {
  transform: translate(-50%, -50%);
}
</style>
