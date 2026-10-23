<script lang="ts" setup>
/**
 * 我的资料页头部
 * 参考图布局:顶部大图封面 + 头像(头像框)上叠 + 昵称(样式)与徽章排 + 称号/身份牌 + 简介 + 数据行
 * 封面与佩戴预览随装扮草稿实时变化,头像点击触发更换
 */
import type { IIdentityMark } from '@/api/types/halo-plugin-third/interaction-plus'
import { useCardBgSrc } from '@/hooks/useWornSlots'
import { getAvatarFallbackText } from '@/utils/avatar'
import { checkAvatarUrl } from '@/utils/url'
import { identityMarksStyleCss } from '@/utils/wornDecorations'
import type { UseMyDecorations } from '../../composables/use-my-decorations'

interface IProps {
  avatar?: string
  nickname?: string
  username?: string
  bio?: string
  /** 头像上传中 */
  uploading?: boolean
  /** 装扮组合式状态(实时预览) */
  deco: UseMyDecorations
  /** 身份标识(角色映射,只读) */
  identityMarks?: IIdentityMark[]
  /** 互动数据 */
  stats?: { posts?: number, comments?: number } | null
  /** 互动增强是否可用(不可用时隐藏背景图设置入口) */
  enhanceEnabled?: boolean
  /** 审核模式(与增强不可用一起隐藏统计数据行) */
  auditMode?: boolean
}

const props = withDefaults(defineProps<IProps>(), {
  avatar: '',
  nickname: '',
  username: '',
  bio: '',
  uploading: false,
  identityMarks: () => [],
  stats: null,
  enhanceEnabled: true,
  auditMode: false,
})

const emit = defineEmits<{
  (e: 'on-avatar-change', filePath: string): void
  (e: 'on-cover-tap'): void
}>()

/** 头像框素材 */
const frameUrl = computed(() => props.deco.previewFrameUrl.value)

/** 封面图:佩戴的名片背景优先,素材缺失/装载失败/增强未启用回退博主页背景图(同 user-profile) */
const { cardBgSrc, onCardBgError } = useCardBgSrc(() => props.deco.previewCardBgUrl.value)

/** 昵称后徽章排:主勋章 + 展示勋章(去重,最多 4 个) */
const badgeUrls = computed(() => {
  const urls: string[] = []
  const primary = props.deco.previewPrimaryBadgeUrl.value
  if (primary) {
    urls.push(primary)
  }
  for (const url of props.deco.previewShowcaseUrls.value) {
    if (url !== primary && !urls.includes(url)) {
      urls.push(url)
    }
    if (urls.length >= 4) {
      break
    }
  }
  return urls
})

/** 头像上传中点击拦截 */
function guardUploading(): boolean {
  return props.uploading
}

// #ifdef MP-WEIXIN
/** 微信端:open-type 原生选择回调(微信头像/相册/拍照) */
function onWxAvatarChosen(e: { detail: { avatarUrl: string } }) {
  const url = e.detail?.avatarUrl
  if (url) {
    emit('on-avatar-change', url)
  }
}
// #endif

// #ifndef MP-WEIXIN
/** 非微信端:相册/相机二选一 */
function chooseAvatar() {
  if (guardUploading()) {
    return
  }
  uni.chooseImage({
    count: 1,
    sourceType: ['album', 'camera'],
    success: (res) => {
      const path = res.tempFilePaths?.[0]
      if (path) {
        emit('on-avatar-change', path)
      }
    },
  })
}
// #endif
</script>

<template>
  <view class="box-border w-full">
    <!-- 顶部大图封面(佩戴的名片背景,通栏铺满,无则博主页背景图/渐变兜底) -->
    <view class="relative z-0 h-60 w-full overflow-hidden">
      <image
        v-if="cardBgSrc" class="h-full w-full bg-cover bg-center !block"
        :src="cardBgSrc" mode="aspectFill" @error="onCardBgError"
      />
      <view v-else class="h-full w-full from-[rgba(185,228,36,0.7)] via-[rgba(215,249,76,0.5)] to-[rgba(185,228,36,0.2)] bg-gradient-to-br" />
      <!-- 轻遮罩压暗封面(同 user-profile) -->
      <view class="uh-profile-mask pointer-events-none absolute left-0 top-0 h-full w-full" />
      <!-- 底部渐隐过渡 -->
      <view class="pointer-events-none absolute bottom-0 left-0 h-12 w-full from-black/0 to-page bg-gradient-to-b" />
    </view>

    <!-- 玻璃资料卡:一半压在封面交界处 -->
    <view class="uh-global-card-glass uh-shadow-xs relative z-10 mx-4 box-border rounded-2xl p-3 -mt-20">
      <!-- 更换封面入口(进装扮 Tab,增强不可用时隐藏) -->
      <view
        v-if="enhanceEnabled"
        class="absolute right-2 top-2 z-20 box-border flex items-center gap-x-1 rounded-full bg-black/35 px-2 py-0.5"
        @click="emit('on-cover-tap')"
      >
        <text class="text-xs text-white">{{ deco.previewCardBgUrl.value ? '更换背景图' : '设置背景图' }}</text>
      </view>
      <view class="flex items-center gap-x-3">
        <!-- 头像:微信端 open-type 原生弹出,其他端 chooseImage -->
        <!-- #ifdef MP-WEIXIN -->
        <button
          class="avatar-trigger relative h-20 w-20 shrink-0 !overflow-inherit" open-type="chooseAvatar" :disabled="uploading"
          @chooseavatar="onWxAvatarChosen"
        >
          <wd-avatar
            :src="checkAvatarUrl(avatar)" :text="getAvatarFallbackText(nickname || username)" shape="round"
            custom-class="uh-global-card-glass uh-shadow-xs !h-full !w-full !text-gray-900 !font-bold"
            class="!border-2 !border-white/60 !rounded-full" mode="aspectFill"
          />
          <!-- #endif -->
          <!-- #ifndef MP-WEIXIN -->
          <view class="relative h-20 w-20 shrink-0" @click="chooseAvatar">
            <wd-avatar
              :src="checkAvatarUrl(avatar)" :text="getAvatarFallbackText(nickname || username)" shape="round"
              custom-class="uh-global-card-glass uh-shadow-xs !h-full !w-full !text-gray-900 !font-bold"
              class="!border-2 !border-white/60 !rounded-full" mode="aspectFill"
            />
            <!-- #endif -->
            <!-- 头像框 -->
            <image
              v-if="frameUrl" class="pointer-events-none absolute left-1/2 top-1/2 z-20 h-24 w-24 !block"
              :src="frameUrl" mode="aspectFit" style="transform:translate(-50%,-50%)"
            />
            <!-- 更换角标 -->
            <view
              class="uh-translate-center absolute bottom-0 right-0 h-6 w-6 flex items-center justify-center rounded-full bg-black/45"
            >
              <wd-icon name="camera" size="28rpx" custom-class="text-white" />
            </view>
            <view v-if="uploading" class="absolute inset-0 flex items-center justify-center rounded-full bg-black/30">
              <wd-loading size="52rpx" custom-class="text-primary" />
            </view>
            <!-- #ifndef MP-WEIXIN -->
          </view>
          <!-- #endif -->
          <!-- #ifdef MP-WEIXIN -->
        </button>
        <!-- #endif -->

        <view class="min-w-0 flex flex-1 flex-col gap-y-1.5">
          <!-- 昵称 + 徽章排 -->
          <view class="flex items-center gap-x-1.5">
            <text class="truncate text-base text-gray-900 font-bold" :style="deco.previewNameStyleCss.value">
              {{ nickname || username }}
            </text>
            <image v-for="(url, i) in badgeUrls" :key="i" :src="url" class="h-5 w-5 shrink-0 !block" mode="aspectFit" />
          </view>
          <!-- 称号 + 身份标识 -->
          <view
            v-if="deco.previewTitle.value || identityMarks.length"
            class="flex flex-wrap items-center gap-x-1.5 gap-y-1"
          >
            <text
              v-if="deco.previewTitle.value" class="box-border max-w-full truncate rounded-full px-2 py-0.5 text-xs"
              :style="deco.previewTitle.value.style"
            >
              {{ deco.previewTitle.value.text }}
            </text>
            <template v-for="(mark, i) in identityMarks" :key="i">
              <image v-if="mark.icon" :src="mark.icon" class="h-4 w-4" mode="aspectFit" />
              <text
                v-else class="box-border max-w-fit truncate border rounded-full border-solid px-1.5 py-0.5 text-xs"
                :style="identityMarksStyleCss(mark)"
              >
                {{ mark.displayName }}
              </text>
            </template>
          </view>
          <!-- 简介 -->
          <text v-if="bio" class="line-clamp-2 text-3xs text-gray-500">
            {{ bio }}
          </text>
        </view>
      </view>

      <!-- 数据行(审核模式/增强不可用时隐藏) -->
      <view
        v-if="enhanceEnabled && !auditMode"
        class="uh-global-card-glass mt-3 flex items-center gap-x-6 rounded-lg px-4 py-1.5 !shadow-none"
      >
        <view class="flex items-baseline gap-x-1">
          <text class="text-sm text-gray-900 font-bold">{{ stats?.posts ?? 0 }}</text>
          <text class="text-xs text-gray-400">文章</text>
        </view>
        <view class="flex items-baseline gap-x-1">
          <text class="text-sm text-gray-900 font-bold">{{ stats?.comments ?? 0 }}</text>
          <text class="text-xs text-gray-400">评论</text>
        </view>
        <view class="flex items-baseline gap-x-1">
          <text class="text-sm text-gray-900 font-bold">{{ deco.availableCount.value }}</text>
          <text class="text-xs text-gray-400">装扮</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.uh-profile-mask {
  background-color: rgb(0 0 0 / 7.5%);
  backdrop-filter: blur(2rpx);
  -webkit-backdrop-filter: blur(2rpx);
}

.avatar-trigger {
  margin: 0;
  padding: 0;
  background: transparent;
  border-radius: 9999rpx;
  line-height: 1;
}

.avatar-trigger::after {
  border: none;
}
</style>
