<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAppConfigStore } from '@/store/appConfig'
import { copyToClipboard } from '@/utils/clipboard'
import { buildMiniLinkText } from '@/utils/friendLinkText'
import { checkImageUrl } from '@/utils/url'

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

const miniInfo = computed(() => {
  const miniCfg = configs.value.featureConfig?.linkInfo?.miniInfo
  const blogger = configs.value.featureConfig?.profile?.blogger
  return {
    displayName: miniCfg?.displayName || '',
    miniProgramCode: miniCfg?.miniProgramCode || '',
    appId: miniCfg?.appId || '',
    path: miniCfg?.path || '',
    link: miniCfg?.link || '',
    // 作者信息：博主资料 nickname/avatar/website
    authorName: blogger?.nickname || '',
    avatar: blogger?.avatar || '',
    website: blogger?.website || '',
    description: miniCfg?.description || '',
    applyRemark: miniCfg?.applyRemark || '',
  }
})

const hasInfo = computed(() => !!(miniInfo.value.displayName || miniInfo.value.miniProgramCode))

/** 逐项友链信息（行尾支持单独复制） */
const infoFields = computed(() => {
  return [
    { label: '应用名称', value: miniInfo.value.displayName },
    { label: '应用地址', value: miniInfo.value.link },
    { label: 'AppID', value: miniInfo.value.appId },
    { label: '路径', value: miniInfo.value.path },
    { label: '太阳码', value: checkImageUrl(miniInfo.value.miniProgramCode) },
    { label: '应用简介', value: miniInfo.value.description },
    { label: '申请说明', value: miniInfo.value.applyRemark },
    { label: '作者昵称', value: miniInfo.value.authorName },
    { label: '作者头像', value: checkImageUrl(miniInfo.value.avatar) },
    { label: '作者网站', value: miniInfo.value.website },
  ].filter(item => item.value)
})

/** 单独复制一项友链信息 */
function handleCopyField(value: string) {
  copyToClipboard(value)
}

/** 复制小程序友链信息（约定格式，供申请表单粘贴识别） */
function handleCopyInfo() {
  copyToClipboard(buildMiniLinkText(miniInfo.value), '友链信息复制成功！')
}

/** 预览太阳码 */
function handlePreviewCode() {
  if (!miniInfo.value.miniProgramCode)
    return
  uni.previewImage({
    urls: [checkImageUrl(miniInfo.value.miniProgramCode)],
    current: checkImageUrl(miniInfo.value.miniProgramCode),
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
    v-model="isShow" :z-index="100" position="bottom" custom-class="!border !rounded-2xl"
    @close="handleClose"
  >
    <!-- 弹窗容器 -->
    <view class="box-border w-full flex flex-col gap-y-3 p-3">
      <!-- 顶部 -->
      <view class="relative box-border w-full flex items-center justify-around">
        <view class="w-full flex flex-col gap-y-1">
          <text class="text-md font-bold">小程序友链信息</text>
          <text class="text-xs text-gray-500">本站小程序申请提交的信息,欢迎互换</text>
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
          <!-- 未配置信息占位 -->
          <view v-if="!hasInfo" class="py-10 text-center text-xs text-gray-400">
            暂未配置小程序申请信息
          </view>

          <template v-else>
            <view class="w-full flex items-center gap-x-3">
              <!-- 太阳码大图(点击预览) -->
              <view v-if="miniInfo.miniProgramCode" class="code-area flex flex-col items-center">
                <wd-img
                  class="code-img h-16 w-16" :radius="999" :src="checkImageUrl(miniInfo.miniProgramCode)"
                  mode="aspectFill" @click="handlePreviewCode"
                >
                  <template #loading>
                    <wd-loading size="64rpx" custom-class="text-primary" />
                  </template>
                </wd-img>
              </view>

              <view class="flex flex-1 flex-col gap-y-1">
                <!-- 名称 -->
                <view v-if="miniInfo.displayName" class="flex items-center">
                  <text class="mini-name text-lg text-gray-900 font-bold">{{ miniInfo.displayName }}</text>
                </view>

                <!-- 描述 -->
                <view v-if="miniInfo.description" class="text-2xs text-gray-600 leading-[1.6]">
                  {{ miniInfo.description }}
                </view>
              </view>
            </view>
            <view class="flex items-center">
              <text class="text-xs text-gray-400">温馨提示：点击图片可以预览太阳码</text>
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
          </template>
        </view>
      </scroll-view>

      <!-- 底部固定操作区域 -->
      <view class="box-border w-full flex items-center">
        <uh-button class="flex-1" custom-class="flex-1 uh-global-card-glass uh-shadow-xs border !py-2.5 !rounded-xl !text-3xs !bg-primary" @click="handleCopyInfo">
          复制友链信息
        </uh-button>
      </view>
    </view>
  </uh-glass-popup>
</template>
