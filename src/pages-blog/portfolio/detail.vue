<script lang="ts" setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { onLoad, onPageScroll, onPullDownRefresh, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { getProjectDetail } from '@/api/halo-plugin-third/portfolio'
import { useAppConfigStore } from '@/store/appConfig'
import { usePageScroll } from '@/hooks/usePageScroll'
import { useDataLoading } from '@/hooks/useDataLoading'
import { DataLoadingStatusEnum } from '@/hooks/useDataLoadingStatus'
import { usePageTitle } from '@/hooks/usePageTitle'
import { markdownConfig } from '@/config/markdown'
import { formatTime } from '@/utils/formatTime'
import { checkImageUrl } from '@/utils/url'
import { PORTFOLIO_PLATFORM_LABELS, PORTFOLIO_TYPE_LABELS, portfolioLabelOf } from '@/config/portfolio'
import type { IProject } from '@/api/types/halo-plugin-third/portfolio'

definePage({
  style: {
    navigationBarTitleText: '项目详情',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
  },
})

const { scrollY, updatePageScrollValue } = usePageScroll()
const appConfigStore = useAppConfigStore()
const { auditModeEnabled: calcAuditModeEnabled } = storeToRefs(appConfigStore)
const siteName = computed(() => appConfigStore.configs.featureConfig?.profile?.appInfo?.name || 'uni-halo')

const slug = ref('')
const project = ref<IProject>()

const pageTitle = usePageTitle('portfolioDetail', '项目详情')

onShareAppMessage(() => ({
  title: `${project.value?.title || pageTitle.value} - ${siteName.value}`,
  path: `/pages-blog/portfolio/detail?slug=${slug.value}`,
}))

onShareTimeline(() => ({
  title: `${project.value?.title || pageTitle.value} - ${siteName.value}`,
  query: '',
}))

/* ---------------- 数据加载 ---------------- */
const { status, run } = useDataLoading(
  () => getProjectDetail(slug.value),
  {
    onSuccess: (res) => {
      project.value = res.data
    },
  },
)

onLoad((options) => {
  slug.value = options?.slug || ''
  run()
})

onPullDownRefresh(() => {
  run().finally(() => uni.stopPullDownRefresh())
})

onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})

/** 平台中文标签 */
function platformLabel(value?: string) {
  return portfolioLabelOf(PORTFOLIO_PLATFORM_LABELS, value)
}

/** 类型中文标签 */
function typeLabel(value?: string) {
  return portfolioLabelOf(PORTFOLIO_TYPE_LABELS, value)
}

/** 格式化创建日期 */
const createTimeText = computed(() => {
  return project.value?.createTime ? formatTime({ d: project.value.createTime, f: 'yyyy/MM/dd' }) : ''
})

/* ---------------- 外链 ---------------- */
const linkButtons = computed(() => [
  { label: '仓库地址', url: project.value?.repoUrl },
  { label: '在线演示', url: project.value?.demoUrl },
  { label: '项目文档', url: project.value?.docsUrl },
].filter(item => item.url))

/** 打开外链：APP 内置 web-view，H5 新窗口，小程序复制链接 */
function handleOpenLink(url: string | undefined, label: string) {
  if (!url) { return }
  // #ifdef APP-PLUS
  uni.navigateTo({
    url: `/pages-blog/website/website?data=${JSON.stringify({
      title: label,
      url: encodeURIComponent(url),
    })}`,
  })
  // #endif
  // #ifdef H5
  window.open(url, '_blank')
  // #endif
  // #ifdef MP-WEIXIN
  uni.setClipboardData({
    data: url,
    success: () => {
      uni.showToast({ icon: 'none', title: `${label}链接复制成功` })
    },
  })
  // #endif
}
</script>

<template>
  <view class="min-h-screen w-screen flex flex-col bg-page">
    <uh-navbar
      :scroll-y="scrollY" :default-title="pageTitle" :need-placeholder="false"
      :scroll-title="project?.title"
    />

    <uh-data-loading
      v-if="status !== DataLoadingStatusEnum.Success" :loading-status="status"
      empty-text="啊偶，项目不存在哦~" min-height="90vh" @refresh="run"
    />

    <view v-else-if="project" class="box-border pt-72 pb-24">
      <!-- 顶部背景封面区域 -->
      <view class="fixed left-0 top-0 h-72 w-full">
        <wd-img v-if="project.cover" :src="checkImageUrl(project.cover)" class="h-full w-full" mode="aspectFill">
          <template #loading>
            <wd-loading size="64rpx" custom-class="text-primary" />
          </template>
        </wd-img>
        <view v-else class="h-full w-full flex items-center justify-center bg-gray-100 text-xs text-gray-400">
          暂无封面
        </view>
        <view class="absolute bottom-0 left-0 h-[140rpx] w-full from-white/0 to-page bg-gradient-to-b" />
      </view>

      <view
        class="-mt-8 uh-global-card-glass uh-content-lift box-border overflow-hidden border rounded-lt-3xl rounded-rt-3xl border-b-none"
        :style="{ boxShadow: '0 -16rpx 12rpx rgba(0, 0, 0, 0.035)' }"
      >
        <!-- 顶部信息 -->
        <view class="box-border flex flex-col gap-3 p-3 pb-2">
          <view class="flex items-center gap-2">
            <view class="font-semibold">
              {{ project.title }}
            </view>
            <view
              v-if="project.featured"
              class="inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-10px text-gray-900"
            >
              推荐
            </view>
          </view>
          <text v-if="project.summary" class="text-xs text-gray-500">{{ project.summary }}</text>
          <view v-if="project.techStacks?.length" class="box-border flex flex-wrap items-center gap-2 text-xs">
            <text
              v-for="tech in project.techStacks" :key="tech"
              class="uh-global-card-glass uh-shadow-xs box-border border rounded-full px-2 py-1"
            >
              {{ tech }}
            </text>
          </view>
          <view class="uh-global-card-glass uh-shadow-xs box-border flex flex-col gap-3 rounded-xl p-3">
            <view class="flex flex-1 items-center gap-x-2 text-gray-500">
              <text class="text-xs">日期</text>
              <text class="text-xs text-gray-900">{{ createTimeText || '-' }}</text>
            </view>
            <view class="flex items-center">
              <view class="flex flex-1 items-center gap-x-2 text-gray-500">
                <text class="text-xs">类型</text>
                <text class="text-xs text-gray-900">{{ typeLabel(project.type) || '-' }}</text>
              </view>
              <view class="flex flex-1 items-center gap-x-2 text-gray-500">
                <text class="text-xs">平台</text>
                <text class="text-xs text-gray-900">{{ platformLabel(project.platform) || '-' }}</text>
              </view>
              <view class="flex flex-1 items-center gap-x-2 text-gray-500">
                <text class="text-xs">技术栈</text>
                <text class="text-xs text-gray-900">{{ project.techStacks?.length || 0 }} 项</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 内容区域 -->
        <view v-if="project.content" class="box-border flex flex-col gap-y-4 p-3 pt-2">
          <view class="uh-global-card-glass uh-shadow-xs box-border rounded-xl p-3 text-3xs text-gray-900 leading-6 !bg-white/10">
            <mp-html
              :content="project.content" lazy-load :domain="markdownConfig.domain"
              :loading-img="markdownConfig.loadingGif" scroll-table selectable
              :tag-style="markdownConfig.tagStyle" :container-style="markdownConfig.containStyle"
              :markdown="true" :show-line-number="true"
              :show-language-name="true" copy-by-long-press
            />
          </view>
        </view>
      </view>

      <!-- 悬浮操作：仓库/演示/文档外链 -->
      <view
        v-if="linkButtons.length"
        class="uh-translate-x-center fixed bottom-0 left-1/2 z-10 flex items-center justify-center pb-safe"
      >
        <view class="uh-global-card-glass box-border flex items-center justify-center gap-2 border rounded-full p-1">
          <view
            v-for="btn in linkButtons" :key="btn.label"
            class="uh-global-card-glass box-border h-9 flex flex-1 items-center justify-center gap-x-1 border rounded-full !px-6 shadow-none"
            @click="handleOpenLink(btn.url, btn.label)"
          >
            <wd-icon name="link" size="32rpx" />
            <text class="shrink-0 text-xs text-gray-900 font-semibold">{{ btn.label }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>
