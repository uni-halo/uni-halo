<script lang="ts" setup>
/**
 * 相册密码解锁弹窗(源自旧项目 components/album-unlock-modal,新建复刻)
 * 输入密码解锁加密相册;2026-09-03 接入插件防刷验证码:
 * 首次提交若服务端要求验证码(403+附新码)则展示验证码行,携带后重试(验证码一次性)
 */
import { computed, ref, watch } from 'vue'
import { getPluginCaptcha, unlockAlbum } from '@/api/uni-halo'
import type { ICaptchaQuery, IPluginCaptcha } from '@/api/uni-halo'

const props = withDefaults(defineProps<{
  show: boolean
  albumName?: string
  albumKey?: string
}>(), {
  albumName: '',
  albumKey: '',
})

const emit = defineEmits<{
  (e: 'update:show', show: boolean): void
  (e: 'success', data: { albumKey: string, token: string, photos: unknown[] }): void
}>()

const isShow = ref(false)
const password = ref('')
const loading = ref(false)

// 防刷验证码(服务端 403 附新码 / 主动刷新)
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

/** 用服务端返回的验证码(403 响应体附新码)填充展示 */
function applyCaptcha(captcha: IPluginCaptcha) {
  captchaImage.value = captcha.imageBase64
  captchaId.value = captcha.id
  captchaCode.value = ''
}

/** 点击验证码图刷新 */
async function handleRefreshCaptcha() {
  if (captchaLoading.value)
    return
  captchaLoading.value = true
  try {
    const res = await getPluginCaptcha()
    if (res.data)
      applyCaptcha(res.data)
  }
  catch (e) {
    console.error('获取验证码失败', e)
  }
  finally {
    captchaLoading.value = false
  }
}

watch(() => props.show, (val) => {
  isShow.value = val
  if (val) {
    password.value = ''
    resetCaptcha()
  }
})

function handleOnCancel() {
  password.value = ''
  resetCaptcha()
  isShow.value = false
  emit('update:show', false)
}

async function handleOnConfirm() {
  if (!password.value.trim()) {
    uni.showToast({ title: '请输入密码', icon: 'none' })
    return
  }

  loading.value = true
  try {
    const captchaQuery: ICaptchaQuery | undefined = captchaImage.value
      ? { captchaId: captchaId.value, captchaCode: captchaCode.value }
      : undefined
    const res = await unlockAlbum(props.albumKey, password.value, captchaQuery)
    if (res.data && (res.data as { token?: string }).token) {
      password.value = ''
      resetCaptcha()
      isShow.value = false
      emit('update:show', false)
      emit('success', {
        albumKey: props.albumKey,
        token: (res.data as { token: string }).token,
        photos: (res.data as { photos?: unknown[] }).photos || [],
      })
      uni.showToast({ title: '解锁成功', icon: 'success' })
    }
  }
  catch (e) {
    console.error('解锁失败', e)
    const err = e as { code?: number, data?: { message?: string, captcha?: IPluginCaptcha } }
    if (err.code === 403 && err.data?.captcha) {
      // 需要/校验失败:服务端附新验证码(一次性,旧码已作废),展示并要求重试
      applyCaptcha(err.data.captcha)
      uni.showToast({ title: '请完成验证码后重新解锁', icon: 'none' })
    }
    else {
      // 密码错误等业务失败:清空密码并复位验证码(一次性,需重新获取)
      password.value = ''
      resetCaptcha()
      uni.showToast({ title: '密码错误，请重试', icon: 'none' })
    }
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <wd-dialog
    v-model="isShow"
    title="相册密码"
    :show-cancel="true"
    confirm-text="解锁"
    confirm-button-color="#f88ca2"
    @cancel="handleOnCancel"
    @confirm="handleOnConfirm"
  >
    <view class="unlock-modal-content py-5">
      <view class="album-info flex flex-col items-center">
        <view class="lock-icon mb-5 text-[80rpx]">
          🔒
        </view>
        <view class="album-name mb-3 text-[32rpx] text-[#333] font-bold">
          {{ albumName }}
        </view>
        <view class="tip-text text-[26rpx] text-[#999]">
          此相册已加密，请输入密码查看
        </view>
      </view>
      <wd-input
        v-model="password"
        :password="true"
        placeholder="请输入相册密码"
        align="center"
        clearable
        class="password-input mt-9"
      />

      <!-- 防刷验证码(首次提交 403 后展示;点击图片可刷新) -->
      <view v-if="captchaSrc" class="captcha-box mt-5 flex items-center justify-center gap-4">
        <image
          :src="captchaSrc"
          class="captcha-img h-[76rpx] w-[200rpx] rounded-lg"
          mode="widthFix"
          @click="handleRefreshCaptcha"
        />
        <wd-input
          v-model="captchaCode"
          placeholder="验证码"
          align="center"
          clearable
          class="captcha-input w-[240rpx]"
        />
      </view>
      <view v-if="captchaSrc" class="captcha-tip mt-2 text-center text-[22rpx] text-[#aaa]">
        点击图片刷新验证码
      </view>
    </view>
  </wd-dialog>
</template>

<style scoped>
.unlock-modal-content {
  /* 布局全部由 UnoCSS 原子类实现 */
}
</style>
