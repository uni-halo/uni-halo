<script lang="ts" setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { resetPassword, sendResetEmailCode } from '@/api/auth'
import { getPluginCaptcha } from '@/api/uni-halo'
import type { ICaptchaQuery, IPluginCaptcha } from '@/api/uni-halo'

/**
 * 忘记密码/重置密码弹层(两段式流程,小程序与 App 均可用):
 * 用户名 → 发送重置验证码(经 Halo SMTP 发往账号绑定邮箱) → 取回不透明 HMAC 票据 →
 * 回填邮件中的 6 位验证码 + 新密码完成重置。重置成功 emit('success'),页面自行决定后续
 * (通常已登录态则提示重新登录,未登录态则跳转登录页)。
 * 已登录场景传入 presetUsername 免输用户名,提交时直接采用预设值。
 */
const props = defineProps<{
  /** 弹层显示(v-model) */
  modelValue: boolean
  /** 预设用户名(登录态传入,隐藏用户名输入框并直接采用) */
  presetUsername?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'success'): void
}>()

const username = ref('')
/** 生效用户名:登录态预设优先,否则取输入值 */
const effectiveUsername = computed(() => props.presetUsername?.trim() || username.value.trim())
const resetCode = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
/** 发码后服务端下发的 HMAC 票据(重置时回传,不可伪造) */
const ticket = ref('')
const codeSending = ref(false)
const codeCountdown = ref(0)
const submitting = ref(false)
let codeTimer: ReturnType<typeof setInterval> | null = null

/* 防刷图形验证码(服务端 403 附新码时启用展示;一次性,发码成功后作废) */
const captchaImage = ref('')
const captchaId = ref('')
const captchaCode = ref('')
const captchaLoading = ref(false)

const captchaSrc = computed(() => {
  if (!captchaImage.value)
    return ''
  return captchaImage.value.startsWith('data:')
    ? captchaImage.value
    : `data:image/png;base64,${captchaImage.value}`
})

function resetCaptcha() {
  captchaImage.value = ''
  captchaId.value = ''
  captchaCode.value = ''
}

function applyCaptcha(captcha: IPluginCaptcha) {
  captchaImage.value = captcha.imageBase64
  captchaId.value = captcha.id
  captchaCode.value = ''
}

async function handleRefreshCaptcha() {
  if (captchaLoading.value)
    return
  captchaLoading.value = true
  try {
    const res = await getPluginCaptcha()
    if (res.data)
      applyCaptcha(res.data)
  }
  catch (error) {
    console.error('获取验证码失败:', error)
  }
  finally {
    captchaLoading.value = false
  }
}

function buildCaptcha(): ICaptchaQuery | undefined {
  return captchaImage.value
    ? { captchaId: captchaId.value, captchaCode: captchaCode.value }
    : undefined
}

/** 弹层每次打开时重置(用户名保留便于重试);倒计时刻意不清零:关闭重开不能绕过 60s 重发间隔 */
watch(() => props.modelValue, (visible) => {
  if (visible) {
    resetCode.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    ticket.value = ''
    resetCaptcha()
  }
})

/** 发送重置验证码(服务端三层防护:图形验证码→限流→Halo SMTP 转发) */
async function sendCode() {
  const value = effectiveUsername.value
  if (!value) {
    uni.showToast({ icon: 'none', title: '请先填写用户名' })
    return
  }
  if (codeSending.value || codeCountdown.value > 0)
    return
  codeSending.value = true
  try {
    const res = await sendResetEmailCode(value, buildCaptcha())
    ticket.value = res.data?.ticket || ''
    uni.showToast({ icon: 'none', title: '验证码已发送，请查收邮箱' })
    resetCaptcha()
    startCountdown()
  }
  catch (error) {
    const err = error as { code?: number, data?: { message?: string, captcha?: IPluginCaptcha } }
    if (err.code === 403 && err.data?.captcha) {
      // 需要/校验失败图形验证码:服务端附新码(一次性),展示并要求重试
      applyCaptcha(err.data.captcha)
      uni.showToast({ icon: 'none', title: '请完成图形验证码后重新发送' })
    }
    else if (err.code === 429) {
      uni.showToast({ icon: 'none', title: '发送过于频繁，请稍后再试' })
    }
    else {
      uni.showToast({
        icon: 'none',
        title: err.data?.message || '验证码发送失败，请稍后重试',
      })
    }
  }
  finally {
    codeSending.value = false
  }
}

function startCountdown() {
  codeCountdown.value = 60
  stopCountdown()
  codeTimer = setInterval(() => {
    codeCountdown.value--
    if (codeCountdown.value <= 0)
      stopCountdown()
  }, 1000)
}

function stopCountdown() {
  if (codeTimer) {
    clearInterval(codeTimer)
    codeTimer = null
  }
  codeCountdown.value = 0
}

/** 提交重置(失败 toast 由调用方统一处理,弹层保留供用户重试) */
async function submit() {
  if (!ticket.value) {
    uni.showToast({ icon: 'none', title: '请先获取重置验证码' })
    return
  }
  const pwd = newPassword.value
  if (!pwd || pwd.length < 5) {
    uni.showToast({ icon: 'none', title: '新密码至少 5 位' })
    return
  }
  if (pwd !== confirmPassword.value) {
    uni.showToast({ icon: 'none', title: '两次输入的新密码不一致' })
    return
  }
  if (!resetCode.value.trim()) {
    uni.showToast({ icon: 'none', title: '请输入邮箱中的重置验证码' })
    return
  }
  submitting.value = true
  try {
    await resetPassword({
      username: effectiveUsername.value,
      ticket: ticket.value,
      code: resetCode.value.trim(),
      newPassword: pwd,
    })
    emit('update:modelValue', false)
    emit('success')
  }
  catch (error) {
    const err = error as { code?: number, data?: { code?: string, message?: string } }
    // 重置码无效/已过期/票据不符:提示重新获取(同一账号重新发码会签出新票据)
    if (err.data?.code === 'RESET_CODE_INVALID') {
      ticket.value = ''
      uni.showToast({ icon: 'none', title: '重置验证码无效或已过期，请重新获取' })
    }
    else {
      console.error('重置密码失败:', error)
      uni.showToast({
        icon: 'none',
        title: err.data?.message || '重置失败，请稍后重试',
      })
    }
  }
  finally {
    submitting.value = false
  }
}

onUnmounted(stopCountdown)

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <uh-glass-popup
    :model-value="modelValue" :hide-when-close="true" position="bottom" :z-index="100"
    :close-on-click-modal="false" custom-class="!rounded-2xl"
    @update:model-value="value => emit('update:modelValue', value)"
  >
    <view class="box-border w-full flex flex-col gap-y-3 p-3">
      <view class="flex items-center justify-between">
        <text class="text-md font-bold">重置密码</text>
      </view>
      <view class="flex flex-col gap-y-3">
        <wd-input
          v-if="!presetUsername" v-model="username" custom-class="uh-profile-input !rounded-lg"
          prefix-icon="user" no-border placeholder="请输入账号用户名" clearable :disabled="submitting || codeSending"
        />
        <view class="flex items-center gap-x-2">
          <wd-input
            v-model="resetCode" custom-class="uh-profile-input flex-1 !rounded-lg" prefix-icon="message"
            no-border placeholder="请输入邮箱中的重置验证码" clearable :disabled="submitting"
          />
          <uh-button
            class="shrink-0"
            custom-class="uh-global-card-glass uh-shadow-xs border shrink-0 !px-3 py-2.5 !text-xs text-gray-900 min-w-24 !bg-primary"
            :class="codeCountdown > 0 || codeSending || !effectiveUsername ? 'opacity-60' : ''"
            @action-click="sendCode"
          >
            {{ codeCountdown > 0 ? `${codeCountdown}s 后重发` : (codeSending ? '发送中' : '发送验证码') }}
          </uh-button>
        </view>
        <view v-if="captchaSrc" class="flex items-center gap-x-2">
          <wd-input
            v-model="captchaCode" custom-class="uh-profile-input flex-1 !rounded-lg" prefix-icon="image"
            no-border placeholder="图形验证码" clearable :disabled="submitting || codeSending"
          />
          <image
            :src="captchaSrc" class="h-9 w-24 shrink-0 border border-gray-200 rounded-lg"
            mode="widthFix" @click="handleRefreshCaptcha"
          />
        </view>
        <view v-if="captchaSrc" class="text-xs text-gray-500">
          点击图片可刷新图形验证码
        </view>
        <wd-input
          v-model="newPassword" custom-class="uh-profile-input !rounded-lg" show-password prefix-icon="lock"
          no-border placeholder="请输入新密码(至少 5 位)" clearable :disabled="submitting"
        />
        <wd-input
          v-model="confirmPassword" custom-class="uh-profile-input !rounded-lg" show-password prefix-icon="lock"
          no-border placeholder="请再次输入新密码" clearable :disabled="submitting"
          @confirm="submit"
        />
        <text class="text-xs text-gray-600">
          重置验证码将发送到账号绑定邮箱，10 分钟内有效；重置成功后该账号在所有设备的登录将失效。
        </text>
      </view>
      <view class="box-border w-full flex items-center justify-center gap-x-3">
        <uh-button
          class="flex-1"
          custom-class="flex-1 uh-global-card-glass uh-shadow-xs border !py-2.5 !rounded-xl !text-3xs !bg-white/90"
          @click="close"
        >
          取消
        </uh-button>
        <uh-button
          class="flex-1"
          custom-class="flex-1 uh-global-card-glass uh-shadow-xs border !py-2.5 !rounded-xl !text-3xs !bg-primary text-gray-900"
          :class="submitting ? 'opacity-60' : ''" @action-click="submit"
        >
          {{ submitting ? '重置中' : '确认重置' }}
        </uh-button>
      </view>
    </view>
  </uh-glass-popup>
</template>

<style lang="scss" scoped>
:deep(.uh-profile-input) {
  box-sizing: border-box;
  height: 74rpx;
  padding: 0 24rpx;
  background-color: rgb(255 255 255 / 65%);
  border-radius: 20rpx;
  width: 100%;
}
</style>
