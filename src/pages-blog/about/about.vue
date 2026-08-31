<script lang="ts" setup>
/**
 * 关于项目页(源自旧项目 pagesA/about,新建复刻)
 */
import { onLoad } from '@dcloudio/uni-app'

definePage({
  style: {
    navigationBarTitleText: '关于项目',
  },
})

const links = [
  { title: '开源组织', value: '巷子工坊', copy: 'https://www.ialley.cn', tip: '巷子工坊官网已复制成功！' },
  { title: '开源作者', value: '小莫唐尼', copy: 'https://www.xiaoxiaomo.cn', tip: '作者主页地址已复制' },
  { title: '作者博客', value: 'https://blog.xiaoxiaomo.cn', copy: 'https://blog.xiaoxiaomo.cn', tip: '作者博客地址已复制' },
  { title: '文档地址', value: 'https://uni-halo.925i.cn', copy: 'https://uni-halo.925i.cn', tip: '项目码云仓库已复制' },
  { title: '码云仓库', value: 'https://gitee.com/ialley-workshop-open/uni-halo', copy: 'https://gitee.com/ialley-workshop-open/uni-halo', tip: '码云仓库地址已复制' },
  { title: 'Github', value: 'https://github.com/ialley-workshop-open/uni-halo', copy: 'https://github.com/ialley-workshop-open/uni-halo', tip: 'Github地址已复制' },
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
  <view class="app-page box-border h-screen w-screen flex flex-col items-center bg-white pt-10">
    <view class="logo mt-10 pt-10">
      <image class="logo-img h-[160rpx] w-[160rpx] rounded-xl" src="https://uni-halo.925i.cn/logo.png" mode="aspectFill" />
    </view>
    <view class="mt-3 text-[36rpx] font-bold">
      uni-halo
    </view>

    <view class="list-group mt-12 w-full">
      <view
        v-for="link in links"
        :key="link.title"
        class="list-item flex items-center justify-between border-b-2 border-[#f5f5f5] px-8 py-7"
        @click="copyText(link.copy, link.tip)"
      >
        <text class="list-title w-[160rpx] shrink-0 text-[28rpx] text-[#303133]">{{ link.title }}</text>
        <text class="list-value max-w-[480rpx] overflow-hidden text-ellipsis whitespace-nowrap text-right text-[24rpx] text-[#909399]">{{ link.value }}</text>
      </view>
    </view>

    <view class="copyright fixed bottom-0 left-0 box-border w-screen bg-white p-9 text-center text-[22rpx] text-[#909399]">
      <view>根据 AGPL-3.0 协议开源</view>
      <view class="mt-2">
        「 2022 uni-halo 丨 开源项目丨巷子工坊@小莫唐尼 」
      </view>
    </view>
  </view>
</template>
