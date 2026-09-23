<script lang="ts" setup>
/**
 * 瞬间卡片
 *
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useFavoritesStore } from '@/store/favorites'
import { useSettingStore } from '@/store/setting'
import { useUpvote } from '@/hooks/useUpvote'
import { checkAvatarUrl } from '@/utils/url'
import { getAvatarFallbackText } from '@/utils/avatar'
import { formatTime } from '@/utils/formatTime'
import { markdownConfig } from '@/config/markdown'
import type { IMoment } from '@/api/types/halo'

defineOptions({
  options: {
    styleIsolation: 'apply-shared',
  },
})

const props = withDefaults(defineProps<IProps>(), {
  blogger: () => ({ nickname: '', avatar: '' }),
})

const emit = defineEmits<{
  (e: 'detail'): void
  (e: 'like'): void
  (e: 'comment'): void
  (e: 'favorite'): void
}>()

interface IProps {
  /** 瞬间数据（含列表页映射出的 images/newHtml 扩展字段） */
  moment: IMoment & {
    images?: { type?: string, url: string }[]
    spec: IMoment['spec'] & { newHtml?: string }
  }
  /** 博主信息（owner 缺省时兜底展示） */
  blogger?: { nickname?: string, avatar?: string }
  /** 是否开启评论（评论按钮显隐） */
  allowComment?: boolean
}

const { isFavorite } = useFavoritesStore()
const { hasUpvoted, upvoteDisplay } = useUpvote('moments', () => '')

/** 头像外观(偏好 avatarShape:square 方形=默认 / circle 圆形;方形 = 文章卡片 image_bottom 同款) */
const { settings } = storeToRefs(useSettingStore())
const avatarShape = computed(() => (settings.value.avatarShape === 'circle' ? 'round' : 'square') as 'round' | 'square')
const avatarClass = computed(() =>
  settings.value.avatarShape === 'circle' ? '!rounded-full' : '!rounded-xl uh-shadow-xs uh-global-card-glass',
)

const imagesClass = computed(() => {
  if (props.moment.images.length >= 3) {
    return 'grid-cols-3'
  }
  return `grid-cols-${props.moment.images.length}`
})

/** 展示用昵称 */
const displayName = computed(() => props.moment.owner?.displayName || props.blogger.nickname || '')
/** 展示用头像 */
const avatarUrl = computed(() => checkAvatarUrl(props.moment.owner?.avatar || props.blogger.avatar || ''))
/** 无头像时显示昵称首字(wd-avatar 回退) */
const avatarText = computed(() => getAvatarFallbackText(displayName.value, '瞬'))

/** 格式化瞬间时间 */
function formatMomentTime(time?: string): string {
  return time ? formatTime({ d: time, f: 'yyyy年MM月dd日 星期w' }) : ''
}

function handlePreview(index: number, list: { url: string }[]) {
  uni.previewImage({
    current: index,
    urls: list.map(item => item.url),
  })
}
</script>

<template>
  <view class="uh-global-card-glass uh-shadow-xs w-full flex-1 overflow-hidden rounded-xl">
    <view class="box-border flex items-center px-3 pt-3">
      <view class="flex flex-1 items-center">
        <wd-avatar
          :src="avatarUrl"
          :text="avatarText"
          :shape="avatarShape"
          custom-class="!h-9 !w-9 !shrink-0 !text-primary !font-bold"
          :class="avatarClass"
          mode="aspectFill"
        />
        <view class="ml-2 flex flex-col gap-y-1">
          <view class="text-3xs text-gray-900 font-bold">
            {{ moment.owner?.displayName || blogger.nickname }}
          </view>
          <view class="text-xs text-gray-400">
            {{ formatMomentTime(moment.spec.releaseTime) }}
          </view>
        </view>
      </view>
      <view class="shrink-0">
        <uh-button custom-class="!py-1.5 bg-secondary text-xs" @click="emit('detail')">
          详情
        </uh-button>
      </view>
    </view>

    <!-- 正文 -->
    <view class="box-border px-3 pt-3">
      <view class="relative box-border rounded-lg text-3xs text-gray-900">
        <mp-html
          :content="moment.spec.newHtml"
          lazy-load :domain="markdownConfig.domain"
          :loading-img="markdownConfig.loadingGif" scroll-table selectable
          :tag-style="markdownConfig.tagStyle" :container-style="markdownConfig.containStyle"
          :markdown="true" :show-line-number="true"
          :show-language-name="true" copy-by-long-press
        />
      </view>
    </view>

    <!-- 图片 -->
    <view
      v-if="moment.images && moment.images.length !== 0"
      class="grid box-border gap-2 p-3 pb-0" :class="imagesClass"
    >
      <view
        v-for="(image, mediumIndex) in moment.images" :key="mediumIndex"
        class="box-border h-24 w-full" :class="[moment.images.length === 1 ? 'h-42' : '']"
      >
        <wd-img
          mode="aspectFill" class="h-full w-full" :radius="8" :src="image.url"
          @click="handlePreview(mediumIndex, moment.images || [])"
        >
          <template #loading>
            <wd-loading size="64rpx" custom-class="text-primary" />
          </template>
        </wd-img>
      </view>
    </view>

    <view
      v-if="moment.spec.tags && moment.spec.tags.length !== 0"
      class="mt-3 box-border flex flex-wrap gap-2 px-4"
    >
      <text
        v-for="(tag, tagIndex) in moment.spec.tags" :key="tagIndex"
        class="rounded-xl bg-secondary px-2 py-1 text-xs"
      >
        # {{ tag }}
      </text>
    </view>

    <!-- (点赞/评论/收藏) -->
    <view
      class="mb-1 mt-2 box-border w-full flex items-center border-t border-black/5 px-4 py-3 text-xs text-gray-400"
      :class="[props.allowComment ? 'justify-between' : 'gap-x-6']"
    >
      <view class="flex items-center gap-x-1" @click.stop="emit('like')">
        <wd-icon class-prefix="uhemoji-icon" name="-kiss-" size="32rpx" />
        <text class="text-3xs" :class="hasUpvoted(moment.metadata.name) ? 'text-primary' : 'text-gray-600'">
          点赞 {{ upvoteDisplay(moment.stats.upvote, moment.metadata.name) }}
        </text>
      </view>
      <view v-if="props.allowComment" class="flex items-center gap-x-1" @click.stop="emit('comment')">
        <wd-icon class-prefix="uhemoji-icon" name="-thinking" size="32rpx" />
        <text class="text-3xs text-gray-600">评论 {{ moment.stats.totalComment || 0 }}</text>
      </view>
      <view class="flex items-center gap-x-1" @click.stop="emit('favorite')">
        <wd-icon class-prefix="uhemoji-icon" name="-smile-" size="32rpx" />
        <text
          class="text-3xs"
          :class="isFavorite('moment', moment.metadata.name) ? 'text-primary' : 'text-gray-600'"
        >
          {{ isFavorite('moment', moment.metadata.name) ? '已收藏' : '收藏' }}
        </text>
      </view>
    </view>
  </view>
</template>
