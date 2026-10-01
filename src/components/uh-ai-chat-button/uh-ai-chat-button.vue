<script setup lang="ts">
import { dialogNeedLogin, fetchDialogConfigOrNull } from '@/api/dialog-config'
import { useTokenStore } from '@/store/token'

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
const blackList: string[] = []
const pages = getCurrentPages()
const currentPage = pages[pages.length - 1]

const tokenStore = useTokenStore()
const hasLogin = computed(() => !!tokenStore.validToken)

/** 对话功能可用：插件已启用(dialogConfig 可访问) 且 (匿名可用 或 已登录) */
const dialogAvailable = ref(false)

// 显隐校验:
// 1. 插件是否开启: dialogConfig 接口不可用(404/请求失败)即视为未启用
// 2. 访问模式要求登录(authenticated_*)且未登录时不显示
async function checkDialogAvailable(force = false) {
  const config = await fetchDialogConfigOrNull(force)
  dialogAvailable.value = !!config && !dialogNeedLogin(config)
}

// 登录态变化后强制刷新配置（显隐随登录在 anonymous_*/authenticated_* 间切换）
watch(hasLogin, () => { checkDialogAvailable(true) })
onMounted(() => { checkDialogAvailable() })

const visible = computed(() => {
  return dialogAvailable.value && !blackList.includes(currentPage.route)
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
