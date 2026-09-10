<script lang="ts" setup>
/**
 * 小程序友链信息弹窗
 * 展示本站小程序申请提交的信息,字段结构与小程序提交申请弹窗(uh-links-mini-apply)一致:
 * 小程序名称/太阳码/跳转地址/作者昵称/作者头像/作者网站/描述/申请说明/邮箱
 * 数据源:插件端 getConfigs.pluginConfig.linkInfo(字段名与插件端一致,无映射;
 * displayName/miniProgramCode/link/description/applyRemark/authorName/avatar/website;
 * email 不在插件端维护,读不到时弹窗该栏自动隐藏)
 */
import { computed, ref, watch } from 'vue'
import { useAppConfigStore } from '@/store/appConfig'
import { checkAvatarUrl, checkImageUrl } from '@/utils/url'

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

/** 小程序申请信息(字段与 uh-links-mini-apply 表单一致；小程序信息读 linkInfo.miniInfo；
 * 作者信息 2026-09-10 起改读应用设置-博主资料 authorConfig.blogger（linkInfo.authorInfo 已下线），字段名无映射) */
const miniInfo = computed(() => {
  const miniCfg = (appConfigStore.configs.pluginConfig?.linkInfo?.miniInfo || {}) as Record<string, unknown>
  const blogger = (appConfigStore.configs.authorConfig?.blogger || {}) as Record<string, unknown>
  const str = (cfg: Record<string, unknown>, key: string, fallback = '') => String(cfg[key] || fallback || '')
  return {
    displayName: str(miniCfg, 'displayName'),
    miniProgramCode: str(miniCfg, 'miniProgramCode'),
    link: str(miniCfg, 'link'),
    // 作者信息：博主资料 nickname/avatar/website（官网地址 2026-09-10 新增）
    authorName: str(blogger, 'nickname'),
    avatar: str(blogger, 'avatar'),
    website: str(blogger, 'website'),
    description: str(miniCfg, 'description'),
    applyRemark: str(miniCfg, 'applyRemark'),
    email: str(miniCfg, 'email'),
  }
})

const hasInfo = computed(() => !!(miniInfo.value.displayName || miniInfo.value.miniProgramCode))

/** 复制跳转地址 */
function handleCopyLink() {
  if (!miniInfo.value.link) {
    uni.showToast({ icon: 'none', title: '暂未填写跳转地址' })
    return
  }
  uni.setClipboardData({
    data: miniInfo.value.link,
    showToast: false,
    success: () => {
      uni.showToast({ icon: 'none', title: '地址复制成功！' })
    },
    fail: () => {
      uni.showToast({ icon: 'none', title: '复制失败！' })
    },
  })
}

/** 复制小程序申请信息(拼接文案) */
function handleCopyInfo() {
  const info = miniInfo.value
  const text = [
    info.displayName ? `小程序名称：${info.displayName}` : '',
    info.link ? `小程序地址：${info.link}` : '',
    info.authorName ? `作者昵称：${info.authorName}` : '',
    info.website ? `作者网站：${info.website}` : '',
    info.description ? `小程序描述：${info.description}` : '',
    info.applyRemark ? `申请说明：${info.applyRemark}` : '',
    info.email ? `通知邮箱：${info.email}` : '',
  ].filter(Boolean).join('\n')
  uni.setClipboardData({
    data: text,
    showToast: false,
    success: () => {
      uni.showToast({ icon: 'none', title: '复制成功！' })
    },
    fail: () => {
      uni.showToast({ icon: 'none', title: '复制失败！' })
    },
  })
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
    v-model="isShow" :z-index="100" position="bottom"
    custom-class="!border rounded-xl" @close="handleClose"
  >
    <view class="relative box-border w-full flex items-center justify-around px-4 pt-4">
      <view class="w-full flex flex-col gap-y-1">
        <text class="text-md font-bold">小程序友链信息</text>
        <text class="text-xs text-gray-500">本站小程序申请提交的信息,欢迎互换</text>
      </view>
      <view
        class="uh-global-card-glass absolute right-4 top-4 h-6 w-6 border rounded-lg text-center shadow-none"
        @click="handleClose"
      >
        <wd-icon name="close" size="32rpx" class="text-gray-500" />
      </view>
    </view>

    <scroll-view :scroll-y="true" :show-scrollbar="false" class="box-border max-h-[60vh] p-4">
      <!-- 未配置信息占位 -->
      <view v-if="!hasInfo" class="py-10 text-center text-xs text-gray-400">
        暂未配置小程序申请信息
      </view>

      <template v-else>
        <!-- 太阳码大图(点击预览) -->
        <view v-if="miniInfo.miniProgramCode" class="code-area flex flex-col items-center">
          <image
            class="code-img h-32 w-32 rounded-xl"
            :src="checkImageUrl(miniInfo.miniProgramCode)" mode="aspectFill"
            @click="handlePreviewCode"
          />
          <view class="code-tip mt-3 flex items-center text-xs text-gray-400">
            <wd-icon name="picture" size="14px" color="#a8a294" />
            <text class="ml-1">点击预览太阳码</text>
          </view>
        </view>

        <!-- 名称 -->
        <view v-if="miniInfo.displayName" class="mini-head mt-5 flex items-center">
          <text class="mini-name text-[34rpx] text-gray-900 font-bold">{{ miniInfo.displayName }}</text>
        </view>

        <!-- 描述 -->
        <view v-if="miniInfo.description" class="mini-desc mt-4 text-[28rpx] text-gray-600 leading-[1.6]">
          {{ miniInfo.description }}
        </view>

        <!-- 作者信息 -->
        <view
          v-if="miniInfo.authorName || miniInfo.avatar || miniInfo.website"
          class="mini-author-info mt-5 flex items-center rounded-xl bg-[#f6f3ee] p-4"
        >
          <image
            v-if="miniInfo.avatar" class="author-avatar h-[72rpx] w-[72rpx] shrink-0 rounded-full"
            :src="checkAvatarUrl(miniInfo.avatar)" mode="aspectFill"
          />
          <view class="author-detail ml-4 flex flex-1 flex-col">
            <text
              v-if="miniInfo.authorName"
              class="author-name text-[28rpx] text-gray-900 font-medium"
            >
              {{ miniInfo.authorName }}
            </text>
            <text
              v-if="miniInfo.website"
              class="author-website mt-1 overflow-hidden truncate whitespace-nowrap text-xs text-gray-400"
            >
              网站：{{ miniInfo.website }}
            </text>
          </view>
        </view>

        <!-- 跳转地址 -->
        <view v-if="miniInfo.link" class="mini-link mt-5 flex items-center justify-between rounded-xl bg-secondary p-4">
          <view class="link-text flex-1 overflow-hidden truncate whitespace-nowrap text-[26rpx] text-[#4d7c0f]">
            {{ miniInfo.link }}
          </view>
          <text class="ml-3 shrink-0 text-[26rpx] text-[#4d7c0f] font-bold" @click="handleCopyLink">复制</text>
        </view>

        <!-- 申请说明 / 邮箱 -->
        <view
          v-if="miniInfo.applyRemark || miniInfo.email"
          class="mini-extra mt-5 flex flex-col gap-2 rounded-xl bg-[#f6f3ee] p-4 text-xs text-gray-500"
        >
          <view v-if="miniInfo.applyRemark">
            <text class="text-gray-400">申请说明：</text>{{ miniInfo.applyRemark }}
          </view>
          <view v-if="miniInfo.email">
            <text class="text-gray-400">通知邮箱：</text>{{ miniInfo.email }}
          </view>
        </view>

        <view class="my-6">
          <uh-button custom-class="py-2 !rounded-xl" @click="handleCopyInfo">
            复制小程序申请信息
          </uh-button>
        </view>
      </template>
    </scroll-view>
  </uh-glass-popup>
</template>
