<script setup lang="ts">
import { computed, ref } from 'vue'

defineOptions({
  options: {
    styleIsolation: 'apply-shared',
  },
})

const props = withDefaults(defineProps<IProps>(), {
  defaultTitle: '博主',
  scrollTitle: '博主',
  scrollY: 0,
})

interface IProps {
  defaultTitle?: string
  scrollTitle?: string
  scrollY?: number
}

// 获取窗口信息
const windowInfo = uni.getWindowInfo()
const statusBarHeight = computed(() => windowInfo.statusBarHeight)

const maxAlpha = ref(0.8)
const customStyle = computed(() => {
  const alpha = Math.min(props.scrollY / 360, maxAlpha.value)
  return {
    paddingTop: `${statusBarHeight.value}px`,
    backdropFilter: 'blur(4rpx)',
    backgroundColor: `rgba(255, 255, 255, ${alpha})`,
  }
})
const scrollThreshold = computed(() => {
  return props.scrollY / 360 <= 0.5
})

const customClass = computed(() => {
  const _class = []
  if (scrollThreshold.value) {
    _class.push('text-white')
  }
  else {
    _class.push('text-gray-900')
  }
  return _class
})

const visibleTitle = computed(() => {
  if (scrollThreshold.value) {
    return props.defaultTitle
  }
  return props.scrollTitle
})
/** 微信扫码绑定二维码内容前缀(与插件端 Constants.QR_BIND_WECHAT_PREFIX 约定一致) */
const QR_BIND_WECHAT_PREFIX = 'uh-bindwx-'

function handleScan() {
  uni.scanCode({
    scanType: ['qrCode'],
    success: (res) => {
      const content = res.result || ''
      // 微信绑定二维码:跳转确认页完成绑定
      if (content.startsWith(QR_BIND_WECHAT_PREFIX)) {
        const ticket = content.slice(QR_BIND_WECHAT_PREFIX.length)
        uni.navigateTo({
          url: `/pages/auth/wechat-bind?ticket=${encodeURIComponent(ticket)}`,
        })
        return
      }
      console.log('扫码成功', res)
      // todo: 处理其他扫码结果 比如跳转到指定页面
    },
    fail: () => {
      uni.showToast({
        title: '扫码失败',
        icon: 'none',
      })
    },
  })
}
</script>

<template>
  <view class="fixed left-0 top-0 z-100 box-border w-full" :class="customClass" :style="[customStyle]">
    <view class="box-border h-[46px] w-full flex items-center gap-x-4 px-4">
      <view class="min-w-18 flex shrink-0 items-center">
        <view
          class="uh-global-card-glass uh-shadow-xs h-7 w-7 flex items-center justify-center gap-x-2 border rounded-full text-primary"
          @click="handleScan()"
        >
          <wd-icon name="scan" size="30rpx" />
        </view>
      </view>
      <!-- 中间 -->
      <view class="flex-1 truncate text-center font-bold transition-colors duration-300">
        <slot> {{ visibleTitle }} </slot>
      </view>
      <!-- 右边 -->
      <view class="min-w-18 shrink-0">
        <slot name="right" />
      </view>
    </view>
  </view>
</template>
