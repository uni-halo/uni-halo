<script lang="ts" setup>
/**
 * 联系博主页(源自旧项目 pagesA/contact,新建复刻)
 * 展示博主社交联系方式,点击复制
 */
import { computed, ref, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useAppConfigStore } from '@/store/appConfig'
import { checkAvatarUrl } from '@/utils/url'

definePage({
  style: {
    navigationBarTitleText: '联系博主',
  },
})

const appConfigStore = useAppConfigStore()
const authorConfig = computed(() => appConfigStore.configs.authorConfig)

const bloggerInfo = computed(() => {
  const blogger = authorConfig.value?.blogger as { nickname?: string, avatar?: string, description?: string } | undefined
  return {
    nickname: blogger?.nickname || '',
    avatar: checkAvatarUrl(blogger?.avatar),
    description: blogger?.description || '',
  }
})

const socialConfig = computed(() => (authorConfig.value?.social as Record<string, unknown> | undefined) || {})

/** 联系方式列表(从配置填充) */
const result = ref<{ key: string, name: string, value: string }[]>([
  { key: 'qq', name: '企鹅号', value: '' },
  { key: 'wechat', name: '微信号', value: '' },
  { key: 'github', name: 'Github', value: '' },
  { key: 'gitee', name: 'Gitee', value: '' },
  { key: 'bilibili', name: 'Bilibili', value: '' },
  { key: 'csdn', name: 'CSDN', value: '' },
  { key: 'blog', name: '博客地址', value: '' },
  { key: 'juejin', name: '掘金地址', value: '' },
  { key: 'weibo', name: '微博地址', value: '' },
  { key: 'email', name: '邮箱地址', value: '' },
])

const calcIsNotEmpty = computed(() => result.value.some(item => item.value !== ''))

function handleGetData() {
  for (const key in socialConfig.value) {
    if (key === 'enabled')
      continue
    const item = result.value.find(x => x.key === key)
    if (item) {
      item.value = String(socialConfig.value[key] || '')
    }
  }
}

function handleOnClick(item: { value: string, name: string }) {
  if (!item.value)
    return
  uni.setClipboardData({
    data: item.value,
    showToast: false,
    success: () => {
      uni.showToast({ icon: 'none', title: `${item.name} 已复制！` })
    },
  })
}

watch(socialConfig, () => {
  handleGetData()
}, { deep: true, immediate: true })

onLoad(() => {
  uni.setNavigationBarTitle({ title: '联系博主' })
})
</script>

<template>
  <view class="app-page box-border min-h-screen w-screen flex flex-col items-center bg-white pt-[160rpx]">
    <!-- 博主信息 -->
    <view class="profile flex flex-col items-center p-9">
      <view class="avatar relative box-border h-[170rpx] w-[170rpx] overflow-hidden border-6 border-white rounded-full shadow-sm">
        <image class="avatar-img h-full w-full" :src="bloggerInfo.avatar" mode="aspectFill" />
      </view>
      <view class="nickname mt-6 text-[38rpx] font-bold">
        {{ bloggerInfo.nickname }}
      </view>
      <view class="desc mt-6 text-center text-[26rpx] text-[#666]">
        {{ bloggerInfo.description || '这个博主很懒，竟然没写介绍~' }}
      </view>
    </view>

    <!-- 联系方式列表 -->
    <view class="contact box-border w-full px-12 pt-12" style="border-top: 2rpx solid #f2f2f2;">
      <block v-if="calcIsNotEmpty">
        <view
          v-for="item in result.filter(i => i.value)"
          :key="item.key"
          class="item mt-6 box-border rounded-xl bg-[#fafafa] p-4"
          @click="handleOnClick(item)"
        >
          <view class="left box-border w-[160rpx] flex items-center">
            <text class="name text-[24rpx] text-[#555]">{{ item.name }}</text>
          </view>
          <view class="right box-border w-0 flex flex-1 flex-wrap items-center break-all pl-3 text-[24rpx] text-[#333]">
            {{ item.value }}
          </view>
        </view>
      </block>
      <view v-else class="empty pt-12">
        <wd-empty description="暂无联系方式" />
      </view>
    </view>
  </view>
</template>

<style scoped>
.app-page {
  /* 布局全部由 UnoCSS 原子类实现 */
}
</style>
