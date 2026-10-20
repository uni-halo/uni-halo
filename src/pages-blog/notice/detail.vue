<script lang="ts" setup>
import { computed, ref } from 'vue'
import { onLoad, onPageScroll, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { getNoticeDetail } from '@/api/uni-halo'
import { formatTime } from '@/utils/formatTime'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { usePageScroll } from '@/hooks/usePageScroll'
import { usePageTitle } from '@/hooks/usePageTitle'
import { checkImageUrl } from '@/utils/url'
import { useAppConfigStore } from '@/store/appConfig'
import { sleep } from '@/utils/common'
import { markdownConfig } from '@/config/markdown'
import type { INoticeDetail } from '@/api/types/uni-halo'

definePage({
  style: {
    navigationBarTitleText: '公告详情',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
  },
})

const { scrollY, updatePageScrollValue } = usePageScroll()
/** 页面标题（插件端可配置，留空回退内置默认） */
const pageTitle = usePageTitle('noticeDetail', '公告详情')
const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()
const name = ref('')
const detail = ref<INoticeDetail | null>(null)

const spec = computed(() => detail.value?.spec)
const content = computed(() => spec.value?.content || '')
const title = computed(() => spec.value?.title || '')
const typeColor = computed(() => spec.value?.typeColor || '')
const typeDisplayName = computed(() => spec.value?.typeDisplayName || '')
/** 封面图:相对路径(如 /upload/...)经 checkImageUrl 补全为完整地址后再渲染 */
const cover = computed(() => {
  const raw = spec.value?.cover || ''
  return raw ? checkImageUrl(raw) : ''
})

const publishTime = computed(() => formatTime({ d: spec.value?.publishTime, f: 'yyyy年MM月dd日 星期w' }))

/* ---------------- 链接跳转（按 linkType 与平台兼容处理） ---------------- */
/** 链接类型：为空时按 link 非空回退 external（兼容历史数据） */
const linkType = computed<'none' | 'external' | 'miniapp' | 'internal' | 'wechat-mp'>(() => {
  return spec.value?.linkType || (spec.value?.link ? 'external' : 'none')
})
/** 是否为小程序链接（入口仅微信小程序端展示） */
const isMiniappLink = computed(() => linkType.value === 'miniapp')
/** 是否展示跳转入口 */
const hasLink = computed(() => {
  if (linkType.value === 'none') { return false }
  if (isMiniappLink.value) {
    // #ifdef MP-WEIXIN
    return !!spec.value?.linkAppId
    // #endif
    // 非微信小程序端不展示小程序链接入口（App/H5 不支持跳转小程序）
    return false
  }
  return !!spec.value?.link
})
/** 按钮文案 */
const linkButtonText = computed(() => {
  switch (linkType.value) {
    case 'internal': return '查看相关页面'
    case 'miniapp': return '打开小程序'
    case 'wechat-mp': return '复制文章链接'
    default: return '复制链接地址'
  }
})

/** 外部链接/公众号文章打开方式：App 端非个人资质走内部 webview，其余复制链接提示 */
function handleOpenExternal(url: string) {
  // #ifdef APP-PLUS
  const appConfigStore = useAppConfigStore()
  const qualification = appConfigStore.configs.featureConfig?.profile?.appInfo?.qualification
  if (qualification === 'enterprise') {
    const data = encodeURIComponent(JSON.stringify({ title: title.value, url }))
    uni.navigateTo({ url: `/pages-blog/website/website?data=${data}` })
    return
  }
  // #endif
  // #ifdef H5
  if (url) {
    window.open(url, '_blank')
    return
  }
  // #endif
  copyLink(url)
}

/** 复制链接并提示 */
function copyLink(url?: string) {
  if (!url) { return }
  uni.setClipboardData({
    data: url,
    success: () => {
      uni.showToast({ title: '链接已复制，请在浏览器打开', icon: 'none' })
    },
    fail: () => {
      uni.showToast({ title: '复制失败', icon: 'none' })
    },
  })
}

/** 跳转入口点击（按链接类型分发） */
function handleLinkClick() {
  const { link, linkAppId, linkPath } = spec.value || {}
  if (linkType.value === 'internal') {
    if (!link) { return }
    uni.navigateTo({ url: link })
    return
  }
  if (linkType.value === 'miniapp') {
    if (!linkAppId) { return }
    uni.navigateToMiniProgram({
      appId: linkAppId,
      path: linkPath || '',
      fail: () => {
        uni.showToast({ title: '打开小程序失败', icon: 'none' })
      },
    })
    return
  }
  handleOpenExternal(link || '')
}

onShareAppMessage(() => ({
  title: title.value || pageTitle.value,
  path: `/pages-blog/notice/detail?name=${name.value}`,
  imageUrl: cover.value,
}))

onShareTimeline(() => ({
  title: title.value || pageTitle.value,
  query: name.value ? `name=${name.value}` : '',
  imageUrl: cover.value,
}))

/* ---------------- 跳转/复制 ---------------- */

/** 加载公告详情(状态机;404/无数据 → 空态,其余错误 → error 态,可重试) */
async function loadDetail() {
  updateLoadingStatus(DataLoadingStatusEnum.Loading)
  if (!name.value) {
    updateLoadingStatus(DataLoadingStatusEnum.Empty)
    return
  }
  try {
    const res = await getNoticeDetail(name.value)
    detail.value = res.data || null
    await sleep(600)
    updateLoadingStatus(
      detail.value?.spec ? DataLoadingStatusEnum.Success : DataLoadingStatusEnum.Empty,
    )
  }
  catch (err) {
    console.error('公告详情加载失败', err)
    const code = (err as { code?: number }).code
    updateLoadingStatus(code === 404 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Error)
  }
  finally {
    uni.stopPullDownRefresh()
  }
}

onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})

onPullDownRefresh(() => {
  loadDetail()
})

onLoad((options) => {
  name.value = options?.name || ''
  loadDetail()
})
</script>

<template>
  <view class="box-border min-h-screen w-screen bg-page pb-safe">
    <!-- 自定义导航 -->
    <uh-navbar :scroll-y="scrollY" :default-title="pageTitle" :scroll-title="title" title-color="text-gray-900" />

    <!-- 加载/错误/空态(状态机) -->
    <uh-data-loading
      v-if="loadingStatus !== 'success'" :loading-status="loadingStatus" min-height="75vh"
      error-text="公告加载失败" empty-text="公告不存在或已下线" empty-sub-text="" @refresh="loadDetail"
    />

    <!-- 正文 -->
    <view v-else class="box-border p-4">
      <!-- 有图，wd-img 如果加载空的地址 会一直处于loading状态，所以空值我们不加载 -->
      <wd-img v-if="cover" class="mb-5 h-[320rpx] w-full" :radius="12" :src="cover" mode="aspectFill">
        <template #loading>
          <wd-loading size="64rpx" custom-class="text-primary" />
        </template>
      </wd-img>
      <!-- 无图 -->
      <view
        v-else
        class="mb-5 h-[320rpx] w-full flex items-center justify-center from-[#ebfabf] to-[#f5fae8] bg-gradient-to-b text-gray-400"
      >
        <wd-icon class-prefix="uhemoji-icon" name="-injury" size="72rpx" />
      </view>
      <view class="text-md text-gray-900 font-bold leading-snug">
        {{ title }}
      </view>

      <view class="mt-3 flex items-center gap-2">
        <view
          v-if="typeDisplayName" class="rounded px-2 py-0.5 text-[20rpx]" :style="{
            color: typeColor || '#f83856',
            backgroundColor: typeColor ? `${typeColor}1a` : '#fdeef1',
          }"
        >
          {{ typeDisplayName }}
        </view>
        <text class="text-[22rpx] text-gray-500">
          {{ publishTime }}
        </text>
      </view>

      <view class="mt-2 box-border w-full pb-4 pt-4 text-3xs text-gray-900">
        <mp-html
          :content="content" lazy-load :domain="markdownConfig.domain"
          :loading-img="markdownConfig.loadingGif" scroll-table selectable
          :tag-style="markdownConfig.tagStyle" :container-style="markdownConfig.containStyle"
          :markdown="true" :show-line-number="true"
          :show-language-name="true" copy-by-long-press
        />
      </view>
    </view>
    <uh-float-toolbar
      v-if="loadingStatus === 'success' && hasLink"
      custom-content-class="!p-0.5"
      :need-placeholder="true"
    >
      <uh-button
        class="min-w-[80vw]"
        custom-class="uh-global-card-glass border w-full !rounded-full !py-2.5 font-medium !text-3xs !bg-primary"
        @click="handleLinkClick"
      >
        {{ linkButtonText }}
      </uh-button>
    </uh-float-toolbar>
  </view>
</template>
