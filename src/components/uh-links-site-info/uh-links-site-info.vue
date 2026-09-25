<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useAppConfigStore } from '@/store/appConfig'
import { checkAvatarUrl } from '@/utils/url'
import { getAvatarFallbackText } from '@/utils/avatar'

defineOptions({
  options: {
    styleIsolation: 'apply-shared',
  },
})

const props = withDefaults(defineProps<{
  show?: boolean
}>(), {
  show: false,
})

const emit = defineEmits<{
  (e: 'on-close'): void
}>()

const isShow = ref(false)
const { configs } = storeToRefs(useAppConfigStore())

const blogDetail = computed(() => configs.value.featureConfig?.linkInfo?.siteInfo || {})

/** 友链交换信息文案(复制用) */
const calcBlogContent = computed(() => {
  const blogger = configs.value.featureConfig?.profile?.blogger || {}
  return [
    `博客名称：${blogDetail.value.displayName || ''}`,
    `博客地址：${blogDetail.value.url || ''}`,
    `博客logo：${checkAvatarUrl(blogDetail.value.logo)}`,
    `博客简介：${blogDetail.value.description || ''}`,
    blogger.avatar ? `作者头像：${checkAvatarUrl(blogger.avatar)}` : '',
    blogger.nickname ? `作者昵称：${blogger.nickname}` : '',
    blogger.website ? `作者网站：${blogger.website}` : '',
    blogger.email ? `通知邮箱：${blogger.email}` : '',
  ].join('\n')
})

function handleCopyLink() {
  uni.setClipboardData({
    data: calcBlogContent.value,
    showToast: false,
    success: () => {
      uni.showToast({ icon: 'none', title: '复制成功！' })
    },
    fail: () => {
      uni.showToast({ icon: 'none', title: '复制失败！' })
    },
  })
}

function handleClose() {
  isShow.value = false
  emit('on-close')
}

watch(() => props.show, (val) => {
  isShow.value = val
})
</script>

<template>
  <uh-glass-popup
    v-model="isShow" :z-index="100" position="bottom" custom-class="!border rounded-2xl"
    @close="handleClose"
  >
    <!-- 弹窗容器 -->
    <view class="box-border w-full flex flex-col gap-y-3 p-3">
      <!-- 顶部 -->
      <view class="relative box-border w-full flex items-center justify-around">
        <view class="w-full flex flex-col gap-y-1">
          <text class="text-md font-bold">友链信息</text>
          <text class="text-xs text-gray-500">本站友链交换信息,欢迎申请互换友链</text>
        </view>
        <view
          class="uh-global-card-glass absolute right-0 top-0 h-6 w-6 border rounded-lg text-center shadow-none"
          @click="handleClose"
        >
          <wd-icon name="close" size="28rpx" class="text-gray-500" />
        </view>
      </view>
      <!-- 滚动区域 -->
      <scroll-view :scroll-y="true" :show-scrollbar="false" class="box-border max-h-[60vh]">
        <!-- 滚动内部容器 -->
        <view class="w-full flex flex-col gap-y-3">
          <!-- 博客名片 -->
          <view class="flex items-center">
            <wd-avatar
              custom-class="uh-global-card-glass !h-14 !w-14 !shrink-0 !text-gray-900 !font-bold"
              class="!rounded-2xl"
              :src="checkAvatarUrl(blogDetail.logo)"
              :text="getAvatarFallbackText(blogDetail.displayName)"
              mode="aspectFill"
            />
            <view class="ml-4 flex flex-1 flex-col justify-center gap-y-1">
              <text class="text-md text-gray-900 font-bold">
                {{ blogDetail.displayName || '未命名博客' }}
              </text>
              <text class="text-xs text-gray-500">
                {{ blogDetail.description || '这个博主很懒，没写简介~' }}
              </text>
            </view>
          </view>

          <!-- 交换信息文案 -->
          <view class="whitespace-pre-wrap text-3xs text-gray-900 leading-6">
            <text>{{ calcBlogContent }}</text>
          </view>
        </view>
      </scroll-view>
      <!-- 底部固定操作区域 -->
      <view class="box-border w-full flex items-center">
        <uh-button
          class="flex-1" custom-class="flex-1 uh-global-card-glass uh-shadow-xs border !py-2.5 !rounded-xl !text-3xs !bg-primary"
          @click="handleCopyLink"
        >
          复制友链交换信息
        </uh-button>
      </view>
    </view>
  </uh-glass-popup>
</template>
