<script lang="ts" setup>
import { computed, getCurrentInstance, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { getDoubanDetail } from '@/api/halo-plugin'
import { useAppConfigStore } from '@/store/appConfig'
import { useDataLoading } from '@/hooks/useDataLoading'
import { DataLoadingStatusEnum } from '@/hooks/useDataLoadingStatus'
import { usePageTitle } from '@/hooks/usePageTitle'
import { markdownConfig } from '@/config/markdown'
import { checkImageUrl } from '@/utils/url'
import type { IDoubanMovie } from '@/api/types/halo-plugin'

definePage({
  style: {
    navigationBarTitleText: '豆瓣详情',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
  },
})

const appConfigStore = useAppConfigStore()
const siteName = computed(() => appConfigStore.configs.featureConfig?.profile?.appInfo?.name || 'uni-halo')

const name = ref('')
const douban = ref<IDoubanMovie>()

const pageTitle = usePageTitle('doubanDetail', '豆瓣详情')

onShareAppMessage(() => ({
  title: `${douban.value?.name || pageTitle.value} - ${siteName.value}`,
  path: `/pages-blog/douban/detail?name=${name.value}`,
}))

onShareTimeline(() => ({
  title: `${douban.value?.name || pageTitle.value} - ${siteName.value}`,
  query: '',
}))

/* ---------------- 类型中文映射 ---------------- */
const TYPE_LABELS: Record<string, string> = {
  movie: '电影',
  book: '图书',
  music: '音乐',
  game: '游戏',
  drama: '舞台剧',
}

const STATUS_LABELS: Record<string, string> = {
  mark: '想做',
  doing: '在做',
  done: '做完',
}

const typeLabel = computed(() => {
  const type = douban.value?.type
  return type ? TYPE_LABELS[type] || type : ''
})

const statusLabel = computed(() => {
  const status = douban.value?.favesStatus
  return status ? STATUS_LABELS[status] || status : ''
})

/* ---------------- 数据加载 ---------------- */
const doubanData = ref<IDoubanMovie>()

const { status, run } = useDataLoading(
  async () => {
    const res = await getDoubanDetail(doubanData.value?.link || '')
    return res.data
  },
  {
    onSuccess: (data) => {
      douban.value = data
    },
  },
)

/** 详情数据来源：列表传入（事件通道）优先，无数据时按 link 兜底请求 */
onLoad((options) => {
  name.value = options?.name || ''
  const eventChannel = (getCurrentInstance()?.proxy as unknown as { $getOpenerEventChannel?: () => { on?: (event: string, cb: (data: IDoubanMovie) => void) => void } } | undefined)?.$getOpenerEventChannel?.()
  eventChannel?.on?.('doubanData', (data) => {
    if (data && data.link) {
      doubanData.value = data
      douban.value = data
      status.value = 'success'
    }
  })
  // 直连进入（分享链接等）无列表数据，豆瓣无按 id 详情端点，提示返回列表
  setTimeout(() => {
    if (!douban.value) {
      status.value = 'error'
    }
  }, 800)
})

onPullDownRefresh(() => {
  run().finally(() => uni.stopPullDownRefresh())
})

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

/** 复制豆瓣地址 */
function handleCopyDoubanLink() {
  if (!douban.value?.link) { return }
  handleCopy(douban.value.link, '豆瓣地址复制成功')
}

/** 复制资源信息 */
function handleCopyInfo() {
  const d = douban.value
  if (!d) { return }
  const parts = [
    `名称：${d.name || ''}`,
    d.cardSubtitle ? `其他：${d.cardSubtitle}` : '',
    d.genres?.length ? `标签：${d.genres.join('/')}` : '',
    d.pubdate ? `时间：${d.pubdate}` : '',
    d.score ? `评分：${d.score}分` : '',
    d.link ? `链接：${d.link}` : '',
  ].filter(Boolean)
  handleCopy(parts.join('\n'), '资源信息复制成功')
}
</script>

<template>
  <view class="min-h-screen w-screen flex flex-col bg-page">
    <uh-navbar :default-title="pageTitle" title-color="text-gray-900" />

    <uh-data-loading
      v-if="status !== DataLoadingStatusEnum.Success" :loading-status="status"
      empty-text="啊偶，记录不存在哦~" min-height="65vh" @refresh="run"
    />

    <view v-else-if="douban" class="box-border flex flex-col gap-3 p-3">
      <!-- 海报与基本信息 -->
      <view class="uh-global-card-glass box-border rounded-xl p-4">
        <view class="flex gap-4">
          <image
            v-if="douban.poster" :src="checkImageUrl(douban.poster)" mode="aspectFill"
            class="h-60 w-44 flex-shrink-0 rounded-lg"
          />
          <view v-else class="h-60 w-44 flex flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">
            无封面
          </view>
          <view class="min-w-0 min-w-0 flex flex-1 flex-col gap-1.5">
            <text class="text-base text-gray-900 font-semibold">{{ douban.name }}</text>
            <view v-if="douban.score" class="flex items-center gap-1">
              <wd-icon name="star-fill" size="14px" class="text-orange-400" />
              <text class="text-sm text-orange-400">{{ douban.score }}</text>
            </view>
            <text v-if="douban.pubdate" class="text-xs text-gray-500">{{ douban.pubdate }}</text>
            <text v-if="douban.year" class="text-xs text-gray-500">{{ douban.year }}</text>
            <view class="mt-1 flex flex-wrap gap-1.5">
              <text v-if="typeLabel" class="rounded-md bg-orange-100 px-1.5 py-0.5 text-10px text-orange-500">
                {{ typeLabel }}
              </text>
              <text
                v-for="genre in douban.genres || []" :key="genre"
                class="rounded-md bg-gray-100 px-1.5 py-0.5 text-10px text-gray-500"
              >
                {{ genre }}
              </text>
            </view>
            <view v-if="statusLabel" class="mt-auto w-fit inline-flex rounded-full bg-primary/15 px-2.5 py-0.5 text-10px text-primary">
              {{ statusLabel }}
            </view>
          </view>
        </view>
        <text v-if="douban.cardSubtitle" class="mt-3 block text-xs text-gray-500">{{ douban.cardSubtitle }}</text>
      </view>

      <!-- 我的标记 -->
      <view
        v-if="douban.favesRemark || douban.favesScore"
        class="uh-global-card-glass box-border flex flex-col gap-2 rounded-xl p-4"
      >
        <uh-section-title>我的标记</uh-section-title>
        <view v-if="douban.favesScore" class="flex items-center gap-1">
          <wd-icon name="star-fill" size="14px" class="text-orange-400" />
          <text class="text-sm text-orange-400">{{ douban.favesScore }}</text>
        </view>
        <text v-if="douban.favesRemark" class="text-xs text-gray-600">{{ douban.favesRemark }}</text>
      </view>

      <!-- 操作按钮 -->
      <view class="uh-global-card-glass box-border rounded-xl p-4">
        <view class="flex flex-wrap gap-2">
          <view
            class="inline-flex items-center border border-gray-200 rounded-full px-4 py-1.5 text-xs text-gray-600"
            @click="handleCopyDoubanLink()"
          >
            <wd-icon name="link" class="mr-1" size="14px" />
            豆瓣地址
          </view>
          <view
            class="inline-flex items-center border border-gray-200 rounded-full px-4 py-1.5 text-xs text-gray-600"
            @click="handleCopyInfo()"
          >
            <wd-icon name="copy" class="mr-1" size="14px" />
            资源信息
          </view>
        </view>
      </view>

      <!-- 正文（getDoubanDetail 实时抓取可能带简介 HTML） -->
      <view v-if="(douban as any).content" class="uh-global-card-glass box-border rounded-xl p-4">
        <mp-html
          :content="(douban as any).content" lazy-load :domain="markdownConfig.domain"
          :loading-img="markdownConfig.loadingGif" scroll-table selectable
          :tag-style="markdownConfig.tagStyle" :container-style="markdownConfig.containStyle"
        />
      </view>
    </view>
  </view>
</template>
