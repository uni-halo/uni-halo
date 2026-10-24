<script lang="ts" setup>
/**
 * 用户信息卡片（详情页内嵌使用）
 *
 * 数据优先级：互动增强 identity > 插件端公开资料 > username 兜底，均静默降级；
 * 增强展示：名片背景封面/头像框/主勋章/称号/昵称样式/身份标牌。
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUserIdentity } from '@/hooks/useUserIdentity'
import { useCardBgSrc } from '@/hooks/useWornSlots'
import { buildWornSlots, identityMarksStyleCss, nameStyleCssOf } from '@/utils/wornDecorations'
import { checkAvatarUrl } from '@/utils/url'
import { useSettingStore } from '@/store/setting'

import { getAvatarFallbackText } from '@/utils/avatar'
import { useUserProfilePopup } from '@/hooks/useUserProfilePopup'
import type { IIdentityMark } from '@/api/types/halo-plugin-third/interaction-plus'

interface IProps {
  // 用户名
  username: string
  // 是否可以打开用户主页
  canOpenUserProfile?: boolean
  // 审核模式下需要隐藏一些内容
  auditMode?: boolean
}

const props = withDefaults(defineProps<IProps>(), {
  auditMode: false,
  canOpenUserProfile: true,
})

const { settings } = storeToRefs(useSettingStore())

const { openUserProfilePopup } = useUserProfilePopup()

/** 用户资料与互动增强信息（插件未启用/审核模式/站点开关关闭时增强数据静默降级为空） */
const { identity, profile, identityPlusAvailable } = useUserIdentity(() => props.username)

const slots = computed(() => buildWornSlots(identity.value))
const nameStyleCss = computed(() => nameStyleCssOf(identity.value))
/** 名片背景（素材缺失/装载失败回退博主页背景图，连兜底未配置则为空串不渲染） */
const { cardBgSrc, onCardBgError } = useCardBgSrc(() => slots.value.cardBackground.url)

/** 头部资料（优先级：互动增强 identity > 插件端 profile > username 兜底） */
const headerUser = computed(() => ({
  nickname: identity.value?.displayName || profile.value?.displayName || props.username,
  avatar: identity.value?.avatar || profile.value?.avatar || '',
  bio: props.auditMode
    ? ''
    : identity.value?.bio || profile.value?.bio || '这个人很懒，什么都没有留下~',
}))

/** 身份标牌（文字牌/图标/图片三形态，最多 3 个；identity 为空自然隐藏） */
const markChips = computed(() => {
  const marks = (identity.value?.identityMarks || []).slice(0, 3) as IIdentityMark[]
  return marks
    .filter(mark => !!mark?.displayName)
    .map(mark => ({
      displayName: mark.displayName,
      icon: /\/|data:/.test(mark.icon || '') ? mark.icon : '',
      style: identityMarksStyleCss(mark),
    }))
})

const avatarShape = computed(() => (settings.value.avatarShape === 'circle' ? 'round' : 'square') as 'round' | 'square')

const avatarClass = computed(() => {
  if (settings.value.avatarShape === 'circle') {
    return '!rounded-full'
  }
  return '!rounded-lg'
})

/** 跳转用户主页 */
function handleToUserProfile() {
  if (!props.canOpenUserProfile) {
    return
  }
  openUserProfilePopup({
    username: props.username,
    nickname: headerUser.value.nickname,
    avatar: headerUser.value.avatar,
  })
}
</script>

<template>
  <view
    v-if="!props.auditMode && identityPlusAvailable"
    class="uh-global-card-glass uh-shadow-xs relative box-border box-border w-full cursor-pointer overflow-hidden rounded-2xl !border"
    @click="handleToUserProfile()"
  >
    <image
      v-if="cardBgSrc" class="absolute inset-0 z-0 h-full w-full bg-cover bg-center !block" :src="cardBgSrc"
      mode="aspectFill" @error="onCardBgError()"
    />
    <view class="absolute inset-0 z-1 from-black/5 to-black/0 bg-gradient-to-r opacity-60" style="backdrop-filter: blur(4rpx);" />
    <view
      class="relative z-2 box-border h-full w-full flex items-center gap-x-3 p-3"
    >
      <!-- 头像 -->
      <view class="relative shrink-0">
        <wd-avatar
          :src="checkAvatarUrl(headerUser.avatar)"
          :text="getAvatarFallbackText(headerUser.nickname || username)" shape="round"
          custom-class="uh-global-card-glass uh-shadow-xs !h-17 !w-17  !text-gray-900 !font-bold"
          class="!border-2 !border-white/60 !rounded-full" mode="aspectFill"
        />
        <!-- 头像框 -->
        <image
          v-if="slots.avatarFrame.visible"
          class="pointer-events-none absolute left-1/2 top-1/2 z-20 h-22 w-22 !block"
          :src="slots.avatarFrame.url" mode="aspectFit" style="transform:translate(-50%,-50%)"
        />
      </view>

      <view class="flex flex-1 flex-col gap-y-1.5">
        <!-- 昵称 + 主勋章排 -->
        <view class="flex items-center gap-x-1.5">
          <text
            class="truncate text-[30rpx] text-white font-black leading-5 text-shadow-[0_2rpx_8rpx_rgba(255,255,255,0.4)] drop-shadow"
            :style="[nameStyleCss]"
          >
            {{ headerUser.nickname || '匿名用户' }}
          </text>
          <image
            v-if="slots.primaryBadge.visible" :src="slots.primaryBadge.url"
            class="h-5 w-5 shrink-0 !block" mode="aspectFit"
          />
        </view>
        <!-- 称号 + 身份标识 -->
        <view
          v-if="slots.title.visible || markChips.length"
          class="flex flex-wrap items-center gap-x-1.5 gap-y-1"
        >
          <text
            v-if="slots.title.visible"
            class="box-border max-w-full truncate rounded-full px-2 py-0.5 text-xs"
            :style="slots.title.style"
          >
            {{ slots.title.text }}
          </text>
          <template v-for="(mark, i) in markChips" :key="i">
            <image v-if="mark.icon" :src="mark.icon" class="h-4 w-4" mode="aspectFit" />
            <text
              v-else
              class="box-border max-w-fit truncate border rounded-full border-solid px-1.5 py-0.5 text-xs"
              :style="mark.style"
            >
              {{ mark.displayName }}
            </text>
          </template>
        </view>
        <!-- 简介 -->
        <text
          v-if="headerUser.bio"
          class="text-xs text-gray-100 leading-5"
          :class="[slots.title.visible || markChips.length ? 'line-clamp-1' : 'slots.title.visible || markChips.length']"
        >
          {{ headerUser.bio }}
        </text>
      </view>
    </view>
  </view>
  <!-- 作者信息 -->
  <view
    v-else class="uh-global-card-glass uh-shadow-xs box-border flex cursor-pointer items-center gap-x-2 rounded-xl px-3 py-2.5"
    @click="handleToUserProfile()"
  >
    <view class="relative flex flex-1 items-center gap-x-2">
      <wd-avatar
        :src="checkAvatarUrl(headerUser.avatar)"
        :text="getAvatarFallbackText(headerUser.nickname)"
        :shape="avatarShape" custom-class="uh-global-card-glass !h-10 !w-10 !text-xs !leading-none !text-gray-900 shrink-0"
        :class="avatarClass" mode="aspectFill"
      />
      <view class="flex flex-1 flex-col justify-center gap-y-0.5 overflow-hidden">
        <text class="truncate text-sm text-gray-900 font-semibold">
          {{ headerUser.nickname || '匿名用户' }}
        </text>
        <text class="line-clamp-1 text-xs text-gray-500">{{ headerUser.bio || '该用户很懒，没有留下简介~' }}</text>
      </view>
    </view>

    <view v-if="!props.auditMode" class="shrink-0 text-gray-400">
      <wd-icon name="right" />
    </view>
  </view>
</template>
