<script lang="ts" setup>
/**
 * 用户资料卡弹窗（全局组件，挂载于 App.ku.vue）
 *
 * 经 useUserProfilePopup().openUserProfilePopup({ username, nickname?, avatar? }) 唤起：
 * - 完整用户信息：昵称（互动增强昵称样式）/简介/加入时间/笔记·评论统计/身份标牌
 * - 增强展示：名片背景（卡片顶部素材带）/头像框/主勋章/称号
 * - 底部「查看主页」跳转个人主页；审核模式下 openUserProfilePopup 直接忽略
 * - 数据优先级：互动增强 identity > 插件端公开资料 > 入参兜底；均走静默降级
 */
import { computed } from 'vue'
import { useUserProfilePopup } from '@/hooks/useUserProfilePopup'
import { useUserIdentity } from '@/hooks/useUserIdentity'
import { buildWornSlots, nameStyleCssOf } from '@/utils/wornDecorations'
import { checkAvatarUrl } from '@/utils/url'
import { getAvatarFallbackText } from '@/utils/avatar'
import { formatTime } from '@/utils/formatTime'
import type { IIdentityMark } from '@/api/types/halo-plugin-third/interaction-plus'

const { userProfilePopupVisible, payload, closeUserProfilePopup } = useUserProfilePopup()
const { identity, profile, decorationWall } = useUserIdentity(() => payload.value.username)

const slots = computed(() => buildWornSlots(identity.value))
const nameStyleCss = computed(() => nameStyleCssOf(identity.value))

/** 头部资料（优先级：互动增强 identity > 插件端 profile > 入参兜底） */
const headerUser = computed(() => ({
  nickname: identity.value?.displayName
    || profile.value?.displayName
    || payload.value.nickname
    || payload.value.username,
  avatar: identity.value?.avatar
    || profile.value?.avatar
    || payload.value.avatar
    || '',
  bio: identity.value?.bio || profile.value?.bio || '这个人很懒，什么都没有留下~',
}))

const joinedAt = computed(() => identity.value?.registeredAt || profile.value?.registeredAt || '')
const joinedText = computed(() =>
  joinedAt.value ? formatTime({ d: joinedAt.value, f: 'yyyy/MM/dd' }) : '')

/** 互动统计（identity 下发才展示；null 表示不公开） */
const statsPosts = computed(() => identity.value?.stats?.posts)
const statsComments = computed(() => identity.value?.stats?.comments)

/** 身份标牌（文字牌/图标/图片三形态，最多 3 个） */
const markChips = computed(() => {
  const marks = (identity.value?.identityMarks || []).slice(0, 3) as IIdentityMark[]
  return marks
    .filter(mark => !!mark?.displayName)
    .map(mark => ({
      displayName: mark.displayName,
      icon: /\/|data:/.test(mark.icon || '') ? mark.icon : '',
      style: mark.color ? `background:${mark.color};` : 'background:rgb(0 0 0 / 0.35);',
    }))
})

function handleToProfile() {
  const username = payload.value.username
  closeUserProfilePopup()
  if (!username) { return }
  uni.navigateTo({
    url: `/pages-blog/user-profile/user-profile?username=${encodeURIComponent(username)}`,
    animationType: 'slide-in-right',
  })
}
</script>

<template>
  <uh-glass-popup
    v-model="userProfilePopupVisible" position="bottom" custom-class="rounded-2xl" :z-index="130"
    @close="closeUserProfilePopup()"
  >
    <view v-if="payload.username" class="flex flex-col">
      <scroll-view :scroll-y="true" :show-scrollbar="false" class="max-h-[70vh] w-full">
        <!-- 用户卡片(垂直居中布局 + 名片背景顶部素材带) -->
        <view class="uh-global-card-glass relative box-border w-full overflow-hidden rounded-2xl">
          <image
            v-if="slots.cardBackground.visible" :src="slots.cardBackground.url"
            class="pointer-events-none absolute left-0 top-0 h-28 w-full opacity-70" mode="aspectFill"
          />
          <view class="relative box-border flex flex-col items-center gap-y-2 px-4 pb-4 pt-5">
            <view class="relative shrink-0">
              <wd-avatar
                :src="checkAvatarUrl(headerUser.avatar)"
                :text="getAvatarFallbackText(headerUser.nickname || payload.username)"
                shape="round"
                custom-class="uh-global-card-glass uh-shadow-xs !h-16 !w-16 !border-2 !border-white/40 !text-gray-900 !font-bold"
                mode="aspectFill"
              />
              <image
                v-if="slots.avatarFrame.visible" :src="slots.avatarFrame.url"
                class="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2"
                mode="aspectFit"
              />
            </view>
            <view class="flex items-center gap-x-1">
              <text class="truncate text-sm text-gray-900 font-black" :style="nameStyleCss">
                {{ headerUser.nickname || payload.username }}
              </text>
              <image
                v-if="slots.primaryBadge.visible" :src="slots.primaryBadge.url"
                class="h-4 w-4 shrink-0" mode="aspectFit"
              />
            </view>
            <text class="line-clamp-2 text-center text-xs text-gray-500">{{ headerUser.bio }}</text>
            <text
              v-if="slots.title.visible"
              class="box-border truncate rounded-full px-2 py-0.5 text-xs"
              :style="slots.title.style"
            >
              {{ slots.title.text }}
            </text>
            <view v-if="markChips.length" class="flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
              <template v-for="(mark, i) in markChips" :key="i">
                <image v-if="mark.icon" :src="mark.icon" class="h-4 w-4" mode="aspectFit" />
                <text v-else class="box-border truncate rounded-full px-1.5 py-0.5 text-3xs text-white" :style="mark.style">
                  {{ mark.displayName }}
                </text>
              </template>
            </view>
            <view v-if="joinedText || statsPosts !== undefined || statsComments !== undefined" class="flex items-center gap-x-2 text-3xs text-gray-400">
              <text v-if="joinedText">加入 {{ joinedText }}</text>
              <text v-if="statsPosts !== undefined">笔记 {{ statsPosts }}</text>
              <text v-if="statsComments !== undefined">评论 {{ statsComments }}</text>
            </view>
          </view>

          <!-- 装扮墙(用户公开的全部装饰,稀有度着色;关闭公开时接口返回空) -->
          <view v-if="decorationWall.length" class="box-border flex flex-col gap-y-2 border-t border-gray-100 px-3 py-3">
            <view class="text-xs text-gray-900 font-bold">
              装扮墙
            </view>
            <view class="grid grid-cols-2 gap-2">
              <view
                v-for="(d, i) in decorationWall" :key="d.assetName || i"
                class="uh-global-card-glass box-border flex items-center gap-2 rounded-xl border p-2"
                :style="d.rarityColor ? `border-color:${d.rarityColor}` : ''"
              >
                <image v-if="d.url" :src="d.url" class="h-10 w-10 shrink-0 rounded-lg" mode="aspectFill" />
                <view class="min-w-0 flex-1">
                  <view class="truncate text-xs text-gray-900">
                    {{ d.displayName }}
                  </view>
                  <view v-if="d.rarityDisplayName" class="text-3xs" :style="d.rarityColor ? `color:${d.rarityColor}` : ''">
                    {{ d.rarityDisplayName }}
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>
      </scroll-view>

      <!-- 查看主页 -->
      <view class="box-border px-3 pb-3 pt-2">
        <uh-button custom-class="!bg-primary !py-2.5 !text-3xs !text-gray-900" @click="handleToProfile">
          查看主页
        </uh-button>
      </view>
    </view>
  </uh-glass-popup>
</template>
