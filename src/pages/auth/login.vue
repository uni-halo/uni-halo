<script lang="ts" setup>
import { loginByPassword, loginByWechat } from '@/api/uni-halo'
import { ref } from 'vue'

definePage({
  style: {
    navigationBarTitleText: '登录',
    navigationStyle: 'custom',
  },
})

/* ---------- 验证登录对接：接口结果仅在页面内展示，不做存储 ---------- */

const activeTab = ref<'password' | 'wechat'>('password')
const username = ref('')
const password = ref('')
const loading = ref(false)
/** 登录结果/错误信息（验证用，仅页面展示） */
const resultText = ref('')

/** 账号密码登录 */
async function doPasswordLogin() {
  if (!username.value || !password.value) {
    uni.showToast({ icon: 'none', title: '请输入账号和密码' })
    return
  }
  loading.value = true
  resultText.value = '登录中...'
  try {
    const res = await loginByPassword(username.value, password.value)
    resultText.value = JSON.stringify(res.data, null, 2)
    console.log('账号密码登录成功:', res.data)
  }
  catch (error: any) {
    resultText.value = `登录失败: ${error?.message ?? JSON.stringify(error)}`
    console.error('账号密码登录失败:', error)
  }
  finally {
    loading.value = false
  }
}

/** 微信登录（仅微信小程序可用） */
async function doWechatLogin() {
  // #ifdef MP-WEIXIN
  loading.value = true
  resultText.value = '登录中...'
  try {
    const loginRes = await new Promise<UniApp.LoginRes>((resolve, reject) => {
      uni.login({
        provider: 'weixin',
        success: res => resolve(res),
        fail: err => reject(new Error(err.errMsg || 'uni.login 失败')),
      })
    })
    console.log('wx.login code:', loginRes.code)
    const res = await loginByWechat(loginRes.code)
    resultText.value = JSON.stringify(res.data, null, 2)
    console.log('微信登录成功:', res.data)
  }
  catch (error: any) {
    resultText.value = `微信登录失败: ${error?.message ?? JSON.stringify(error)}`
    console.error('微信登录失败:', error)
  }
  finally {
    loading.value = false
  }
  // #endif
}
</script>

<template>
  <view class="box-border min-h-screen w-screen bg-page">
    <uh-navbar default-title="登录" />

    <view class="box-border flex flex-col items-center px-6 pt-10">
      <!-- 登录卡片（玻璃拟态） -->
      <view class="uh-global-card-glass uh-shadow-xs box-border w-full rounded-2xl p-6">
        <!-- 平台切换 -->
        <view class="mb-6 flex rounded-full bg-white/60 p-1">
          <view
            class="flex-1 rounded-full py-2 text-center text-sm"
            :class="activeTab === 'password' ? 'bg-primary font-bold text-white' : 'text-gray-500'"
            @click="activeTab = 'password'"
          >
            账号密码
          </view>
          <!-- #ifdef MP-WEIXIN -->
          <view
            class="flex-1 rounded-full py-2 text-center text-sm"
            :class="activeTab === 'wechat' ? 'bg-primary font-bold text-white' : 'text-gray-500'"
            @click="activeTab = 'wechat'"
          >
            微信登录
          </view>
          <!-- #endif -->
        </view>

        <!-- 账号密码登录表单 -->
        <template v-if="activeTab === 'password'">
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
        <template v-else>
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

      <!-- 登录结果输出（验证用） -->
      <view v-if="resultText" class="uh-global-card-glass uh-shadow-xs mt-6 box-border w-full rounded-2xl p-4">
        <view class="mb-2 text-sm font-bold text-gray-700">
          登录结果
        </view>
        <text class="break-all whitespace-pre-wrap text-xs text-gray-500">{{ resultText }}</text>
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
