<script lang="ts" setup>
import { useAppConfigStore } from '@/store/appConfig'
import { useTokenStore } from '@/store/token'
import { computed, ref } from 'vue'

definePage({
  style: {
    navigationBarTitleText: '登录',
    navigationStyle: 'custom',
  },
})

const appConfigStore = useAppConfigStore()
const tokenStore = useTokenStore()

/* ---------- 登录配置(getConfigs loginConfig 组,两开关全关即整体不可用) ---------- */
const loginConfig = computed(() => appConfigStore.configs.loginConfig)
const passwordLoginEnabled = computed(() => loginConfig.value?.passwordLoginEnabled !== false)
const wechatLoginEnabled = computed(() => loginConfig.value?.wechatLoginEnabled === true)

const activeTab = ref<'password' | 'wechat'>('password')
const username = ref('')
const password = ref('')
const loading = ref(false)

/** 可用登录方式(按插件端配置过滤;配置未就绪时默认展示账号密码登录) */
const availableTabs = computed(() => {
  const tabs: ('password' | 'wechat')[] = []
  if (passwordLoginEnabled.value) {
    tabs.push('password')
  }
  if (wechatLoginEnabled.value) {
    tabs.push('wechat')
  }
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
    console.error('微信登录失败:', error)
  }
  finally {
    loading.value = false
  }
  // #endif
}

/** 登录成功统一处理:返回来源页 */
function handleLoginSuccess() {
  setTimeout(() => {
    uni.navigateBack()
  }, 600)
}
</script>

<template>
  <view class="box-border min-h-screen w-screen bg-page">
    <uh-navbar default-title="登录" />

    <view class="box-border flex flex-col items-center px-6 pt-10">
      <!-- 登录能力整体关闭提示 -->
      <view v-if="availableTabs.length === 0" class="uh-global-card-glass uh-shadow-xs box-border w-full rounded-2xl p-8 text-center">
        <view class="text-sm text-gray-500">
          登录功能暂未开启
        </view>
      </view>

      <!-- 登录卡片（玻璃拟态） -->
      <view v-else class="uh-global-card-glass uh-shadow-xs box-border w-full rounded-2xl p-6">
        <!-- 平台切换(仅一种登录方式时不显示切换条) -->
        <view v-if="availableTabs.length > 1" class="mb-6 flex rounded-full bg-white/60 p-1">
          <view
            v-for="tab in availableTabs"
            :key="tab"
            class="flex-1 rounded-full py-2 text-center text-sm"
            :class="activeTab === tab ? 'bg-primary font-bold text-white' : 'text-gray-500'"
            @click="activeTab = tab"
          >
            {{ tab === 'password' ? '账号密码' : '微信登录' }}
          </view>
        </view>

        <!-- 账号密码登录表单 -->
        <template v-if="activeTab === 'password' && passwordLoginEnabled">
          <wd-input
            v-model="username"
            custom-class="uh-login-input"
            prefix-icon="user"
            no-border
            placeholder="请输入账号"
            :disabled="loading"
          />
          <wd-input
            v-model="password"
            custom-class="uh-login-input mt-3"
            prefix-icon="lock"
            show-password
            no-border
            placeholder="请输入密码"
            :disabled="loading"
            @confirm="doPasswordLogin"
          />
          <button
            class="mt-6 w-full rounded-full text-white"
            :class="loading ? 'opacity-60' : ''"
            :style="{ backgroundColor: '#b9e424' }"
            :disabled="loading"
            @click="doPasswordLogin"
          >
            {{ loading ? '登录中...' : '登 录' }}
          </button>
        </template>

        <!-- 微信登录 -->
        <template v-else-if="wechatLoginEnabled">
          <!-- #ifdef MP-WEIXIN -->
          <view class="flex flex-col items-center py-4">
            <view class="mb-4 h-16 w-16 flex items-center justify-center rounded-full bg-green-500/10">
              <wd-icon name="chat" size="64rpx" class="text-green-600" />
            </view>
            <button
              class="w-full rounded-full text-white"
              :class="loading ? 'opacity-60' : ''"
              :style="{ backgroundColor: '#07c160' }"
              :disabled="loading"
              @click="doWechatLogin"
            >
              {{ loading ? '登录中...' : '微信一键登录' }}
            </button>
          </view>
          <!-- #endif -->
        </template>
      </view>
    </view>

    <uh-page-copyright />
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
</style>
