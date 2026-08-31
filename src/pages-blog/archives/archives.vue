<script lang="ts" setup>
/**
 * 归档页(源自旧项目 pagesA/archives,新建复刻)
 * 按月份/年份分组展示文章时间线
 */
import { computed, ref } from 'vue'
import { onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import dayjs from 'dayjs'
import { getPostList } from '@/api/halo'
import { useAppConfigStore } from '@/store/appConfig'
import { useSettingStore } from '@/store/setting'
import { checkThumbnailUrl } from '@/utils/url'
import { formatTime as formatTimeUtil } from '@/utils/formatTime'
import type { IPost } from '@/api/types/halo'

definePage({
  style: {
    navigationBarTitleText: '归档',
    enablePullDownRefresh: true,
  },
})

const appConfigStore = useAppConfigStore()
const settingStore = useSettingStore()

const calcAuditModeEnabled = computed(() => !!appConfigStore.configs.auditConfig?.auditModeEnabled)
const mockJson = computed(() => appConfigStore.mockJson)
const globalAppSettings = computed(() => settingStore.settings)

/* ---------------- 状态 ---------------- */
const loading = ref<'loading' | 'success' | 'error'>('loading')
const tab = ref({ activeIndex: 0, list: ['按月份查看', '按年份查看'] })
const queryParams = ref({ size: 10, page: 1 })
const result = ref<{ hasNext: boolean }>({ hasNext: false })
const cacheDataList = ref<IPost[]>([])
const dataList = ref<{
  sort: number
  key: string
  year: string
  month: string
  posts: IPost[]
}[]>([])
const isLoadMore = ref(false)
const loadMoreText = ref('加载中...')

const postLabelYearKey = 'content.halo.run/archive-year'
const postLabelMonthKey = 'content.halo.run/archive-month'

/* ---------------- 数据处理 ---------------- */
/** 按 tab 分组文章 */
function handleGetPosts(list: IPost[]): Record<string, IPost[]> {
  const posts: Record<string, IPost[]> = {}
  list.forEach((item) => {
    const labels = item.metadata.labels || {}
    let postItemKey = ''
    if (tab.value.activeIndex === 0) {
      postItemKey = `${labels[postLabelYearKey]}-${labels[postLabelMonthKey]}`
    }
    else {
      postItemKey = `${labels[postLabelYearKey]}`
    }
    if (posts[postItemKey]) {
      posts[postItemKey].push(item)
    }
    else {
      posts[postItemKey] = [item]
    }
  })
  return posts
}

/** 处理成显示数据(分组 + 排序) */
function handleGetShowDataList(posts: Record<string, IPost[]>): typeof dataList.value {
  const listResult: typeof dataList.value = []
  Object.keys(posts).forEach((key) => {
    const postData = {
      sort: 0,
      key,
      year: key,
      month: '',
      posts: posts[key],
    }
    if (tab.value.activeIndex === 0) {
      const splitDate = key.split('-')
      postData.year = splitDate[0]
      postData.month = splitDate[1]
      postData.sort = Number(key.replace('-', ''))
    }
    else {
      postData.sort = Number(key)
    }
    listResult.push(postData)
  })
  listResult.sort((a, b) => Number(b.sort) - Number(a.sort))
  return listResult
}

/** 去重缓存列表 */
function handleUniqueCacheDatalist(list: IPost[]): IPost[] {
  const seen = new Set<string>()
  return list.filter((item) => {
    return seen.has(item.metadata.name) ? false : (seen.add(item.metadata.name), true)
  })
}

/* ---------------- 数据加载 ---------------- */
async function handleGetData() {
  if (calcAuditModeEnabled.value) {
    const archivesMock = mockJson.value.archives as { list?: { time?: string, cover?: string, title?: string, desc?: string }[] } | undefined
    const dataListMock: IPost[] = (archivesMock?.list || []).map((item) => {
      const date = new Date(item.time || Date.now())
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      return {
        metadata: {
          name: String(Date.now() * Math.random()),
          labels: {
            [postLabelYearKey]: String(year),
            [postLabelMonthKey]: String(month),
          },
        },
        spec: {
          title: item.title || '',
          slug: '',
          cover: item.cover,
          pinned: false,
          publishTime: item.time,
          deleted: false,
          publish: true,
          allowComment: true,
          visible: 'PUBLIC',
          priority: 0,
          categories: [],
          tags: [],
        },
        status: { permalink: '', inProgress: false, excerpt: item.desc },
        stats: { visit: 0 },
      }
    })
    const posts = handleGetPosts(dataListMock)
    dataList.value = handleGetShowDataList(posts)
    cacheDataList.value = dataListMock
    loading.value = 'success'
    loadMoreText.value = '呜呜，没有更多数据啦~'
    uni.hideLoading()
    uni.stopPullDownRefresh()
    return
  }

  if (isLoadMore.value) {
    uni.showLoading({ title: '加载中...' })
  }
  else {
    loading.value = 'loading'
  }
  loadMoreText.value = '加载中...'

  try {
    const data = await getPostList({ ...queryParams.value })
    result.value = { hasNext: data.hasNext }
    const posts = handleGetPosts(data.items)
    const showDataList = handleGetShowDataList(posts)

    if (isLoadMore.value) {
      cacheDataList.value = handleUniqueCacheDatalist([...cacheDataList.value, ...data.items])
      // 合并增量数据
      showDataList.forEach((item) => {
        const find = dataList.value.find(x => x.key === item.key)
        if (find) {
          item.posts.forEach((post) => {
            if (!find.posts.some(x => x.metadata.name === post.metadata.name)) {
              find.posts.push(post)
            }
          })
        }
      })
      showDataList.forEach((post) => {
        if (!dataList.value.some(x => x.key === post.key)) {
          dataList.value.push(post)
        }
      })
      dataList.value.sort((a, b) => Number(b.sort) - Number(a.sort))
    }
    else {
      dataList.value = showDataList
      cacheDataList.value = data.items
    }

    loading.value = 'success'
    loadMoreText.value = data.hasNext ? '上拉加载更多' : '呜呜，没有更多数据啦~'
  }
  catch (err) {
    console.error(err)
    loading.value = 'error'
    loadMoreText.value = '加载失败，请下拉刷新！'
  }
  finally {
    uni.hideLoading()
    uni.stopPullDownRefresh()
  }
}

function handleOnTabChange(index: number) {
  tab.value.activeIndex = index
  queryParams.value.page = 1
  dataList.value = handleGetShowDataList(handleGetPosts(cacheDataList.value))
  uni.pageScrollTo({ scrollTop: 0, duration: 500 })
}

function handleToArticleDetail(article: IPost) {
  if (calcAuditModeEnabled.value)
    return
  uni.navigateTo({
    url: `/pages-blog/article-detail/article-detail?name=${article.metadata.name}`,
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

function formatTime(time?: string): string {
  // 与旧项目一致:yyyy年MM月dd日 星期w
  return time ? formatTimeUtil({ d: time, f: 'yyyy年MM月dd日 星期w' }) : ''
}

/* ---------------- 生命周期 ---------------- */
handleGetData()

onPullDownRefresh(() => {
  isLoadMore.value = false
  queryParams.value.page = 1
  handleGetData()
})

onReachBottom(() => {
  if (calcAuditModeEnabled.value) {
    uni.showToast({ icon: 'none', title: '没有更多数据了' })
    return
  }
  if (result.value.hasNext) {
    queryParams.value.page += 1
    isLoadMore.value = true
    handleGetData()
  }
  else {
    uni.showToast({ icon: 'none', title: '没有更多数据了' })
  }
})
</script>

<template>
  <view class="app-page min-h-screen w-screen flex flex-col" style="background-color: #fafafd;">
    <!-- 顶部 tab -->
    <view class="archive-tabs fixed inset-x-0 top-0 z-6 bg-white">
      <wd-tabs
        v-model="tab.activeIndex"
        :tabs="tab.list.map(title => ({ title }))"
        align="center"
        @change="handleOnTabChange"
      />
    </view>
    <view class="h-[90rpx] w-screen" />

    <!-- 骨架屏 -->
    <view v-if="loading !== 'success'" class="loading-wrap p-3">
      <wd-skeleton :row="3" :animated="true" />
    </view>

    <!-- 内容区域 -->
    <block v-else>
      <view v-if="dataList.length === 0" class="list-empty h-screen w-screen flex items-center justify-center">
        <wd-empty :description="calcAuditModeEnabled ? '暂无归档的内容' : '暂无归档的文章'" />
      </view>

      <view v-else class="timeline mt-6 px-6">
        <view v-for="(item, index) in dataList" :key="item.key" class="timeline-item flex">
          <view class="timeline-left w-[160rpx] flex shrink-0 flex-col items-center">
            <view class="timeline-dot mt-1 h-6 w-6 rounded-full" style="background-color: #64b5f6; box-shadow: 0 4rpx 12rpx rgb(100 181 246 / 40%);" />
            <view v-if="index !== dataList.length - 1" class="timeline-line mt-1 w-0.5 flex-1 bg-[#e0e0e0]" />
          </view>
          <view class="timeline-content flex-1 pb-12 pl-6">
            <view class="time mb-6 flex items-center font-bold">
              <text class="time-text text-[30rpx]">{{ item.year }}年</text>
              <text v-if="tab.activeIndex === 0" class="time-text text-[30rpx]">{{ item.month }}月</text>
              <text class="time-count ml-3 text-[22rpx] text-[#999] font-normal">（共 {{ item.posts.length }} 篇{{ calcAuditModeEnabled ? '内容' : '文章' }}）</text>
            </view>

            <view v-if="item.posts.length !== 0">
              <view
                v-for="post in item.posts"
                :key="post.metadata.name"
                class="post mb-6 flex rounded-xl bg-white p-6 shadow-sm"
                :class="[globalAppSettings.layout.cardType]"
                @click="handleToArticleDetail(post)"
              >
                <image class="post-thumbnail h-[170rpx] w-[200rpx] shrink-0 rounded-lg" :src="checkThumbnailUrl(post.spec.cover)" mode="aspectFill" lazy-load />
                <view class="post-info w-0 flex-1 pl-5">
                  <view class="post-info-title text-overflow text-[28rpx] text-[#303133] font-bold">
                    {{ post.spec.title }}
                  </view>
                  <view class="post-info-summary line-clamp-2 mt-3 text-[24rpx] text-[#909399]">
                    {{ post.status?.excerpt }}
                  </view>
                  <view class="post-info-time mt-3 text-[24rpx] text-[#909399]">
                    发布时间：{{ formatTime(post.spec.publishTime) }}
                  </view>
                </view>
              </view>
            </view>
            <view v-else class="post-empty py-6 text-[26rpx] text-[#909399]">
              该日期下暂无归档文章！
            </view>
          </view>
        </view>
      </view>

      <view class="load-text pb-6 text-center text-[24rpx] text-[#999]">
        {{ loadMoreText }}
      </view>
      <view class="to-top-btn fixed bottom-[100rpx] right-6 z-6 h-[72rpx] w-[72rpx] flex items-center justify-center rounded-full bg-white shadow-sm" @click="handleToTopPage()">
        <wd-icon name="arrow-up" size="20px" color="#03a9f4" />
      </view>
    </block>
  </view>
</template>

<style scoped lang="scss">
.app-page {
  /* 布局全部由 UnoCSS 原子类实现 */
}

.timeline {
  .post {
    &.tb_image_text,
    &.tb_text_image {
      flex-direction: column;

      .post-thumbnail {
        width: 100%;
        height: 220rpx;
      }

      .post-info {
        width: 100%;
        padding-left: 0;
      }
    }

    &.lr_text_image {
      .post-thumbnail {
        order: 2;
      }

      .post-info {
        order: 1;
        padding-left: 0;
        padding-right: 24rpx;
      }
    }

    &.only_text {
      .post-thumbnail {
        display: none;
      }

      .post-info {
        padding: 6rpx;
      }
    }
  }
}
</style>
