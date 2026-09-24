<script lang="ts" setup>
import { onLoad, onPageScroll, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { useAppConfigStore } from '@/store/appConfig'
import { checkUrl } from '@/utils/url'
import { usePageScroll } from '@/hooks/usePageScroll'
import { usePageTitle } from '@/hooks/usePageTitle'

definePage({
  style: {
    navigationBarTitleText: '关于项目',
    navigationStyle: 'custom',
  },
})

const { scrollY, updatePageScrollValue } = usePageScroll()
/** 页面标题（插件端可配置，留空回退内置默认） */
const pageTitle = usePageTitle('aboutProject', '关于项目')
const appConfigStore = useAppConfigStore()

const appInfo = computed(() => {
  return {
    name: 'UniHalo',
    logo: checkUrl('/plugins/uni-halo/assets/static/logo.png'),
  }
})

/* ---------------- 分享 ---------------- */

onShareAppMessage(() => ({
  title: pageTitle.value,
  path: '/pages-blog/about-project/about-project',
}))

onShareTimeline(() => ({
  title: pageTitle.value,
  query: '',
}))

const links = [
  { title: '小莫唐尼', value: 'https://www.xiaoxiaomo.cn', copy: 'https://www.xiaoxiaomo.cn', tip: '作者主页地址已复制', tileColor: '#26a69a', tileLetter: '作' },
  { title: '作者博客', value: 'https://blog.xiaoxiaomo.cn', copy: 'https://blog.xiaoxiaomo.cn', tip: '作者博客地址已复制', tileColor: '#7e57c2', tileLetter: '博' },
  { title: '文档地址', value: 'https://uni-halo.ialley.cn', copy: 'https://uni-halo.ialley.cn', tip: '项目文档地址已复制', tileColor: '#039be5', tileLetter: '文' },
  { title: 'Github', value: 'https://github.com/uni-halo/uni-halo', copy: 'https://github.com/uni-halo/uni-halo', tip: 'Github地址已复制', tileColor: '#24292f', tileLetter: 'G' },
]

function copyText(content: string, tips: string) {
  uni.setClipboardData({
    data: content,
    showToast: false,
    success: () => {
      uni.showToast({ icon: 'none', title: tips })
    },
  })
}

onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})

onLoad(() => {
  uni.setNavigationBarTitle({ title: '关于项目' })
})
</script>

<template>
  <view class="box-border min-h-screen w-screen flex flex-col overflow-hidden bg-page px-4 pb-8 pt-2">
    <!-- 自定义导航 -->
    <uh-navbar :scroll-y="scrollY" :default-title="pageTitle" title-color="text-gray-900" />

    <view class="uh-blur-xl fixed top-8 h-28 w-28 rounded-full bg-[rgba(185,228,36,0.32)] -right-8" />
    <view class="uh-blur-xl fixed top-36 h-24 w-24 rounded-full bg-[rgba(215,249,76,0.45)] -left-10" />

    <view class="relative">
      <view class="uh-global-card-glass uh-shadow-xs relative flex flex-col items-center rounded-2xl px-6 pb-7 pt-10">
        <image
          class="uh-global-card-glass uh-shadow-xs h-18 w-18 border rounded-2xl" :src="appInfo.logo"
          mode="aspectFill"
        />
        <view class="text- mt-4 text-xl font-bold">
          {{ appInfo.name }}
        </view>
        <view class="mt-3 flex items-center gap-2">
          <text class="rounded-full bg-secondary px-3 py-1 text-[20rpx] text-gray-900">Apache 2.0</text>
          <text class="rounded-full bg-gray-100 px-3 py-1 text-[20rpx] text-gray-900">UniApp × Halo</text>
        </view>
        <view class="mt-4 text-center text-xs text-gray-500 leading-relaxed">
          基于 uni-app 打造的 Halo 博客跨端客户端
        </view>
      </view>
    </view>

    <uh-section-title class="mb-3 mt-6">
      相关链接
    </uh-section-title>

    <view class="uh-global-card-glass uh-shadow-xs box-border flex flex-col gap-y-6 rounded-2xl py-4">
      <view
        v-for="(link) in links" :key="link.title" class="flex items-center gap-3 px-4"
        @click="copyText(link.copy, link.tip)"
      >
        <view
          class="uh-global-card-glass uh-shadow-xs h-9 w-9 flex shrink-0 items-center justify-center border rounded-xl"
          :style="{ backgroundColor: `${link.tileColor}1A` }"
        >
          <text class="text-sm font-bold" :style="{ color: link.tileColor }">{{ link.tileLetter }}</text>
        </view>
        <view class="min-w-0 flex flex-1 flex-col justify-center gap-y-1">
          <text class="text-3xs text-gray-900 font-semibold">{{ link.title }}</text>
          <view class="truncate text-xs text-gray-400">
            {{ link.value }}
          </view>
        </view>
        <wd-icon name="copy" size="28rpx" class="shrink-0 text-gray-500" />
      </view>
    </view>

    <uh-page-copyright />
  </view>
</template>

<style scoped lang="scss">
.uh-blur-xl {
  filter: blur(20rpx);
}
</style>
