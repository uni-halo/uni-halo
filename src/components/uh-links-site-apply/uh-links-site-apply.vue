<script lang="ts" setup>
/**
 * 友链申请表单弹窗(站点版,源自旧页面 pages-blog/submit-link)
 * 参考小程序申请弹窗 uh-links-mini-apply 的封装方式(uh-glass-popup bottom + 表单 + 提交)
 * 提交后等待站长审核,通过后展示在「站点」列表中
 */
import { ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  show?: boolean
}>(), {
  show: false,
})

const emit = defineEmits<{
  (e: 'on-close', data: { isSubmit: boolean, refresh: boolean }): void
}>()

const isShow = ref(false)

interface IApplyForm {
  name: string
  url: string
  logo: string
  linkPageUrl: string
  email: string
  rssUrl: string
  description: string
}

const form = ref<IApplyForm>({
  name: '',
  url: '',
  logo: '',
  linkPageUrl: '',
  email: '',
  rssUrl: '',
  description: '',
})

const submitting = ref(false)

function handleResetForm() {
  form.value = {
    name: '',
    url: '',
    logo: '',
    linkPageUrl: '',
    email: '',
    rssUrl: '',
    description: '',
  }
}

function checkIsUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

function checkIsEmail(email: string): boolean {
  return /^[\w.-]+@[\w-]+(?:\.[\w-]+)+$/.test(email)
}

/** 提交校验 */
function validateForm(): boolean {
  if (!form.value.name.trim()) {
    uni.showToast({ icon: 'none', title: '请输入网站名称！' })
    return false
  }
  if (!checkIsUrl(form.value.url)) {
    uni.showToast({ icon: 'none', title: '请输入正确的网站地址！' })
    return false
  }
  if (form.value.logo.trim() && !checkIsUrl(form.value.logo.trim())) {
    uni.showToast({ icon: 'none', title: '请输入正确的Logo地址！' })
    return false
  }
  if (form.value.email.trim() && !checkIsEmail(form.value.email.trim())) {
    uni.showToast({ icon: 'none', title: '请输入正确的邮箱地址！' })
    return false
  }
  return true
}

/** 提交申请 */
async function handleSubmit() {
  if (!validateForm())
    return

  // linksSubmitPlugin 已弃用（2026-09-08），第三方友链自助提交暂未开放；
  // 后续可对接 Halo 官方 plugin-links link-applications 接口
  uni.showToast({ icon: 'none', title: '友链申请功能暂未开放，请联系站长' })
}

function handleOnChange(isOpen: boolean) {
  isShow.value = isOpen
  if (!isOpen)
    emit('on-close', { isSubmit: false, refresh: false })
}

function handleClose(refresh = false) {
  isShow.value = false
  emit('on-close', { isSubmit: true, refresh })
}

watch(() => props.show, (val) => {
  if (!val)
    return
  isShow.value = true
  handleResetForm()
})
</script>

<template>
  <uh-glass-popup
    v-model="isShow" :z-index="100" position="bottom"
    custom-class="!border rounded-xl" @close="handleClose(false)"
  >
    <view class="relative mb-4 box-border w-full flex items-center justify-around px-4 pt-4">
      <view class="w-full flex flex-col gap-y-1">
        <text class="text-md font-bold">申请友链</text>
        <text class="text-xs text-gray-500">提交后等待站长审核,通过后展示在「站点」列表中</text>
      </view>
      <view
        class="uh-global-card-glass absolute right-4 top-4 h-6 w-6 border rounded-lg text-center shadow-none"
        @click="handleClose(false)"
      >
        <wd-icon name="close" size="32rpx" class="text-gray-500" />
      </view>
    </view>
    <scroll-view :scroll-y="true" :show-scrollbar="false" class="box-border max-h-[60vh] p-4 pt-0">
      <view class="mb-5 flex items-center">
        <text class="label w-[140rpx] shrink-0 text-sm text-[#666]">名称 *</text>
        <input
          v-model="form.name"
          class="uh-global-card-glass h-9 flex-1 border rounded-xl px-4 text-sm shadow-none"
          placeholder="请输入网站名称"
        >
      </view>

      <view class="mb-5 flex items-center">
        <text class="label w-[140rpx] shrink-0 text-sm text-[#666]">网址 *</text>
        <input
          v-model="form.url"
          class="uh-global-card-glass h-9 flex-1 border rounded-xl px-4 text-sm shadow-none"
          placeholder="请输入网站地址"
        >
      </view>

      <view class="mb-5 flex items-center">
        <text class="label w-[140rpx] shrink-0 text-sm text-[#666]">Logo</text>
        <input
          v-model="form.logo"
          class="uh-global-card-glass h-9 flex-1 border rounded-xl px-4 text-sm shadow-none"
          placeholder="请输入网站Logo(选填)"
        >
      </view>

      <view class="mb-5 flex items-center">
        <text class="label w-[140rpx] shrink-0 text-sm text-[#666]">邮箱</text>
        <input
          v-model="form.email"
          class="uh-global-card-glass h-9 flex-1 border rounded-xl px-4 text-sm shadow-none"
          placeholder="请输入邮箱(选填)"
        >
      </view>

      <view class="mb-5 flex items-center">
        <text class="label w-[140rpx] shrink-0 text-sm text-[#666]">友链页面</text>
        <input
          v-model="form.linkPageUrl"
          class="uh-global-card-glass h-9 flex-1 border rounded-xl px-4 text-sm shadow-none"
          placeholder="贵站友情链接页面地址(选填)"
        >
      </view>
      <view class="mb-2 pl-[140rpx] text-xs text-gray-400 -mt-3">
        （即包含本站链接的页面）
      </view>

      <view class="mb-5 flex items-center">
        <text class="label w-[140rpx] shrink-0 text-sm text-[#666]">RSS地址</text>
        <input
          v-model="form.rssUrl"
          class="uh-global-card-glass h-9 flex-1 border rounded-xl px-4 text-sm shadow-none"
          placeholder="用于抓取文章(选填)"
        >
      </view>

      <view class="mb-5">
        <text class="label mb-2 block text-sm text-[#666]">网站描述</text>
        <textarea
          v-model="form.description"
          class="uh-global-card-glass box-border h-24 w-full flex-1 border rounded-xl p-3 text-sm shadow-none"
          placeholder="请输入网站描述,不超过30字符(选填)" :maxlength="30"
        />
      </view>

      <view class="my-6">
        <uh-button custom-class="py-2 !rounded-xl" :loading="submitting" @click="handleSubmit">
          提交申请
        </uh-button>
      </view>
    </scroll-view>
  </uh-glass-popup>
</template>
