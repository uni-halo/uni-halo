<script lang="ts" setup>
import { computed, onUnmounted, ref } from 'vue'
import { onPageScroll, onShow } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import { useDialog } from '@wot-ui/ui'
import { DIALOG_CANCEL_BUTTON_PROPS, DIALOG_CONFIRM_BUTTON_PROPS } from '@/config/dialog'
import {
  bindMyWechat,
  getAuthProfile,
  getMyWechatBinding,
  getWxCode,
  setInitialPassword,
  unbindMyWechat,
} from '@/api/auth'
import type { IMyWechatBinding } from '@/api/auth'
import {
  changeMyPassword,
  getCurrentUserDetail,
  sendEmailVerificationCode,
  updateUserProfile,
  uploadUserAvatar,
  verifyEmail,
} from '@/api/user'
import { usePageScroll } from '@/hooks/usePageScroll'
import { useTokenStore } from '@/store/token'
import { useUserStore } from '@/store/user'
import { isWechat } from '@/utils/platform'
import { checkAvatarUrl } from '@/utils/url'
import { getAvatarFallbackText } from '@/utils/avatar'
import { sleep } from '@/utils/common'
import { isValidEmail } from '@/utils/validate'

definePage({
  style: {
    navigationBarTitleText: '我的资料',
    navigationStyle: 'custom',
  },
})

const dialog = useDialog()
const { scrollY, updatePageScrollValue } = usePageScroll()
const tokenStore = useTokenStore()
const userStore = useUserStore()
const { userInfo } = storeToRefs(userStore)

const isAdmin = computed(() => userInfo.value.roles?.includes('super-role'))

/** 统一提取报错文案(插件端错误体在 error.data.detail) */
function errText(error: any, fallback: string) {
  return error?.data?.detail || error?.data?.message || error?.message || fallback
}

/**
 * 微信绑定相关业务 code → 可执行提示
 * 权威定义在插件端 BizErrorCode(uni-halo-plugin),此处只做前端文案映射。
 * 冲突类(409)提示「先解绑」等可执行引导,便于用户自行恢复。
 */
const WECHAT_BIND_ERROR_TEXT: Record<string, string> = {
  WECHAT_ALREADY_BOUND: '该微信已绑定其他账号,请先解绑后再试',
  ACCOUNT_ALREADY_BOUND: '当前账号已绑定其他微信,请先解除绑定',
  WECHAT_LOGIN_DISABLED: '站点未开启微信登录',
  WECHAT_NOT_CONFIGURED: '站点未配置微信登录密钥,请联系站长',
  WECHAT_LOGIN_FAILED: '微信登录失败,请重试',
  BIND_TICKET_INVALID: '二维码已失效,请重新生成',
  UNAUTHENTICATED: '登录已失效,请重新登录',
  INTERNAL_ERROR: '服务异常,请稍后重试',
}

/** 绑定/解绑报错:优先按业务 code 取文案,其次服务端 message,最后兜底 */
function bizErrText(error: any, fallback: string) {
  const code = error?.data?.code as string | undefined
  return (code ? WECHAT_BIND_ERROR_TEXT[code] : '') || errText(error, fallback)
}

/* ---------------- 头像 ---------------- */
const avatarUploading = ref(false)

/** 头像选择回调（open-type="chooseAvatar" 或 chooseImage 成功后） */
function onAvatarPicked(filePath: string) {
  doUploadAvatar(filePath)
}

// #ifdef MP-WEIXIN
/** 微信端:open-type="chooseAvatar" 原生选择回调(微信头像/相册/拍照) */
function onWxAvatarChosen(e: { detail: { avatarUrl: string } }) {
  const url = e.detail?.avatarUrl
  if (url) {
    onAvatarPicked(url)
  }
}
// #endif

// #ifndef MP-WEIXIN
/** 非微信端:相册/相机二选一 */
function chooseAvatar() {
  if (avatarUploading.value) {
    return
  }
  uni.chooseImage({
    count: 1,
    sourceType: ['album', 'camera'],
    success: (res) => {
      const path = res.tempFilePaths?.[0]
      if (path) {
        onAvatarPicked(path)
      }
    },
  })
}
// #endif

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

/* ---------------- 昵称 ---------------- */
const editingNickname = ref(false)
const nicknameDraft = ref('')
const nicknameSaving = ref(false)

/** 整行可点进编辑态 */
function startEditNickname() {
  nicknameDraft.value = userInfo.value.nickname || ''
  editingNickname.value = true
}

function cancelEditNickname() {
  editingNickname.value = false
}

/** 复制用户名 */
function copyUsername() {
  const username = userInfo.value.username || ''
  if (!username)
    return
  uni.setClipboardData({
    data: username,
    success: () => uni.showToast({ icon: 'none', title: '用户名已复制' }),
  })
}

async function saveNickname() {
  const displayName = nicknameDraft.value.trim()
  if (!displayName) {
    uni.showToast({ icon: 'none', title: '昵称不能为空' })
    return
  }
  if (displayName === userInfo.value.nickname) {
    cancelEditNickname()
    return
  }
  nicknameSaving.value = true
  try {
    // 先取完整 User（含 metadata.version 乐观锁），仅改 displayName 后回写
    const userDetailRes = await getCurrentUserDetail()
    console.log('detailRes', userDetailRes.data)
    const user = userDetailRes.data.user || (userDetailRes as any)
    if (!user?.metadata?.name) {
      throw new Error('获取用户资料失败')
    }
    user.spec = { ...(user.spec || {}), displayName }
    await updateUserProfile(user)
    await userStore.fetchUserInfo()
    editingNickname.value = false
    uni.showToast({ icon: 'none', title: '昵称已更新' })
  }
  catch (error: any) {
    console.error('昵称保存失败:', error)
    uni.showToast({ icon: 'none', title: errText(error, '昵称保存失败') })
  }
  finally {
    nicknameSaving.value = false
  }
}

/* ---------------- 修改密码（UC 端点） ---------------- */
const passwordSheet = ref(false)
const passwordSet = ref(true)
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordSaving = ref(false)

async function openPasswordSheet() {
  oldPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  passwordSheet.value = true
  // 判定「是否自主设置过密码」：必须用插件 profile 的 passwordSetByUser（注解），
  // 不能用 UC 的 passwordSet——后者只看密码哈希是否存在，插件代生成的随机/固定
  // 密码用户注册起就是 true，会被误判为已设置而要求输入无人知晓的旧密码。
  try {
    const res = await getAuthProfile()
    passwordSet.value = res.data?.user?.passwordSetByUser !== false
  }
  catch {
    passwordSet.value = true
  }
}

async function savePassword() {
  const pwd = newPassword.value
  if (passwordSet.value && !oldPassword.value) {
    uni.showToast({ icon: 'none', title: '请输入原密码' })
    return
  }
  if (!pwd || pwd.length < 6) {
    uni.showToast({ icon: 'none', title: '新密码至少 5 位' })
    return
  }
  if (pwd !== confirmPassword.value) {
    uni.showToast({ icon: 'none', title: '两次输入的新密码不一致' })
    return
  }
  passwordSaving.value = true
  try {
    if (passwordSet.value) {
      // 已自主设置过密码：走 Halo UC 端点，需旧密码验证
      await changeMyPassword(oldPassword.value, pwd)
      passwordSheet.value = false
      uni.showToast({ icon: 'none', title: '密码修改成功' })
    }
    else {
      // 从未自主设置过密码（微信自动注册的随机密码用户）：走插件端首次设密接口，
      // 免旧密码；服务端打 password-set-by-user 注解后此通道关闭。
      await setInitialPassword(pwd)
      passwordSheet.value = false
      uni.showToast({ icon: 'none', title: '密码设置成功' })
    }
  }
  catch (error: any) {
    // 插件端判定已设置过（403 PASSWORD_ALREADY_SET）：切回「已设置」模式，提示补旧密码
    if (error?.data?.code === 'PASSWORD_ALREADY_SET') {
      passwordSet.value = true
      uni.showToast({ icon: 'none', title: '密码已设置，请输入原密码修改' })
    }
    else {
      console.error('密码设置失败:', error)
      uni.showToast({ icon: 'none', title: errText(error, '密码设置失败') })
    }
  }
  finally {
    passwordSaving.value = false
  }
}

/* ---------------- 邮箱验证/换绑 ---------------- */
/* 官方链路：POST users/-/send-email-verification-code 把新邮箱暂存 EMAIL_TO_VERIFY
 * 注解并把验证码发往新邮箱；POST users/-/verify-email 以「当前密码 + 验证码」
 * 双重确认，成功后服务端才把新邮箱写入 spec.email 并置 emailVerified=true。 */
const emailSheet = ref(false)
const emailInfo = ref({ email: '', verified: false })
const emailDraft = ref('')
const emailCode = ref('')
const emailPassword = ref('')
const emailSubmitting = ref(false)
const emailCodeSending = ref(false)
const emailCodeCountdown = ref(0)
let emailCodeTimer: ReturnType<typeof setInterval> | null = null

async function fetchEmailInfo() {
  try {
    const res = await getCurrentUserDetail()
    emailInfo.value = {
      email: res.data?.user?.spec?.email || '',
      verified: res.data?.user?.spec?.emailVerified === true,
    }
  }
  catch (error) {
    console.error('获取邮箱信息失败:', error)
  }
}

function openEmailSheet() {
  emailDraft.value = emailInfo.value.email || userInfo.value.email || ''
  emailCode.value = ''
  emailPassword.value = ''
  emailSheet.value = true
}

/** 发送验证码到新邮箱 */
async function sendEmailCode() {
  const value = emailDraft.value.trim()
  if (!value || !isValidEmail(value)) {
    uni.showToast({ icon: 'none', title: '请填写正确的邮箱' })
    return
  }
  if (emailCodeSending.value || emailCodeCountdown.value > 0) {
    return
  }
  emailCodeSending.value = true
  try {
    await sendEmailVerificationCode(value)
    uni.showToast({ icon: 'none', title: '验证码已发送，请查收邮箱' })
    emailCodeCountdown.value = 60
    emailCodeTimer = setInterval(() => {
      emailCodeCountdown.value--
      if (emailCodeCountdown.value <= 0) {
        clearInterval(emailCodeTimer!)
        emailCodeTimer = null
      }
    }, 1000)
  }
  catch (error: any) {
    console.error('发送邮箱验证码失败:', error)
    uni.showToast({ icon: 'none', title: errText(error, '验证码发送失败，请稍后重试') })
  }
  finally {
    emailCodeSending.value = false
  }
}

/** 验证新邮箱（当前密码 + 验证码双重确认） */
async function submitEmailVerify() {
  const value = emailDraft.value.trim()
  if (!value || !isValidEmail(value)) {
    uni.showToast({ icon: 'none', title: '请填写正确的邮箱' })
    return
  }
  if (!emailCode.value.trim()) {
    uni.showToast({ icon: 'none', title: '请输入邮箱验证码' })
    return
  }
  if (!emailPassword.value) {
    uni.showToast({ icon: 'none', title: '请输入当前密码' })
    return
  }
  emailSubmitting.value = true
  try {
    await verifyEmail(emailPassword.value, emailCode.value.trim())
    emailSheet.value = false
    uni.showToast({ icon: 'none', title: '邮箱验证成功' })
    await Promise.all([fetchEmailInfo(), userStore.fetchUserInfo()])
  }
  catch (error: any) {
    console.error('邮箱验证失败:', error?.data?.detail)
    uni.showToast({ icon: 'none', title: errText(error, '邮箱验证失败') })
  }
  finally {
    emailSubmitting.value = false
  }
}

onUnmounted(() => {
  if (emailCodeTimer) {
    clearInterval(emailCodeTimer)
  }
})

/* ---------------- 微信绑定 ---------------- */
const binding = ref<IMyWechatBinding | null>(null)
const bindingLoading = ref(false)
const bindSubmitting = ref(false)

const isBound = computed(() => binding.value?.bound === true)

async function fetchBinding() {
  bindingLoading.value = true
  try {
    const res = await getMyWechatBinding()
    binding.value = res.data || null
  }
  catch (error) {
    console.error('获取微信绑定状态失败:', error)
    binding.value = null
  }
  finally {
    bindingLoading.value = false
  }
}

/** 一键绑定微信（仅微信小程序环境；身份由 token 携带，code 换微信身份） */
async function handleBindWechat() {
  if (bindSubmitting.value) { return }
  bindSubmitting.value = true
  try {
    const loginRes = await getWxCode()
    await bindMyWechat(loginRes.code)
    // 服务端同时发站内通知,提示里一并说明,避免用户疑惑"消息通知里那条哪来的"
    uni.showToast({ icon: 'none', title: '绑定成功，已发送站内通知' })
    await fetchBinding()
  }
  catch (error: any) {
    console.error('微信绑定失败:', error)
    uni.showToast({ icon: 'none', title: bizErrText(error, '微信绑定失败') })
  }
  finally {
    bindSubmitting.value = false
  }
}

/** 解除绑定（幂等：未绑定时同样成功） */
function handleUnbindWechat() {
  dialog.confirm({
    title: '提示',
    msg: '解绑后将无法使用微信一键登录该账号，确定解除绑定吗？',
    zIndex: 9999,
    confirmButtonProps: DIALOG_CONFIRM_BUTTON_PROPS,
    cancelButtonProps: DIALOG_CANCEL_BUTTON_PROPS,
  }).then(async () => {
    try {
      await unbindMyWechat()
      // 直接本地置为未绑定,不立即重查:服务端 UserConnection 删除是两阶段异步,
      // 删除指令返回后残留的 deleting 记录仍可能让重查返回 bound=true;
      // 下次进入页面 fetchBinding 自然拿到最终状态
      binding.value = {
        username: userInfo.value.username,
        bound: false,
        providerUserId: null,
        boundAt: null,
      }
      uni.showToast({ icon: 'none', title: '已解除绑定，已发送站内通知' })
    }
    catch (error: any) {
      console.error('解绑失败:', error)
      uni.showToast({ icon: 'none', title: bizErrText(error, '解绑失败') })
    }
  }).catch(() => { })
}

/* ---------------- 退出登录（复用「我的」弹窗既有流程） ---------------- */
function handleLogout() {
  dialog.confirm({
    title: '提示',
    msg: '确定退出登录吗？',
    zIndex: 9999,
    confirmButtonProps: DIALOG_CONFIRM_BUTTON_PROPS,
    cancelButtonProps: DIALOG_CANCEL_BUTTON_PROPS,
  }).then(async () => {
    await tokenStore.logout()
    uni.showToast({ icon: 'none', title: '已退出登录' })
    setTimeout(() => uni.navigateBack(), 600)
  }).catch(() => { })
}

function isExampleEMail(email: string) {
  return email?.trim().endsWith('@example.com')
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
  fetchBinding()
  // 邮箱与验证状态（store 摘要不含 emailVerified，走 console users/- 补齐）
  fetchEmailInfo()
})
</script>

<template>
  <wd-dialog />
  <view class="box-border min-h-screen bg-page">
    <uh-navbar :scroll-y="scrollY" default-title="我的资料" title-color="text-gray-900" :need-placeholder="true" />

    <view class="box-border flex flex-col gap-y-5 px-4 py-3">
      <!-- 头像卡片:微信端 open-type 原生弹出(微信头像/相册/拍照),其他端点击走 chooseImage -->
      <view class="uh-global-card-glass uh-shadow-xs flex flex-col items-center gap-y-2 rounded-2xl py-6">
        <!-- #ifdef MP-WEIXIN -->
        <button
          class="avatar-trigger relative h-22 w-22" open-type="chooseAvatar"
          :disabled="avatarUploading" @chooseavatar="onWxAvatarChosen"
        >
          <wd-avatar
            :src="checkAvatarUrl(userInfo.avatar)"
            :text="getAvatarFallbackText(userInfo.nickname || userInfo.username)"
            shape="round"
            custom-class="uh-global-card-glass uh-shadow-xs !h-full !w-full !text-gray-900 !font-bold"
            class="!rounded-full"
            mode="aspectFill"
          />
          <view
            class="uh-translate-center absolute left-1/2 top-1/2 h-6 w-6 flex items-center justify-center"
          >
            <wd-icon name="camera" size="32rpx" custom-class="text-white" />
          </view>
          <view
            v-if="avatarUploading"
            class="absolute inset-0 flex items-center justify-center rounded-full bg-black/30"
          >
            <wd-loading size="52rpx" class="text-primary" />
          </view>
        </button>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <view class="relative h-22 w-22" @click="chooseAvatar">
          <wd-avatar
            :src="checkAvatarUrl(userInfo.avatar)"
            :text="getAvatarFallbackText(userInfo.nickname || userInfo.username)"
            shape="round"
            custom-class="uh-global-card-glass uh-shadow-xs !h-full !w-full !text-gray-900 !font-bold"
            class="!rounded-full"
            mode="aspectFill"
          />
          <view
            class="uh-translate-center absolute left-1/2 top-1/2 h-6 w-6 flex items-center justify-center"
          >
            <wd-icon name="camera" size="32rpx" custom-class="text-white" />
          </view>
          <view
            v-if="avatarUploading"
            class="absolute inset-0 flex items-center justify-center rounded-full bg-black/30"
          >
            <wd-loading size="52rpx" class="text-primary" />
          </view>
        </view>
        <!-- #endif -->
        <text class="text-md text-gray-900 font-bold">{{ userInfo.nickname || userInfo.username }}</text>
        <text class="text-3xs text-gray-400">点击头像更换</text>
      </view>

      <!-- 账号资料 -->
      <view class="flex flex-col">
        <uh-section-title>账号资料</uh-section-title>
        <view class="uh-global-card-glass uh-shadow-xs mt-3 overflow-hidden rounded-2xl">
          <!-- 昵称(整行可点进编辑) -->
          <view
            class="flex items-center gap-x-3 px-4 py-3"
            :class="editingNickname ? '' : 'border-b border-black/5'"
          >
            <wd-icon name="at" size="36rpx" custom-class="text-gray-900 dark:text-gray-100" />
            <text class="shrink-0 text-sm text-gray-900">昵称</text>
            <view class="flex flex-1 items-center justify-end gap-x-2">
              <template v-if="editingNickname">
                <wd-input
                  v-model="nicknameDraft" no-border
                  custom-class="flex-1 uh-profile-input uh-global-card-glass uh-shadow-xs border !rounded-lg !h-auto !py-1 !bg-gray-100 !text-xs"
                  focus placeholder="请输入昵称" :disabled="nicknameSaving" :maxlength="20"
                  @confirm="saveNickname"
                />
                <view class="flex shrink-0 items-center gap-x-1">
                  <uh-button
                    custom-class="uh-global-card-glass border !bg-gray-100 !px-2 py-1.5 !text-xs text-gray-gray-600"
                    @click="cancelEditNickname"
                  >
                    取消
                  </uh-button>
                  <uh-button
                    custom-class="uh-global-card-glass border shrink-0 !px-2 py-1.5 !text-xs text-gray-900"
                    :class="nicknameSaving ? 'opacity-60' : ''" @click="saveNickname"
                  >
                    {{ nicknameSaving ? '保存中' : '保存' }}
                  </uh-button>
                </view>
              </template>
              <template v-else>
                <text
                  class="truncate text-2xs text-gray-500"
                  @click="!editingNickname && startEditNickname()"
                >
                  {{ userInfo.nickname || '-' }}
                </text>
                <wd-icon
                  name="edit" size="28rpx" custom-class="text-gray-500"
                  @click="!editingNickname && startEditNickname()"
                />
              </template>
            </view>
          </view>
          <!-- 用户名(资源 name,不可改) -->
          <view class="flex items-center gap-x-3 border-b border-black/5 px-4 py-3">
            <wd-icon name="user" size="36rpx" custom-class="text-gray-900 dark:text-gray-100" />
            <text class="shrink-0 text-sm text-gray-900">用户名</text>
            <view class="flex flex-1 items-center justify-end gap-x-2">
              <text class="text-2xs text-gray-500" @click="copyUsername">{{ userInfo.username || '-' }}</text>
            </view>
          </view>
          <!-- 角色 -->
          <view class="flex items-center gap-x-3 border-b border-black/5 px-4 py-3">
            <wd-icon name="idcard" size="36rpx" custom-class="text-gray-900 dark:text-gray-100" />
            <text class="shrink-0 text-sm text-gray-900">角色</text>
            <view class="flex flex-1 items-center justify-end">
              <text class="rounded-full bg-secondary px-2 py-0.5 text-20rpx text-[#4d7c0f]">
                {{ isAdmin ? '超级管理员' : '普通用户' }}
              </text>
            </view>
          </view>
          <!-- 邮箱(点击打开验证/换绑弹层;验证状态来自 console users/- 的 emailVerified) -->
          <view class="flex items-center gap-x-3 px-4 py-3" @click="openEmailSheet">
            <wd-icon name="email" size="36rpx" custom-class="text-gray-900 dark:text-gray-100" />
            <text class="shrink-0 text-sm text-gray-900">邮箱</text>
            <view class="min-w-0 flex flex-1 items-center justify-end gap-x-2">
              <text
                class="shrink-0 rounded-full px-2 py-0.5 text-20rpx"
                :class="emailInfo.verified ? 'bg-secondary text-[#4d7c0f]' : 'bg-orange-400/10 text-orange-500'"
              >
                {{ emailInfo.verified ? '已验证' : '未验证' }}
              </text>
              <text class="truncate text-2xs text-gray-500">{{ emailInfo.email || userInfo.email || '-' }}</text>
              <wd-icon name="edit" size="28rpx" custom-class="shrink-0 text-gray-400" />
            </view>
          </view>
        </view>
      </view>

      <!-- 账号绑定 -->
      <view class="flex flex-col">
        <uh-section-title>账号绑定</uh-section-title>
        <view class="uh-global-card-glass uh-shadow-xs mt-3 flex items-center gap-x-3 rounded-2xl px-4 py-4">
          <view
            class="uh-global-card-glass h-11 w-11 flex shrink-0 items-center justify-center rounded-xl bg-green-400/10 shadow-none"
          >
            <wd-icon name="message" size="46rpx" class="text-primary" />
          </view>
          <view class="min-w-0 flex flex-1 flex-col gap-y-1">
            <view class="flex items-center gap-x-1.5">
              <view class="h-2 w-2 rounded-full" :class="isBound ? 'bg-primary' : 'bg-gray-300'" />
              <text class="text-3xs text-gray-900 font-bold">
                {{ bindingLoading ? '查询中...' : isBound ? '已绑定微信' : '未绑定微信' }}
              </text>
            </view>
            <text class="text-xs text-gray-400">
              可在微信小程序内一键登录
            </text>
          </view>
          <template v-if="!bindingLoading">
            <uh-button
              v-if="isBound"
              custom-class="uh-global-card-glass border !rounded-full border-red-400/30 bg-red-400/10 px-4 py-1.5 text-xs text-red-400 shadow-none"
              @action-click="handleUnbindWechat"
            >
              解除绑定
            </uh-button>
            <uh-button
              v-else-if="isWechat"
              custom-class="!rounded-full !bg-green-500 px-4 py-1.5 !text-xs text-white"
              :class="bindSubmitting ? 'opacity-60' : ''" @action-click="handleBindWechat"
            >
              {{ bindSubmitting ? '绑定中' : '一键绑定' }}
            </uh-button>
          </template>
        </view>
      </view>

      <!-- 账号安全 -->
      <view class="flex flex-col">
        <uh-section-title>账号安全</uh-section-title>
        <view class="uh-global-card-glass uh-shadow-xs mt-3 overflow-hidden rounded-2xl">
          <view class="flex items-center gap-x-3 px-4 py-3.5" @click="openPasswordSheet">
            <wd-icon name="lock" size="36rpx" custom-class="text-gray-900 dark:text-gray-100" />
            <text class="shrink-0 text-sm text-gray-900">修改密码</text>
            <view class="flex flex-1 items-center justify-end gap-x-2">
              <text class="text-3xs text-gray-400">{{ passwordSet ? '已设置密码' : '未设置密码' }}</text>
              <wd-icon name="edit" size="28rpx" custom-class="text-gray-400" />
            </view>
          </view>
        </view>
      </view>

      <!-- 退出登录 -->
      <view class="mt-2 box-border w-full pb-6">
        <uh-button
          custom-class="uh-global-card-glass w-full border border-red-400/30 bg-red-400/80 py-2.5 text-white !rounded-full !text-3xs"
          @action-click="handleLogout()"
        >
          退出登录
        </uh-button>
      </view>
    </view>

    <!-- 修改密码弹层(输入中途误触遮罩不应丢弃已填内容,禁用遮罩关闭) -->
    <uh-glass-popup
      v-model="passwordSheet" :hide-when-close="true" position="bottom" :z-index="100"
      :close-on-click-modal="false" custom-class="rounded-xl"
    >
      <!-- 弹窗容器 -->
      <view class="box-border w-full flex flex-col gap-y-3 p-3">
        <!-- 顶部 -->
        <view class="flex items-center justify-between">
          <text class="text-md font-bold">修改密码</text>
        </view>
        <view class="flex flex-col gap-y-3">
          <wd-input
            v-if="passwordSet" v-model="oldPassword" custom-class="uh-profile-input !rounded-lg" show-password
            prefix-icon="lock" no-border placeholder="请输入原密码" clearable :disabled="passwordSaving"
          />
          <wd-input
            v-model="newPassword" custom-class="uh-profile-input !rounded-lg" show-password prefix-icon="lock"
            no-border placeholder="请输入新密码(至少 6 位)" clearable :disabled="passwordSaving"
          />
          <wd-input
            v-model="confirmPassword" custom-class="uh-profile-input !rounded-lg" show-password prefix-icon="lock"
            no-border placeholder="请再次输入新密码" clearable :disabled="passwordSaving"
          />
          <text v-if="!passwordSet" class="text-xs text-gray-600">
            微信自动注册的账号未自主设置过密码，无需原密码可直接设置，设置后请牢记新密码。
          </text>
        </view>
        <!-- 底部固定操作区域 -->
        <view class="box-border w-full flex items-center justify-center gap-x-3">
          <uh-button
            class="flex-1"
            custom-class="flex-1 uh-global-card-glass uh-shadow-xs border !py-2.5 !rounded-xl !text-3xs bg-white/90"
            @click="passwordSheet = false"
          >
            取消
          </uh-button>
          <uh-button
            class="flex-1"
            custom-class="flex-1 uh-global-card-glass uh-shadow-xs border !py-2.5 !rounded-xl !text-3xs bg-primary text-gray-900"
            :class="passwordSaving ? 'opacity-60' : ''" @action-click="savePassword"
          >
            {{ passwordSaving ? '保存中' : '确定' }}
          </uh-button>
        </view>
      </view>
    </uh-glass-popup>

    <!-- 邮箱验证弹层(新邮箱 → 验证码 + 当前密码,验证通过后服务端写入 spec.email) -->
    <uh-glass-popup
      v-model="emailSheet" :hide-when-close="true" position="bottom" :z-index="100"
      :close-on-click-modal="false" custom-class="rounded-xl"
    >
      <view class="box-border w-full flex flex-col gap-y-3 p-3">
        <view class="flex items-center justify-between">
          <text class="text-md font-bold">{{ emailInfo.verified ? '修改邮箱' : '验证邮箱' }}</text>
        </view>
        <view class="flex flex-col gap-y-3">
          <wd-input
            v-model="emailDraft" custom-class="uh-profile-input !rounded-lg" prefix-icon="email"
            no-border placeholder="请输入新邮箱" clearable :disabled="emailSubmitting || emailCodeSending"
          />
          <text v-if="isExampleEMail(emailDraft)" class="text-xs text-gray-600">
            说明：@example.com 是示例邮箱，请更换自己的邮箱。
          </text>
          <view class="flex items-center gap-x-2">
            <wd-input
              v-model="emailCode" custom-class="uh-profile-input flex-1 !rounded-lg" prefix-icon="message"
              no-border placeholder="请输入邮箱验证码" clearable :disabled="emailSubmitting"
            />
            <uh-button
              class="shrink-0"
              custom-class="uh-global-card-glass uh-shadow-xs border shrink-0 !px-3 py-2.5 !text-xs text-gray-900"
              :class="emailCodeCountdown > 0 || emailCodeSending ? 'opacity-60' : ''"
              @action-click="sendEmailCode"
            >
              {{ emailCodeCountdown > 0 ? `${emailCodeCountdown}s 后重发` : (emailCodeSending ? '发送中' : '发送验证码') }}
            </uh-button>
          </view>
          <wd-input
            v-model="emailPassword" custom-class="uh-profile-input !rounded-lg" show-password prefix-icon="lock"
            no-border placeholder="请输入当前密码" clearable :disabled="emailSubmitting"
          />
          <text class="text-xs text-gray-600">
            验证码将发送到新邮箱，10 分钟内有效；验证需当前密码确认身份，未设置过密码的账号请先在「修改密码」中设置。
          </text>
        </view>
        <view class="box-border w-full flex items-center justify-center gap-x-3">
          <uh-button
            class="flex-1"
            custom-class="flex-1 uh-global-card-glass uh-shadow-xs border !py-2.5 !rounded-xl !text-3xs bg-white/90"
            @click="emailSheet = false"
          >
            取消
          </uh-button>
          <uh-button
            class="flex-1"
            custom-class="flex-1 uh-global-card-glass uh-shadow-xs border !py-2.5 !rounded-xl !text-3xs bg-primary text-gray-900"
            :class="emailSubmitting ? 'opacity-60' : ''" @action-click="submitEmailVerify"
          >
            {{ emailSubmitting ? '验证中' : '确定' }}
          </uh-button>
        </view>
      </view>
    </uh-glass-popup>
  </view>
</template>

<style scoped lang="scss">
.avatar-trigger {
  margin: 0;
  padding: 0;
  background: transparent;
  border-radius: 9999rpx;
  line-height: 1;
}

.avatar-trigger::after {
  border: none;
}

:deep(.uh-profile-input) {
  box-sizing: border-box;
  height: 74rpx;
  padding: 0 24rpx;
  background-color: rgb(255 255 255 / 65%);
  border-radius: 20rpx;
  width: 100%;
}
</style>
