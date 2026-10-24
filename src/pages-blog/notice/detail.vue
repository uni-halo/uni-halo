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
import { resolveNoticeLink } from '@/utils/noticeLink'
import type { NoticeLinkAction, NoticePlatform } from '@/utils/noticeLink'
import { copyToClipboard } from '@/utils/clipboard'
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
const appConfigStore = useAppConfigStore()

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

/* ---------------- 链接跳转（按 链接类型 × 运行端 × 小程序资质类型 解析） ---------------- */
/** 当前运行端（条件编译注入；决定外链/公众号文章打开策略，见 utils/noticeLink.ts） */
const platform = ((): NoticePlatform => {
  // #ifdef MP-WEIXIN
  return 'mp-weixin'
  // #endif
  // #ifdef H5
  return 'h5'
  // #endif
  return 'app'
})()

/** 小程序资质类型（插件端 appInfo.qualification；App 端企业资质外链走内部 webview） */
const qualification = computed(() => appConfigStore.configs.featureConfig?.profile?.appInfo?.qualification)

/** 跳转入口解析（visible/text/behavior 由同一纯函数产出，文案=本次点击的真实动作） */
const linkAction = computed(() =>
  resolveNoticeLink({ entry: spec.value || {}, platform, qualification: qualification.value }))

/** 执行解析出的跳转行为 */
function handleLinkAction() {
  const action: NoticeLinkAction = linkAction.value
  const link = spec.value?.link || ''
  switch (action.behavior) {
    case 'internal': {
      uni.navigateTo({ url: link })
      break
    }
    case 'miniapp': {
      uni.navigateToMiniProgram({
        appId: spec.value?.linkAppId || '',
        path: spec.value?.linkPath || '',
        fail: () => {
          uni.showToast({ title: '打开小程序失败', icon: 'none' })
        },
      })
      break
    }
    case 'webview': {
      const data = encodeURIComponent(JSON.stringify({ title: title.value, url: link }))
      uni.navigateTo({ url: `/pages-blog/website/website?data=${data}` })
      break
    }
    case 'h5-open': {
      window.open(link, '_blank')
      break
    }
    case 'copy': {
      copyToClipboard(link, '链接已复制，请在浏览器打开')
      break
    }
  }
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
  <view class="box-border min-h-screen w-screen bg-page">
    <!-- 自定义导航 -->
    <uh-navbar :scroll-y="scrollY" :default-title="pageTitle" :scroll-title="title" title-color="text-gray-900" />

    <!-- 加载/错误/空态(状态机) -->
    <uh-data-loading
      v-if="loadingStatus !== 'success'" :loading-status="loadingStatus" min-height="75vh"
      error-text="公告加载失败" empty-text="公告不存在或已下线" empty-sub-text="" @refresh="loadDetail"
    />

    <!-- 正文 -->
    <view v-else class="box-border p-3 pb-0">
      <!-- 有图，wd-img 如果加载空的地址 会一直处于loading状态，所以空值我们不加载 -->
      <wd-img v-if="cover" class="mb-5 h-40 w-full" :radius="12" :src="cover" mode="aspectFill">
        <template #loading>
          <wd-loading size="64rpx" custom-class="text-primary" />
        </template>
      </wd-img>
      <!-- 无图 -->
      <view
        v-else
        class="mb-5 h-40 w-full flex items-center justify-center from-[#ebfabf] to-[#f5fae8] bg-gradient-to-b text-gray-400"
      >
        <wd-icon class-prefix="uhemoji-icon" name="-injury" size="72rpx" />
      </view>
      <view class="text-md text-gray-900 font-bold leading-snug">
        {{ title }}
      </view>

      <view class="mt-3 flex items-center gap-2">
        <view
          v-if="typeDisplayName" class="rounded px-2 py-0.5 text-xs" :style="{
            color: typeColor || '#f83856',
            backgroundColor: typeColor ? `${typeColor}1a` : '#fdeef1',
          }"
        >
          {{ typeDisplayName }}
        </view>
        <text class="text-xs text-gray-500">
          {{ publishTime }}
        </text>
      </view>

      <view class="mt-2 box-border w-full py-3 text-3xs text-gray-900">
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
      v-if="loadingStatus === 'success' && linkAction.visible"
      custom-content-class="!p-0.5"
      :need-placeholder="true"
    >
      <uh-button
        class="min-w-[80vw]"
        custom-class="uh-global-card-glass border w-full !rounded-full !py-2.5 font-medium !text-3xs !bg-primary"
        @click="handleLinkAction"
      >
        {{ linkAction.text }}
      </uh-button>
    </uh-float-toolbar>
  </view>
</template>
