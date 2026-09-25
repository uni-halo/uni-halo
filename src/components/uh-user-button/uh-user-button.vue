<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useTokenStore } from '@/store/token'
import { useUserStore } from '@/store/user'
import { checkAvatarUrl } from '@/utils/url'
import { getAvatarFallbackText } from '@/utils/avatar'

interface IProps {
  containerClass?: string
  customClass?: string
  fixed?: boolean
}

const props = withDefaults(defineProps<IProps>(), {
  customClass: '',
  fixed: true,
})

const emits = defineEmits<{
  (e: 'action-click'): void
}>()

const { hasLogin } = storeToRefs(useTokenStore())
const { userInfo } = storeToRefs(useUserStore())

// 黑名单模式(入口页/维护页等过渡页不展示)
const blackList = [
  'pages/index/index',
  'pages/maintenance/maintenance',
  'pages/auth/wechat-bind',
]
const pages = getCurrentPages()
const currentPage = pages[pages.length - 1]
const visible = computed(() => {
  return hasLogin.value && !blackList.includes(currentPage.route)
})

const _customClass = computed(() => {
  const colorClass = currentPage.route.includes('/love/') ? '!text-love' : '!text-primary'
  return `${props.customClass} ${colorClass}`
})

const avatarSrc = computed(() => checkAvatarUrl(userInfo.value.avatar || ''))
const avatarText = computed(() => getAvatarFallbackText(userInfo.value.nickname || userInfo.value.username))

function handleClick() {
  emits('action-click')
}
</script>

<template>
  <view
    v-if="visible" :class="[props.fixed ? 'fixed bottom-22 right-3 z-50 pb-safe' : '', props.containerClass]"
    @click="handleClick"
  >
    <view
      class="uh-global-card-glass h-11 w-11 flex items-center justify-center rounded-full"
    >
      <wd-avatar
        :src="avatarSrc"
        :text="avatarText"
        shape="round"
        bg-color="transparent"
        custom-style="font-size:32rpx"
        mode="aspectFill"
        custom-class="!w-full !h-full"
        :class="_customClass"
      />
    </view>
  </view>
</template>
