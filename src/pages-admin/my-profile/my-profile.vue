<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { onPageScroll, onShow } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import { uploadUserAvatar } from '@/api/user'
import { usePageScroll } from '@/hooks/usePageScroll'
import { useUserIdentity } from '@/hooks/useUserIdentity'
import ProfileHeader from './components/profile-header/profile-header.vue'
import ProfileAccountPanel from './components/profile-account-panel/profile-account-panel.vue'
import ProfileDecorationPanel from './components/profile-decoration-panel/profile-decoration-panel.vue'
import { useMyDecorations } from './composables/use-my-decorations'
import { useAppConfigStore } from '@/store/appConfig'
import { useTokenStore } from '@/store/token'
import { useUserStore } from '@/store/user'
import { sleep } from '@/utils/common'

definePage({
  style: {
    navigationBarTitleText: '我的资料',
    navigationStyle: 'custom',
  },
})

const { scrollY, updatePageScrollValue } = usePageScroll()
const tokenStore = useTokenStore()
const userStore = useUserStore()
const { userInfo } = storeToRefs(userStore)
const { auditModeEnabled } = storeToRefs(useAppConfigStore())

/* ---------------- Tab 切换与装扮状态 ---------------- */
type ProfileTab = 'profile' | 'decoration'
const activeTab = ref<ProfileTab>('profile')
const deco = useMyDecorations()
const { identityPlusAvailable, identity, profile: publicProfile } = useUserIdentity(() => userInfo.value.username)
const identityStats = computed(() => identity.value?.stats || null)
const headerBio = computed(() => publicProfile.value?.bio || '')

/** 资料面板(页面 onShow 时透传刷新) */
const accountPanelRef = ref<InstanceType<typeof ProfileAccountPanel> | null>(null)

watch(identityPlusAvailable, (available) => {
  if (available && !deco.loaded.value) {
    deco.load()
  }
}, { immediate: true })

/** 统一提取报错文案(插件端错误体在 error.data.detail) */
function errText(error: any, fallback: string) {
  return error?.data?.detail || error?.data?.message || error?.message || fallback
}

/* ---------------- 头像 ---------------- */
const avatarUploading = ref(false)

/** 头像选择回调（open-type="chooseAvatar" 或 chooseImage 成功后） */
function onAvatarPicked(filePath: string) {
  doUploadAvatar(filePath)
}

/**
 * 上传头像
 */
async function doUploadAvatar(filePath: string) {
  if (!userInfo.value.username) {
    uni.showToast({ icon: 'none', title: '登录状态异常，请重新登录' })
    return
  }
  avatarUploading.value = true
  const prevAvatar = userInfo.value.avatar || ''
  try {
    await uploadUserAvatar(filePath)
    // 轮询 profile 等待 Reconciler 回填 spec.avatar(最多 ~3s)
    let refreshed = false
    for (let i = 0; i < 5; i++) {
      await sleep(600)
      const info = await userStore.fetchUserInfo()
      if (info.avatar && info.avatar !== prevAvatar) {
        refreshed = true
        break
      }
    }
    uni.showToast({ icon: 'none', title: refreshed ? '头像已更新' : '头像已上传，稍后自动生效' })
  }
  catch (error: any) {
    console.error('头像上传失败:', error)
    uni.showToast({ icon: 'none', title: errText(error, '头像上传失败') })
  }
  finally {
    avatarUploading.value = false
  }
}

/* ---------------- 生命周期 ---------------- */
onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})

onShow(() => {
  if (!tokenStore.updateNowTime().hasLogin) {
    uni.showToast({ icon: 'none', title: '请先登录' })
    setTimeout(() => uni.navigateBack(), 600)
    return
  }
  // 拉最新 profile 回显（头像/昵称存原始地址，渲染时 checkAvatarUrl 补全）
  userStore.fetchUserInfo().catch(() => { })
  accountPanelRef.value?.refresh()
})
</script>

<template>
  <wd-dialog />
  <view class="box-border box-border min-h-screen bg-page pb-safe">
    <uh-navbar
      :scroll-y="scrollY" default-title="我的资料" :scroll-title="userInfo.nickname || userInfo.username"
      :need-placeholder="false"
    />

    <!-- 头部:通栏封面 + 头像 + 昵称 + 徽章 + 数据行 -->
    <profile-header
      :avatar="userInfo.avatar" :nickname="userInfo.nickname" :username="userInfo.username"
      :bio="headerBio" :uploading="avatarUploading" :deco="deco" :identity-marks="deco.identityMarks.value"
      :stats="identityStats" :enhance-enabled="identityPlusAvailable" :audit-mode="auditModeEnabled"
      @on-avatar-change="onAvatarPicked" @on-cover-tap="activeTab = 'decoration'"
    />

    <view class="box-border flex flex-col gap-y-5 px-4 py-3">
      <!-- 资料 Tab -->
      <template v-if="activeTab === 'profile'">
        <profile-account-panel ref="accountPanelRef" />
      </template>

      <!-- 装扮 Tab -->
      <template v-else>
        <profile-decoration-panel :deco="deco" />
      </template>
    </view>

    <!-- 悬浮 Tab(增强不可用时整条隐藏,页面仅资料内容) -->
    <uh-float-toolbar v-if="identityPlusAvailable" :need-placeholder="true">
      <view
        class="uh-global-card-glass uh-shadow-xs box-border flex items-center justify-center rounded-full px-5 py-2.5 !border"
        :class="activeTab === 'profile' ? 'bg-primary' : ''" @click="activeTab = 'profile'"
      >
        <text class="text-3xs text-gray-900">我的资料</text>
      </view>
      <view
        v-if="identityPlusAvailable"
        class="uh-global-card-glass uh-shadow-xs box-border flex items-center justify-center rounded-full px-5 py-2.5 !border"
        :class="activeTab === 'decoration' ? 'bg-primary' : ''" @click="activeTab = 'decoration'"
      >
        <text class="text-3xs text-gray-900">我的装扮</text>
      </view>
    </uh-float-toolbar>
  </view>
</template>
