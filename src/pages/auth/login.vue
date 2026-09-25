<script lang="ts" setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useAppConfigStore } from '@/store/appConfig'
import { useTokenStore } from '@/store/token'
import { checkImageUrl } from '@/utils/url'
import { usePageTitle } from '@/hooks/usePageTitle'
import { getGlobalInfo } from '@/api/auth'
import { REGISTER_PAGE } from '@/router/config'

definePage({
  style: {
    navigationBarTitleText: '登录',
    navigationStyle: 'custom',
  },
})

const { bootstrap } = useAppConfigStore()
const { configs } = storeToRefs(useAppConfigStore())
/** 页面标题（插件端可配置，留空回退内置默认） */
const pageTitle = usePageTitle('login', '登录')
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

/* ---------- 注册开关(Halo /actuator/globalinfo,匿名可访问,读取失败视为关闭) ---------- */
const registrationAllowed = ref(false)
getGlobalInfo().then((res) => {
  registrationAllowed.value = res.data?.allowRegistration === true
}).catch((error) => {
  console.error('获取注册开关失败:', error)
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
  uni.navigateTo({ url: REGISTER_PAGE })
}

/** 可用登录方式(按插件端配置过滤;配置未就绪时默认展示账号密码登录) */
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
  loading.value = true
  try {
    await tokenStore.login({ username: username.value, password: password.value })
    handleLoginSuccess()
  }
  catch (error) {
    console.error('账号密码登录失败:', error)
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

/** 登录成功统一处理:返回来源页 */
async function handleLoginSuccess() {
  // 登录成功需要重新拉取配置
  await bootstrap({ force: true })
  setTimeout(() => {
    uni.navigateBack()
  }, 600)
}
</script>

<template>
  <view class="relative box-border min-h-screen w-screen flex flex-col overflow-hidden bg-[#f5fae8]">
    <!-- 顶部自定义导航 -->
    <uh-navbar :default-title="pageTitle" :need-placeholder="false" />

    <view
      class="pointer-events-none fixed left-0 top-0 z-0 h-[46vh] w-full from-[#d9f77f] via-[#e8fbaf] to-[#f5fae8] bg-gradient-to-b"
    />

    <view
      class="breathe uh-blur-52 pointer-events-none absolute left-[-80rpx] top-[calc(var(--status-bar-height)+40rpx)] z-0 h-[280rpx] w-[280rpx] rounded-full bg-white/40"
    />
    <view
      class="uh-blur-52 pointer-events-none absolute right-[-60rpx] top-[180rpx] z-0 h-[220rpx] w-[220rpx] rounded-full bg-[rgba(184,236,63,0.28)]"
    />
    <view
      class="uh-blur-44 pointer-events-none absolute bottom-[120rpx] right-[80rpx] z-0 h-[180rpx] w-[180rpx] rounded-full bg-[#ffd53d] opacity-20"
    />
    <view
      class="uh-blur-44 pointer-events-none absolute bottom-[280rpx] left-[-40rpx] z-0 h-[200rpx] w-[200rpx] rounded-full bg-[#ebfabf] opacity-90"
    />

    <view class="relative z-10 box-border h-screen w-screen flex flex-col items-center justify-center gap-y-6 px-6">
      <view class="box-border w-full flex flex-1 flex-col items-center justify-center gap-y-4 pt-20">
        <!-- 顶部:应用 logo + 欢迎语 -->
        <view class="flex flex-col items-center">
          <view class="bob relative h-24 w-24">
            <view
              class="uh-global-card-glass uh-shadow-xs absolute inset-0 flex items-center justify-center overflow-hidden border-2 rounded-full from-[#ebfabf] to-[#b8ec3f] bg-gradient-to-br"
            >
              <image v-if="appInfo.logo" class="h-full w-full" :src="appInfo.logo" mode="aspectFill" />
              <wd-icon
                v-else class-prefix="uhemoji-icon" name="-smile-" size="100rpx"
                class="text-gray-900"
              />
            </view>
          </view>
          <view class="mt-6 text-xl text-gray-900 font-black">
            欢迎回来
          </view>
          <view class="mt-2 text-xs text-black/50 font-medium">
            登录 {{ appInfo.name }}，开启你的专属之旅
          </view>
        </view>

        <!-- 登录内容区 -->
        <view class="box-border w-full flex flex-col items-center">
          <!-- 登录能力整体关闭提示 -->
          <view
            v-if="availableTabs.length === 0"
            class="uh-global-card-glass uh-shadow-xs box-border w-full border rounded-2xl p-8 text-center"
          >
            <view class="text-xs text-gray-500">
              登录功能暂未开启
            </view>
          </view>

          <!-- 登录卡片(玻璃拟态) -->
          <view v-else class="uh-global-card-glass uh-shadow-xs box-border w-full rounded-2xl p-6">
            <!-- 账号密码登录 -->
            <template v-if="passwordLoginEnabled">
              <wd-input
                v-model="username" custom-class="uh-login-input" prefix-icon="user" no-border
                placeholder="请输入账号" :disabled="loading"
              />
              <wd-input
                v-model="password" custom-class="uh-login-input mt-3" prefix-icon="lock"
                show-password no-border placeholder="请输入密码" :disabled="loading"
                @confirm="doPasswordLogin"
              />
              <uh-button
                class="w-full"
                custom-class="mt-6 uh-global-card-glass !bg-primary !py-2.5 uh-shadow-xs border w-full !rounded-full text-gray-900 border-none !text-3xs"
                :class="loading ? 'opacity-60' : ''" @click="doPasswordLogin"
              >
                {{ loading ? '登录中...' : '登 录' }}
              </uh-button>
            </template>

            <!-- 微信登录 -->
            <!-- #ifdef MP-WEIXIN -->
            <button
              v-if="wechatLoginEnabled"
              class="uh-button-native uh-global-card-glass mt-3 w-full w-full text-sm text-gray-900 !rounded-full !bg-primary !py-2"
              :class="loading ? 'opacity-60' : ''" :disabled="loading" @click="doWechatLogin"
            >
              {{ loading ? '登录中...' : '微信一键登录' }}
            </button>
            <!-- #endif -->
          </view>
          <!-- 去注册 -->
          <view v-if="registrationAllowed" class="mt-4 text-center text-xs text-black/50" @click="goRegister">
            没有账号？去注册
          </view>
          <!-- 用户协议/隐私政策 -->
          <view class="mt-4 text-center text-xs text-black/40 leading-5">
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
      </view>
      <!-- 页脚 -->
      <view class="relative z-10 mb-4 box-border w-full shrink-0 pt-4 pb-safe">
        <uh-page-copyright />
      </view>
    </view>

    <!-- 用户协议/隐私政策弹窗(底部弹出,tab 切换查看) -->
    <uh-agreement-popup
      v-model="agreementPopupVisible" :show-agree-button="true" :contents="agreementContents"
      :initial-tab="agreementTab"
    />

    <!-- 微信补邮箱注册弹层(新微信一键登录被拦后的第二段) -->
    <uh-wx-email-verify-sheet v-model="wxEmailSheet" :ticket="wxTicket" @success="handleLoginSuccess" />
  </view>
</template>

<style lang="scss" scoped>
:deep(.uh-login-input) {
  box-sizing: border-box;
  height: 88rpx;
  padding: 0 24rpx;
  background-color: rgb(255 255 255 / 65%);
  border-radius: 24rpx;
}

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

/* logo 浮动 */
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
</style>
