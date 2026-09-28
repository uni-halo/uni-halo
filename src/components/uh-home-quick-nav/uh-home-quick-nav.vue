<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { useAppConfigStore } from '@/store/appConfig'
import { useLoveModuleUnlock } from '@/hooks/useLoveModuleUnlock'
import type { IQuickNavIconStyle, IQuickNavItem } from '@/api/types/uni-halo'

const { configs } = storeToRefs(useAppConfigStore())

const calcIsShowQuickNavigationEnabled = computed(() => configs.value.featureConfig?.pages?.home?.useQuickNavigation)

/** 快捷导航项(数据源为插件端配置；visible=false 隐藏) */
const navList = computed(() => {
  const configured = configs.value.featureConfig?.pages?.home?.quickNavigation
  return (configured || []).filter(item => item.visible !== false)
})

/** 解析条目当前生效的图标风格（iconMode 优先，缺省取 icons[0]，旧数据回退 icon/iconPrefix） */
function resolveItemIcon(item: IQuickNavItem): IQuickNavIconStyle | null {
  if (item.icons?.length) {
    return item.icons.find(i => i.key === item.iconMode) ?? item.icons[0]
  }
  return item.icon ? { key: 'emoji-font', prefix: item.iconPrefix || '', iconName: item.icon } : null
}

/* 恋爱模块解锁拦截(目前仅恋爱日记设密码,命中锁定则先解锁再跳转;样式不变) */
const {
  unlockModalVisible,
  unlockTip,
  handleUnlockRequest,
  handleUnlockSuccess,
  interceptNavigateByPath,
} = useLoveModuleUnlock()

function handleClickNav(item: { path?: string }) {
  if (!item.path) { return }
  // 命中恋爱模块且锁定 → 弹解锁弹窗,解锁成功后由 hook 自动跳转
  if (interceptNavigateByPath(item.path)) { return }
  uni.navigateTo({ url: item.path })
}
</script>

<template>
  <view
    v-if="calcIsShowQuickNavigationEnabled && navList.length"
    class="mb-3 box-border overflow-hidden rounded-xl p-3"
  >
    <uh-section-title> 快捷导航 </uh-section-title>
    <view class="grid grid-cols-5 mt-4 gap-4">
      <view
        v-for="item in navList" :key="item.key" class="flex flex-col items-center gap-2"
        @click="handleClickNav(item)"
      >
        <view
          class="uh-global-card-glass uh-shadow-xs h-13 w-13 flex items-center justify-center border rounded-2xl"
          :style="{
            backgroundColor: item.bgColor,
            color: item.iconColor || item.color,
          }"
        >
          <wd-icon
            :class-prefix="resolveItemIcon(item)?.prefix"
            :name="resolveItemIcon(item)?.iconName"
            :size="item.iconMode === 'emoji-font' ? '64rpx' : '56rpx'"
          />
        </view>
        <view class="flex flex-col items-center gap-0.5">
          <text class="max-w-16 truncate text-xs text-gray-900" :style="{ color: item.color }">
            {{ item.title }}
          </text>
        </view>
      </view>
    </view>
  </view>

  <!-- 恋爱模块解锁弹窗(解锁成功自动跳转) -->
  <uh-unlock-popup
    v-model:show="unlockModalVisible" title="请解锁" captcha-enabled
    :tip="unlockTip" placeholder="请输入密码" confirm-text="进入" :request="handleUnlockRequest"
    @success="handleUnlockSuccess"
  />
</template>
