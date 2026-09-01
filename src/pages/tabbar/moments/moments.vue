<script lang="ts" setup>
/**
 * 瞬间页(源自旧项目 pages/tabbar/moments/moments.vue,新建复刻)
 * 功能:瞬间卡片列表(头像/内容/图片/音频/视频/标签) + 分页加载
 */
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { getMomentList } from '@/api/halo'
import { useAppConfigStore } from '@/store/appConfig'
import { checkAvatarUrl, checkThumbnailUrl } from '@/utils/url'
import { generateUUID } from '@/utils/uuid'
import { formatTime as formatTimeUtil } from '@/utils/formatTime'
import { randomTagColor } from '@/utils/random'
import { t } from '@/locale'
import { usePluginAvailable } from '@/utils/plugin'
import { markdownConfig } from '@/config/markdown'
import type { IMoment } from '@/api/types/halo'

definePage({
  style: {
    navigationBarTitleText: '瞬间',
    enablePullDownRefresh: true,
  },
})

const appConfigStore = useAppConfigStore()
const haloConfigs = computed(() => appConfigStore.configs)
const mockJson = computed(() => appConfigStore.mockJson)
const calcAuditModeEnabled = computed(() => !!haloConfigs.value.auditConfig?.auditModeEnabled)
const calcUseTagRandomColor = computed(() => !!haloConfigs.value.pageConfig?.momentConfig?.useTagRandomColor)

const bloggerInfo = computed(() => {
  const blogger = haloConfigs.value.authorConfig?.blogger as { nickname?: string, avatar?: string } | undefined
  return {
    nickname: blogger?.nickname || '',
    avatar: checkAvatarUrl(blogger?.avatar),
  }
})

const startConfig = computed(() => haloConfigs.value.appConfig?.startConfig as { title?: string } | undefined)

/** 依赖插件(plugin-moments) */
const uniHaloPluginId = 'plugin-moments'
const uniHaloPluginAvailable = ref(true)

/* ---------------- 状态 ---------------- */
const loading = ref<'loading' | 'success' | 'error'>('loading')
const queryParams = ref({ size: 10, page: 1 })
const hasNext = ref(false)
const dataList = ref<(IMoment & { images?: { type?: string, url: string }[], videos?: { id?: string, url: string }[], audios?: { type?: string, url: string }[], spec: { newHtml?: string } })[]>([])
const isLoadMore = ref(false)
const loadMoreText = ref(t('common.loading'))
const videoContexts = ref<Record<string, UniApp.VideoContext | undefined>>({})
const currentVideoId = ref<string | null>(null)

/** 移除内容中的 tag 链接 */
function removeTagLinksCompletely(htmlString: string): string {
  const regex = /<a\b[^>]+class=(['"])[^'"]*\btag\b[^'"]*\1[^>]*>[\s\S]*?<\/a>/gi
  return htmlString.replace(regex, '')
}

/* ---------------- 数据加载 ---------------- */
async function handleGetData() {
  if (calcAuditModeEnabled.value) {
    const momentsMock = mockJson.value.moments as { list?: { content?: string, time?: string, images?: string[] }[] } | undefined
    dataList.value = (momentsMock?.list || []).map(item => ({
      metadata: { name: String(Date.now() * Math.random()) },
      spec: {
        content: item.content || '',
        owner: {
          displayName: bloggerInfo.value.nickname,
          avatar: bloggerInfo.value.avatar,
        },
        visible: 'PUBLIC',
        allowComment: true,
        approved: true,
        releaseTime: item.time,
      },
      images: (item.images || []).map(img => ({ type: 'PHOTO', url: checkThumbnailUrl(img) })),
      videos: [],
    }))
    loading.value = 'success'
    loadMoreText.value = t('common.noMore')
    uni.hideLoading()
    uni.stopPullDownRefresh()
    return
  }

  uni.showLoading({ mask: true, title: t('common.loading') })
  if (!isLoadMore.value) {
    loading.value = 'loading'
  }
  loadMoreText.value = t('common.loading')

  try {
    const res = await getMomentList({ ...queryParams.value })
	loading.value = 'success'
    loadMoreText.value = res.data.hasNext ? t('common.loadMore') : t('common.noMore')
    hasNext.value = res.data.hasNext

    const tempItems = res.data.items
      .filter(x => x.spec.visible === 'PUBLIC')
      .map((item) => {
        const medium = (item.spec as unknown as { medium?: { type?: string, url: string }[] }).medium || []
        const newItem = {
          ...item,
          spec: {
            ...item.spec,
            owner: {
              displayName: bloggerInfo.value.nickname,
              avatar: bloggerInfo.value.avatar,
            },
            newHtml: removeTagLinksCompletely((item.spec as unknown as { content?: { html?: string } }).content?.html || ''),
          },
          images: medium.filter(x => x.type === 'PHOTO').map(x => ({ ...x, url: checkThumbnailUrl(x.url, true) })),
          videos: medium.filter(x => x.type === 'VIDEO').map(x => ({ ...x, id: generateUUID() })),
          audios: medium.filter(x => x.type === 'AUDIO'),
        }
        return newItem
      })

    dataList.value = isLoadMore.value
      ? dataList.value.concat(tempItems)
      : tempItems

    nextTick(() => {
      createVideoContexts(tempItems)
    })
  }
  catch (err) {
    console.error(err)
    loading.value = 'error'
    loadMoreText.value = t('common.loadFailed')
  }
  finally {
    setTimeout(() => {
      uni.hideLoading()
      uni.stopPullDownRefresh()
    }, 500)
  }
}

/* ---------------- 视频互斥 ---------------- */
function createVideoContexts(list: { videos?: { id?: string }[] }[]) {
  stopAllVideos()
  list.map(item => item.videos || []).flat().forEach((item) => {
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

function handleToMomentDetail(moment: IMoment) {
  if (calcAuditModeEnabled.value)
    return
  uni.navigateTo({
    url: `/pages-blog/moment-detail/moment-detail?name=${moment.metadata.name}`,
    animationType: 'slide-in-right',
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

/** 格式化瞬间时间 */
function formatMomentTime(time?: string): string {
  // 与旧项目一致:yyyy年MM月dd日 星期w
  return time ? formatTimeUtil({ d: time, f: 'yyyy年MM月dd日 星期w' }) : ''
}

/* ---------------- 生命周期 ---------------- */
onLoad(async () => {
  uni.setNavigationBarTitle({ title: t('page.moments.title') })
  uniHaloPluginAvailable.value = await usePluginAvailable(uniHaloPluginId)
  if (!uniHaloPluginAvailable.value) {
    uni.stopPullDownRefresh()
    return
  }
  handleGetData()
})

onPullDownRefresh(() => {
  if (!uniHaloPluginAvailable.value) {
    uni.stopPullDownRefresh()
    return
  }
  isLoadMore.value = false
  queryParams.value.page = 1
  videoContexts.value = {}
  currentVideoId.value = null
  handleGetData()
})

onReachBottom(() => {
  if (!uniHaloPluginAvailable.value)
    return
  if (calcAuditModeEnabled.value) {
    uni.showToast({ icon: 'none', title: t('common.noMoreData') })
    return
  }
  if (hasNext.value) {
    queryParams.value.page += 1
    isLoadMore.value = true
    handleGetData()
  }
  else {
    uni.showToast({ icon: 'none', title: t('common.noMoreData') })
  }
})
</script>

<template>
  <view class=" box-border min-h-screen w-screen flex flex-col py-6">
    <uh-plugin-unavailable
      v-if="!uniHaloPluginAvailable"
      :plugin-id="uniHaloPluginId"
      error-text="检测到当前插件没有安装或者启用，无法使用瞬间功能哦，请联系管理员"
      @on-refresh="handleGetData"
    />
    <template v-else>
      <view v-if="loading !== 'success'" class="loading-wrap p-3">
        <wd-skeleton :row="3" :animated="true" />
      </view>

      <view v-else class="flex flex-col gap-y-2 p-4">
        <view v-if="dataList.length === 0" class="min-h-[70vh] w-full flex items-center justify-center content-empty">
          <wd-empty :description="t('common.empty')" />
        </view>

        <block v-else>
          <!-- 瞬间卡片 -->
          <view v-for="moment in dataList" :key="moment.metadata.name" class="flex flex-col overflow-hidden rounded-xl bg-white shadow-sm">
            <view class="head flex items-center p-3 pb-0">
              <image class="avatar h-[66rpx] w-[66rpx] shrink-0 rounded-full" :src="moment.spec.owner?.avatar || bloggerInfo.avatar" mode="aspectFill" />
              <view class="nickname ml-3">
                <view class="nickname-text text-[30rpx] text-[#333] font-bold">
                  {{ moment.spec.owner?.displayName || bloggerInfo.nickname }}
                </view>
                <view class="release-time mt-1 text-[24rpx] text-[#666]">
                  {{ formatMomentTime(moment.spec.releaseTime) }}
                </view>
              </view>
            </view>

            <view class="moment-content px-3 py-2" @click.stop="handleToMomentDetail(moment)">
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

            <!-- 图片 -->
            <view v-if="moment.images && moment.images.length !== 0" class="images flex flex-wrap items-start px-3 pb-6" :class="`images-${moment.images.length}`">
              <view v-for="(image, mediumIndex) in moment.images" :key="mediumIndex" class="image-item box-border p-1" :class="moment.images && moment.images.length === 1 ? 'h-[350rpx] w-full' : (moment.images && moment.images.length === 2 ? 'h-[250rpx] w-1/2' : 'h-[200rpx] w-1/3')">
                <image
                  mode="aspectFill"
                  class="image-src h-full w-full rounded-lg"
                  :src="image.url"
                  @click="handlePreview(mediumIndex, moment.images || [])"
                />
              </view>
            </view>

            <!-- 音频 -->
            <view v-if="moment.audios && moment.audios.length !== 0" class="audio-list mb-3 flex flex-col gap-3 px-3">
              <uh-audio-player
                v-for="audio in moment.audios"
                :key="audio.url"
                :src="audio.url"
                :poster="bloggerInfo.avatar"
                :name="`来自${startConfig?.title || bloggerInfo.nickname}的声音`"
                :author="bloggerInfo.nickname"
              />
            </view>

            <!-- 视频 -->
            <view v-if="moment.videos && moment.videos.length !== 0" class="video-list mb-3 flex flex-col gap-3 px-3">
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

            <!-- 标签 -->
            <view v-if="moment.spec.tags && moment.spec.tags.length !== 0" class="tags flex flex-wrap gap-4 px-3 pb-6">
              <view v-for="(tag, tagIndex) in moment.spec.tags" :key="tagIndex" class="tag text-[24rpx]" :style="{ color: randomTagColor() }">
                {{ tag }}
              </view>
            </view>
          </view>

          <view class="to-top-btn fixed bottom-[120rpx] right-6 z-6 h-[72rpx] w-[72rpx] flex items-center justify-center rounded-full bg-white shadow-sm" @click="handleToTopPage()">
            <wd-icon name="arrow-up" size="20px" color="#03a9f4" />
          </view>
          <view class="load-text pb-5 text-center text-[24rpx] text-[#999]">
            {{ loadMoreText }}
          </view>
        </block>
      </view>
    </template>
  </view>
</template>
