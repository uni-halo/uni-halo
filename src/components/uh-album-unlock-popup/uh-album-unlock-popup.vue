<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { getPluginCaptcha, unlockAlbum } from '@/api/uni-halo'
import type { ICaptchaQuery, IPluginCaptcha } from '@/api/uni-halo'

interface IProps {
  show: boolean
}

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
  if (captchaLoading.value) { return }
  captchaLoading.value = true
  try {
    const res = await getPluginCaptcha()
    if (res.data) { applyCaptcha(res.data) }
  }
  catch (e) {
    console.error('获取验证码失败', e)
  }
  finally {
    captchaLoading.value = false
  }
}

// immediate:组件 v-if 条件创建时 show 可能已为 true,需立即同步(如相册解锁弹窗)
watch(() => props.show, (val) => {
  isShow.value = val
  if (val) {
    password.value = ''
    resetCaptcha()
    // 插件端开启验证码时打开即拉取显示,避免首次提交 403 后才出现
    handleRefreshCaptcha()
  }
}, { immediate: true })

/** 弹窗开关同步(遮罩/关闭按钮/取消):关闭时复位输入并通知父组件 */
function handleOnPopupClose(val: boolean) {
  isShow.value = val
  if (!val) {
    password.value = ''
    resetCaptcha()
  }
  emit('update:show', val)
}

function handleOnCancel() {
  handleOnPopupClose(false)
}

async function handleOnConfirm() {
  if (loading.value)
    return
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
  <uh-glass-popup
    :model-value="isShow" position="bottom" :z-index="100" custom-class="!border rounded-2xl"
    @update:model-value="handleOnPopupClose"
  >
    <!-- 弹窗容器 -->
    <view class="box-border w-full flex flex-col gap-y-3 p-3">
      <!-- 顶部 -->
      <view class="w-full flex items-center justify-between">
        <view class="flex items-center gap-x-1 font-bold">
          <wd-icon name="lock" size="42rpx" /> 解锁相册
        </view>
        <view
          class="uh-global-card-glass uh-shadow-xs h-6 w-6 flex items-center justify-center border rounded-lg"
          @click="handleOnCancel"
        >
          <wd-icon name="close" size="28rpx" />
        </view>
      </view>
      <view class="flex flex-col items-center">
        <view class="album-name mb-3 text-lg text-gray-900 font-bold">
          {{ albumName }}
        </view>
        <view class="tip-text text-sm text-gray-600">
          此相册已加密，请输入密码查看
        </view>
      </view>
      <input
        v-model="password" :password="true" placeholder="请输入相册密码"
        class="uh-global-card-glass uh-shadow-xs box-border h-10 border rounded-xl px-3 text-sm"
      >

      <view v-if="captchaSrc" class="flex items-center justify-center gap-4">
        <input
          v-model="captchaCode" placeholder="验证码"
          class="uh-global-card-glass uh-shadow-xs box-border h-10 flex-1 border rounded-xl px-3 text-sm"
        >
        <image
          :src="captchaSrc" class="h-10 w-26 shrink-0 rounded-xl" mode="widthFix"
          @click="handleRefreshCaptcha"
        />
      </view>
      <view v-if="captchaSrc" class="text-center text-xs text-gray-500">
        点击图片刷新验证码
      </view>

      <!-- 底部固定操作区域 -->
      <view class="box-border w-full flex items-center gap-4">
        <uh-button
          custom-class="flex-1 uh-global-card-glass uh-shadow-xs border py-2 !rounded-xl bg-white/90"
          @click="handleOnCancel"
        >
          取消
        </uh-button>
        <uh-button
          custom-class="flex-1 uh-global-card-glass uh-shadow-xs border py-2 !rounded-xl !bg-love/90 text-white"
          @click="handleOnConfirm"
        >
          {{ loading ? '解锁中...' : '解锁' }}
        </uh-button>
      </view>
    </view>
  </uh-glass-popup>
</template>
