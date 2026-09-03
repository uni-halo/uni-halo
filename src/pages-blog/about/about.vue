<script lang="ts" setup>
/**
 * 关于项目页(源自旧项目 pagesA/about,新建复刻)
 * 数字名片式设计:Hero 名片卡(渐变光斑透卡 + 徽章) + 彩色瓦片链接列表,点击复制
 */
import { onLoad } from '@dcloudio/uni-app'

definePage({
  style: {
    navigationBarTitleText: '关于项目',
  },
})

const links = [
  { title: '开源组织', value: '巷子工坊', copy: 'https://www.ialley.cn', tip: '巷子工坊官网已复制成功！', tileColor: '#5c6bc0', tileLetter: '组' },
  { title: '开源作者', value: '小莫唐尼', copy: 'https://www.xiaoxiaomo.cn', tip: '作者主页地址已复制', tileColor: '#26a69a', tileLetter: '作' },
  { title: '作者博客', value: 'https://blog.xiaoxiaomo.cn', copy: 'https://blog.xiaoxiaomo.cn', tip: '作者博客地址已复制', tileColor: '#7e57c2', tileLetter: '博' },
  { title: '文档地址', value: 'https://uni-halo.925i.cn', copy: 'https://uni-halo.925i.cn', tip: '项目码云仓库已复制', tileColor: '#039be5', tileLetter: '文' },
  { title: '码云仓库', value: 'https://gitee.com/ialley-workshop-open/uni-halo', copy: 'https://gitee.com/ialley-workshop-open/uni-halo', tip: '码云仓库地址已复制', tileColor: '#c71d23', tileLetter: '码' },
  { title: 'Github', value: 'https://github.com/ialley-workshop-open/uni-halo', copy: 'https://github.com/ialley-workshop-open/uni-halo', tip: 'Github地址已复制', tileColor: '#24292f', tileLetter: 'G' },
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

onLoad(() => {
  uni.setNavigationBarTitle({ title: '关于项目' })
})
</script>

<template>
  <view class="app-page box-border min-h-screen w-screen flex flex-col overflow-hidden bg-page px-4 pb-8 pt-6">
    <!-- Hero 名片卡(主题色光斑透过毛玻璃形成柔和渐变) -->
    <view class="hero-wrap relative">
      <view class="absolute h-[220rpx] w-[220rpx] rounded-full bg-[rgba(185,228,36,0.32)] -right-8 -top-8" />
      <view class="absolute top-[150rpx] h-[180rpx] w-[180rpx] rounded-full bg-[rgba(215,249,76,0.45)] -left-10" />
      <view class="hero-card uh-global-card-glass relative flex flex-col items-center rounded-3xl px-6 pb-7 pt-10">
        <image class="logo-img h-[140rpx] w-[140rpx] rounded-3xl shadow-lg" src="https://uni-halo.925i.cn/logo.png" mode="aspectFill" />
        <view class="mt-4 text-[40rpx] text-gray-900 font-bold">
          uni-halo
        </view>
        <view class="mt-3 flex items-center gap-2">
          <text class="rounded-full bg-secondary px-3 py-1 text-[20rpx] text-[#4d7c0f]">AGPL-3.0 开源协议</text>
          <text class="rounded-full bg-[#f6f3ee] px-3 py-1 text-[20rpx] text-gray-500">uni-app × Halo</text>
        </view>
        <view class="mt-4 text-center text-[24rpx] text-gray-500 leading-relaxed">
          基于 uni-app 打造的 Halo 博客跨端客户端
        </view>
      </view>
    </view>

    <!-- 相关链接 -->
    <uh-section-title class="mb-3 mt-6 text-[30rpx]">
      相关链接
    </uh-section-title>
    <view class="link-list uh-global-card-glass overflow-hidden rounded-2xl">
      <view
        v-for="(link, index) in links"
        :key="link.title"
        class="link-item flex items-center gap-3 px-4 py-4"
        :class="index < links.length - 1 ? 'border-b border-black/5' : ''"
        @click="copyText(link.copy, link.tip)"
      >
        <view class="tile h-[76rpx] w-[76rpx] flex shrink-0 items-center justify-center rounded-xl border border-black/5" :style="{ backgroundColor: link.tileColor + '1A' }">
          <text class="text-[30rpx] font-bold" :style="{ color: link.tileColor }">{{ link.tileLetter }}</text>
        </view>
        <view class="min-w-0 flex flex-1 flex-col">
          <text class="text-[28rpx] text-gray-900 font-bold">{{ link.title }}</text>
          <view class="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[24rpx] text-gray-400">
            {{ link.value }}
          </view>
        </view>
        <wd-icon name="copy" size="28rpx" color="#c8c2b4" class="shrink-0" />
      </view>
    </view>

    <!-- 版权 -->
    <view class="copyright mt-auto pt-8 text-center text-[22rpx] text-gray-400">
      <view>「 2022 uni-halo 丨 开源项目丨巷子工坊@小莫唐尼 」</view>
    </view>
  </view>
</template>
