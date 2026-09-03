<script lang="ts" setup>
/**
 * 瞬间详情页(源自旧项目 pagesA/moment-detail,新建复刻)
 * 展示瞬间内容(mp-html) + 图片/音频/视频附件
 */
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import dayjs from 'dayjs'
import { getMomentByName } from '@/api/halo'
import { useAppConfigStore } from '@/store/appConfig'
import { checkAvatarUrl, checkThumbnailUrl } from '@/utils/url'
import { generateUUID } from '@/utils/uuid'
import { formatTime as formatTimeUtil } from '@/utils/formatTime'
import { randomTagColor } from '@/utils/random'
import { markdownConfig } from '@/config/markdown'
import type { IMoment } from '@/api/types/halo'

definePage({
  style: {
    navigationBarTitleText: '瞬间详情',
    enablePullDownRefresh: true,
  },
})

const appConfigStore = useAppConfigStore()
const haloConfigs = computed(() => appConfigStore.configs)

const bloggerInfo = computed(() => {
  const blogger = haloConfigs.value.authorConfig?.blogger as { nickname?: string, avatar?: string } | undefined
  return {
    nickname: blogger?.nickname || '',
    avatar: checkAvatarUrl(blogger?.avatar),
  }
})

const calcUseTagRandomColor = computed(() => !!haloConfigs.value.pageConfig?.momentConfig?.useTagRandomColor)

/** 站点名称(原 startConfig.title 已随启动页下线,改读 appConfig.appInfo.name) */
const siteName = computed(() => {
  const appInfo = haloConfigs.value.appConfig?.appInfo as { name?: string } | undefined
  return appInfo?.name || bloggerInfo.value.nickname || 'uni-halo'
})

/* ---------------- 状态 ---------------- */
const loading = ref<'loading' | 'success' | 'error'>('loading')
const queryName = ref('')
const moment = ref<(IMoment & {
  images?: { type?: string, url: string }[]
  videos?: { id?: string, url: string }[]
  audios?: { type?: string, url: string }[]
  spec: IMoment['spec'] & { newHtml?: string }
}) | null>(null)
const videoContexts = ref<Record<string, UniApp.VideoContext | undefined>>({})
const currentVideoId = ref<string | null>(null)

/** 移除 tag 链接 */
function removeTagLinksCompletely(htmlString: string): string {
  const regex = /<a\b[^>]+class=(['"])[^'"]*\btag\b[^'"]*\1[^>]*>[\s\S]*?<\/a>/gi
  return htmlString.replace(regex, '')
}

function tagColor(): string {
  if (!calcUseTagRandomColor.value)
    return 'blue'
  return randomTagColor()
}

function formatTime(time?: string): string {
  // 与旧项目一致:yyyy年MM月dd日 星期w
  return time ? formatTimeUtil({ d: time, f: 'yyyy年MM月dd日 星期w' }) : ''
}

/* ---------------- 数据加载 ---------------- */
async function handleGetData() {
  loading.value = 'loading'
  try {
    const res = await getMomentByName(queryName.value)
    uni.setNavigationBarTitle({ title: '瞬间详情' })

    const medium = (res.data.spec.content?.medium || [])
      .map(x => ({ ...x, url: x.url || '' }))
    const owner = res.data.owner
    const tempResult = {
      ...res.data,
      // 无顶层 owner(如个别历史接口)时兜底为博主信息
      owner: owner?.displayName
        ? owner
        : { displayName: bloggerInfo.value.nickname || '', name: bloggerInfo.value.nickname || '', avatar: bloggerInfo.value.avatar },
      spec: {
        ...res.data.spec,
        newHtml: removeTagLinksCompletely(res.data.spec.content?.html || ''),
      },
      images: medium.filter(x => x.type === 'PHOTO').map(x => ({ ...x, url: checkThumbnailUrl(x.url, true) })),
      videos: medium.filter(x => x.type === 'VIDEO').map(x => ({ ...x, id: generateUUID() })),
      audios: medium.filter(x => x.type === 'AUDIO'),
    }
    moment.value = tempResult
    loading.value = 'success'

    nextTick(() => {
      createVideoContexts(tempResult.videos || [])
    })
  }
  catch (err) {
    console.error('获取瞬间详情失败', err)
    loading.value = 'error'
  }
  finally {
    uni.stopPullDownRefresh()
  }
}

/* ---------------- 视频互斥 ---------------- */
function createVideoContexts(videos: { id?: string }[]) {
  stopAllVideos()
  videos.forEach((item) => {
    if (item.id) {
      videoContexts.value[item.id] = uni.createVideoContext(`video_${item.id}`)
    }
  })
}

function stopAllVideos(excludesVideoId: string | null = null) {
  Object.keys(videoContexts.value).forEach((videoId) => {
    if (!excludesVideoId || excludesVideoId !== videoId) {
      videoContexts.value[videoId]?.pause()
    }
  })
}

function onVideoPlay(videoId: string) {
  currentVideoId.value = videoId
  stopAllVideos(videoId)
}

function onVideoPause(videoId: string) {
  if (currentVideoId.value === videoId) {
    currentVideoId.value = null
  }
}

function onVideoEnded() {
  currentVideoId.value = null
}

/* ---------------- 交互 ---------------- */
function handlePreview(index: number, list: { url: string }[]) {
  uni.previewImage({
    current: index,
    urls: list.map(item => item.url),
  })
}

function handleToTopPage(duration = 500) {
  uni.pageScrollTo({
    scrollTop: 0,
    duration,
    fail: (err) => {
      console.error('回顶失败', err)
    },
  })
}

/* ---------------- 生命周期 ---------------- */
onLoad((options) => {
  uni.setNavigationBarTitle({ title: '瞬间加载中...' })
  queryName.value = options?.name || ''
  handleGetData()
})

onPullDownRefresh(() => {
  videoContexts.value = {}
  currentVideoId.value = null
  handleGetData()
})

onShareAppMessage(() => ({
  path: `/pages-blog/moment-detail/moment-detail?name=${moment.value?.metadata.name}`,
  title: moment.value?.owner?.displayName || '',
}))

onShareTimeline(() => ({
  title: moment.value?.owner?.displayName || '',
  query: moment.value ? `name=${moment.value.metadata.name}` : '',
}))
</script>

<template>
  <view class="app-page box-border min-h-screen w-screen flex flex-col pb-6" style="background-color: #fafafd;">
    <view v-if="loading !== 'success'" class="loading-wrap h-screen bg-white px-6">
      <wd-skeleton :row="3" :animated="true" />
    </view>

    <block v-else>
      <view v-if="moment" class="moment-card flex flex-col gap-6 p-6">
        <!-- 用户信息 -->
        <view class="card flex items-center rounded-xl bg-white p-6 shadow-sm">
          <image class="avatar h-[80rpx] w-[80rpx] shrink-0 rounded-full" :src="moment.owner?.avatar || bloggerInfo.avatar" mode="aspectFill" />
          <view class="nickname ml-3">
            <view class="nickname-text text-[30rpx] text-[#333] font-bold">
              {{ moment.owner?.displayName || bloggerInfo.nickname }}
            </view>
            <view class="release-time mt-1.5 text-[24rpx] text-[#666]">
              {{ formatTime(moment.spec.releaseTime) }}
            </view>
            <!-- 互动数据(点赞/评论) -->
            <view v-if="moment.stats && ((moment.stats.totalComment ?? 0) > 0 || (moment.stats.upvote ?? 0) > 0)" class="stats mt-1.5 flex items-center gap-6 text-[24rpx] text-[#8a919e]">
              <view class="flex items-center gap-1">
                <wd-icon name="heart" size="13px" color="#f08585" />
                <text>{{ moment.stats.upvote || 0 }}</text>
              </view>
              <view class="flex items-center gap-1">
                <wd-icon name="message" size="13px" color="#9aa3b2" />
                <text>{{ moment.stats.totalComment || 0 }}</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 标签 -->
        <view v-if="moment.spec.tags && moment.spec.tags.length !== 0" class="card rounded-xl bg-white p-6 shadow-sm">
          <text class="tags-label text-[26rpx] text-[#606266]">标签列表：</text>
          <text v-for="(tag, tagIndex) in moment.spec.tags" :key="tagIndex" class="tag mr-4 text-[24rpx]" :style="{ color: tagColor() }">
            {{ tag }}
          </text>
        </view>

        <!-- 内容 -->
        <view class="card overflow-hidden rounded-xl bg-white p-6 shadow-sm">
          <mp-html
            class="evan-markdown"
            lazy-load
            :domain="markdownConfig.domain ?? ''"
            :loading-img="markdownConfig.loadingGif"
            scroll-table
            selectable
            :tag-style="markdownConfig.tagStyle"
            :container-style="markdownConfig.containStyle"
            :content="moment.spec.newHtml || ''"
            :markdown="true"
            :show-line-number="true"
            :show-language-name="true"
            copy-by-long-press
          />
        </view>

        <!-- 图片附件 -->
        <view v-if="moment.images && moment.images.length !== 0" class="card rounded-xl bg-white p-6 shadow-sm">
          <view class="card-head mb-1.5 text-[28rpx] text-[#606266]">
            图片附件：
          </view>
          <view class="images flex flex-wrap items-start pt-6" :class="`images-${moment.images.length}`">
            <view v-for="(image, mediumIndex) in moment.images" :key="mediumIndex" class="image-item box-border p-1.5" :class="moment.images && moment.images.length === 1 ? 'h-[350rpx] w-full' : (moment.images && moment.images.length === 2 ? 'h-[250rpx] w-1/2' : 'h-[200rpx] w-1/3')">
              <image
                mode="aspectFill"
                class="image-src h-full w-full rounded-lg"
                :src="image.url"
                @click="handlePreview(mediumIndex, moment.images || [])"
              />
            </view>
          </view>
        </view>

        <!-- 音频附件 -->
        <view v-if="moment.audios && moment.audios.length !== 0" class="card rounded-xl bg-white p-6 shadow-sm">
          <view class="card-head mb-1.5 text-[28rpx] text-[#606266]">
            音频附件：
          </view>
          <view class="audio-list flex flex-col gap-3 pt-3">
            <uh-audio-player
              v-for="audio in moment.audios"
              :key="audio.url"
              :src="audio.url"
              :poster="bloggerInfo.avatar"
              :name="`来自${siteName}的声音`"
              :author="bloggerInfo.nickname"
            />
          </view>
        </view>

        <!-- 视频附件 -->
        <view v-if="moment.videos && moment.videos.length !== 0" class="card rounded-xl bg-white p-6 shadow-sm">
          <view class="card-head mb-1.5 text-[28rpx] text-[#606266]">
            视频附件：
          </view>
          <view class="video-list mt-6 w-full flex flex-col gap-3">
            <video
              v-for="(video, index) in moment.videos"
              :id="`video_${video.id}`"
              :key="index"
              class="video-src h-[400rpx] w-full rounded-xl"
              :src="video.url"
              :show-mute-btn="true"
              :controls="true"
              :show-center-play-btn="true"
              :enable-progress-gesture="true"
              @play="onVideoPlay(video.id || '')"
              @pause="onVideoPause(video.id || '')"
              @ended="onVideoEnded"
            />
          </view>
        </view>
      </view>

      <view class="to-top-btn fixed bottom-[100rpx] right-6 z-6 h-[72rpx] w-[72rpx] flex items-center justify-center rounded-full bg-white shadow-sm" @click="handleToTopPage()">
        <wd-icon name="arrow-up" size="20px" color="#03a9f4" />
      </view>
    </block>
  </view>
</template>

<style scoped>
.app-page {
  /* 布局全部由 UnoCSS 原子类实现 */
}
</style>
