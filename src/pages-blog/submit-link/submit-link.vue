<script lang="ts" setup>
/**
 * 友链申请页(源自旧项目 pagesA/submit-link,新建复刻)
 * 提交友链交换信息表单
 */
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { submitLink } from '@/api/uni-halo'
import { useAppConfigStore } from '@/store/appConfig'
import { checkAvatarUrl } from '@/utils/url'

definePage({
  style: {
    navigationBarTitleText: '友链申请',
  },
})

const appConfigStore = useAppConfigStore()
const haloPluginConfigs = computed(() => appConfigStore.configs.pluginConfig)

const blogDetail = computed(() => (haloPluginConfigs.value?.linksSubmitPlugin as {
  blogName?: string
  blogUrl?: string
  blogLogo?: string
  blogDesc?: string
} | undefined) || {})

const blogDetailPoupShow = ref(false)

const form = ref({
  url: '',
  name: '',
  logo: '',
  linkPageUrl: '',
  email: '',
  rssUrl: '',
  description: '',
})

const calcBlogContent = computed(() => `
博客名称：${blogDetail.value.blogName}
博客地址：${blogDetail.value.blogUrl}
博客logo：${checkAvatarUrl(blogDetail.value.blogLogo)}
博客简介：${blogDetail.value.blogDesc}
`)

function calcSiteThumbnail(val?: string): string {
  if (!val)
    return ''
  const _val = val.endsWith('/') ? val : `${val}/`
  return `https://image.thum.io/get/width/1000/crop/800/${_val}`
}

function checkIsUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

function checkIsEmail(email: string): boolean {
  return /^[\w.-]+@[\w-]+(?:\.[\w-]+)+$/.test(email)
}

async function handleHandle() {
  if (!form.value.name.trim()) {
    uni.showToast({ icon: 'none', title: '请输入网站名称！' })
    return
  }
  if (!checkIsUrl(form.value.url)) {
    uni.showToast({ icon: 'none', title: '请输入正确的网站地址！' })
    return
  }
  if (form.value.logo && !checkIsUrl(form.value.logo)) {
    uni.showToast({ icon: 'none', title: '请输入正确的Logo地址！' })
    return
  }
  if (form.value.email && !checkIsEmail(form.value.email)) {
    uni.showToast({ icon: 'none', title: '请输入正确的邮箱地址！' })
    return
  }

  uni.showLoading({ title: '正在提交...' })
  try {
    const res = await submitLink({
      name: form.value.name,
      url: form.value.url,
      logo: form.value.logo,
      description: form.value.description,
      email: form.value.email,
      linkPageUrl: form.value.linkPageUrl,
      rssUrl: form.value.rssUrl,
    })
    uni.hideLoading()
    const code = res.code
    const msg = res.data?.msg || res.data?.message || res.message || '提交成功'
    uni.showToast({ icon: 'none', title: msg })
    if (code === 200 || code === undefined) {
      setTimeout(() => {
        uni.navigateTo({
          url: '/pages-blog/friend-links/friend-links',
        })
      }, 1000)
    }
  }
  catch (err) {
    console.error(err)
    uni.hideLoading()
    uni.showToast({ icon: 'none', title: '提交失败，请重试！' })
  }
}

function handleCopyLink() {
  uni.setClipboardData({
    data: calcBlogContent.value,
    showToast: false,
    success: () => {
      uni.showToast({ icon: 'none', title: '复制成功！' })
    },
    fail: () => {
      uni.showToast({ icon: 'none', title: '复制失败！' })
    },
  })
}

onLoad(() => {
  uni.setNavigationBarTitle({ title: '友链申请' })
})
</script>

<template>
  <view class="app-page box-border min-h-screen w-screen bg-[#fafafd] p-8">
    <!-- 博客详情卡片 -->
    <view class="blog-coupon mb-6 flex items-center rounded-xl p-6" style="background: linear-gradient(135deg, #2196f3, #64b5f6);" @click="blogDetailPoupShow = true">
      <image class="coupon-img h-[80rpx] w-[80rpx] shrink-0 rounded-xl" :src="checkAvatarUrl(blogDetail.blogLogo)" mode="aspectFill" />
      <view class="coupon-info ml-5 flex-1">
        <view class="coupon-title text-[30rpx] text-white font-bold">
          {{ blogDetail.blogName }}
        </view>
        <view class="coupon-desc mt-1 text-[24rpx] text-white/80">
          {{ blogDetail.blogDesc }}
        </view>
      </view>
      <view class="coupon-btn border-2 border-white/60 rounded-3xl px-5 py-1 text-[24rpx] text-white">
        友链详情
      </view>
    </view>

    <!-- 友链信息提交表单 -->
    <view class="form-wrap rounded-xl bg-white p-6 shadow-sm">
      <view class="form-title mb-6 text-[26rpx] font-bold">
        友链信息提交
      </view>

      <view class="form-item flex items-center border-b-2 border-[#f5f5f5] py-5">
        <text class="label w-[160rpx] shrink-0 text-[26rpx] text-[#333]">名称</text>
        <input v-model="form.name" class="input flex-1 text-[26rpx]" placeholder="请输入网站名称">
      </view>
      <view class="form-item flex items-center border-b-2 border-[#f5f5f5] py-5">
        <text class="label w-[160rpx] shrink-0 text-[26rpx] text-[#333]">网址</text>
        <input v-model="form.url" class="input flex-1 text-[26rpx]" placeholder="请输入网站地址">
      </view>
      <view class="form-item flex items-center border-b-2 border-[#f5f5f5] py-5">
        <text class="label w-[160rpx] shrink-0 text-[26rpx] text-[#333]">Logo</text>
        <input v-model="form.logo" class="input flex-1 text-[26rpx]" placeholder="请输入网站Logo">
      </view>
      <view class="form-item flex items-center border-b-2 border-[#f5f5f5] py-5">
        <text class="label w-[160rpx] shrink-0 text-[26rpx] text-[#333]">邮箱</text>
        <input v-model="form.email" class="input flex-1 text-[26rpx]" placeholder="请输入邮箱">
      </view>
      <view class="form-item flex items-center border-b-2 border-[#f5f5f5] py-5">
        <text class="label w-[160rpx] shrink-0 text-[26rpx] text-[#333]">友链页面</text>
        <input v-model="form.linkPageUrl" class="input flex-1 text-[26rpx]" placeholder="请输入友链页面地址">
      </view>
      <view class="form-tip py-1 pl-[160rpx] text-[22rpx] text-[#999]">
        （贵站友情链接页面地址，即包含本站链接的页面）
      </view>
      <view class="form-item flex items-center border-b-2 border-[#f5f5f5] py-5">
        <text class="label w-[160rpx] shrink-0 text-[26rpx] text-[#333]">RSS地址</text>
        <input v-model="form.rssUrl" class="input flex-1 text-[26rpx]" placeholder="请输入RSS地址">
      </view>
      <view class="form-tip py-1 pl-[160rpx] text-[22rpx] text-[#999]">
        （用于抓取文章）
      </view>
      <view class="form-item flex items-center border-b-2 border-[#f5f5f5] py-5">
        <text class="label w-[160rpx] shrink-0 text-[26rpx] text-[#333]">网站描述</text>
        <textarea v-model="form.description" class="textarea h-[100rpx] flex-1 text-[26rpx]" :maxlength="30" placeholder="请输入网站描述,不超过30字符" />
      </view>

      <view class="submit-btn mt-6">
        <wd-button type="primary" block size="medium" @click="handleHandle">
          提交数据
        </wd-button>
        <view class="submit-tip py-8 text-center text-[24rpx] text-[#999]">
          友链申请
        </view>
      </view>
    </view>

    <!-- 博客详情弹窗 -->
    <wd-popup v-model="blogDetailPoupShow" position="center" custom-style="width:640rpx;border-radius:12rpx;">
      <view class="poup p-9">
        <view class="info flex">
          <image class="poup-logo h-[140rpx] w-[140rpx] rounded-3xl" :src="checkAvatarUrl(blogDetail.blogLogo)" mode="aspectFill" />
          <view class="info-detail ml-6 flex flex-1 flex-col justify-center">
            <view class="poup-name text-[34rpx] font-bold">
              {{ blogDetail.blogName }}
            </view>
            <view class="poup-tag mt-2.5 text-[24rpx] text-[#999]">
              {{ blogDetail.blogDesc }}
            </view>
          </view>
        </view>
        <view class="poup-desc mt-6 whitespace-pre-wrap text-[28rpx] text-[#555] leading-[1.8]">
          <text>{{ calcBlogContent }}</text>
        </view>
        <image v-if="blogDetail.blogUrl" class="poup-img mt-6 h-[320rpx] w-[568rpx] rounded-xl" :src="calcSiteThumbnail(blogDetail.blogUrl)" mode="aspectFill" />
        <view class="poup-link my-6 flex justify-center gap-6">
          <wd-button size="small" plain type="primary" @click="handleCopyLink">
            复制友链交换信息
          </wd-button>
          <wd-button size="small" plain @click="blogDetailPoupShow = false">
            关闭
          </wd-button>
        </view>
      </view>
    </wd-popup>
  </view>
</template>

<style scoped>
.app-page {
  /* 布局全部由 UnoCSS 原子类实现 */
}
</style>
