<script lang="ts" setup>
/**
 * 恋爱故事页(源自旧项目 pagesA/love/journey.vue,新建复刻)
 * 时间轴展示恋爱故事,点击查看故事详情弹窗
 */
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { getLoveStories } from '@/api/uni-halo'
import { useAppConfigStore } from '@/store/appConfig'
import { checkImageUrl } from '@/utils/url'
import type { ILoveStory } from '@/api/types/uni-halo'

definePage({
  style: {
    navigationBarTitleText: '恋爱故事',
    enablePullDownRefresh: true,
  },
})

const appConfigStore = useAppConfigStore()

/* ---------------- 状态 ---------------- */
const loading = ref<'loading' | 'success' | 'error'>('loading')
const scrollTop = ref(0)
const stories = ref<ILoveStory[]>([])
const showDetail = ref(false)
const currentStory = ref<ILoveStory>({})
const currentStoryHtml = ref('')
const storyImageIndex = ref(0)

/* ---------------- 计算属性 ---------------- */
/** 弹窗故事图片(预处理路径) */
const currentStoryImages = computed(() => {
  const images = (currentStory.value as unknown as { spec?: { images?: string[] } }).spec?.images || []
  return images.map(img => checkImageUrl(img || ''))
})

/* ---------------- 数据加载 ---------------- */
async function handleGetStories() {
  loading.value = 'loading'
  try {
    const res = await getLoveStories({})
    if (res.data && (res.data as unknown as { items?: unknown[] }).items && ((res.data as unknown as { items: unknown[] }).items.length > 0)) {
      // 按 priority 排序
      stories.value = ((res.data as unknown as { items: ILoveStory[] }).items).sort((a, b) => {
        const priorityA = (a as unknown as { spec?: { priority?: number } }).spec?.priority || 0
        const priorityB = (b as unknown as { spec?: { priority?: number } }).spec?.priority || 0
        return priorityB - priorityA
      })
      loading.value = 'success'
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
  const appConfigs = appConfigStore.configs
  const loveModuleConfig = appConfigs.loveConfig as { ourStory?: { content?: string } } | undefined
  if (loveModuleConfig?.ourStory?.content) {
    stories.value = [{
      name: 'legacy-story',
      spec: {
        title: '我们的故事',
        content: loveModuleConfig.ourStory.content,
        date: '',
        images: [],
      },
    }]
    loading.value = 'success'
    return
  }
  stories.value = []
  loading.value = 'success'
}

/* ---------------- 交互 ---------------- */
function handleOnStoryClick(story: ILoveStory) {
  currentStory.value = story
  currentStoryHtml.value = (story as unknown as { spec?: { content?: string } }).spec?.content || ''
  storyImageIndex.value = 0
  showDetail.value = true
}

function handleOnStoryImageChange(e: { detail: { current: number } }) {
  storyImageIndex.value = e.detail.current
}

/** 时间轴封面图:最多 3 张,预处理路径 */
function storyCoverImages(story: ILoveStory): string[] {
  const images = (story as unknown as { spec?: { images?: string[] } }).spec?.images || []
  return images.slice(0, 3).map(img => checkImageUrl(img || ''))
}

/** 预览时间轴封面图 */
function handlePreviewStoryImages(story: ILoveStory, index: number) {
  const images = (story as unknown as { spec?: { images?: string[] } }).spec?.images || []
  const urls = images.map(img => checkImageUrl(img || ''))
  if (urls.length === 0)
    return
  uni.previewImage({ current: urls[index], urls })
}

function handlePreviewImage(index: number) {
  const images = (currentStory.value as unknown as { spec?: { images?: string[] } }).spec?.images || []
  const urls = images.map(img => checkImageUrl(img || ''))
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
  uni.setNavigationBarTitle({ title: '恋爱故事' })
  handleGetStories()
})

onPullDownRefresh(() => {
  handleGetStories()
})
</script>

<template>
  <view class="app-page box-border min-h-screen w-screen p-6 pb-[144rpx]" style="background: linear-gradient(-45deg, rgb(247 149 51 / 10%), rgb(243 112 85 / 10%) 15%, rgb(239 78 123 / 10%) 30%, rgb(161 102 171 / 10%) 44%, rgb(80 115 184 / 10%) 58%, rgb(16 152 173 / 10%) 72%, rgb(7 179 155 / 10%) 86%, rgb(109 186 130 / 10%)); color: rgb(26 26 26);">
    <view v-if="loading === 'loading'" class="loading-wrap box-border h-[60vh] w-full flex items-center justify-center p-9">
      <view class="loadig-text mt-7 text-[28rpx] text-[#56bbf9]">
        故事正在努力加载中啦~
      </view>
    </view>
    <view v-else-if="loading === 'error'" class="loading-wrap box-border h-[60vh] w-full flex items-center justify-center p-9">
      <wd-empty description="啊偶,加载失败了呢~">
        <wd-button size="small" plain type="danger" @click="handleGetStories()">
          刷新试试
        </wd-button>
      </wd-empty>
    </view>
    <view v-else class="content-wrap">
      <!-- 空状态 -->
      <view v-if="stories.length === 0" class="empty-state h-[60vh] w-full flex items-center justify-center">
        <wd-empty description="还没有故事，等待你们来书写...">
          <wd-button size="small" plain type="primary" @click="handleGetStories()">
            刷新试试
          </wd-button>
        </wd-empty>
      </view>
      <!-- 时间轴 -->
      <view v-else class="timeline relative pl-10">
        <view v-for="(story, index) in stories" :key="String((story as unknown as { name?: string })?.name ?? index)" class="timeline-item relative pb-10" @click="handleOnStoryClick(story)">
          <view class="timeline-dot absolute left-[-32rpx] top-4 z-2 h-5 w-5 rounded-full" style="background-color: #f88ca2; box-shadow: 0 0 0 6rpx rgb(248 140 162 / 20%);" />
          <view class="timeline-card rounded-xl bg-white p-6 shadow-sm">
            <view v-if="(story as unknown as { spec?: { date?: string } }).spec?.date" class="timeline-date mb-2 text-[24rpx] text-[#f88ca2]">
              {{ (story as unknown as { spec?: { date?: string } }).spec?.date }}
            </view>
            <view class="timeline-title text-[32rpx] text-[#333] font-bold">
              {{ (story as unknown as { spec?: { title?: string } }).spec?.title || '' }}
            </view>
            <view v-if="(story as unknown as { spec?: { location?: string } }).spec?.location" class="timeline-location mt-2 flex items-center text-[24rpx] text-[#999]">
              <text class="location-text ml-1">{{ (story as unknown as { spec?: { location?: string } }).spec?.location }}</text>
            </view>
            <view
              v-if="(story as unknown as { spec?: { images?: string[] } }).spec?.images?.length"
              class="timeline-covers mt-4 flex flex-wrap gap-2"
            >
              <view
                v-for="(img, imgIndex) in storyCoverImages(story)"
                :key="imgIndex"
                class="timeline-cover h-[180rpx] w-[calc((100%-16rpx)/3)] overflow-hidden rounded-lg"

                @click.stop="handlePreviewStoryImages(story, imgIndex)"
              >
                <image class="timeline-cover-img h-full w-full" :src="img" mode="aspectFill" lazy-load />
              </view>
              <view
                v-if="((story as unknown as { spec?: { images?: string[] } }).spec?.images?.length || 0) > 3"
                class="timeline-cover timeline-cover-more h-[180rpx] w-[calc((100%-16rpx)/3)] flex items-center justify-center bg-black/50"

                @click.stop="handleOnStoryClick(story)"
              >
                <text class="more-text text-[32rpx] text-white font-bold">
                  +{{ ((story as unknown as { spec?: { images?: string[] } }).spec?.images?.length || 0) - 3 }}
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
            {{ (currentStory as unknown as { spec?: { title?: string } }).spec?.title || '' }}
          </view>
          <view
            v-if="(currentStory as unknown as { spec?: { date?: string; location?: string } }).spec?.date
              || (currentStory as unknown as { spec?: { date?: string; location?: string } }).spec?.location"
            class="story-detail-meta mt-2 flex items-center text-[24rpx] text-[#999]"
          >
            <text v-if="(currentStory as unknown as { spec?: { date?: string } }).spec?.date" class="story-detail-date">
              {{ (currentStory as unknown as { spec?: { date?: string } }).spec?.date }}
            </text>
            <text v-if="(currentStory as unknown as { spec?: { location?: string } }).spec?.location" class="story-detail-location ml-6">
              {{ (currentStory as unknown as { spec?: { location?: string } }).spec?.location }}
            </text>
          </view>
        </view>
        <!-- 故事图片:多图 swiper 轮播 -->
        <view v-if="currentStoryImages.length > 0" class="story-images shrink-0">
          <swiper
            v-if="currentStoryImages.length > 1"
            class="story-images-swiper h-[360rpx] w-full"
            circular
            indicator-dots
            indicator-color="rgba(255,255,255,0.4)"
            indicator-active-color="#f88ca2"
            :current="storyImageIndex"
            @change="handleOnStoryImageChange"
          >
            <swiper-item v-for="(img, imgIndex) in currentStoryImages" :key="imgIndex" class="story-images-item h-full w-full">
              <image :src="img" mode="aspectFill" class="story-image h-full w-full" @click="handlePreviewImage(imgIndex)" />
            </swiper-item>
          </swiper>
          <image v-else :src="currentStoryImages[0]" mode="aspectFill" class="story-image story-image-single h-[360rpx] w-full" @click="handlePreviewImage(0)" />
        </view>
        <scroll-view scroll-y class="story-detail-content box-border min-h-0 flex-1 px-7 py-6">
          <view class="story-html text-[28rpx] text-[#333] leading-[1.8]" v-html="currentStoryHtml" />
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

    &:last-child::before {
      display: none;
    }
  }
}
</style>
