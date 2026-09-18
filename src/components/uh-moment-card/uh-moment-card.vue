<script lang="ts" setup>
/**
 * 瞬间卡片
 *
 */
import { useFavoritesStore } from '@/store/favorites'
import { useUpvote } from '@/hooks/useUpvote'
import { checkAvatarUrl } from '@/utils/url'
import { formatTime } from '@/utils/formatTime'
import { markdownConfig } from '@/config/markdown'
import type { IMoment } from '@/api/types/halo'

defineOptions({
  options: {
    styleIsolation: 'apply-shared',
  },
})

interface IProps {
  /** 瞬间数据（含列表页映射出的 images/newHtml 扩展字段） */
  moment: IMoment & {
    images?: { type?: string, url: string }[]
    spec: IMoment['spec'] & { newHtml?: string }
  }
  /** 博主信息（owner 缺省时兜底展示） */
  blogger?: { nickname?: string, avatar?: string }
}

const props = withDefaults(defineProps<IProps>(), {
  blogger: () => ({ nickname: '', avatar: '' }),
})

const emit = defineEmits<{
  (e: 'detail'): void
  (e: 'like'): void
  (e: 'comment'): void
  (e: 'favorite'): void
}>()

const { isFavorite } = useFavoritesStore()
const { hasUpvoted } = useUpvote('moments', () => '')

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
  <view class="uh-global-card-glass uh-shadow-xs flex-1 overflow-hidden rounded-xl">
    <view class="box-border flex items-center px-4 pt-4">
      <view class="flex flex-1 items-center">
        <image class="avatar h-9 w-9 shrink-0 rounded-full"
          :src="checkAvatarUrl(moment.owner?.avatar || blogger.avatar)" mode="aspectFill" />
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
    <view class="box-border px-4 pt-3">
      <view class="relative box-border rounded-lg bg-page p-3 text-gray-900 text-3xs">
        <mp-html lazy-load :domain="markdownConfig.domain ?? ''" :loading-img="markdownConfig.loadingGif"
          scroll-table selectable :tag-style="markdownConfig.tagStyle" :container-style="markdownConfig.containStyle"
          :content="moment.spec.newHtml || ''" :markdown="true" :show-line-number="true"
          :show-language-name="true" copy-by-long-press />
      </view>
    </view>

    <!-- 图片 -->
    <view v-if="moment.images && moment.images.length !== 0"
      class="box-border flex flex-wrap items-start px-3 pt-2">
      <view v-for="(image, mediumIndex) in moment.images" :key="mediumIndex"
        class="image-item box-border p-1"
        :class="moment.images && moment.images.length === 1 ? 'h-32 w-full' : (moment.images && moment.images.length === 2 ? 'h-[250rpx] w-1/2' : 'h-20 w-1/3')">
        <image mode="aspectFill" class="h-full w-full rounded-lg" :src="image.url"
          @click="handlePreview(mediumIndex, moment.images || [])" />
      </view>
    </view>

    <view v-if="moment.spec.tags && moment.spec.tags.length !== 0"
      class="mt-3 box-border flex flex-wrap gap-2 px-4">
      <text v-for="(tag, tagIndex) in moment.spec.tags" :key="tagIndex"
        class="rounded-xl bg-secondary px-2 py-1 text-xs">
        # {{ tag }}
      </text>
    </view>

    <!-- (点赞/评论/收藏) -->
    <view
      class="mb-1 mt-2 box-border w-full flex items-center border-t border-black/5 px-4 py-3 text-xs text-gray-400"
      :class="[moment.spec.allowComment ? 'justify-between' : 'gap-x-6']">
      <view class="flex items-center gap-x-1" @click.stop="emit('like')">
        <wd-icon class-prefix="uhemoji-icon" name="-kiss-" size="32rpx" />
        <text class="text-3xs" :class="hasUpvoted(moment.metadata.name) ? 'text-primary' : 'text-gray-600'">
          点赞 {{ moment.stats.upvote || 0 }}
        </text>
      </view>
      <view v-if="moment.spec.allowComment" class="flex items-center gap-x-1" @click.stop="emit('comment')">
        <wd-icon class-prefix="uhemoji-icon" name="-thinking" size="32rpx" />
        <text class="text-3xs text-gray-600">评论 {{ moment.stats.totalComment || 0 }}</text>
      </view>
      <view class="flex items-center gap-x-1" @click.stop="emit('favorite')">
        <wd-icon class-prefix="uhemoji-icon" name="-smile-" size="32rpx" />
        <text class="text-3xs"
          :class="isFavorite('moment', moment.metadata.name) ? 'text-primary' : 'text-gray-600'">
          {{ isFavorite('moment', moment.metadata.name) ? '已收藏' : '收藏' }}
        </text>
      </view>
    </view>
  </view>
</template>
