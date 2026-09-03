<script lang="ts" setup>
import { computed } from 'vue'
import { checkThumbnailUrl } from '@/utils/url'
import { useSettingStore } from '@/store/setting'
import { formatTime} from '@/utils/formatTime'
import type { IPost } from '@/api/types/halo'

const props = withDefaults(defineProps<{
  /** 来源页面(home 时跟随首页布局) */
  from?: string
  article: IPost
}>(), {
  from: '',
})

const emit = defineEmits<{
  (e: 'on-click', article: IPost): void
}>()

const settingStore = useSettingStore()

/** 卡片布局 class(由全局设置 layout 决定) */
const cardType = computed(() => {
  const layout = settingStore.settings.layout
  // 首页双列时强制上图下文布局,除非显式指定其他
  if (props.from === 'home' && layout.home === 'h_row_col2') {
    if (!['tb_image_text', 'tb_text_image', 'only_text'].includes(layout.cardType)) {
      return [props.from, layout.home, 'tb_image_text']
    }
    return [props.from, layout.home, layout.cardType]
  }
  return [layout.home, layout.cardType]
})

/** 发布时间格式化 yyyy-MM-dd */
const publishTimeText = computed(() => {
  const time = props.article.spec.publishTime
  return time ? formatTime({d:time,f:'yyyy-MM-dd'}) : ''
})

/** 阅读数(兼容 status.stats.visits 与旧版顶层 stats.visit) */
const visitCount = computed(() => {
  return props.article.status?.stats?.visits ?? props.article.stats?.visit ?? 0
})

function handleClick() {
  emit('on-click', props.article)
}
</script>

<template>
  <view class="uh-global-card-glass overflow-hidden relative rounded-xl p-3"  @click="handleClick">
     <!-- v-if="article.spec.pinned" -->
	<text class="absolute right-6 top-6 z-1 bg-secondary text-gray-60 text-xs px-2 py-1 rounded-lg"> 置顶 </text>
	<image class="w-full h-36 rounded-lg" :src="checkThumbnailUrl(article.spec.cover)" mode="aspectFill" lazy-load />
    <view class="flex flex-col w-full gap-y-2 text-sm">
      <view class="mt-2 font-bold truncate">
       {{ article.spec.title }} 
      </view>
      <view class="content line-clamp-2 text-gray-600">
        {{ article.status?.excerpt }}
      </view>
      <view class="flex items-center justify-between text-xs text-gray-500">
		<view class="flex items-center gap-x-1">
			<image :src="article.owner.avatar" class="uh-global-card-glass rounded-full w-5 h-5" mode="aspectFill"></image>
			<text>{{article.owner.displayName}}</text>
		</view>
        <view class="flex items-center gap-x-2">
          {{ publishTimeText }}
        </view>
        <view class="visits">
          浏览
          <text class="number">{{ visitCount }}</text>
          次
        </view>
      </view>
    </view>
  </view>
</template>
