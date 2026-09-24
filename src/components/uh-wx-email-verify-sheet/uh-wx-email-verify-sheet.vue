<script lang="ts" setup>
import { onUnmounted, ref, watch } from 'vue'
import { useTokenStore } from '@/store/token'
import { sendRegisterEmailCode } from '@/api/auth'
import { isValidEmail } from '@/utils/validate'

/**
 * 微信补邮箱注册弹层(第二段)
 *
 * 站点开启「注册必须验证邮箱」后，微信一键注册/一键登录遇到新微信时会被服务端
 * 以 WECHAT_EMAIL_REQUIRED 拦下并下发注册票据(30 分钟)，页面拦截该业务码后
 * 打开本弹层：邮箱 → 发送验证码(60s 倒计时) → 提交完成注册并登录。
 * 注册成功 emit('success')，页面自行决定后续跳转；发码走 Halo 匿名端点。
 */
const props = defineProps<{
  /** 弹层显示(v-model) */
  modelValue: boolean
  /** 一键注册被拦时服务端下发的注册票据 */
  ticket: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'success'): void
}>()

const tokenStore = useTokenStore()

const email = ref('')
const emailCode = ref('')
const codeSending = ref(false)
const codeCountdown = ref(0)
const submitting = ref(false)
let codeTimer: ReturnType<typeof setInterval> | null = null

/** 弹层每次打开时重置验证码与倒计时(邮箱保留,便于重试时不必重填) */
watch(() => props.modelValue, (visible) => {
  if (visible) {
    emailCode.value = ''
    stopCountdown()
  }
})

/** 发送验证码到新邮箱(Halo 匿名端点,按 IP 限流,429 = 发送过于频繁) */
async function sendCode() {
  const value = email.value.trim()
  if (!value) {
    uni.showToast({ icon: 'none', title: '请先填写邮箱' })
    return
  }
  if (!isValidEmail(value)) {
    uni.showToast({ icon: 'none', title: '邮箱格式不正确' })
    return
  }
  if (codeSending.value || codeCountdown.value > 0)
    return
  codeSending.value = true
  try {
    await sendRegisterEmailCode(value)
    uni.showToast({ icon: 'none', title: '验证码已发送，请查收邮箱' })
    startCountdown()
  }
  catch (error) {
    const code = (error as { code?: number })?.code
    uni.showToast({
      icon: 'none',
      title: code === 429 ? '发送过于频繁，请稍后再试' : '验证码发送失败，请稍后重试',
    })
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

/** 提交补邮箱注册(失败 toast 由 store 统一处理,弹层保留供用户重试) */
async function submit() {
  const trimmedEmail = email.value.trim()
  if (!isValidEmail(trimmedEmail)) {
    uni.showToast({ icon: 'none', title: '请填写正确的邮箱' })
    return
  }
  if (!emailCode.value.trim()) {
    uni.showToast({ icon: 'none', title: '请填写邮箱验证码' })
    return
  }
  if (!props.ticket) {
    uni.showToast({ icon: 'none', title: '注册会话已失效，请重新操作' })
    return
  }
  submitting.value = true
  try {
    await tokenStore.wxRegisterByEmail(props.ticket, trimmedEmail, emailCode.value.trim())
    emit('update:modelValue', false)
    emit('success')
  }
  catch (error) {
    console.error('微信补邮箱注册失败:', error)
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
    custom-class="rounded-xl" @update:model-value="value => emit('update:modelValue', value)"
  >
    <view class="box-border w-full flex flex-col gap-y-3 p-3">
      <view class="flex items-center justify-between">
        <text class="text-md font-bold">验证邮箱</text>
      </view>
      <view class="flex flex-col gap-y-3">
        <wd-input
          v-model="email" custom-class="uh-profile-input !rounded-lg" prefix-icon="email"
          no-border placeholder="请输入邮箱" clearable :disabled="submitting || codeSending"
        />
        <view class="flex items-center gap-x-2">
          <wd-input
            v-model="emailCode" custom-class="uh-profile-input flex-1 !rounded-lg" prefix-icon="message"
            no-border placeholder="请输入邮箱验证码" clearable :disabled="submitting" @confirm="submit"
          />
          <uh-button
            class="shrink-0"
            custom-class="uh-global-card-glass uh-shadow-xs border shrink-0 !px-3 py-2.5 !text-xs text-gray-900"
            :class="codeCountdown > 0 || codeSending ? 'opacity-60' : ''"
            @action-click="sendCode"
          >
            {{ codeCountdown > 0 ? `${codeCountdown}s 后重发` : (codeSending ? '发送中' : '发送验证码') }}
          </uh-button>
        </view>
        <text class="text-xs text-gray-600">
          已开启验证邮箱，请补充邮箱完成注册，验证码将发送到所填邮箱，10 分钟内有效。
        </text>
      </view>
      <view class="box-border w-full flex items-center justify-center gap-x-3">
        <uh-button
          class="flex-1"
          custom-class="flex-1 uh-global-card-glass uh-shadow-xs border py-2 !rounded-xl bg-white/90"
          @click="close"
        >
          取消
        </uh-button>
        <uh-button
          class="flex-1"
          custom-class="flex-1 uh-global-card-glass uh-shadow-xs border py-2 !rounded-xl bg-primary text-gray-900"
          :class="submitting ? 'opacity-60' : ''" @action-click="submit"
        >
          {{ submitting ? '注册中' : '完成注册' }}
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
