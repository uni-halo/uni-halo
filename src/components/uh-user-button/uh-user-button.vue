<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useTokenStore } from '@/store/token'
import { useAppConfigStore } from '@/store/appConfig'
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
  'action-click': [isLogin: boolean]
  'is-visible': [visible: boolean]
}>()

const { configs } = storeToRefs(useAppConfigStore())
const loginConfig = computed(() => configs.value.loginConfig?.client)
const loginEntryVisible = computed(() =>
  loginConfig.value?.passwordLoginEnabled !== false
  || loginConfig.value?.wechatLoginEnabled === true)

const { hasLogin, validToken } = storeToRefs(useTokenStore())
const { updateNowTime } = useTokenStore()
const { userInfo } = storeToRefs(useUserStore())

// 黑名单模式(入口页/维护页等过渡页不展示)
const blackList = [
  'pages/index/index',
  'pages/maintenance/maintenance',
  'pages/auth/wechat-bind',
  'pages/auth/login',
  'pages/auth/register',
]
const pages = getCurrentPages()
const currentPage = pages[pages.length - 1]
const visible = computed(() => {
  return loginEntryVisible.value && !blackList.includes(currentPage.route)
})

const _customClass = computed(() => {
  const colorClass = currentPage.route.includes('/love/') ? '!text-love' : '!text-primary'
  return `${props.customClass} ${colorClass}`
})

const avatarSrc = computed(() => checkAvatarUrl(userInfo.value.avatar || ''))
const avatarText = computed(() => getAvatarFallbackText(userInfo.value.nickname || userInfo.value.username))

function handleClick() {
  // 无 token:保持原逻辑,跳转登录页
  if (!validToken.value) {
    emits('action-click', false)
    return
  }
  // 有 token:校验会话有效性,失效则提示并拦截(不打开侧边栏,不跳转)
  if (!updateNowTime().hasLogin) {
    uni.showToast({ icon: 'none', title: '登录已过期，请重新登录' })
    return
  }
  emits('action-click', true)
}
watch((visible), (newVal) => {
  emits('is-visible', newVal)
}, { immediate: true })
</script>

<template>
  <view
    v-if="visible" :class="[props.fixed ? 'fixed bottom-22 right-3 z-50 pb-safe' : '', props.containerClass]"
    @click="handleClick"
  >
    <view
      class="uh-global-card-glass h-10 w-10 flex items-center justify-center border rounded-full"
    >
      <wd-avatar
        v-if="hasLogin"
        :src="avatarSrc"
        :text="avatarText"
        shape="round"
        bg-color="transparent"
        custom-style="font-size:32rpx"
        mode="aspectFill"
        custom-class="!w-full !h-full block"
        :class="_customClass"
      />
      <wd-icon v-else name="user" size="42rpx" :class="_customClass" />
    </view>
  </view>
</template>
