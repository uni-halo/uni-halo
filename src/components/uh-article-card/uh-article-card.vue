<script lang="ts" setup>
import { computed } from 'vue'
import { checkThumbnailUrl } from '@/utils/url'
import { useSettingStore } from '@/store/setting'
import { formatTime } from '@/utils/formatTime'
import type { ICategory, IPost } from '@/api/types/halo'

const props = withDefaults(defineProps<{
  from?: string
  auditMode?: boolean
  article: IPost
  /** 卡片形态:list=常规列表卡(默认),grid=两列紧凑卡(隐藏分类/标签,摘要单行) */
  variant?: 'list' | 'grid'
}>(), {
  auditMode: false,
  from: '',
  variant: 'list',
})

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

/** grid 紧凑模式(两列:隐藏分类/标签,摘要单行,底部精简) */
const isGrid = computed(() => props.variant === 'grid')

/** 发布时间格式化 yyyy-MM-dd */
const publishTimeText = computed(() => {
  const time = props.article.spec.publishTime
  return time ? formatTime({ d: time, f: 'yyyy-MM-dd' }) : ''
})

/** 阅读数(兼容 status.stats.visits 与旧版顶层 stats.visit) */
const visitCount = computed(() => {
  return props.article.status?.stats?.visits ?? props.article.stats?.visit ?? 0
})

function handleToArticleDetail() {
  uni.navigateTo({
    url: `/pages-blog/article-detail/article-detail?name=${props.article.metadata.name}`,
    animationType: 'slide-in-right',
  })
}

function handleToCategory(category: ICategory) {
  if (props.auditMode) {
    return
  }
  uni.navigateTo({
    url: `/pages-blog/category-articles/category-articles?name=${category.metadata.name}&title=${category.spec.displayName}`,
  })
}
</script>

<template>
  <view
    class="uh-global-card-glass uh-shadow-xs relative overflow-hidden rounded-xl p-3"
    @click.stop="handleToArticleDetail()"
  >
    <text
      v-if="article.spec.pinned"
      class="text-gray-60 absolute right-6 top-6 z-1 rounded-lg bg-secondary px-2 py-1 text-xs"
    >
      置顶
    </text>
    <image
      :class="isGrid ? 'w-full h-24 rounded-lg' : 'w-full h-36 rounded-lg'"
      :src="checkThumbnailUrl(article.spec.cover)" mode="aspectFill" lazy-load
    />
    <view class="w-full flex flex-col gap-y-2 text-sm">
      <view class="mt-2 truncate font-bold">
        {{ article.spec.title }}
      </view>
      <view :class="isGrid ? 'content line-clamp-1 text-gray-600' : 'content line-clamp-2 text-gray-600'">
        {{ article.status?.excerpt }}
      </view>
      <view v-if="!isGrid" class="my-1 box-border flex flex-wrap gap-2">
        <template v-if="article.categories && article.categories.length !== 0">
          <text
            v-for="cate in article.categories" :key="cate.metadata.name"
            class="rounded-xl bg-secondary px-2 py-1 text-xs" @click.stop="handleToCategory(cate)"
          >
            {{ cate.spec.displayName }}
          </text>
        </template>
        <template v-if="article.tags && article.tags.length !== 0">
          <text
            v-for="tag in article.tags" :key="tag.metadata.name"
            class="rounded-xl bg-secondary px-2 py-1 text-xs"
          >
            # {{ tag.spec.displayName }}
          </text>
        </template>
      </view>
      <view class="mt-1 flex items-center justify-between text-xs text-gray-500">
        <view v-if="!isGrid" class="flex items-center gap-x-1">
          <image
            :src="article.owner.avatar" class="uh-global-card-glass h-5 w-5 rounded-full"
            mode="aspectFill"
          />
          <text>{{ article.owner.displayName }}</text>
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
