<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAppConfigStore } from '@/store/appConfig'
import { useTokenStore } from '@/store/token'
import { checkImageUrl } from '@/utils/url'
import { getGlobalInfo } from '@/api/auth'
import { getPluginCaptcha } from '@/api/uni-halo'
import type { ICaptchaQuery, IPluginCaptcha } from '@/api/uni-halo'
import { REGISTER_PAGE } from '@/router/config'

/**
 * 登录弹窗(底部弹层):在当前页面内完成登录,不打断浏览上下文。
 * 账号密码/图形验证码/微信一键登录/忘记密码,逻辑与登录页一致;
 * 登录成功 emit('on-success') 并刷新配置,由调用方决定后续动作。
 */
const props = defineProps<{
  /** 弹层显示(v-model) */
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'on-success'): void
}>()

const { bootstrap } = useAppConfigStore()
const { configs, auditModeEnabled } = storeToRefs(useAppConfigStore())
const tokenStore = useTokenStore()

/* ---------- 应用信息(顶部 logo 展示,getConfigs 下发于 featureConfig.profile.appInfo) ---------- */
const appInfo = computed(() => {
  const info = configs.value.featureConfig?.profile?.appInfo
  return {
    name: info?.name || 'uni-halo',
    logo: info?.logo ? checkImageUrl(info.logo) : '',
  }
})

/* ---------- 登录配置(getConfigs loginConfig.client,两开关全关即整体不可用) ---------- */
const loginConfig = computed(() => configs.value.loginConfig?.client)
const passwordLoginEnabled = computed(() => loginConfig.value?.passwordLoginEnabled !== false)
const wechatLoginEnabled = computed(() => loginConfig.value?.wechatLoginEnabled === true)

const username = ref('')
const password = ref('')
const loading = ref(false)

/* ---------- 登录图形验证码(站点开启 captchaConfig.scope.login 后,服务端 403 附新码时展示) ---------- */
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

async function refreshCaptcha() {
  if (captchaLoading.value)
    return
  captchaLoading.value = true
  try {
    const res = await getPluginCaptcha()
    if (res.data) {
      captchaImage.value = res.data.imageBase64
      captchaId.value = res.data.id
      captchaCode.value = ''
    }
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

/* ---------- 注册开关(Halo /actuator/globalinfo,匿名可访问,读取失败视为关闭;审核模式下不显示) ---------- */
const registrationAllowedRaw = ref(false)
const registrationAllowed = computed(() => registrationAllowedRaw.value && !auditModeEnabled.value)
watch(() => props.modelValue, (visible) => {
  if (visible) {
    getGlobalInfo().then((res) => {
      registrationAllowedRaw.value = res.data?.allowRegistration === true
    }).catch((error) => {
      console.error('获取注册开关失败:', error)
    })
  }
})

/* ---------- 用户协议/隐私政策(登录即代表同意,可点击弹出查看;登录不做强制勾选) ---------- */
type AgreementType = 'userAgreement' | 'privacyPolicy'
const agreementPopupVisible = ref(false)
const agreementTab = ref<AgreementType>('userAgreement')

/** 协议内容 */
const agreementContents = computed(() => {
  const pages = configs.value.featureConfig?.pages
  return {
    userAgreement: (pages?.userAgreement?.content || '').trim(),
    privacyPolicy: (pages?.privacyPolicy?.content || '').trim(),
  }
})

/** 打开协议弹窗(弹窗内可切换查看两份协议) */
function openAgreementPopup(type: AgreementType) {
  agreementTab.value = type
  agreementPopupVisible.value = true
}

/** 去注册 */
function goRegister() {
  emit('update:modelValue', false)
  uni.navigateTo({ url: REGISTER_PAGE })
}

/* ---------- 忘记密码(重置密码弹层,匿名两段式流程) ---------- */
const forgotSheet = ref(false)

/** 重置密码成功:匿名场景直接提示用新密码登录 */
function onForgotResetSuccess() {
  uni.showToast({ icon: 'none', title: '密码重置成功，请使用新密码登录！', mask: true })
}

/* ---------- 微信补邮箱注册(一键登录被拦后的第二段) ---------- */
const wxEmailSheet = ref(false)
const wxTicket = ref('')

/**
 * 拦截服务端 WECHAT_EMAIL_REQUIRED 业务码:取出注册票据并打开补邮箱弹层。
 * @returns 是否已拦截(true = 该错误已处理,调用方无需再提示)
 */
function handleWechatEmailRequired(error: unknown): boolean {
  const err = error as { data?: { code?: string, data?: { ticket?: string } } }
  if (err?.data?.code !== 'WECHAT_EMAIL_REQUIRED') {
    return false
  }
  wxTicket.value = err?.data?.data?.ticket || ''
  if (wxTicket.value) {
    wxEmailSheet.value = true
  }
  else {
    uni.showToast({ icon: 'none', title: '登录会话已失效，请重新操作' })
  }
  return true
}

/* ---------- 弹层显隐 ---------- */
/** 弹层每次打开时重置表单(验证码/密码不保留) */
watch(() => props.modelValue, (visible) => {
  if (visible) {
    username.value = ''
    password.value = ''
    resetCaptcha()
  }
})

function close() {
  emit('update:modelValue', false)
}

/** 登录成功统一处理:关闭弹层,提示展示完成后 emit,配置刷新并行执行 */
function handleLoginSuccess() {
  close()
  // 登录成功需要重新拉取配置
  bootstrap({ force: true }).catch(err => console.error('登录后刷新配置失败', err))
  uni.showToast({ icon: 'none', title: '登录成功', mask: true })
  emit('on-success')
}

/* ---------- 可用登录方式(按插件端配置过滤;配置未就绪时默认展示账号密码登录) ---------- */
const availableTabs = computed(() => {
  const tabs: ('password' | 'wechat')[] = []
  if (passwordLoginEnabled.value) {
    tabs.push('password')
  }
  // #ifdef MP-WEIXIN
  if (wechatLoginEnabled.value) {
    tabs.push('wechat')
  }
  // #endif
  return tabs
})

/** 账号密码登录(tokenStore.login 内部完成 token 存储与用户信息写入) */
async function doPasswordLogin() {
  if (!username.value || !password.value) {
    uni.showToast({ icon: 'none', title: '请输入账号和密码' })
    return
  }
  if (captchaSrc.value && !captchaCode.value.trim()) {
    uni.showToast({ icon: 'none', title: '请输入图形验证码' })
    return
  }
  loading.value = true
  try {
    await tokenStore.login({
      username: username.value,
      password: password.value,
      captcha: buildCaptcha(),
    })
    resetCaptcha()
    handleLoginSuccess()
  }
  catch (error) {
    const err = error as { code?: number, data?: { captcha?: IPluginCaptcha } }
    // 服务端要求/校验失败图形验证码:403 附新码(一次性),展示后随下次登录携带
    if (err.code === 403 && err.data?.captcha) {
      captchaImage.value = err.data.captcha.imageBase64
      captchaId.value = err.data.captcha.id
      captchaCode.value = ''
      uni.showToast({ icon: 'none', title: '请完成图形验证码后重新登录' })
    }
    else {
      console.error('账号密码登录失败:', error)
    }
  }
  finally {
    loading.value = false
  }
}

/** 微信登录(仅微信小程序可用) */
async function doWechatLogin() {
  // #ifdef MP-WEIXIN
  loading.value = true
  try {
    await tokenStore.wxLogin()
    handleLoginSuccess()
  }
  catch (error) {
    // 新微信被 WECHAT_EMAIL_REQUIRED 拦下要求补邮箱,弹层继续完成注册
    if (!handleWechatEmailRequired(error)) {
      console.error('微信登录失败:', error)
    }
  }
  finally {
    loading.value = false
  }
  // #endif
}
</script>

<template>
  <uh-glass-popup
    :model-value="modelValue" :hide-when-close="true" position="bottom" :z-index="110"
    :close-on-click-modal="false" custom-class="!rounded-2xl"
    @update:model-value="value => emit('update:modelValue', value)"
  >
    <view class="box-border w-full flex flex-col gap-y-4 p-3">
      <!-- 顶部:应用 logo + 欢迎语 + 关闭 -->
      <view class="relative flex items-center gap-x-3">
        <view class="uh-global-card-glass uh-shadow-xs h-12 w-12 flex items-center justify-center overflow-hidden rounded-full">
          <image v-if="appInfo.logo" class="h-full w-full" :src="appInfo.logo" mode="aspectFill" />
          <wd-icon
            v-else class-prefix="uhemoji-icon" name="-smile-" size="50rpx"
            class="text-gray-900"
          />
        </view>
        <view class="flex flex-1 flex-col">
          <text class="text-md text-gray-900 font-black">欢迎回来</text>
          <text class="mt-1 text-xs text-black/50">登录 {{ appInfo.name }}，开启你的专属之旅</text>
        </view>
        <view
          class="uh-global-card-glass absolute right-0 top-0 h-6 w-6 flex items-center justify-center border rounded-lg shadow-none"
          @click="close()"
        >
          <wd-icon name="close" size="28rpx" class="text-gray-500" />
        </view>
      </view>

      <!-- 登录能力整体关闭提示 -->
      <view
        v-if="availableTabs.length === 0"
        class="uh-global-card-glass uh-shadow-xs box-border w-full rounded-2xl p-6 text-center"
      >
        <text class="text-xs text-gray-500">登录功能暂未开启</text>
      </view>

      <!-- 登录表单 -->
      <view v-else class="box-border w-full flex flex-col items-center gap-3 overflow-hidden">
        <!-- 账号密码登录 -->
        <template v-if="passwordLoginEnabled">
          <wd-input
            v-model="username" custom-class="w-full box-border !rounded-xl !py-2.5" prefix-icon="user" no-border
            placeholder="请输入账号" :disabled="loading"
          />
          <wd-input
            v-model="password" custom-class="w-full box-border !rounded-xl !py-2.5" prefix-icon="lock"
            show-password no-border placeholder="请输入密码" :disabled="loading"
            @confirm="doPasswordLogin"
          />
          <!--  图形验证码:站点开启登录验证码后展示(403 附新码出现,点击图片刷新) -->
          <view v-if="captchaSrc" class="w-full flex items-center gap-x-2">
            <wd-input
              v-model="captchaCode" custom-class="flex-1 !rounded-xl !py-2.5" prefix-icon="image"
              no-border placeholder="图形验证码" :disabled="loading"
              @confirm="doPasswordLogin"
            />
            <view class="h-10 w-26 shrink-0 overflow-hidden border border-gray-200 rounded-xl bg-white">
              <image
                :src="captchaSrc" class="h-full w-full"
                mode="widthFix" @click="refreshCaptcha"
              />
            </view>
          </view>
          <view class="box-border w-full pl-2 text-left text-xs text-gray-500">
            点击图片可刷新验证码
          </view>
          <uh-button
            class="w-full flex-1"
            custom-class="mt-2 uh-global-card-glass !bg-primary !py-2.5 uh-shadow-xs border w-full !rounded-xl text-gray-900 !text-3xs"
            :class="loading ? 'opacity-60' : ''" @action-click="doPasswordLogin"
          >
            {{ loading ? '登录中...' : '登 录' }}
          </uh-button>
        </template>

        <!-- 微信登录 -->
        <!-- #ifdef MP-WEIXIN -->
        <button
          v-if="wechatLoginEnabled"
          class="uh-button-native uh-global-card-glass w-full text-3xs text-gray-900 !border !rounded-xl !bg-primary !py-2.5"
          :class="loading ? 'opacity-60' : ''" :disabled="loading" @click="doWechatLogin"
        >
          {{ loading ? '登录中...' : '微信一键登录' }}
        </button>
        <!-- #endif -->
      </view>

      <!-- 忘记密码/去注册:同行居中展示 -->
      <view
        v-if="passwordLoginEnabled || registrationAllowed"
        class="flex items-center justify-center gap-x-6 text-xs text-black/50"
      >
        <text v-if="passwordLoginEnabled" @click="forgotSheet = true">忘记密码？</text>
        <text v-if="registrationAllowed" @click="goRegister">没有账号？去注册</text>
      </view>
      <!-- 用户协议/隐私政策 -->
      <view class="text-center text-xs text-black/40 leading-5">
        登录即代表同意<text
          class="text-primary"
          @click="openAgreementPopup('userAgreement')"
        >
          《用户协议》
        </text>与<text
          class="text-primary"
          @click="openAgreementPopup('privacyPolicy')"
        >
          《隐私政策》
        </text>
      </view>
    </view>
  </uh-glass-popup>

  <!-- 用户协议/隐私政策弹窗(底部弹出,tab 切换查看) -->
  <uh-agreement-popup
    v-model="agreementPopupVisible" :show-agree-button="true" :contents="agreementContents"
    :initial-tab="agreementTab"
  />

  <!-- 微信补邮箱注册弹层(新微信一键登录被拦后的第二段) -->
  <uh-wx-email-verify-sheet v-model="wxEmailSheet" :ticket="wxTicket" @success="handleLoginSuccess" />

  <!-- 忘记密码/重置密码弹层(匿名两段式流程) -->
  <uh-forgot-password-sheet v-model="forgotSheet" @success="onForgotResetSuccess" />
</template>
