<script lang="ts" setup>
/**
 * 插件不可用提示(源自旧项目 components/plugin-unavailable,新建复刻)
 * 当依赖的 Halo 插件未安装/未启用时展示:插件 logo、名称、错误标签、描述、插件地址、复制/反馈按钮
 */
import { computed } from 'vue'
import { NeedPlugins } from '@/utils/plugin'

const props = withDefaults(defineProps<{
  /** 插件名称(与 NeedPlugins 中的 id 对应) */
  pluginId: string
  errorText?: string
  useDecoration?: boolean
  useBorder?: boolean
  customStyle?: Record<string, string>
}>(), {
  errorText: '',
  useDecoration: true,
  useBorder: true,
  customStyle: () => ({}),
})

const emit = defineEmits<{
  (e: 'on-refresh'): void
}>()

/** 插件信息(未在清单中时兜底) */
const pluginInfo = computed(() => {
  const info = NeedPlugins.get(props.pluginId)
  return info || {
    id: props.pluginId,
    name: props.pluginId,
    desc: '',
    logo: '',
    url: '',
  }
})

const defaultStyle = {
  width: '80vw',
  borderRadius: '24rpx',
}

const calcCustomStyle = computed(() => ({
  ...defaultStyle,
  ...props.customStyle,
}))

function copy() {
  if (!pluginInfo.value.url)
    return
  uni.setClipboardData({
    data: pluginInfo.value.url,
    showToast: false,
    success: () => {
      uni.showToast({ icon: 'none', title: '插件地址已复制' })
    },
  })
}
</script>

<template>
  <view
    v-if="pluginInfo"
    class="uh-plugin-unavailable mx-auto my-auto box-border flex flex-col gap-6 p-10 text-[28rpx]"
    :class="{ border: useBorder, decoration: useDecoration }"
    :style="[calcCustomStyle]"
  >
    <!-- 图标 -->
    <image class="plugin-logo box-border h-[120rpx] w-[120rpx] rounded-3xl" :src="pluginInfo.logo" mode="scaleToFill" />
    <!-- 名称 -->
    <view class="plugin-name box-border text-[32rpx] text-[#333] font-bold">
      {{ pluginInfo.name }}
    </view>
    <!-- 错误标签 -->
    <view class="plugin-error box-border rounded-[36rpx] px-4 py-1.5 text-[24rpx] font-bold" style="background-color: rgb(255 61 49 / 7.5%); color: rgb(255 61 49);">
      未安装/启用插件
    </view>
    <!-- 描述 -->
    <view class="plugin-desc box-border w-[60vw] text-center text-[24rpx] text-[#64748b]">
      {{ pluginInfo.desc }}
    </view>
    <!-- 自定义错误提示 -->
    <view v-if="errorText" class="plugin-tip box-border border-2 rounded-xl border-dashed px-5 py-2.5 text-[24rpx]" style="border-color: #f2c97d; color: #f0a020;">
      {{ errorText }}
    </view>
    <!-- 插件地址 -->
    <view class="plugin-url box-border w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-xl bg-[#f1f5f9] px-6 py-4 text-[24rpx] text-[#666]">
      插件地址：{{ pluginInfo.url }}
    </view>
    <!-- 反馈按钮/复制地址 -->
    <view class="plugin-btns box-border w-full">
      <!-- #ifndef MP-WEIXIN -->
      <wd-button type="primary" block size="medium" @click="copy">
        复制地址
      </wd-button>
      <!-- #endif -->
      <!-- #ifdef MP-WEIXIN -->
      <view class="flex gap-3">
        <wd-button type="primary" plain block size="medium" @click="copy">
          复制地址
        </wd-button>
        <wd-button type="warning" plain block size="medium" open-type="contact">
          提交反馈
        </wd-button>
      </view>
      <!-- #endif -->
    </view>
    <!-- 刷新按钮 -->
    <view class="flex justify-center">
      <wd-button size="small" plain type="info" @click="emit('on-refresh')">
        刷新试试
      </wd-button>
    </view>

    <view class="plugin-copyright text-[20rpx] text-[#999]" style="transform: scale(0.9) translateY(20px);">
      提示：请确保 Halo 博客已安装相关插件
    </view>
  </view>
</template>

<style scoped lang="scss">
.uh-plugin-unavailable {
  &.border {
    border: 2rpx solid #eee;
  }

  &.decoration {
    background-color: rgb(255 255 255 / 95%);
    box-shadow: 0 0 12rpx rgb(226 232 240 / 35%);
    backdrop-filter: blur(6rpx);
    border-top: 12rpx solid rgb(3 169 244);
  }
}
</style>
