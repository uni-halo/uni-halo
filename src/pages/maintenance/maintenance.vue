<script lang="ts" setup>
/**
 * 维护页(plugin-uni-halo 维护模式,2026-09-04 客户端接入)
 * 数据源:getConfigs additive 顶层 maintenance 键(store.configs;仅 scheduled/active
 * 时插件下发,键缺失=未维护或已到点自动结束)。logo 复用 appConfig.appInfo.logo
 * (相对路径经 checkUrl/BASE_API 补全)。双态:scheduled 维护预告(倒计时至 startTime)
 * / active 维护中(倒计时至 endTime);到点自动重拉判定(服务端状态切换/自动结束)。
 * 设计见插件 .docs/maintenance-config-design.md §8。
 */
import { computed, ref } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { useAppConfigStore } from '@/store/appConfig'
import { checkUrl } from '@/utils/url'
import { markdownConfig } from '@/config/markdown'
import type { IPublicMaintenance } from '@/api/types/uni-halo'

definePage({
  style: {
    navigationBarTitleText: '站点维护',
  },
})

type ViewState = 'loading' | 'normal' | 'error' | 'maintenance'

const store = useAppConfigStore()

const viewState = ref<ViewState>('loading')
const maintenance = ref<IPublicMaintenance | null>(null)
const nowMs = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null
let refreshing = false

const isScheduled = computed(() => maintenance.value?.status === 'scheduled')
const title = computed(() => maintenance.value?.title || (isScheduled.value ? '即将维护' : '站点维护中'))
const description = computed(() => maintenance.value?.description || '')

/** 应用信息 logo(相对插件内置资源路径 → BASE_API 补全) */
const appLogo = computed(() => {
  const appInfo = store.configs.appConfig?.appInfo
  const logo = appInfo && typeof appInfo === 'object'
    ? (appInfo as { logo?: string }).logo
    : ''
  return logo ? checkUrl(logo) : ''
})

/** 倒计时目标:scheduled → startTime / active → endTime */
const countdownTarget = computed(() => {
  const info = maintenance.value
  if (!info)
    return ''
  return isScheduled.value ? info.startTime || '' : info.endTime || ''
})

const countdownPrefix = computed(() => (isScheduled.value ? '距维护开始还有' : '预计恢复还有'))

const countdownText = computed(() => {
  const target = countdownTarget.value
  if (!target)
    return ''
  const remaining = new Date(target).getTime() - nowMs.value
  if (!Number.isFinite(remaining) || remaining <= 0)
    return ''
  const total = Math.floor(remaining / 1000)
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return days > 0
    ? `${days}天${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
})

function startTimer() {
  stopTimer()
  timer = setInterval(tick, 1000)
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

/** 每秒刷新倒计时;目标时刻已到 → 重拉一次(服务端可能已切换 scheduled→active 或自动结束) */
function tick() {
  nowMs.value = Date.now()
  const target = countdownTarget.value
  if (!target)
    return
  const remaining = new Date(target).getTime() - nowMs.value
  if (Number.isFinite(remaining) && remaining <= 0)
    void load(true)
}

async function load(force = false) {
  if (refreshing)
    return
  refreshing = true
  viewState.value = 'loading'
  maintenance.value = null
  stopTimer()
  try {
    const { ok } = await store.bootstrap({ force })
    const info = store.configs.maintenance
    if (info) {
      maintenance.value = info
      viewState.value = 'maintenance'
      startTimer()
    }
    else if (ok) {
      // 拉取成功但无 maintenance 键:未维护(或已到点自动结束)→ 服务正常
      viewState.value = 'normal'
    }
    else {
      viewState.value = 'error'
    }
  }
  catch {
    viewState.value = 'error'
  }
  finally {
    refreshing = false
  }
}

function goHome() {
  uni.switchTab({ url: '/pages/tabbar/home/home' })
}

onLoad(() => {
  void load()
})

onUnload(() => {
  stopTimer()
})
</script>

<template>
  <view class="maintenance-page min-h-screen bg-[#fafafa] pb-16">
    <!-- 加载中 -->
    <view v-if="viewState === 'loading'" class="flex flex-col items-center justify-center py-48">
      <text class="text-[26rpx] text-[#999]">
        加载中...
      </text>
    </view>

    <!-- 服务正常(未维护) -->
    <view v-else-if="viewState === 'normal'" class="flex flex-col items-center justify-center px-10 py-48 text-center">
      <text class="text-[64rpx]">
        ✅
      </text>
      <text class="mt-6 text-[28rpx] text-[#333]">
        当前服务正常，无需维护
      </text>
      <text class="mt-2 text-[24rpx] text-[#999]">
        如果仍然无法访问，请稍后重试或联系站长
      </text>
      <view class="mt-10">
        <wd-button type="primary" round @click="goHome">
          返回首页
        </wd-button>
      </view>
    </view>

    <!-- 拉取失败(通常为服务器停机中) -->
    <view v-else-if="viewState === 'error'" class="flex flex-col items-center justify-center px-10 py-48 text-center">
      <text class="text-[64rpx]">
        ⚠️
      </text>
      <text class="mt-6 text-[28rpx] text-[#333]">
        服务暂时无法访问
      </text>
      <text class="mt-2 text-[24rpx] text-[#999]">
        站点可能正在维护中，请稍后重试
      </text>
      <view class="mt-10">
        <wd-button type="primary" plain round @click="load(true)">
          重新加载
        </wd-button>
      </view>
    </view>

    <!-- 维护预告 / 维护中 -->
    <view v-else class="flex flex-col items-center px-8 pt-24">
      <image
        v-if="appLogo"
        class="h-[150rpx] w-[150rpx] border border-[#eee] rounded-full bg-white"
        :src="appLogo"
        mode="aspectFill"
      />

      <view class="mt-8 flex items-center justify-center">
        <view
          class="rounded-full px-5 py-1 text-[22rpx]"
          :class="isScheduled ? 'bg-[#e8f1ff] text-[#1e6fff]' : 'bg-[#fdeef1] text-[#f83856]'"
        >
          {{ isScheduled ? '维护预告' : '维护中' }}
        </view>
      </view>

      <view class="mt-6 text-center text-[40rpx] text-[#222] font-bold">
        {{ title }}
      </view>

      <view v-if="countdownText" class="mt-8 flex flex-col items-center">
        <text class="text-[24rpx] text-[#999]">
          {{ countdownPrefix }}
        </text>
        <text
          class="mt-2 text-[44rpx] font-bold tabular-nums"
          :class="isScheduled ? 'text-[#1e6fff]' : 'text-[#f83856]'"
        >
          {{ countdownText }}
        </text>
      </view>

      <view v-if="description" class="mt-10 w-full rounded-2xl bg-white p-6">
        <mp-html
          :content="description"
          lazy-load
          :domain="markdownConfig.domain ?? ''"
          scroll-table
          selectable
          :tag-style="markdownConfig.tagStyle"
          :container-style="markdownConfig.containStyle"
          copy-by-long-press
        />
      </view>

      <view v-if="!description && !countdownText" class="mt-10 text-center text-[24rpx] text-[#999]">
        请耐心等待，维护完成后将自动恢复访问
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.maintenance-page {
  :deep(img) {
    max-width: 100%;
    border-radius: 8rpx;
  }
}
</style>
