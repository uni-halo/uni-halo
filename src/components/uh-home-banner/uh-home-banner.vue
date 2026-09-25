<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { getBanners } from '@/api/uni-halo'
import { checkAvatarUrl, checkThumbnailUrl } from '@/utils/url'
import { formatTime } from '@/utils/formatTime'
import type { IBannerPublicItem } from '@/api/types/uni-halo'

export interface IBannerItem {
  id?: string | number
  name?: string
  title?: string
  image?: string
  src?: string
  type?: string
  postId?: string
  content?: string
  url?: string
  date?: string
  authorName?: string
  authorAvatar?: string
  [key: string]: unknown
}

/* ---------------- 数据 ---------------- */
const bannerList = ref<IBannerItem[]>([])
const currentIndex = ref(0)
const currentBanner = ref<IBannerItem | null>(null)

/** 公开 Banner 条目 → 轮播展示项 */
function mapBanners(items: IBannerPublicItem[]): IBannerItem[] {
  return items.map((item) => {
    item.date = item.date || Date.now().toString()
    return {
      id: item.name,
      name: item.name,
      title: item.title || '',
      image: checkThumbnailUrl(item.cover),
      src: checkThumbnailUrl(item.cover),
      type: item.source,
      postId: item.postId,
      url: item.link,
      date: formatTime({
        d: item.date,
        f: 'yyyy年MM月dd日 星期w',
      }),
      authorName: item.authorName,
      authorAvatar: item.authorAvatar ? checkAvatarUrl(item.authorAvatar) : '',
    }
  })
}

onMounted(async () => {
  try {
    const res = await getBanners()
    bannerList.value = mapBanners(res.data || [])
    handleBannerChange({
      detail: { current: 0 },
    })
  }
  catch (err) {
    console.error('获取轮播图失败', err)
  }
})

function handleBannerChange(e: any) {
  currentIndex.value = e?.detail?.current ?? 0
  currentBanner.value = bannerList.value[currentIndex.value]
}

function handleOnClick(item: IBannerItem) {
  // 审核模式下照常展示 Banner,点击分发不拦截(详情页自行处理审核限制)
  if (item.type === 'custom') {
    // 自定义条目:跳转 Banner 详情页,页面内调公开详情接口展示 content/外链
    if (item.name) {
      uni.navigateTo({
        url: `/pages-blog/banner-detail/banner-detail?name=${item.name}`,
        animationType: 'slide-in-right',
      })
    }
    return
  }
  // 笔记来源
  uni.navigateTo({
    url: `/pages-blog/article-detail/article-detail?name=${item.postId}`,
    animationType: 'slide-in-right',
  })
}

function handleToSearch() {
  uni.navigateTo({ url: '/pages-blog/search/search' })
}
</script>

<template>
  <view v-if="bannerList.length > 0" class="relative mb-6 box-border w-full">
    <view class="relative box-border h-64 w-full overflow-hidden">
      <swiper
        class="h-64 w-full" :circular="true" :indicator-dots="false" :autoplay="true" :interval="3000"
        :duration="1000" @change="handleBannerChange"
      >
        <swiper-item v-for="(item, index) in bannerList" :key="index" class="relative">
          <!-- 有图，wd-img 如果加载空的地址 会一直处于loading状态，所以空值我们不加载 -->
          <wd-img
            v-if="item.image || item.src" :src="item.image || item.src" class="h-full w-full"
            mode="aspectFill" @click.stop="handleOnClick(item)"
          >
            <template #loading>
              <wd-loading size="64rpx" custom-class="text-primary" />
            </template>
          </wd-img>
          <!-- 无图 -->
          <view
            v-else
            class="h-full w-full flex items-center justify-center from-[#ebfabf] to-[#f5fae8] bg-gradient-to-b text-gray-400"
          >
            <wd-icon class-prefix="uhemoji-icon" name="-injury" size="72rpx" />
          </view>
        </swiper-item>
      </swiper>
      <view
        v-if="currentBanner"
        class="pointer-events-none absolute inset-0 z-10 box-border flex flex-col items-center justify-center gap-y-2 bg-white/5 pt-safe"
      >
        <view
          class="mt-3 box-border max-w-[45vw] flex items-center justify-center truncate border rounded-full px-3 py-1.5"
          :style="{
            backdropFilter: 'blur(2rpx)',
            backgroundColor: 'rgba(215, 249, 76, 0.9)',
          }"
        >
          <text class="truncate text-3xs text-gray-900 font-semibold">
            {{ currentBanner.title }}
          </text>
        </view>
        <text
          class="text-xs text-white text-shadow-[0_2rpx_8rpx_rgba(0,0,0,0.4)]"
        >
          {{ currentBanner.date }}
        </text>
      </view>
    </view>

    <view class="absolute bottom-0 left-0 right-0 h-12 w-full from-white/0 to-page bg-gradient-to-b" />
    <view class="uh-translate-y-n6 absolute left-0 right-0 z-10 flex items-center justify-center">
      <view
        class="uh-global-card-glass w-4/5 flex items-center justify-center gap-x-2 border rounded-full px-4 py-2.5 text-gray-600"
        @click="handleToSearch()"
      >
        <wd-icon name="search-line" size="32rpx" />
        <text class="text-2xs">哈喽，想看些什么 <text class="rounded-lg bg-secondary px-1">{ 内容 }</text> 呢~</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.uh-translate-y-n6 {
  transform: translateY(-1.5rem);
}
</style>
