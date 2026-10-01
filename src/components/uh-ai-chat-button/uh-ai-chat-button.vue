<script setup lang="ts">
import { dialogNeedLogin, fetchDialogConfigOrNull } from '@/api/dialog-config'
import { storeToRefs } from 'pinia'
import { useAppConfigStore } from '@/store/appConfig'

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

// 黑名单模式：这些页面不显示入口
const blackList: string[] = [
  'pages/index/index',
  'pages/maintenance/maintenance',
]
const pages = getCurrentPages()
const currentPage = pages[pages.length - 1]

const { configs } = storeToRefs(useAppConfigStore())

/** 站点开关：aiAssistant.enabled 显式 false 时隐藏入口（缺省视为开启，兼容存量站点） */
const assistantEnabled = computed(
  () => configs.value?.integrationConfig?.pluginConfig?.aiAssistant?.enabled !== false,
)

/** 登录能力是否可用(账号密码登录或小程序一键登录任一开启, 与登录页判定一致) */
const loginAvailable = computed(() => {
  const client = configs.value.loginConfig?.client
  return client?.passwordLoginEnabled !== false || client?.wechatLoginEnabled === true
})

/** 对话功能可用：插件已启用(dialogConfig 可访问) 且 (匿名可对话 或 要求登录但登录能力可用) */
const dialogAvailable = ref(false)

// 显隐校验:
// 1. 插件是否开启: dialogConfig 接口不可用(404/请求失败)即视为未启用
// 2. 访问模式要求登录(authenticated_*)且登录能力整体关闭(两方式开关全关)时不显示
async function checkDialogAvailable(force = false) {
  const config = await fetchDialogConfigOrNull(force)
  dialogAvailable.value = !!config && (!dialogNeedLogin(config) || loginAvailable.value)
}

onMounted(() => { checkDialogAvailable() })

const visible = computed(() => {
  return assistantEnabled.value && dialogAvailable.value && !blackList.includes(currentPage.route)
})

const _customClass = computed(() => {
  const colorClass = currentPage.route.includes('/love/') ? 'text-love' : 'text-primary'
  return `${props.customClass} ${colorClass}`
})

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
      class="uh-global-card-glass h-11 w-11 flex items-center justify-center border rounded-full"
      :class="_customClass"
    >
      <wd-icon name="message" size="42rpx" />
    </view>
  </view>
</template>
