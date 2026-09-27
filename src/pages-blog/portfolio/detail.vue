<script lang="ts" setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { onLoad, onPullDownRefresh, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { getProjectDetail } from '@/api/halo-plugin'
import { useAppConfigStore } from '@/store/appConfig'
import { useDataLoading } from '@/hooks/useDataLoading'
import { DataLoadingStatusEnum } from '@/hooks/useDataLoadingStatus'
import { markdownConfig } from '@/config/markdown'
import { checkImageUrl } from '@/utils/url'
import { PORTFOLIO_PLATFORM_LABELS, PORTFOLIO_TYPE_LABELS, portfolioLabelOf } from '@/config/portfolio'
import type { IProject } from '@/api/types/halo-plugin'

definePage({
  style: {
    navigationBarTitleText: '项目详情',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
  },
})

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

/** 平台中文标签 */
function platformLabel(value?: string) {
  return portfolioLabelOf(PORTFOLIO_PLATFORM_LABELS, value)
}

/** 类型中文标签 */
function typeLabel(value?: string) {
  return portfolioLabelOf(PORTFOLIO_TYPE_LABELS, value)
}

/* ---------------- 交互 ---------------- */
/** 复制文本 */
function handleCopy(text: string, title: string) {
  uni.setClipboardData({
    data: text,
    success: () => {
      uni.showToast({ icon: 'none', title })
    },
  })
}

/** 复制链接 */
function handleCopyLink(url: string | undefined, label: string) {
  if (!url) { return }
  handleCopy(url, `${label}链接复制成功`)
}

const linkButtons = computed(() => [
  { label: '仓库地址', url: project.value?.repoUrl },
  { label: '在线演示', url: project.value?.demoUrl },
  { label: '项目文档', url: project.value?.docsUrl },
].filter(item => item.url))

/** 复制资源信息 */
function handleCopyInfo() {
  const p = project.value
  if (!p) { return }
  const parts = [
    `名称：${p.title}`,
    p.summary ? `简介：${p.summary}` : '',
    p.techStacks?.length ? `技术栈：${p.techStacks.join('/')}` : '',
    p.repoUrl ? `仓库：${p.repoUrl}` : '',
    p.demoUrl ? `演示：${p.demoUrl}` : '',
  ].filter(Boolean)
  handleCopy(parts.join('\n'), '项目信息复制成功')
}
</script>

<template>
  <view class="min-h-screen w-screen flex flex-col bg-page">
    <uh-navbar :default-title="pageTitle" title-color="text-gray-900" />

    <uh-data-loading
      v-if="status !== DataLoadingStatusEnum.Success" :loading-status="status"
      empty-text="啊偶，项目不存在哦~" min-height="65vh" @refresh="run"
    />

    <view v-else-if="project" class="box-border flex flex-col gap-3 p-3">
      <!-- 封面 -->
      <view class="uh-global-card-glass overflow-hidden rounded-xl">
        <image
          v-if="project.cover" :src="checkImageUrl(project.cover)" mode="aspectFill"
          class="h-48 w-full"
        />
        <view v-else class="h-48 w-full flex items-center justify-center bg-gray-100 text-xs text-gray-400">
          暂无封面
        </view>
      </view>

      <!-- 基本信息 -->
      <view class="uh-global-card-glass box-border flex flex-col gap-2 rounded-xl p-4">
        <view class="flex items-center gap-2">
          <text class="flex-1 text-base text-gray-900 font-semibold">{{ project.title }}</text>
          <view
            v-if="project.featured"
            class="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-10px text-primary"
          >
            推荐
          </view>
        </view>
        <text v-if="project.summary" class="text-xs text-gray-500">{{ project.summary }}</text>
        <view v-if="project.techStacks?.length" class="mt-1 flex flex-wrap gap-1.5">
          <text
            v-for="tech in project.techStacks" :key="tech"
            class="rounded-md bg-gray-100 px-1.5 py-0.5 text-10px text-gray-500"
          >
            {{ tech }}
          </text>
        </view>
        <view class="mt-1 flex flex-wrap items-center gap-2 text-10px text-gray-400">
          <text v-if="typeLabel(project.type)">{{ typeLabel(project.type) }}</text>
          <text v-if="platformLabel(project.platform)">{{ platformLabel(project.platform) }}</text>
          <text v-if="project.createTime">{{ project.createTime }}</text>
        </view>
      </view>

      <!-- 外链按钮 -->
      <view v-if="linkButtons.length" class="uh-global-card-glass box-border rounded-xl p-4">
        <view class="flex flex-wrap gap-2">
          <view
            v-for="btn in linkButtons" :key="btn.label"
            class="inline-flex items-center border border-gray-200 rounded-full px-4 py-1.5 text-xs text-gray-600"
            @click="handleCopyLink(btn.url, btn.label)"
          >
            <wd-icon name="link" class="mr-1" size="14px" />
            {{ btn.label }}
          </view>
        </view>
      </view>

      <!-- 正文 -->
      <view v-if="project.content" class="uh-global-card-glass box-border rounded-xl p-4">
        <mp-html
          :content="project.content" lazy-load :domain="markdownConfig.domain"
          :loading-img="markdownConfig.loadingGif" scroll-table selectable
          :tag-style="markdownConfig.tagStyle" :container-style="markdownConfig.containStyle"
        />
      </view>

      <!-- 复制信息 -->
      <view
        class="uh-global-card-glass box-border rounded-xl py-3 text-center text-xs text-gray-500"
        @click="handleCopyInfo()"
      >
        复制项目信息
      </view>
    </view>
  </view>
</template>
