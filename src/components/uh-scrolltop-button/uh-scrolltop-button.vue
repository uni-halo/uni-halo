<script setup lang="ts">
interface IProps {
  customClass?: string
  fixed?: boolean
}

const props = withDefaults(defineProps<IProps>(), {
  customClass: '',
  fixed: true,
})

const emits = defineEmits<{
  'is-visible': [visible: boolean]
}>()

function handleScrollTop() {
  uni.pageScrollTo({ scrollTop: 0, duration: 500 })
}

// 黑名单模式
const blackList = [
  'pages/auth/login',
  'pages/auth/register',
  'pages/index/index',
  'pages/tabbar/blogger/blogger',
  'pages/maintenance/maintenance',
  'pages-blog/setting/setting',
  'pages-blog/love/love',
  'pages-blog/contact/contact',
  'pages-blog/about-project/about-project',
  'pages-blog/draw-canvas/draw-canvas',
  'pages-blog/footprint/footprint',
  'pages/auth/wechat-bind',
  'pages-admin/my-profile/my-profile',
  'uni_modules/uh-upgrade/pages/upgrade-popup',
]
const pages = getCurrentPages()
const currentPage = pages[pages.length - 1]
const visible = computed(() => {
  return !blackList.includes(currentPage.route)
})

const _customClass = computed(() => {
  const colorClass = currentPage.route.includes('/love/') ? 'text-love' : 'text-primary'
  return `${props.customClass} ${colorClass}`
})

watch((visible), (newVal) => {
  emits('is-visible', newVal)
}, { immediate: true })
</script>

<template>
  <view v-if="visible" :class="[props.fixed ? 'fixed bottom-22 right-3 z-50 pb-safe' : '']">
    <view
      class="uh-global-card-glass h-10 w-10 flex items-center justify-center border rounded-full"
      :class="_customClass" @click="handleScrollTop"
    >
      <wd-icon name="arrow-up" size="42rpx" />
    </view>
  </view>
</template>
