<script lang="ts" setup>
/**
 * 站点友链信息弹窗(源自旧页面 pages-blog/submit-link 的博客详情弹窗,重设计为底部玻璃弹窗)
 * 展示本站友链交换信息(博客名片 + 复制交换信息 + 站点缩略图)
 * 数据源为 linksSubmitPlugin 配置(即本站申请提交的信息)
 */
import { computed, ref, watch } from 'vue'
import { useAppConfigStore } from '@/store/appConfig'
import { checkAvatarUrl } from '@/utils/url'

const props = withDefaults(defineProps<{
  show?: boolean
}>(), {
  show: false,
})

const emit = defineEmits<{
  (e: 'on-close'): void
}>()

const isShow = ref(false)
const appConfigStore = useAppConfigStore()

const blogDetail = computed(() => (appConfigStore.configs.pluginConfig?.linksSubmitPlugin as {
  blogName?: string
  blogUrl?: string
  blogLogo?: string
  blogDesc?: string
} | undefined) || {})

/** 友链交换信息文案(复制用) */
const calcBlogContent = computed(() => `
博客名称：${blogDetail.value.blogName || ''}
博客地址：${blogDetail.value.blogUrl || ''}
博客logo：${checkAvatarUrl(blogDetail.value.blogLogo)}
博客简介：${blogDetail.value.blogDesc || ''}
`)

function calcSiteThumbnail(val?: string): string {
  if (!val)
    return ''
  const _val = val.endsWith('/') ? val : `${val}/`
  return `https://image.thum.io/get/width/1000/crop/800/${_val}`
}

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
    v-model="isShow" :z-index="100" position="bottom"
    custom-class="!border rounded-xl" @close="handleClose"
  >
    <view class="relative box-border w-full flex items-center justify-around px-4 pt-4">
      <view class="w-full flex flex-col gap-y-1">
        <text class="text-md font-bold">友链信息</text>
        <text class="text-xs text-gray-500">本站友链交换信息,欢迎申请互换友链</text>
      </view>
      <view
        class="uh-global-card-glass absolute right-4 top-4 h-6 w-6 border rounded-lg text-center shadow-none"
        @click="handleClose"
      >
        <wd-icon name="close" size="32rpx" class="text-gray-500" />
      </view>
    </view>
    <scroll-view :scroll-y="true" :show-scrollbar="false" class="box-border max-h-[60vh] p-4">
      <!-- 博客名片 -->
      <view class="flex items-center">
        <image
          class="uh-global-card-glass h-20 w-20 shrink-0 rounded-2xl"
          :src="checkAvatarUrl(blogDetail.blogLogo)" mode="aspectFill"
        />
        <view class="ml-4 flex flex-1 flex-col justify-center gap-y-1">
          <text class="text-md text-gray-900 font-bold">
            {{ blogDetail.blogName || '未命名博客' }}
          </text>
          <text class="text-xs text-gray-500">
            {{ blogDetail.blogDesc || '这个博主很懒，没写简介~' }}
          </text>
        </view>
      </view>

      <!-- 交换信息文案 -->
      <view class="mt-4 whitespace-pre-wrap text-xs text-gray-600 leading-5">
        <text>{{ calcBlogContent }}</text>
      </view>

      <!-- 站点缩略图 -->
      <image
        v-if="blogDetail.blogUrl" class="mt-4 h-[320rpx] w-full rounded-xl"
        :src="calcSiteThumbnail(blogDetail.blogUrl)" mode="aspectFill"
      />

      <view class="my-6">
        <uh-button custom-class="py-2 !rounded-xl" @click="handleCopyLink">
          复制友链交换信息
        </uh-button>
      </view>
    </scroll-view>
  </uh-glass-popup>
</template>
