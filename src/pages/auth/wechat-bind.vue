<script lang="ts" setup>
import { confirmBindTicket, getBindTicketStatus } from '@/api/auth'
import type { IBindTicketStatus } from '@/api/auth'
import { getWxCode } from '@/api/auth'
import { useTokenStore } from '@/store/token'
import { storeToRefs } from 'pinia'
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'

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
/** 提交确认中 */
const submitting = ref(false)
/** 绑定结果:success 成功 / fail 失败(带原因) */
const bindResult = ref<'success' | 'fail' | null>(null)
const failReason = ref('')

onLoad((query) => {
  // #ifdef MP-WEIXIN
  const t = query?.ticket || ''
  if (!t) {
    ticketStatus.value = 'EXPIRED'
    failReason.value = '绑定参数缺失，请在电脑端重新生成二维码'
    return
  }
  ticket.value = t
  queryTicketStatus()
  // #endif
})

/** 查询票据状态(匿名接口,确认前先校验票据是否有效) */
async function queryTicketStatus() {
  try {
    const res = await getBindTicketStatus(ticket.value)
    ticketStatus.value = res.data?.status ?? null
    if (ticketStatus.value === 'CONFIRMED') {
      bindResult.value = 'success'
    }
    else if (ticketStatus.value === 'EXPIRED') {
      failReason.value = '二维码已过期，请在电脑端重新生成'
    }
  }
  catch (error) {
    console.error('查询绑定票据状态失败:', error)
    ticketStatus.value = 'EXPIRED'
    failReason.value = '绑定请求已失效，请在电脑端重新生成二维码'
  }
}

/** 确认绑定:wx.login 取 code 后调 confirm 接口 */
async function doConfirm() {
  // #ifdef MP-WEIXIN
  if (submitting.value) {
    return
  }
  submitting.value = true
  try {
    const loginRes = await getWxCode()
    await confirmBindTicket(ticket.value, loginRes.code)
    bindResult.value = 'success'
    ticketStatus.value = 'CONFIRMED'
    // 绑定成功后未登录时自动用该微信身份登录(绑定即登录,免二次操作)
    const tokenStore = useTokenStore()
    tokenStore.updateNowTime()
    const { hasLogin } = storeToRefs(tokenStore)
    if (!hasLogin.value) {
      await wxLogin()
    }
  }
  catch (error: any) {
    console.error('确认绑定微信失败:', error)
    // 绑定本身已成功、仅自动登录失败时不提示失败态,只提示登录未完成
    if (bindResult.value === 'success') {
      uni.showToast({ title: '绑定成功,但自动登录失败,请手动登录', icon: 'none' })
    }
    else {
      bindResult.value = 'fail'
      failReason.value = error?.message || '绑定失败，请稍后重试'
    }
  }
  finally {
    submitting.value = false
  }
  // #endif
}

/** 完成:返回上一页 */
function handleDone() {
  uni.navigateBack()
}
</script>

<template>
  <view class="box-border min-h-screen w-screen bg-page">
    <uh-navbar default-title="绑定微信" />

    <view class="box-border flex flex-col items-center px-6 pt-16">
      <view class="uh-global-card-glass uh-shadow-xs box-border w-full rounded-2xl p-8">
        <!-- 绑定成功 -->
        <view v-if="bindResult === 'success'" class="flex flex-col items-center py-6">
          <view class="mb-4 h-16 w-16 flex items-center justify-center rounded-full bg-green-500/10">
            <wd-icon name="check" size="64rpx" class="text-green-600" />
          </view>
          <view class="text-lg font-bold">
            绑定成功
          </view>
          <view class="mt-2 text-sm text-gray-500">
            你的账号已成功绑定微信，现在可以使用微信登录了
          </view>
          <button
            class="mt-8 w-full rounded-full text-white"
            :style="{ backgroundColor: '#b9e424' }"
            @click="handleDone"
          >
            完 成
          </button>
        </view>

        <!-- 绑定失败 / 票据失效 -->
        <view v-else-if="bindResult === 'fail' || ticketStatus === 'EXPIRED'" class="flex flex-col items-center py-6">
          <view class="mb-4 h-16 w-16 flex items-center justify-center rounded-full bg-red-500/10">
            <wd-icon name="close" size="64rpx" class="text-red-500" />
          </view>
          <view class="text-lg font-bold">
            无法绑定
          </view>
          <view class="mt-2 text-center text-sm text-gray-500">
            {{ failReason || '绑定失败，请稍后重试' }}
          </view>
          <button
            class="mt-8 w-full rounded-full bg-gray-400/80 text-white"
            @click="handleDone"
          >
            返 回
          </button>
        </view>

        <!-- 等待确认 -->
        <view v-else class="flex flex-col items-center py-6">
          <view class="mb-4 h-16 w-16 flex items-center justify-center rounded-full bg-green-500/10">
            <wd-icon name="chat" size="64rpx" class="text-green-600" />
          </view>
          <view class="text-lg font-bold">
            确认绑定微信
          </view>
          <view class="mt-2 text-center text-sm text-gray-500">
            检测到你在电脑端发起微信绑定请求，确认后该微信将绑定到对应账号
          </view>
          <button
            class="mt-8 w-full rounded-full text-white"
            :class="submitting ? 'opacity-60' : ''"
            :style="{ backgroundColor: '#07c160' }"
            :disabled="submitting"
            @click="doConfirm"
          >
            {{ submitting ? '绑定中...' : '确认绑定' }}
          </button>
        </view>
      </view>
    </view>

    <uh-page-copyright />
  </view>
</template>
