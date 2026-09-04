<script lang="ts" setup>
/**
 * 联系博主页(源自旧项目 pagesA/contact,新建复刻)
 * 数字名片式设计:Hero 名片卡(渐变光斑透卡) + 品牌色字母瓦片联系方式列表,点击复制
 */
import { computed, ref, watch, watchEffect } from 'vue'
import { useAppConfigStore } from '@/store/appConfig'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { checkAvatarUrl } from '@/utils/url'

definePage({
  style: {
    navigationBarTitleText: '联系博主',
    navigationStyle: 'custom',
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

/** 平台瓦片(品牌色 + 字符);未覆盖的平台回退中性色与名称首字 */
const platformMeta: Record<string, { color: string, letter: string }> = {
  qq: { color: '#12b7f5', letter: 'Q' },
  wechat: { color: '#07c160', letter: '微' },
  github: { color: '#24292f', letter: 'G' },
  gitee: { color: '#c71d23', letter: 'G' },
  bilibili: { color: '#fb7299', letter: 'B' },
  csdn: { color: '#fc5531', letter: 'C' },
  blog: { color: '#3f51b5', letter: '博' },
  juejin: { color: '#1e80ff', letter: '掘' },
  weibo: { color: '#e6162d', letter: 'W' },
  email: { color: '#f57c00', letter: '@' },
}

const calcIsNotEmpty = computed(() => result.value.some(item => item.value !== ''))

/* ---------------- 加载状态机(本地配置,状态直接推导) ---------------- */
const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()
watchEffect(() => {
  updateLoadingStatus(calcIsNotEmpty.value ? DataLoadingStatusEnum.Success : DataLoadingStatusEnum.Empty)
})

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
</script>

<template>
  <view class="app-page box-border min-h-screen w-screen overflow-hidden bg-page px-4 pb-10 pt-6">
    <!-- 自定义导航 -->
    <uh-navbar default-title="联系博主" title-color="text-gray-900" />

    <!-- Hero 名片卡(主题色光斑透过毛玻璃形成柔和渐变) -->
    <view class="hero-wrap relative">
      <view class="absolute h-[220rpx] w-[220rpx] rounded-full bg-[rgba(185,228,36,0.32)] -right-8 -top-8" />
      <view class="absolute top-[150rpx] h-[180rpx] w-[180rpx] rounded-full bg-[rgba(215,249,76,0.45)] -left-10" />
      <view class="hero-card uh-global-card-glass relative flex flex-col items-center rounded-3xl px-6 pb-6 pt-10">
        <view class="avatar relative box-border h-[150rpx] w-[150rpx] overflow-hidden border-5 border-white/90 rounded-full shadow-lg">
          <image class="avatar-img h-full w-full" :src="bloggerInfo.avatar" mode="aspectFill" />
        </view>
        <view class="nickname mt-4 text-[38rpx] text-gray-900 font-bold">
          {{ bloggerInfo.nickname }}
        </view>
        <view class="desc mt-2 px-4 text-center text-[26rpx] text-gray-500 leading-relaxed">
          {{ bloggerInfo.description || '这个博主很懒，竟然没写介绍~' }}
        </view>
        <view class="mt-5 w-full flex items-center justify-center gap-2 border-t border-black/5 pt-4">
          <wd-icon name="copy" size="26rpx" color="#a8a294" />
          <text class="text-2xs text-gray-400">点击卡片即可复制对应内容</text>
        </view>
      </view>
    </view>

    <!-- 联系方式(状态机:无联系方式 → empty 态) -->
    <uh-data-loading
      v-if="loadingStatus !== 'success'" :loading-status="loadingStatus" min-height="30vh"
      empty-text="暂无联系方式" empty-sub-text="" @refresh="handleGetData"
    />
    <template v-else>
      <uh-section-title class="mb-3 mt-6 text-[30rpx]">
        联系方式
      </uh-section-title>
      <view class="flex flex-col gap-3">
        <view
          v-for="item in result.filter(i => i.value)"
          :key="item.key"
          class="item uh-global-card-glass flex items-center gap-3 rounded-2xl px-4 py-3"
          @click="handleOnClick(item)"
        >
          <view class="tile h-[76rpx] w-[76rpx] flex shrink-0 items-center justify-center rounded-xl" :style="{ backgroundColor: platformMeta[item.key]?.color || '#8a8a7a' }">
            <text class="text-[30rpx] text-white font-bold">{{ platformMeta[item.key]?.letter || item.name.slice(0, 1) }}</text>
          </view>
          <view class="min-w-0 flex flex-1 flex-col">
            <text class="text-[24rpx] text-gray-400">{{ item.name }}</text>
            <view class="mt-1 break-all text-[26rpx] text-gray-900 leading-snug">
              {{ item.value }}
            </view>
          </view>
          <wd-icon name="copy" size="28rpx" color="#c8c2b4" class="shrink-0" />
        </view>
      </view>
    </template>
  </view>
</template>
