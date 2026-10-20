<script lang="ts" setup>
/**
 * 用户资料卡弹窗（全局组件，挂载于 App.ku.vue）
 *
 * 经 useUserProfilePopup().openUserProfilePopup({ username, nickname?, avatar? }) 唤起：
 * - 完整用户信息：昵称（互动增强昵称样式）/简介/加入时间/笔记·评论统计/身份标牌
 * - 增强展示：名片背景（卡片顶部素材带，头像骑素材带下缘）/头像框/主勋章/称号
 * - 装扮墙：用户公开的全部装饰（30s TTL 缓存），点击直接唤起 imagePreview 原生图片预览
 * - 底部「查看主页」跳转个人主页（底部安全区 padding）；审核模式下 openUserProfilePopup 直接忽略
 * - 数据优先级：互动增强 identity > 插件端公开资料 > 入参兜底；均走静默降级
 */
import { computed } from 'vue'
import { useUserProfilePopup } from '@/hooks/useUserProfilePopup'
import { useUserIdentity } from '@/hooks/useUserIdentity'
import { useCardBgSrc } from '@/hooks/useWornSlots'
import { useAppConfigStore } from '@/store/appConfig'
import { buildWornSlots, nameStyleCssOf } from '@/utils/wornDecorations'
import { checkAvatarUrl } from '@/utils/url'
import { getAvatarFallbackText } from '@/utils/avatar'
import { formatTime } from '@/utils/formatTime'
import { imagePreview } from '@/utils/image'
import type { IDecorationWallItem, IIdentityMark } from '@/api/types/halo-plugin-third/interaction-plus'

const { userProfilePopupVisible, payload, closeUserProfilePopup } = useUserProfilePopup()
const { identity, profile, decorationWall } = useUserIdentity(() => payload.value.username)

const slots = computed(() => buildWornSlots(identity.value))
const nameStyleCss = computed(() => nameStyleCssOf(identity.value))
/** 名片背景（素材缺失/装载失败回退博主页背景图，连兜底未配置则为空串不渲染） */
const { cardBgSrc, onCardBgError } = useCardBgSrc(() => slots.value.cardBackground.url)

/** 匿名（guest）模式：评论区未登录访客，仅有昵称/头像（可能空）/可选 website */
const isGuest = computed(() => !!payload.value.anonymous)
/** 匿名标牌样式（仿称号槽位形态，灰色系） */
const GUEST_CHIP_STYLE = 'background:rgb(0 0 0 / 0.07);color:rgb(0 0 0 / 0.55);'

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

/** 互动统计（identity 下发才展示；null 表示不公开；审核模式下不展示） */
const statsPosts = computed(() => identity.value?.stats?.posts)
const statsComments = computed(() => identity.value?.stats?.comments)

/**
 * 互动统计可展示性：笔记/评论统计仅由互动增强 identity 下发——
 * 插件未启用/门控未过（identity 为空）时无此数据；审核模式下隐私要求不展示。
 * 两者皆不可见时退化为仅「加入时间」单格居中展示。
 */
const appConfigStore = useAppConfigStore()
const showInteractStats = computed(() =>
  !appConfigStore.auditModeEnabled
  && (statsPosts.value !== undefined || statsComments.value !== undefined))

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

/* ---------- 点击放大预览（头像/装扮条目；直接用工具类 imagePreview 原生预览） ---------- */

function handlePreviewAvatar() {
  const url = checkAvatarUrl(headerUser.value.avatar)
  if (!url) { return }
  imagePreview(url)
}

function handlePreviewAsset(d: IDecorationWallItem) {
  if (!d?.url) { return }
  imagePreview(d.url)
}

/** 仅当稀有度色为 #rrggbb 形式时追加 6 位 alpha，避免 rgb()/颜色名拼接失效 */
function hexAlpha(color: string | undefined, alpha: string): string {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : ''
}

/** 透明网格棋盘(模拟透明图层纹理,与设计工具一致) */
const CHECKER_PATTERN = 'conic-gradient(rgb(0 0 0 / 0.05) 25%, transparent 0 50%, rgb(0 0 0 / 0.05) 0 75%, transparent 0)'

/** 装扮墙条目展示样式（稀有度着色：描边淡色/画布轻染叠加透明网格/右上角稀有度徽标/title 类文字着色，非 hex 安全回退） */
const wallStyled = computed(() => decorationWall.value.map((item) => {
  const tint = hexAlpha(item.rarityColor, '14')
  const layers = [tint ? `linear-gradient(160deg, ${tint}, transparent 70%)` : '', CHECKER_PATTERN]
    .filter(Boolean)
    .join(',')
  const sizes = [tint ? '100% 100%' : '', '12px 12px'].filter(Boolean).join(', ')
  const isTextDecoration = item.type === 'title' || item.type === 'name_style'
  return {
    item,
    style: hexAlpha(item.rarityColor, '40') ? `border-color:${hexAlpha(item.rarityColor, '40')};` : '',
    bgStyle: layers ? `background-image:${layers};background-size:${sizes};` : '',
    badgeStyle: item.rarityColor ? `background:${item.rarityColor};` : '',
    textStyle: item.rarityColor ? `color:${item.rarityColor};` : '',
    isTextDecoration,
  }
}))

function handleToProfile() {
  const username = payload.value.username
  closeUserProfilePopup()
  if (!username) { return }
  uni.navigateTo({
    url: `/pages-blog/user-profile/user-profile?username=${encodeURIComponent(username)}`,
    animationType: 'slide-in-right',
  })
}

/** 匿名/guest 模式：复制访客主页网址（无则不响应） */
function handleCopyWebsite() {
  const url = payload.value.website
  if (!url) { return }
  uni.setClipboardData({
    data: url,
    success: () => uni.showToast({ icon: 'none', title: '网址已复制' }),
  })
}
</script>

<template>
  <uh-glass-popup
    v-model="userProfilePopupVisible" position="bottom" custom-class="rounded-2xl" :z-index="130"
    @close="closeUserProfilePopup()"
  >
    <view v-if="payload.username || payload.anonymous" class="uh-profile-fade flex flex-col">
      <scroll-view :scroll-y="true" :show-scrollbar="false" class="max-h-[70vh] w-full">
        <!-- 用户卡片(垂直居中布局 + 名片背景顶部素材带,头像骑素材带下缘) -->
        <view class="relative box-border w-full overflow-hidden rounded-2xl bg-white/80 pb-3">
          <view v-if="cardBgSrc" class="absolute h-36 w-full overflow-hidden">
            <image
              :src="cardBgSrc"
              class="pointer-events-none absolute inset-0 h-full w-full" mode="aspectFill"
              @error="onCardBgError()"
            />
            <!-- 磨砂面纱(对齐 user-profile 顶部:rgba(0,0,0,.075) + backdrop blur) -->
            <view class="uh-profile-mask pointer-events-none absolute inset-0 h-full w-full" />
            <!-- 底部渐隐衔卡片底 -->
            <view
              class="pointer-events-none absolute bottom-0 left-0 z-10 h-12 w-full from-white/0 to-[#F9F9FA] bg-gradient-to-b"
            />
          </view>
          <view
            class="relative z-20 box-border flex flex-col items-center gap-y-2 px-4 pb-4"
            :class="cardBgSrc ? 'pt-26' : 'pt-5'"
          >
            <view class="relative shrink-0">
              <wd-avatar
                :src="checkAvatarUrl(headerUser.avatar)"
                :text="getAvatarFallbackText(headerUser.nickname || payload.username, '?')" shape="round"
                custom-class="uh-global-card-glass uh-shadow-xs !h-16 !w-16 !border-2 !border-white/40 !text-gray-900 !font-bold"
                mode="aspectFill" @click="handlePreviewAvatar()"
              />
              <image
                v-if="slots.avatarFrame.visible" :src="slots.avatarFrame.url"
                class="uh-frame-center pointer-events-none absolute left-1/2 top-1/2 h-[4.5rem] w-[4.5rem]"
                mode="aspectFit"
              />
            </view>
            <view class="flex items-center gap-x-1">
              <text class="truncate text-sm text-gray-900 font-black" :style="nameStyleCss">
                {{ headerUser.nickname || payload.username }}
              </text>
              <image
                v-if="slots.primaryBadge.visible" :src="slots.primaryBadge.url" class="h-4 w-4 shrink-0"
                mode="aspectFit"
              />
            </view>
            <!-- 称号 + 匿名标牌 + 身份标牌(同为身份徽章语义,同行 wrap;匿名时灰色「匿名用户」) -->
            <view
              v-if="slots.title.visible || isGuest || markChips.length"
              class="flex flex-wrap items-center justify-center gap-x-1 gap-y-1"
            >
              <text
                v-if="isGuest" class="box-border truncate rounded-full px-2 py-0.5 text-xs"
                :style="GUEST_CHIP_STYLE"
              >
                匿名用户
              </text>
              <text
                v-if="slots.title.visible" class="box-border truncate rounded-full px-2 py-0.5 text-xs"
                :style="slots.title.style"
              >
                {{ slots.title.text }}
              </text>
              <template v-for="(mark, i) in markChips" :key="i">
                <image v-if="mark.icon" :src="mark.icon" class="h-4 w-4" mode="aspectFit" />
                <text
                  v-else class="box-border truncate rounded-full px-1.5 py-0.5 text-xs text-white"
                  :style="mark.style"
                >
                  {{ mark.displayName }}
                </text>
              </template>
            </view>
            <text v-if="!isGuest" class="line-clamp-2 text-center text-xs text-gray-500">
              {{ headerUser.bio }}
            </text>
            <!-- 统计(数字加粗 + label 小字;互动统计依赖互动增强 identity,审核模式下不展示) -->
            <view v-if="showInteractStats" class="w-full flex items-center pt-1 text-center">
              <view class="flex-1">
                <text class="block text-sm text-gray-900 font-bold">{{ joinedText || '-' }}</text>
                <text class="text-xs text-gray-400">加入时间</text>
              </view>
              <view class="flex-1">
                <text class="block text-sm text-gray-900 font-bold">{{ statsPosts ?? '-' }}</text>
                <text class="text-xs text-gray-400">笔记</text>
              </view>
              <view class="flex-1">
                <text class="block text-sm text-gray-900 font-bold">{{ statsComments ?? '-' }}</text>
                <text class="text-xs text-gray-400">评论</text>
              </view>
            </view>
            <!-- 无互动统计(插件未启用/门控未过/审核模式):仅加入时间单格居中 -->
            <view v-else-if="joinedText" class="w-full pt-1 text-center">
              <text class="block text-xs text-gray-900 font-bold">{{ joinedText }}</text>
              <text class="text-3xs text-gray-400">加入时间</text>
            </view>
          </view>

          <!-- 装扮墙(用户公开的全部装饰,稀有度着色,点击放大;关闭公开时接口返回空) -->
          <view
            v-if="decorationWall.length"
            class="box-border flex flex-col gap-y-2 border-t border-gray-100 px-3 py-3"
          >
            <view class="flex items-center justify-between">
              <view class="text-3xs text-gray-900 font-bold">
                装扮展示
              </view>
              <view class="rounded-full text-xs text-gray-500">
                共 {{ decorationWall.length }} 件
              </view>
            </view>
            <!-- 单行横向滚动(条目宽≈原 3 列宽,whitespace-nowrap 兼容小程序端) -->
            <scroll-view :scroll-x="true" :show-scrollbar="false" class="w-full whitespace-nowrap">
              <view class="inline-flex gap-2">
                <view
                  v-for="(d, i) in wallStyled" :key="d.item.assetName || i"
                  class="inline-block w-24 shrink-0 cursor-pointer" @click="handlePreviewAsset(d.item)"
                >
                  <view class="flex flex-col items-center justify-center gap-y-1.5">
                    <!-- 预览框(稀有度描边外框 + 固定高度/内边距/自身边框的透明网格画布 + 右上角稀有度徽标) -->
                    <view class="relative box-border w-full overflow-hidden border rounded-lg p-2" :style="d.style">
                      <view
                        class="h-16 w-full flex items-center justify-center border border-gray-100 rounded-lg"
                        :style="d.bgStyle"
                      >
                        <image
                          v-if="d.item.url" :src="d.item.url" class="h-full w-full rounded-md p-1"
                          mode="aspectFit"
                        />
                        <!-- title/昵称样式类装饰无图时:名称文字即装饰本体,稀有度色作用于内部文字 -->
                        <text
                          v-else class="w-full truncate px-1 text-center font-black"
                          :class="d.isTextDecoration ? 'text-xs' : 'text-2xs'" :style="d.textStyle"
                        >
                          {{ d.item.displayName }}
                        </text>
                      </view>
                      <view
                        v-if="d.item.rarityDisplayName"
                        class="absolute right-0 top-0 z-10 box-border rounded-lb-md px-1 text-xs text-white"
                        :style="d.badgeStyle"
                      >
                        {{ d.item.rarityDisplayName }}
                      </view>
                    </view>
                    <!-- 名称(框外下方,不随稀有度着色) -->
                    <text class="w-full truncate text-center text-xs text-gray-700">{{ d.item.displayName }}</text>
                  </view>
                </view>
              </view>
            </scroll-view>
          </view>
          <!-- 底部操作(常规=查看主页;匿名=guest 网址可复制,否则仅关闭) -->
          <view class="box-border flex items-center gap-x-3 px-3 pt-2">
            <uh-button
              class="flex-1"
              custom-class="uh-global-card-glass !border !rounded-xl !bg-white !py-2.5 !text-3xs !text-gray-900"
              @click="closeUserProfilePopup"
            >
              关闭
            </uh-button>
            <uh-button
              v-if="payload.username" class="flex-1"
              custom-class="uh-global-card-glass !border !rounded-xl !bg-primary !py-2.5 !text-3xs !text-gray-900"
              @click="handleToProfile"
            >
              查看主页
            </uh-button>
            <uh-button
              v-else-if="payload.website" class="flex-1"
              custom-class="uh-global-card-glass !border !rounded-xl !bg-primary !py-2.5 !text-3xs !text-gray-900"
              @click="handleCopyWebsite"
            >
              复制网址
            </uh-button>
          </view>
        </view>
      </scroll-view>
    </view>
  </uh-glass-popup>
</template>

<style scoped>
.uh-profile-mask {
  background-color: rgba(0, 0, 0, 0.075);
  backdrop-filter: blur(2rpx);
  -webkit-backdrop-filter: blur(2rpx);
}

.uh-profile-fade {
  animation: uh-profile-fade-in 0.3s ease both;
}

@keyframes uh-profile-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
  }
}
</style>

<style scoped>
/* -translate-* 工具类在端内不支持,头像框居中经此类实现 */
.uh-frame-center {
  transform: translate(-50%, -50%);
}
</style>
