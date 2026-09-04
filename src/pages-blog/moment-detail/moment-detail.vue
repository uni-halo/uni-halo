<script lang="ts" setup>
/**
 * 瞬间详情页(源自旧项目 pagesA/moment-detail,新建复刻)
 * 展示瞬间内容(mp-html) + 图片/音频/视频附件
 * 设计:日记页(大字日期刊头 + 宽松留白),与列表页的信息流形成两种性格
 * 试点:useDataLoading 状态机接管加载四态
 */
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { getMomentByName, submitUpvote } from '@/api/halo'
import { useAppConfigStore } from '@/store/appConfig'
import { useFavoritesStore } from '@/store/favorites'
import { checkAvatarUrl, checkThumbnailUrl } from '@/utils/url'
import { buildMomentFavoriteItem } from '@/utils/favorite'
import { generateUUID } from '@/utils/uuid'
import { formatTime as formatTimeUtil } from '@/utils/formatTime'
import { randomTagColor } from '@/utils/random'
import { markdownConfig } from '@/config/markdown'
import { useDataLoading } from '@/hooks/useDataLoading'
import type { IMoment } from '@/api/types/halo'

definePage({
  style: {
    navigationBarTitleText: '瞬间详情',
    enablePullDownRefresh: true,
    // 下拉/回弹露出的窗口底色对齐页面底色
    backgroundColor: '#f6f3ee',
  },
})

const appConfigStore = useAppConfigStore()
const favoritesStore = useFavoritesStore()
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
const queryName = ref('')
const videoContexts = ref<Record<string, UniApp.VideoContext | undefined>>({})
const currentVideoId = ref<string | null>(null)

/** 瞬间卡片(medium 按类型拆为 images/videos/audios + 正文 tag 清理) */
type MomentCard = IMoment & {
  images?: { type?: string, url: string }[]
  videos?: { id?: string, url: string }[]
  audios?: { type?: string, url: string }[]
  spec: IMoment['spec'] & { newHtml?: string }
}

/** 移除 tag 链接 */
function removeTagLinksCompletely(htmlString: string): string {
  const regex = /<a\b[^>]+class=(['"])[^'"]*\btag\b[^'"]*\1[^>]*>[\s\S]*?<\/a>/gi
  return htmlString.replace(regex, '')
}

/** 瞬间详情 → 展示卡片(作者兜底 + medium 拆分 + tag 清理) */
function buildMomentCard(res: IMoment): MomentCard {
  const medium = (res.spec.content?.medium || [])
    .map(x => ({ ...x, url: x.url || '' }))
  const owner = res.owner
  return {
    ...res,
    // 无顶层 owner(如个别历史接口)时兜底为博主信息
    owner: owner?.displayName
      ? owner
      : { displayName: bloggerInfo.value.nickname || '', name: bloggerInfo.value.nickname || '', avatar: bloggerInfo.value.avatar },
    spec: {
      ...res.spec,
      newHtml: removeTagLinksCompletely(res.spec.content?.html || ''),
    },
    images: medium.filter(x => x.type === 'PHOTO').map(x => ({ ...x, url: checkThumbnailUrl(x.url, true) })),
    videos: medium.filter(x => x.type === 'VIDEO').map(x => ({ ...x, id: generateUUID() })),
    audios: medium.filter(x => x.type === 'AUDIO'),
  }
}

/* ---------------- 数据加载(useDataLoading 试点:状态由 hook 接管) ---------------- */
const { data: moment, status, run: loadMoment } = useDataLoading(
  async (): Promise<MomentCard> => {
    const res = await getMomentByName(queryName.value)
    uni.setNavigationBarTitle({ title: '瞬间详情' })
    return buildMomentCard(res.data)
  },
  {
    onSuccess: (card) => {
      nextTick(() => {
        createVideoContexts(card.videos || [])
      })
    },
    onError: () => {
      uni.setNavigationBarTitle({ title: '瞬间详情' })
    },
  },
)

/** 标签颜色(随机模式下按数据稳定,避免每次渲染重新随机变色) */
const calcTagColors = computed(() => {
  const tags = moment.value?.spec.tags || []
  return tags.map(() => (calcUseTagRandomColor.value ? randomTagColor() : '#4d7c0f'))
})

/** 刊头大字日期(如 09月03日) */
const calcMastheadDate = computed(() => {
  const time = moment.value?.spec.releaseTime
  return time ? formatTimeUtil({ d: time, f: 'MM月dd日' }) : ''
})

/** 刊头辅助信息(如 2026年 · 星期四) */
const calcMastheadMeta = computed(() => {
  const time = moment.value?.spec.releaseTime
  return time ? formatTimeUtil({ d: time, f: 'yyyy年 · 星期w' }) : ''
})

/* ---------------- 收藏 ---------------- */
/** 当前瞬间是否已收藏(悬浮胶囊高亮) */
const momentFavorited = computed(() => {
  const name = moment.value?.metadata.name
  return !!name && favoritesStore.isFavorite('moment', name)
})

/** 切换收藏(收藏/取消),收藏时按当前详情内容生成快照入库 */
function handleToggleMomentFavorite() {
  const card = moment.value
  if (!card)
    return
  const favorited = favoritesStore.toggle(buildMomentFavoriteItem(card))
  uni.showToast({ icon: 'none', title: favorited ? '收藏成功' : '已取消收藏' })
}

/* ---------------- 点赞 ---------------- */
const upvotedNames = ref<string[]>([])

function hasUpvoted(): boolean {
  return upvotedNames.value.includes(moment.value?.metadata.name || '')
}

async function handleDoLikes() {
  const current = moment.value
  if (!current)
    return
  if (hasUpvoted()) {
    uni.showToast({ icon: 'none', title: '已经点过赞啦!' })
    return
  }
  try {
    await submitUpvote({
      group: 'content.halo.run',
      plural: 'moments',
      name: current.metadata.name,
    })
    uni.showToast({ icon: 'none', title: '点赞成功!' })
    upvotedNames.value.push(current.metadata.name)
    if (current.stats) {
      current.stats.upvote = (current.stats.upvote || 0) + 1
    }
  }
  catch (err) {
    console.error('点赞失败', err)
    uni.showToast({ icon: 'none', title: '点赞失败' })
  }
}

/* ---------------- 评论 ---------------- */
const commentModal = ref({
  show: false,
  isComment: false,
  postName: '',
  title: '',
})

function handleToComment() {
  const current = moment.value
  if (!current)
    return
  if (!current.spec.allowComment) {
    uni.showToast({ icon: 'none', title: '瞬间已开启禁止评论！' })
    return
  }
  commentModal.value = {
    show: true,
    isComment: true,
    postName: current.metadata.name,
    title: '新增评论',
  }
}

function handleOnCommentModalClose(data: { refresh: boolean, isSubmit: boolean }) {
  commentModal.value.show = false
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
  loadMoment()
})

onPullDownRefresh(async () => {
  videoContexts.value = {}
  currentVideoId.value = null
  await loadMoment()
  uni.stopPullDownRefresh()
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
  <view class="app-page box-border min-h-screen w-screen bg-page px-4 pb-8 pt-4">
    <!-- 状态区(加载中/失败可重试/空) -->
    <uh-data-loading
      v-if="status !== 'success'"
      :loading-status="status"
      min-height="60vh"
      error-text="瞬间内容加载失败"
      empty-text="瞬间不存在或已被删除"
      @refresh="loadMoment"
    />

    <!-- 瞬间内页(日记式:大字日期刊头 + 阅读正文 + 媒体 + 互动脚注) -->
    <view v-else-if="moment" class="moment-card uh-shadow-xs overflow-hidden rounded-[28rpx] bg-white">
      <!-- 刊头:大字日期 -->
      <view v-if="moment.spec.releaseTime" class="px-7 pt-7">
        <view class="text-[56rpx] text-gray-900 font-bold leading-tight">
          {{ calcMastheadDate }}
        </view>
        <view class="mt-1 text-[24rpx] text-gray-400">
          {{ calcMastheadMeta }}
        </view>
        <view class="mt-4 h-[8rpx] w-[96rpx] rounded-full bg-secondary" />
      </view>

      <!-- 作者 -->
      <view class="flex items-center px-7 pt-6">
        <image class="h-[80rpx] w-[80rpx] shrink-0 rounded-full" :src="moment.owner?.avatar || bloggerInfo.avatar" mode="aspectFill" />
        <view class="ml-3 flex flex-col">
          <view class="text-[30rpx] text-[#5c7c0f] font-bold">
            {{ moment.owner?.displayName || bloggerInfo.nickname }}
          </view>
          <view class="mt-0.5 text-[22rpx] text-gray-400">
            记录了这美好的一刻
          </view>
        </view>
      </view>

      <!-- 正文 -->
      <view class="content px-7 pt-5">
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
      <view v-if="moment.images && moment.images.length !== 0" class="px-7 pt-6">
        <view class="images flex flex-wrap items-start">
          <view
            v-for="(image, mediumIndex) in moment.images"
            :key="mediumIndex"
            class="image-item box-border p-1.5"
            :class="moment.images && moment.images.length === 1 ? 'h-[350rpx] w-full' : (moment.images && moment.images.length === 2 ? 'h-[250rpx] w-1/2' : 'h-[200rpx] w-1/3')"
          >
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
      <view v-if="moment.audios && moment.audios.length !== 0" class="px-7 pt-6">
        <view class="audio-list flex flex-col gap-3">
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
      <view v-if="moment.videos && moment.videos.length !== 0" class="px-7 pt-6">
        <view class="video-list w-full flex flex-col gap-3">
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

      <!-- 标签 -->
      <view v-if="moment.spec.tags && moment.spec.tags.length !== 0" class="tags flex flex-wrap gap-2 px-7 pt-6">
        <view v-for="(tag, tagIndex) in moment.spec.tags" :key="tagIndex" class="rounded-full bg-black/5 px-3 py-1 text-[22rpx] font-bold" :style="{ color: calcTagColors[tagIndex] }">
          # {{ tag }}
        </view>
      </view>

      <!-- 互动脚注(点赞/评论) -->
      <view v-if="moment.stats" class="mx-7 mt-6 flex items-center justify-end gap-5 border-t border-black/5 py-4 text-[24rpx] text-gray-400">
        <view class="flex items-center gap-1">
          <wd-icon name="heart" size="13px" color="#f08585" />
          <text>{{ moment.stats.upvote || 0 }}</text>
        </view>
        <view class="flex items-center gap-1">
          <wd-icon name="message" size="13px" color="#9aa3b2" />
          <text>{{ moment.stats.totalComment || 0 }}</text>
        </view>
      </view>
      <view v-else class="h-7" />
    </view>

    <!-- 悬浮操作(与文章详情一致:点赞/评论/收藏) -->
    <view class="fixed bottom-8 left-1/2 z-10 flex items-center justify-center pb-safe -translate-x-1/2">
      <view
        class="uh-global-card-glass box-border flex items-center justify-center gap-2 border rounded-full p-1 text-primary"
      >
        <!-- 点赞 -->
        <view
          class="uh-global-card-glass box-border h-[72rpx] flex flex-1 items-center justify-center gap-x-1 border rounded-full px-4 shadow-none"
          :class="{ active: hasUpvoted() }" @click="handleDoLikes"
        >
          <wd-icon class-prefix="uhemoji-icon" name="-kiss-" size="36rpx" />
          <text class="shrink-0 text-sm text-gray-900 font-semibold">点赞</text>
        </view>
        <!-- 评论 -->
        <view
          class="uh-global-card-glass box-border h-[72rpx] flex flex-1 items-center justify-center gap-x-1 border rounded-full px-4 shadow-none"
          @click="handleToComment()"
        >
          <wd-icon class-prefix="uhemoji-icon" name="-thinking" size="36rpx" />
          <text class="shrink-0 text-sm text-gray-900 font-semibold">评论</text>
        </view>
        <!-- 收藏 -->
        <view
          class="uh-global-card-glass box-border h-[72rpx] flex flex-1 items-center justify-center gap-x-1 border rounded-full px-4 shadow-none"
          @click="handleToggleMomentFavorite"
        >
          <wd-icon class-prefix="uhemoji-icon" name="-smile-" size="36rpx" />
          <text class="shrink-0 text-sm text-gray-900 font-semibold"
            :style="momentFavorited ? { color: '#ffb300' } : ''">{{ momentFavorited ? '已收藏' : '收藏' }}</text>
        </view>
      </view>
    </view>

    <!-- 回顶 -->
    <view class="to-top-btn uh-shadow-xs fixed bottom-[100rpx] right-6 z-6 h-[72rpx] w-[72rpx] flex items-center justify-center rounded-full bg-white" @click="handleToTopPage()">
      <wd-icon name="arrow-up" size="20px" color="#6b7280" />
    </view>

    <!-- 评论弹窗 -->
    <uh-comment-modal
      v-if="commentModal.show" :show="commentModal.show" :is-comment="commentModal.isComment"
      :title="commentModal.title" :post-name="commentModal.postName" subject-kind="Moment"
      @on-close="handleOnCommentModalClose"
    />
  </view>
</template>
