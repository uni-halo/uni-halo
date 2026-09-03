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
    // 玻璃拟态试验:下拉/回弹露出的窗口底色对齐壁纸底部色调
    backgroundColor: '#f4efff',
  },
})

const appConfigStore = useAppConfigStore()
const haloConfigs = computed(() => appConfigStore.configs)
const calcAuditModeEnabled = computed(() => appConfigStore.auditModeEnabled)
const calcUseTagRandomColor = computed(() => !!haloConfigs.value.pageConfig?.momentConfig?.useTagRandomColor)

const bloggerInfo = computed(() => {
  const blogger = haloConfigs.value.authorConfig?.blogger as { nickname?: string, avatar?: string } | undefined
  return {
    nickname: blogger?.nickname || '',
    avatar: checkAvatarUrl(blogger?.avatar),
  }
})

/** 站点名称(原 startConfig.title 已随启动页下线,改读 appConfig.appInfo.name) */
const siteName = computed(() => {
  const appInfo = haloConfigs.value.appConfig?.appInfo as { name?: string } | undefined
  return appInfo?.name || bloggerInfo.value.nickname || 'uni-halo'
})

/** 依赖插件(plugin-moments) */
const uniHaloPluginId = 'plugin-moments'
const uniHaloPluginAvailable = ref(true)

/* ---------------- 状态 ---------------- */
const loading = ref<'loading' | 'success' | 'error'>('loading')
const queryParams = ref({ size: 10, page: 1 })
const hasNext = ref(false)
/** 列表卡片:medium 已按类型拆为 images/videos/audios + 正文 tag 清理 */
type MomentCard = IMoment & {
  images?: { type?: string, url: string }[]
  videos?: { id?: string, url: string }[]
  audios?: { type?: string, url: string }[]
  spec: IMoment['spec'] & { newHtml?: string }
}
const dataList = ref<MomentCard[]>([])
const isLoadMore = ref(false)
const loadMoreText = ref(t('common.loading'))
const videoContexts = ref<Record<string, UniApp.VideoContext | undefined>>({})
const currentVideoId = ref<string | null>(null)

/** 移除内容中的 tag 链接 */
function removeTagLinksCompletely(htmlString: string): string {
  const regex = /<a\b[^>]+class=(['"])[^'"]*\btag\b[^'"]*\1[^>]*>[\s\S]*?<\/a>/gi
  return htmlString.replace(regex, '')
}

/** 瞬间项映射(spec.content.medium 拆分为 images/videos/audios + 内容 tag 清理 + 作者兜底) */
function mapMomentItem(item: IMoment): MomentCard {
  const medium = (item.spec.content?.medium || [])
    .map(x => ({ ...x, url: x.url || '' }))
  const owner = item.owner
  return {
    ...item,
    // 无顶层 owner(如个别历史接口)时兜底为博主信息
    owner: owner?.displayName
      ? owner
      : { displayName: bloggerInfo.value.nickname || '', name: bloggerInfo.value.nickname || '', avatar: bloggerInfo.value.avatar },
    spec: {
      ...item.spec,
      newHtml: removeTagLinksCompletely(item.spec.content?.html || ''),
    },
    images: medium.filter(x => x.type === 'PHOTO').map(x => ({ ...x, url: checkThumbnailUrl(x.url, true) })),
    videos: medium.filter(x => x.type === 'VIDEO').map(x => ({ ...x, id: generateUUID() })),
    audios: medium.filter(x => x.type === 'AUDIO'),
  }
}

/* ---------------- 数据加载 ---------------- */
async function handleGetData() {
  if (calcAuditModeEnabled.value) {
    // 审核模式:真实瞬间按 audit-data moments 过滤(数组顺序即展示顺序)
    const auditMomentNames = appConfigStore.auditData.spec?.moments || []
    try {
      const res = await getMomentList({ page: 1, size: 99999 })
      const filtered = res.data.items
        .filter(x => x.spec.visible === 'PUBLIC' && auditMomentNames.includes(x.metadata.name))
      const orderMap = new Map(auditMomentNames.map((name, index) => [name, index]))
      filtered.sort((a, b) => (orderMap.get(a.metadata.name) ?? 999) - (orderMap.get(b.metadata.name) ?? 999))
      const tempItems = filtered.map(mapMomentItem)
      dataList.value = tempItems
      nextTick(() => {
        createVideoContexts(tempItems)
      })
      loading.value = 'success'
      loadMoreText.value = t('common.noMore')
      uni.hideLoading()
      uni.stopPullDownRefresh()
    }
    catch (err) {
      console.error(err)
      loading.value = 'error'
      loadMoreText.value = t('common.loadFailed')
    }
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
      .map(mapMomentItem)

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
  <view class="moments-page relative box-border min-h-screen w-screen flex flex-col py-6">
    <!-- 苹果风玻璃拟态试验:fixed 渐变"壁纸"(多层柔光光斑为卡片毛玻璃取色) -->
    <view class="moments-wallpaper">
      <view class="deco deco-blue" />
      <view class="deco deco-pink" />
      <view class="deco deco-lavender" />
      <view class="deco deco-cyan" />
      <view class="deco deco-lift" />
    </view>
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

      <view v-else class="flex flex-col gap-y-4 p-4">
        <view v-if="dataList.length === 0" class="min-h-[70vh] w-full flex items-center justify-center content-empty">
          <wd-empty :description="t('common.empty')" />
        </view>

        <block v-else>
          <!-- 瞬间卡片(玻璃) -->
          <view v-for="moment in dataList" :key="moment.metadata.name" class="moment-glass flex flex-col overflow-hidden rounded-[32rpx]">
            <view class="head flex items-center p-3 pb-0">
              <image class="avatar h-[66rpx] w-[66rpx] shrink-0 rounded-full" :src="moment.owner?.avatar || bloggerInfo.avatar" mode="aspectFill" />
              <view class="nickname ml-3">
                <view class="nickname-text text-[30rpx] text-[#333] font-bold">
                  {{ moment.owner?.displayName || bloggerInfo.nickname }}
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
                :name="`来自${siteName}的声音`"
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

            <!-- 互动数据(点赞/评论) -->
            <view  class="flex items-center justify-end gap-7 px-4 pb-4 text-[24rpx] text-[#8a919e]">
              <view class="flex items-center gap-1">
                <wd-icon name="heart" size="14px" color="#f08585" />
                <text>{{ moment.stats.upvote || 0 }}</text>
              </view>
              <view class="flex items-center gap-1">
                <wd-icon name="message" size="14px" color="#9aa3b2" />
                <text>{{ moment.stats.totalComment || 0 }}</text>
              </view>
            </view>
          </view>

          <view class="fixed bottom-[120rpx] right-6 z-6 h-[72rpx] w-[72rpx] flex items-center justify-center rounded-full moment-glass" @click="handleToTopPage()">
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

<style scoped lang="scss">
/* 苹果风玻璃拟态试验(测试点:瞬间页)
 * 原理:页面固定一层多彩渐变"壁纸",卡片用半透明白 + backdrop-filter,
 * 壁纸的颜色透过玻璃才看得见(纯白背景看不出毛玻璃)。
 */
.moments-page {
  /* 兜底底色(壁纸固定层异常时页面不至于纯白) */
  background-color: #eef1fd;
}

.moments-wallpaper {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  /* 通栏渐变铺满整屏(随视口固定):顶部白衔接导航栏,中段淡蓝紫,底部淡粉回环 */
  background: linear-gradient(
    180deg,
    #ffffff 0%,
    #f3f6ff 20%,
    #edf0ff 46%,
    #f6eeff 68%,
    #ffeef6 88%,
    #f4f7ff 100%
  );
}

/* 柔光光斑:以软径向渐变直接呈现"虚化"质感(免 filter blur,低端机零开销),
 * 分布覆盖整屏,让玻璃卡片在任何位置都有色可"取" */
.deco {
  position: absolute;
  border-radius: 50%;
  filter: blur(60rpx);
}

.deco-blue {
  width: 64%;
  height: 64%;
  right: -18%;
  top: -14%;
  background: radial-gradient(circle, rgb(255 255 255 / 85%) 0%, rgb(124 163 255 / 42%) 22%, rgb(96 140 255 / 30%) 42%, transparent 68%);
}

.deco-pink {
  width: 48%;
  height: 48%;
  left: -14%;
  top: 16%;
  background: radial-gradient(circle, rgb(255 255 255 / 80%) 0%, rgb(255 122 176 / 32%) 26%, rgb(255 110 160 / 20%) 48%, transparent 72%);
}

.deco-lavender {
  width: 54%;
  height: 54%;
  right: -10%;
  top: 42%;
  background: radial-gradient(circle, rgb(255 255 255 / 75%) 0%, rgb(170 132 255 / 28%) 30%, rgb(158 120 255 / 18%) 50%, transparent 72%);
}

.deco-cyan {
  width: 60%;
  height: 60%;
  left: -16%;
  bottom: -18%;
  background: radial-gradient(circle, rgb(255 255 255 / 70%) 0%, rgb(90 216 236 / 24%) 30%, rgb(70 200 226 / 16%) 52%, transparent 72%);
}

/* 中部柔和提亮,避免大面积素色发闷 */
.deco-lift {
  width: 42%;
  height: 42%;
  left: 28%;
  bottom: 6%;
  background: radial-gradient(circle, rgb(255 255 255 / 55%), transparent 70%);
}

.moment-glass {
  background-color: rgb(255 255 255 / 55%);
  border: 1rpx solid rgb(255 255 255 / 65%);
  box-shadow:
    inset 0 1rpx 0 rgb(255 255 255 / 75%),
    0 8rpx 32rpx rgb(90 105 200 / 14%);
  backdrop-filter: blur(24rpx) saturate(160%);
  -webkit-backdrop-filter: blur(24rpx) saturate(160%);

  /* 低端安卓 WebView 不支持 backdrop-filter 的兜底:提高不透明度保证可读性 */
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    background-color: rgb(255 255 255 / 88%);
  }
}
</style>
