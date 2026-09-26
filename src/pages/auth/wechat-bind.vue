<script lang="ts" setup>
import { confirmBindTicket, getBindTicketStatus, getWxCode } from '@/api/auth'
import type { IBindTicketStatus } from '@/api/auth'
import { useTokenStore } from '@/store/token'
import { storeToRefs } from 'pinia'
import { onLoad } from '@dcloudio/uni-app'
import { computed, onUnmounted, ref } from 'vue'

definePage({
  style: {
    navigationBarTitleText: '绑定微信',
    navigationStyle: 'custom',
  },
})

const { wxLogin } = useTokenStore()

const ticket = ref('')
/** 票据当前状态(null 表示尚未查询) */
const ticketStatus = ref<IBindTicketStatus | null>(null)
/**
 * 登录态预检(status 接口返回):null 未登录 / true 二维码归属当前登录账号 /
 * false 归属其他账号。仅用于提前给出失败提示,真正的归属裁决始终在服务端 confirm 时完成
 */
const mine = ref<boolean | null>(null)
/** 提交确认中 */
const submitting = ref(false)
/** 绑定结果:success 成功 / waiting 已扫码等电脑端确认 / fail 失败(带原因) */
const bindResult = ref<'success' | 'waiting' | 'fail' | null>(null)
const failReason = ref('')
/** 等待电脑端确认的轮询定时器 */
let waitTimer: ReturnType<typeof setInterval> | null = null

/**
 * 确认页文案:已登录且是本人扫码时,明确说"绑到当前账号";
 * 匿名/归属未知时保持中性表述(归属由服务端裁决)
 */
const confirmTip = computed(() =>
  mine.value === true
    ? '检测到你在电脑端发起微信绑定请求，确认后该微信将绑定到你当前登录的账号'
    : '检测到你在电脑端发起微信绑定请求，确认后该微信将绑定到二维码对应的账号',
)

function stopWaiting() {
  if (waitTimer) {
    clearInterval(waitTimer)
    waitTimer = null
  }
}

/**
 * 登录态预检:登录着其他账号时提前失败,省一次 wx.login 和干等。
 * 只在票据未到终态时生效;终态(EXPIRED/FAILED/CONFIRMED)按原逻辑展示。
 */
function applyMineCheck() {
  if (
    mine.value === false
    && (ticketStatus.value === 'PENDING' || ticketStatus.value === 'SCANNED')
  ) {
    stopWaiting()
    bindResult.value = 'fail'
    failReason.value
      = '当前登录账号与二维码对应的账号不一致，无法进行绑定，您可以在 [我的资料-解除绑定] / 或者更换账号登录后重新绑定。【注意：一个微信只能绑定一个账号】'
    return true
  }
  return false
}

onLoad((query) => {
  // #ifdef MP-WEIXIN
  const t = query?.ticket || ''
  if (!t) {
    ticketStatus.value = 'EXPIRED'
    bindResult.value = 'fail'
    failReason.value = '绑定参数缺失，请在电脑端重新生成二维码'
    return
  }
  // 登录/未登录都允许扫码绑定:匿名走"扫码登记 + 电脑端确认",
  // 已登录则由服务端按 token 身份与票据归属比对(同账号放行,异账号由 mine 预检与 confirm 双重拦截)
  ticket.value = t
  queryTicketStatus()
  // #endif
})

/** 查询票据状态(匿名接口,确认前先校验票据是否有效) */
async function queryTicketStatus() {
  try {
    const res = await getBindTicketStatus(ticket.value)
    ticketStatus.value = res.data?.status ?? null
    mine.value = res.data?.mine ?? null
    if (applyMineCheck()) {
      return
    }
    if (ticketStatus.value === 'CONFIRMED') {
      bindResult.value = 'success'
    }
    else if (ticketStatus.value === 'FAILED') {
      bindResult.value = 'fail'
      failReason.value = res.data?.reason || '绑定失败，请在电脑端重新生成二维码'
    }
    else if (ticketStatus.value === 'EXPIRED') {
      bindResult.value = 'fail'
      failReason.value = '二维码已过期，请在电脑端点击「重新生成」后重新扫码'
    }
    else if (ticketStatus.value === 'SCANNED') {
      bindResult.value = 'waiting'
      startWaiting()
    }
  }
  catch (error) {
    console.error('查询绑定票据状态失败:', error)
    ticketStatus.value = 'EXPIRED'
    bindResult.value = 'fail'
    failReason.value = '绑定请求已失效，请在电脑端重新生成二维码'
  }
}

/**
 * 两阶段确认:扫码只登记微信身份,真正的绑定要等电脑端点「确认绑定」。
 * 这里轮询票据终态,避免用户扫完就以为已经绑好了。
 */
function startWaiting() {
  stopWaiting()
  waitTimer = setInterval(async () => {
    const res = await getBindTicketStatus(ticket.value).catch(() => null)
    const status = res?.data?.status
    if (!status || status === 'SCANNED' || status === 'PENDING') {
      return
    }
    ticketStatus.value = status
    stopWaiting()
    if (status === 'CONFIRMED') {
      bindResult.value = 'success'
      await loginIfNeeded()
    }
    else if (status === 'FAILED') {
      bindResult.value = 'fail'
      failReason.value = res?.data?.reason || '绑定失败，请在电脑端重新生成二维码'
    }
    else {
      bindResult.value = 'fail'
      failReason.value = '二维码已过期，请在电脑端点击「重新生成」后重新扫码'
    }
  }, 2000)
}

/** 绑定成功后若仍未登录,自动用该微信身份登录(绑定即登录,免二次操作) */
async function loginIfNeeded() {
  const store = useTokenStore()
  store.updateNowTime()
  const { hasLogin: logined } = storeToRefs(store)
  if (!logined.value) {
    await wxLogin()
  }
}

/** 确认绑定:wx.login 取 code 后调 confirm 接口(第一阶段,不直接建立绑定) */
async function doConfirm() {
  // #ifdef MP-WEIXIN
  if (submitting.value) {
    return
  }
  submitting.value = true
  try {
    const loginRes = await getWxCode()
    await confirmBindTicket(ticket.value, loginRes.code)
    // 已登记微信身份,等电脑端发起方确认
    bindResult.value = 'waiting'
    ticketStatus.value = 'SCANNED'
    startWaiting()
  }
  catch (error: any) {
    console.error('确认绑定微信失败:', error)
    bindResult.value = 'fail'
    failReason.value = error?.data?.message || error?.message || '绑定失败，请稍后重试'
  }
  finally {
    submitting.value = false
  }
  // #endif
}

onUnmounted(stopWaiting)

/** 完成:返回上一页 */
function handleDone() {
  uni.navigateBack()
}
</script>

<template>
  <view class="box-border min-h-screen w-screen flex flex-col items-center justify-center bg-[#f5fae8]">
    <uh-navbar default-title="绑定微信" :need-placeholder="false" />
    <view
      class="pointer-events-none fixed left-0 top-0 z-0 h-[46vh] w-full from-[#d9f77f] via-[#e8fbaf] to-[#f5fae8] bg-gradient-to-b"
    />

    <view class="relative z-10 box-border w-full flex flex-1 flex-col items-center justify-center px-4">
      <view class="uh-global-card-glass uh-shadow-xs box-border w-full border rounded-2xl p-6">
        <!-- 绑定成功 -->
        <view v-if="bindResult === 'success'" class="w-full flex flex-col items-center">
          <view class="mb-4 h-16 w-16 flex items-center justify-center rounded-full bg-green-500/10">
            <wd-icon name="check" size="64rpx" class="text-green-600" />
          </view>
          <view class="text-lg font-bold">
            绑定成功
          </view>
          <view class="mt-2 text-center text-3xs text-gray-600 leading-6">
            已成功绑定账号，现在登录后已经关联该账号！
          </view>
          <uh-button
            class="w-full flex-1"
            custom-class="uh-global-card-glass uh-shadow-xs mt-8 box-border w-full border !rounded-full !bg-primary !py-2 !text-gray-900 !text-sm"
            @click="handleDone"
          >
            完 成
          </uh-button>
        </view>

        <!-- 绑定失败 / 票据失效 -->
        <view v-else-if="bindResult === 'fail' || ticketStatus === 'EXPIRED'" class="w-full flex flex-col items-center">
          <view class="mb-4 h-16 w-16 flex items-center justify-center rounded-full bg-red-500/10">
            <wd-icon name="close" size="64rpx" class="text-red-500" />
          </view>
          <view class="text-lg font-bold">
            无法绑定
          </view>
          <view class="mt-3 text-center text-3xs text-gray-600 leading-6">
            {{ failReason || '绑定失败，请稍后重试' }}
          </view>
          <uh-button
            class="w-full flex-1"
            custom-class="uh-global-card-glass uh-shadow-xs mt-8 box-border w-full border !rounded-full !bg-white !py-2 !text-gray-900 !text-sm"
            @click="handleDone"
          >
            关闭页面
          </uh-button>
        </view>

        <!-- 已扫码,等电脑端确认 -->
        <view v-else-if="bindResult === 'waiting'" class="w-full flex flex-col items-center">
          <view class="mb-4 h-16 w-16 flex items-center justify-center rounded-full bg-green-500/10">
            <wd-icon name="chat" size="64rpx" class="text-green-500" />
          </view>
          <view class="text-lg font-bold">
            等待确认
          </view>
          <view class="mt-3 text-center text-3xs text-gray-600 leading-6">
            已扫码，请在电脑端弹窗中点击「确认绑定」完成绑定
          </view>
        </view>

        <!-- 等待确认 -->
        <view v-else class="w-full flex flex-col items-center">
          <view class="mb-4 h-16 w-16 flex items-center justify-center rounded-full bg-green-500/10">
            <wd-icon name="chat" size="64rpx" class="text-green-500" />
          </view>
          <view class="text-lg font-bold">
            确认绑定微信
          </view>
          <view class="mt-3 text-center text-3xs text-gray-600 leading-6">
            {{ confirmTip }}
          </view>
          <uh-button
            class="w-full flex-1"
            custom-class="uh-global-card-glass uh-shadow-xs mt-8 box-border w-full border !rounded-full !bg-primary !py-2 !text-gray-900 !text-sm"
            :class="submitting ? 'opacity-60' : ''"
            :disabled="submitting"
            @click="doConfirm"
          >
            {{ submitting ? '绑定中...' : '确认绑定' }}
          </uh-button>
        </view>
      </view>
    </view>

    <view class="box-border shrink-0 py-6">
      <uh-page-copyright />
    </view>
  </view>
</template>
