<script setup lang="ts">
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
  'action-click': []
  'is-visible': [visible: boolean]
}>()

// 白名单模式
const whiteList = [
  'pages/tabbar/home/home',
  'pages/tabbar/moments/moments',
  'pages-blog/articles/articles',
  'pages-blog/article-detail/article-detail',
  'pages-blog/archives/archives',
  'pages-blog/friend-links/friend-links',
]
const pages = getCurrentPages()
const currentPage = pages[pages.length - 1]
const visible = computed(() => {
  return whiteList.includes(currentPage.route)
})

const _customClass = computed(() => {
  const colorClass = currentPage.route.includes('/love/') ? 'text-love' : 'text-primary'
  return `${props.customClass} ${colorClass}`
})

function handleClick() {
  emits('action-click')
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
      :class="_customClass"
    >
      <wd-icon name="settings" size="42rpx" />
    </view>
  </view>
</template>
