<script lang="ts" setup>
import { ref } from 'vue'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { getLoveStories } from '@/api/uni-halo'
import { useAppConfigStore } from '@/store/appConfig'
import { checkImageUrl } from '@/utils/url'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import type { ILoveStory } from '@/api/types/uni-halo'

definePage({
  style: {
    navigationBarTitleText: '恋爱故事',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
  },
})

const appConfigStore = useAppConfigStore()

/* ---------------- 展示层类型 ---------------- */
/** 时间轴故事卡片(script 预处理后的干净展示数据) */
interface IStoryCard {
  /** 唯一 key(metadata.name,无则用索引) */
  key: string
  title: string
  date: string
  location: string
  /** 故事正文(HTML) */
  content: string
  /** 全部图片(已预处理 URL) */
  images: string[]
  /** 时间轴封面图(最多 3 张,已预处理 URL) */
  coverImages: string[]
}

/** 空故事占位(弹窗未打开时) */
const EMPTY_STORY: IStoryCard = {
  key: '',
  title: '',
  date: '',
  location: '',
  content: '',
  images: [],
  coverImages: [],
}

/** 故事卡片映射:字段取值 + 图片路径预处理(模板不感知原始接口结构) */
function mapStoryCard(story: ILoveStory, index: number): IStoryCard {
  const spec = story.spec || {}
  const images = (spec.images || []).map(img => checkImageUrl(img || ''))
  return {
    key: story.metadata?.name || `story-${index}`,
    title: spec.title || '',
    date: spec.date || '',
    location: spec.location || '',
    content: spec.content || '',
    images,
    coverImages: images.slice(0, 3),
  }
}

/* ---------------- 状态 ---------------- */
const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()
const stories = ref<IStoryCard[]>([])
const showDetail = ref(false)
const currentStory = ref<IStoryCard>(EMPTY_STORY)
const storyImageIndex = ref(0)

/* ---------------- 数据加载 ---------------- */
async function handleGetStories() {
  updateLoadingStatus(DataLoadingStatusEnum.Loading)
  try {
    const res = await getLoveStories({})
    const items = res.data?.items || []
    if (items.length > 0) {
      // 按 priority 排序(越大越靠前)
      const sorted = [...items].sort((a, b) => (b.spec?.priority || 0) - (a.spec?.priority || 0))
      stories.value = sorted.map(mapStoryCard)
      updateLoadingStatus(DataLoadingStatusEnum.Success)
    }
    else {
      // 降级:从旧配置读取单条故事
      handleLoadFromLegacy()
    }
  }
  catch (e) {
    console.error('获取故事失败', e)
    handleLoadFromLegacy()
  }
  finally {
    setTimeout(() => {
      uni.stopPullDownRefresh()
    }, 200)
  }
}

function handleLoadFromLegacy() {
  const loveModuleConfig = appConfigStore.configs.loveConfig as { ourStory?: { content?: string } } | undefined
  if (loveModuleConfig?.ourStory?.content) {
    stories.value = [{
      key: 'legacy-story',
      title: '我们的故事',
      date: '',
      location: '',
      content: loveModuleConfig.ourStory.content,
      images: [],
      coverImages: [],
    }]
    updateLoadingStatus(DataLoadingStatusEnum.Success)
    return
  }
  stories.value = []
  updateLoadingStatus(DataLoadingStatusEnum.Empty)
}

/* ---------------- 交互 ---------------- */
function handleOnStoryClick(story: IStoryCard) {
  currentStory.value = story
  storyImageIndex.value = 0
  showDetail.value = true
}

function handleOnStoryImageChange(e: { detail: { current: number } }) {
  storyImageIndex.value = e.detail.current
}

/** 预览时间轴封面图(基于已预处理 URL) */
function handlePreviewStoryImages(story: IStoryCard, index: number) {
  if (story.images.length === 0)
    return
  uni.previewImage({ current: story.images[index], urls: story.images })
}

/** 预览弹窗内大图 */
function handlePreviewImage(index: number) {
  const urls = currentStory.value.images
  if (urls.length > 0) {
    uni.previewImage({ current: urls[index], urls })
  }
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
onLoad(() => {
  handleGetStories()
})

onPullDownRefresh(() => {
  handleGetStories()
})
</script>

<template>
  <view class="app-page box-border min-h-screen w-screen flex flex-col" style="background: linear-gradient(-45deg, rgb(247 149 51 / 10%), rgb(243 112 85 / 10%) 15%, rgb(239 78 123 / 10%) 30%, rgb(161 102 171 / 10%) 44%, rgb(80 115 184 / 10%) 58%, rgb(16 152 173 / 10%) 72%, rgb(7 179 155 / 10%) 86%, rgb(109 186 130 / 10%)); color: rgb(26 26 26);">
    <!-- 自定义导航 -->
    <uh-navbar default-title="恋爱故事" title-color="text-gray-900" />

    <!-- 加载/错误/空占位(状态机) -->
    <uh-data-loading
      v-if="loadingStatus !== DataLoadingStatusEnum.Success"
      :loading-status="loadingStatus"
      min-height="60vh"
      empty-text="还没有故事，等待你们来书写..."
      @refresh="handleGetStories"
    />

    <!-- 时间轴 -->
    <view v-else class="content-wrap box-border flex-1 p-6 pb-[144rpx]">
      <view class="timeline relative pl-10">
        <view v-for="(story, index) in stories" :key="story.key" class="timeline-item relative pb-10" :class="index === stories.length - 1 ? 'timeline-item-last' : ''" @click="handleOnStoryClick(story)">
          <view class="timeline-dot absolute left-[-32rpx] top-4 z-2 h-5 w-5 rounded-full" style="background-color: #f88ca2; box-shadow: 0 0 0 6rpx rgb(248 140 162 / 20%);" />
          <view class="timeline-card rounded-xl bg-white p-6 shadow-sm">
            <view v-if="story.date" class="timeline-date mb-2 text-[24rpx] text-[#f88ca2]">
              {{ story.date }}
            </view>
            <view class="timeline-title text-[32rpx] text-[#333] font-bold">
              {{ story.title }}
            </view>
            <view v-if="story.location" class="timeline-location mt-2 flex items-center text-[24rpx] text-[#999]">
              <text class="location-text ml-1">{{ story.location }}</text>
            </view>
            <view v-if="story.coverImages.length" class="timeline-covers mt-4 flex flex-wrap gap-2">
              <view
                v-for="(img, imgIndex) in story.coverImages"
                :key="imgIndex"
                class="timeline-cover h-[180rpx] w-[calc((100%-16rpx)/3)] overflow-hidden rounded-lg"
                @click.stop="handlePreviewStoryImages(story, imgIndex)"
              >
                <image class="timeline-cover-img h-full w-full" :src="img" mode="aspectFill" lazy-load />
              </view>
              <view
                v-if="story.images.length > 3"
                class="timeline-cover timeline-cover-more h-[180rpx] w-[calc((100%-16rpx)/3)] flex items-center justify-center bg-black/50"
                @click.stop="handleOnStoryClick(story)"
              >
                <text class="more-text text-[32rpx] text-white font-bold">
                  +{{ story.images.length - 3 }}
                </text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="to-top-btn fixed bottom-[160rpx] right-6 z-6 h-[72rpx] w-[72rpx] flex items-center justify-center rounded-full bg-white shadow-sm" @click="handleToTopPage()">
      <wd-icon name="arrow-up" size="20px" color="#03a9f4" />
    </view>

    <!-- 故事详情弹窗 -->
    <wd-popup v-model="showDetail" position="center" custom-style="width:90vw;height:80vh;border-radius:12rpx;">
      <view class="story-detail h-full w-full flex flex-col overflow-hidden rounded-xl bg-white">
        <view class="story-detail-header box-border shrink-0 border-b border-black/5 px-7 py-6">
          <view class="story-detail-title text-[32rpx] text-[#333] font-bold">
            {{ currentStory.title }}
          </view>
          <view v-if="currentStory.date || currentStory.location" class="story-detail-meta mt-2 flex items-center text-[24rpx] text-[#999]">
            <text v-if="currentStory.date" class="story-detail-date">
              {{ currentStory.date }}
            </text>
            <text v-if="currentStory.location" class="story-detail-location ml-6">
              {{ currentStory.location }}
            </text>
          </view>
        </view>
        <!-- 故事图片:多图 swiper 轮播 -->
        <view v-if="currentStory.images.length > 0" class="story-images shrink-0">
          <swiper
            v-if="currentStory.images.length > 1"
            class="story-images-swiper h-[360rpx] w-full"
            circular
            indicator-dots
            indicator-color="rgba(255,255,255,0.4)"
            indicator-active-color="#f88ca2"
            :current="storyImageIndex"
            @change="handleOnStoryImageChange"
          >
            <swiper-item v-for="(img, imgIndex) in currentStory.images" :key="imgIndex" class="story-images-item h-full w-full">
              <image :src="img" mode="aspectFill" class="story-image h-full w-full" @click="handlePreviewImage(imgIndex)" />
            </swiper-item>
          </swiper>
          <image v-else :src="currentStory.images[0]" mode="aspectFill" class="story-image story-image-single h-[360rpx] w-full" @click="handlePreviewImage(0)" />
        </view>
        <scroll-view scroll-y class="story-detail-content box-border min-h-0 flex-1 px-7 py-6">
          <view class="story-html text-[28rpx] text-[#333] leading-[1.8]" v-html="currentStory.content" />
        </scroll-view>
        <view class="story-detail-close box-border shrink-0 border-t border-black/5 px-7 py-5">
          <text class="close-text block h-20 rounded-[40rpx] text-center text-[30rpx] text-white font-bold" style="background: linear-gradient(135deg, #f88ca2, #ff6b9d); line-height: 80rpx;" @click="showDetail = false">关闭</text>
        </view>
      </view>
    </wd-popup>
  </view>
</template>

<style scoped lang="scss">
.timeline {
  .timeline-item {
    &::before {
      content: '';
      position: absolute;
      left: -20rpx;
      top: 12rpx;
      bottom: 0;
      width: 2rpx;
      background-color: rgb(248 140 162 / 40%);
    }

    &.timeline-item-last::before {
      display: none;
    }
  }
}
</style>
