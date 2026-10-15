<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useAppConfigStore } from '@/store/appConfig'
import { copyToClipboard } from '@/utils/clipboard'
import { buildSiteLinkText } from '@/utils/friendLinkText'
import { checkImageUrl } from '@/utils/url'
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

/** 逐项友链信息（行尾支持单独复制） */
const infoFields = computed(() => {
  const blogger = configs.value.featureConfig?.profile?.blogger || {}
  return [
    { label: '站点名称', value: blogDetail.value.displayName || '' },
    { label: '站点地址', value: blogDetail.value.url || '' },
    { label: '站点头像', value: checkImageUrl(blogDetail.value.logo) },
    { label: '站点简介', value: blogDetail.value.description || '' },
    { label: '作者昵称', value: blogger.nickname || '' },
    { label: '作者头像', value: checkImageUrl(blogger.avatar || '') },
    { label: '作者网站', value: blogger.website || '' },
    { label: '通知邮箱', value: blogger.email || '' },
  ].filter(item => item.value)
})

/** 复制友链信息（约定格式，供申请表单粘贴识别） */
function handleCopyLink() {
  const blogger = configs.value.featureConfig?.profile?.blogger || {}
  copyToClipboard(buildSiteLinkText({
    ...blogDetail.value,
    authorName: blogger.nickname || '',
    avatar: blogger.avatar || '',
    website: blogger.website || '',
    email: blogger.email || '',
  }), '友链信息复制成功！')
}

/** 单独复制一项友链信息 */
function handleCopyField(value: string) {
  copyToClipboard(value)
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
    v-model="isShow" :z-index="100" position="bottom" custom-class="!border !rounded-2xl"
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
          class="uh-global-card-glass absolute right-0 top-0 h-6 w-6 flex items-center justify-center border rounded-lg shadow-none"
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
              custom-class="uh-global-card-glass shadow-none !text-xl !h-14 !w-14 !shrink-0 !text-primary !font-semibold"
              class="!rounded-2xl"
              :src="checkImageUrl(blogDetail.logo)"
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

          <!-- 信息逐项展示（行尾支持单独复制） -->
          <view class="flex flex-col gap-y-2">
            <view
              v-for="field in infoFields" :key="field.label"
              class="uh-global-card-glass flex items-center gap-x-2 border rounded-lg px-3 py-2 !shadow-none"
            >
              <text class="shrink-0 text-xs text-gray-400">{{ field.label }}</text>
              <text class="flex-1 truncate text-xs text-gray-600">{{ field.value }}</text>
              <view class="shrink-0" @click.stop="handleCopyField(field.value)">
                <wd-icon name="copy" size="26rpx" class="text-gray-500" />
              </view>
            </view>
          </view>
        </view>
      </scroll-view>
      <!-- 底部固定操作区域 -->
      <view class="box-border w-full flex items-center">
        <uh-button
          class="flex-1" custom-class="flex-1 uh-global-card-glass uh-shadow-xs border !py-2.5 !rounded-xl !text-3xs !bg-primary"
          @click="handleCopyLink"
        >
          复制友链信息
        </uh-button>
      </view>
    </view>
  </uh-glass-popup>
</template>
