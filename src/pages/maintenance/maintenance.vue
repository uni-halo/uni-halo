<script lang="ts" setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { useAppConfigStore } from '@/store/appConfig'
import { checkUrl } from '@/utils/url'
import type { IPublicMaintenance } from '@/api/types/uni-halo'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '维护中...',
  },
})

type ViewState = 'loading' | 'normal' | 'error' | 'maintenance'
type FromReason = 'plugin' | 'maintenance'

/** 默认维护标题(拦截场景未配置维护信息时展示) */
const DEFAULT_MAINTENANCE_TITLE = '维护中'
/** 恢复检测轮询间隔(ms):插件激活/维护结束探测 */
const RECOVERY_POLL_INTERVAL = 30 * 1000

const appConfigStore = useAppConfigStore()
const { configs } = storeToRefs(appConfigStore)
const { bootstrap } = appConfigStore
/** 插件可用性(拦截恢复检测用,参考 gallery 对象传参模式) */
const { check: checkPluginAvailable } = usePluginAvailable({
  pluginId: 'uni-halo',
})

const viewState = ref<ViewState>('loading')
const maintenance = ref<IPublicMaintenance | null>(null)
/** 拦截来源(index/首页 ?from=plugin|maintenance);为空 = 手动进入(保留四态) */
const fromReason = ref<FromReason | null>(null)
const nowMs = ref(Date.now())
/** 刷新按钮旋转中 */
const spinning = ref(false)
/** Toast 文案(空 = 隐藏) */
const toast = ref('')
/** 「维护详情」弹窗显隐 */
const showDetail = ref(false)
let timer: ReturnType<typeof setInterval> | null = null
let recoveryTimer: ReturnType<typeof setInterval> | null = null
let toastTimer: ReturnType<typeof setTimeout> | null = null
let refreshing = false

const isIntercepted = computed(() => !!fromReason.value)
const isScheduled = computed(() => maintenance.value?.status === 'scheduled')
const title = computed(() => maintenance.value?.title || DEFAULT_MAINTENANCE_TITLE)
/** 维护详情(富文本 HTML;小程序端「维护详情」弹窗内 mp-html 渲染) */
const detailHtml = computed(() => maintenance.value?.description || '')
/** 维护说明(纯文本;标题下方按行直接展示,留空展示设计稿默认文案) */
const noticeLines = computed(() => (maintenance.value?.notice || '').split('\n'))

/** 应用信息 logo(相对插件内置资源路径 → BASE_API 补全) */
const appLogo = computed(() => {
  const logo = configs.value.featureConfig?.profile?.appInfo?.logo
  return logo ? checkUrl(logo) : ''
})

/** 倒计时目标:scheduled → startTime / active → endTime */
const countdownTarget = computed(() => {
  const info = maintenance.value
  if (!info)
    return ''
  return isScheduled.value ? info.startTime || '' : info.endTime || ''
})

const countdownPrefix = computed(() => (isScheduled.value ? '距维护开始' : '预计恢复倒计时'))

/** 倒计时四格(天/时/分/秒),无目标或已归零为 null */
const countdownParts = computed(() => {
  const target = countdownTarget.value
  if (!target)
    return null
  const remaining = Math.max(0, Math.floor((new Date(target).getTime() - nowMs.value) / 1000))
  if (remaining <= 0)
    return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    days: pad(Math.floor(remaining / 86400)),
    hours: pad(Math.floor((remaining % 86400) / 3600)),
    minutes: pad(Math.floor((remaining % 3600) / 60)),
    seconds: pad(remaining % 60),
  }
})

/** 倒计时备注(本地时间):scheduled → 开始时刻 / active → 预计完成时刻 */
const etaNote = computed(() => {
  const target = countdownTarget.value
  if (!target) { return '' }
  const date = new Date(target)
  if (Number.isNaN(date.getTime())) { return '' }
  const pad = (n: number) => String(n).padStart(2, '0')
  const hm = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  return isScheduled.value ? `将于 ${hm} 开始维护` : `预计 ${hm} 前完成 · 实际进度可能提前哦～`
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

function startRecoveryCheck() {
  stopRecoveryCheck()
  recoveryTimer = setInterval(() => {
    void silentCheck()
  }, RECOVERY_POLL_INTERVAL)
}

function stopRecoveryCheck() {
  if (recoveryTimer) {
    clearInterval(recoveryTimer)
    recoveryTimer = null
  }
}

/** 每秒刷新倒计时;目标时刻已到 → 静默重拉(服务端可能已切换 scheduled→active 或自动结束) */
function tick() {
  nowMs.value = Date.now()
  const target = countdownTarget.value
  if (!target) {
    return
  }
  const remaining = new Date(target).getTime() - nowMs.value
  if (Number.isFinite(remaining) && remaining <= 0) { silentCheck() }
}

/**
 * 恢复检测(拦截场景):强制刷新配置;插件已激活且无维护信息 → 重定向入口页重新走拦截流程。
 * 拉取失败(服务器停机)保持维护页不打扰。
 */
async function silentCheck() {
  if (refreshing) { return }
  refreshing = true
  try {
    await bootstrap({ force: true })
    if (fromReason.value === 'plugin') {
      const available = await checkPluginAvailable()
      if (!available) {
        const info = configs.value.maintenance
        if (info) {
          maintenance.value = info
          viewState.value = 'maintenance'
          startTimer()
        }
        return
      }
    }
    const info = configs.value.maintenance
    if (info) {
      maintenance.value = info
      viewState.value = 'maintenance'
      startTimer()
      return
    }
    // 恢复:插件可用且无维护信息(或维护已到点自动结束) → 重定向入口页重新检查
    goIndex()
  }
  catch {
    // 服务器停机/接口异常 → 维持维护页
  }
  finally {
    refreshing = false
  }
}

async function load(force = false) {
  if (refreshing) { return }
  refreshing = true
  viewState.value = 'loading'
  maintenance.value = null
  stopTimer()
  stopRecoveryCheck()
  try {
    const { ok } = await bootstrap({ force })
    const info = configs.value.maintenance
    if (info) {
      maintenance.value = info
      viewState.value = 'maintenance'
      startTimer()
      if (isIntercepted.value)
        startRecoveryCheck()
    }
    else if (isIntercepted.value) {
      maintenance.value = null
      viewState.value = 'maintenance'
      startRecoveryCheck()
    }
    else if (ok) {
      goIndex()
    }
    else {
      viewState.value = 'error'
    }
  }
  catch {
    if (isIntercepted.value) {
      maintenance.value = null
      viewState.value = 'maintenance'
      startRecoveryCheck()
    }
    else {
      viewState.value = 'error'
    }
  }
  finally {
    refreshing = false
  }
}

/**
 * 检查通过 → 重定向入口页(index):由入口页重新执行「插件可用性 + 维护模式」拦截,
 * 通过后再进入首页/笔记详情等(保证任何时刻都从完整门禁通过)。
 */
function goIndex() {
  stopTimer()
  stopRecoveryCheck()
  uni.reLaunch({ url: '/pages/index/index' })
}

/** Toast 提示(1.8s 自动消失) */
function showToast(message: string) {
  toast.value = message
  if (toastTimer)
    clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = ''
  }, 1800)
}

async function handleRefresh() {
  if (spinning.value) { return }
  spinning.value = true
  await silentCheck()
  spinning.value = false
  if (viewState.value === 'maintenance') {
    showToast('站点仍在维护中，请稍后再试')
  }
}

onLoad((options) => {
  const from = options?.from
  fromReason.value = from === 'plugin' || from === 'maintenance' ? from : null
  load()
})

onUnload(() => {
  stopTimer()
  stopRecoveryCheck()
  if (toastTimer) {
    clearTimeout(toastTimer)
  }
})
</script>

<template>
  <view class="relative min-h-screen w-screen flex flex-col justify-center overflow-hidden bg-[#f5fae8]">
    <!-- 背景 -->
    <view
      class="lef-0 fixed top-0 z-0 h-[46vh] w-full from-[#d9f77f] via-[#e8fbaf] to-[#f5fae8] bg-gradient-to-b"
    />

    <!-- 刷新 -->
    <uh-data-loading v-if="viewState === 'loading'" />

    <!-- 拉取失败 -->
    <view
      v-else-if="viewState === 'error'"
      class="relative z-10 w-full flex flex-col items-center justify-center px-10 py-48 text-center"
    >
      <wd-icon class-prefix="uhemoji-icon" name="-thinking" size="140rpx" />
      <text class="text-md mt-6 text-gray-900 font-bold">
        服务暂时无法访问
      </text>
      <text class="mt-3 text-xs text-gray-500">
        站点可能正在维护中，请稍后重试
      </text>
      <view class="mt-10">
        <uh-button
          custom-class="uh-global-card-glass border flex-1 py-2 !px-8 !rounded-full font-semibold"
          @click="load(true)"
        >
          刷新试试
        </uh-button>
      </view>
    </view>
    <!-- 维护页 -->
    <view v-else class="relative z-10 w-full w-full flex flex-1 flex-col items-center justify-center">
      <view class="relative box-border w-full px-6 pb-4 pt-[calc(var(--status-bar-height)+76rpx)] text-center">
        <view
          class="breathe uh-blur-52 pointer-events-none absolute left-[-60rpx] top-[104rpx] z-0 h-[260rpx] w-[260rpx] rounded-full bg-white/40"
        />
        <view
          class="uh-blur-52 pointer-events-none absolute right-[-48rpx] top-[40rpx] z-0 h-[200rpx] w-[200rpx] rounded-full bg-[rgba(184,236,63,0.28)]"
        />
        <view
          class="uh-blur-52 pointer-events-none absolute bottom-[-40rpx] right-[72rpx] z-0 h-[160rpx] w-[160rpx] rounded-full bg-white/40"
        />

        <view class="relative z-2 mx-auto mt-[44rpx] h-[236rpx] w-[236rpx]">
          <view
            class="bob uh-global-card-glass absolute inset-0 flex items-center justify-center border-4 border-white rounded-full from-[#ebfabf] to-[#b8ec3f] bg-gradient-to-br"
          >
            <image v-if="appLogo" class="h-full w-full rounded-full" :src="appLogo" mode="aspectFill" />
            <wd-icon
              v-else class-prefix="uhemoji-icon" name="-injury" size="140rpx"
              class="text-gray-900"
            />
          </view>
          <view
            class="gear-spin absolute right-[-28rpx] top-[-16rpx] h-[68rpx] w-[68rpx] flex items-center justify-center"
          >
            <wd-icon name="settings" size="45rpx" />
          </view>
          <view
            class="gear-spin-reverse absolute bottom-[16rpx] left-[-32rpx] h-[48rpx] w-[48rpx] flex items-center justify-center"
          >
            <wd-icon name="settings" size="32rpx" />
          </view>
          <view
            class="uh-shadow-sm uh-badge absolute bottom-[-28rpx] left-1/2 inline-flex items-center whitespace-nowrap border-2 border-[#ebfabf] rounded-full border-solid bg-[#ebfabf] px-[24rpx] py-[12rpx] text-[22rpx] font-extrabold leading-none"
          >
            MAINTENANCE
          </view>
        </view>

        <view class="relative z-2 mt-8 text-5 font-black leading-8">
          <uh-text-underline>{{ title }}</uh-text-underline>
        </view>
        <view class="text-balck/50 relative z-2 mt-6 px-[16rpx] text-[25rpx] font-medium leading-[1.7]">
          <template v-if="fromReason !== 'plugin' && noticeLines.length > 0">
            <text v-for="(line, index) in noticeLines" :key="index" class="block">{{ line }}</text>
          </template>
          <template v-else>
            <text>升级期间给你带来不便，非常抱歉</text>
            <text class="block">
              别担心，我们很快就回来！
            </text>
          </template>
        </view>
      </view>

      <!-- ===== 内容区 ===== -->
      <view class="relative z-10 w-full">
        <view
          class="uh-blur-44 pointer-events-none absolute left-[64rpx] top-[-52rpx] z-0 h-[192rpx] w-[192rpx] rounded-full bg-[#ebfabf] opacity-90"
        />
        <view
          class="uh-blur-44 pointer-events-none absolute right-[-52rpx] top-[300rpx] z-0 h-[168rpx] w-[168rpx] rounded-full bg-[#ffd53d] opacity-20"
        />
        <view
          class="relative z-1 box-border w-full flex flex-col items-center gap-[28rpx] px-6 pb-[68rpx] pt-[32rpx]"
        >
          <!-- 恢复倒计时 -->
          <view
            v-if="countdownParts"
            class="uh-global-card-glass relative w-full overflow-hidden border rounded-2xl p-[32rpx] text-center shadow-[0_4rpx_24rpx_rgba(98,124,44,0.08)]"
          >
            <view
              class="absolute bottom-[-48rpx] right-[-12rpx] text-[176rpx] text-[#a7e93b] font-black leading-none opacity-10"
            >
              GO!
            </view>
            <view
              class="inline-flex items-center justify-center text-xs text-gray-500 font-extrabold tracking-[4rpx]"
            >
              {{ countdownPrefix }}
            </view>
            <view class="mt-4 w-full flex justify-center gap-4">
              <view class="flex-1 rounded-[24rpx] bg-[#f4fbe0] px-[8rpx] pb-[16rpx] pt-[18rpx]">
                <text class="block text-[42rpx] text-[#17181a] font-black leading-none tabular-nums">
                  {{ countdownParts.days }}
                </text>
                <text
                  class="mt-[10rpx] block text-[18rpx] text-[#8a9099] font-extrabold tracking-[1px]"
                >
                  天
                  DAY
                </text>
              </view>
              <view class="flex-1 rounded-[24rpx] bg-[#f4fbe0] px-[8rpx] pb-[16rpx] pt-[18rpx]">
                <text class="block text-[42rpx] text-primary font-black leading-none tabular-nums">
                  {{ countdownParts.hours }}
                </text>
                <text
                  class="mt-[10rpx] block text-[18rpx] text-[#8a9099] font-extrabold tracking-[1px]"
                >
                  时
                  HR
                </text>
              </view>
              <view class="flex-1 rounded-[24rpx] bg-[#f4fbe0] px-[8rpx] pb-[16rpx] pt-[18rpx]">
                <text class="block text-[42rpx] text-[#17181a] font-black leading-none tabular-nums">
                  {{ countdownParts.minutes }}
                </text>
                <text
                  class="mt-[10rpx] block text-[18rpx] text-[#8a9099] font-extrabold tracking-[1px]"
                >
                  分
                  MIN
                </text>
              </view>
              <view class="flex-1 rounded-[24rpx] bg-[#f4fbe0] px-[8rpx] pb-[16rpx] pt-[18rpx]">
                <text class="block text-[42rpx] text-[#17181a] font-black leading-none tabular-nums">
                  {{ countdownParts.seconds }}
                </text>
                <text
                  class="mt-[10rpx] block text-[18rpx] text-[#8a9099] font-extrabold tracking-[1px]"
                >
                  秒
                  SEC
                </text>
              </view>
            </view>
            <view v-if="etaNote" class="mt-[24rpx] text-[21rpx] text-primary font-medium">
              {{ etaNote }}
            </view>
          </view>

          <!-- 操作 -->
          <view class="mt-2 box-border w-full flex flex-col gap-4 px-12">
            <uh-button
              custom-class="uh-global-card-glass w-full border flex-1 py-2.5 !rounded-full"
              @click="handleRefresh"
            >
              {{ spinning ? '请稍等...' : '刷新试试' }}
            </uh-button>
            <view
              v-if="detailHtml"
              class="uh-global-card-glass uh-shadow-xs w-full flex flex-1 items-center justify-center rounded-full bg-white py-2 text-sm text-primary"
              @click="showDetail = true"
            >
              维护详情
            </view>
          </view>
        </view>
      </view>

      <view
        v-if="toast"
        class="uh-global-card-glass uh-translate-x-center fixed bottom-[calc(72rpx+env(safe-area-inset-bottom))] left-1/2 z-60 whitespace-nowrap border rounded-full px-6 py-2 text-xs font-bold"
      >
        {{ toast }}
      </view>

      <uh-maintenance-detail v-model="showDetail" :content="detailHtml" />
    </view>

    <view class="box-border shrink-0 pb-3">
      <uh-page-copyright />
    </view>
  </view>
</template>

<style scoped lang="scss">
.uh-blur-44 {
  filter: blur(44rpx);
}

.uh-blur-52 {
  filter: blur(52rpx);
}

/* 光斑呼吸 */
.breathe {
  animation: breathe 5s ease-in-out infinite;
}

@keyframes breathe {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.28;
  }

  50% {
    transform: scale(1.18);
    opacity: 0.4;
  }
}

/* 勋章浮动 */
.bob {
  animation: bob 3.2s ease-in-out infinite;
}

@keyframes bob {
  0%,
  100% {
    transform: translateY(0) rotate(-2deg);
  }

  50% {
    transform: translateY(-14rpx) rotate(2deg);
  }
}

/* 齿轮旋转(正/反两档;keyframes 会被 scoped 重命名,须自定义承载类) */
.gear-spin {
  animation: spin 6s linear infinite;
}

.gear-spin-reverse {
  animation: spin 4.5s linear infinite reverse;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 刷新图标点击转圈 */
.refresh-ic {
  display: inline-block;
}

.refresh-ic.spinning {
  animation: spin 0.7s linear;
}

/* 按压反馈 */
.press {
  transition: transform 0.12s ease;
}

.press:active {
  transform: scale(0.94);
}

/* MAINTENANCE 徽章：居中 + 轻微旋转 */
.uh-badge {
  transform: translateX(-50%) rotate(-5deg);
}

/* 水平居中定位 */
.uh-translate-x-center {
  transform: translateX(-50%);
}
</style>
