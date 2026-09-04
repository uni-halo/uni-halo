<script lang="ts" setup>
/**
 * 归档页(源自旧项目 pagesA/archives,新建复刻)
 * 按月份/年份分组展示文章时间线
 */
import { computed, ref } from 'vue'
import { onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { getPostList } from '@/api/halo'
import { useAppConfigStore } from '@/store/appConfig'
import { useSettingStore } from '@/store/setting'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { checkThumbnailUrl } from '@/utils/url'
import { formatTime as formatTimeUtil } from '@/utils/formatTime'
import type { IPost } from '@/api/types/halo'

definePage({
  style: {
    navigationBarTitleText: '归档',
    enablePullDownRefresh: true,
    navigationStyle: 'custom',
  },
})

const appConfigStore = useAppConfigStore()
const settingStore = useSettingStore()

const calcAuditModeEnabled = computed(() => appConfigStore.auditModeEnabled)
const globalAppSettings = computed(() => settingStore.settings)

/* ---------------- 状态 ---------------- */
const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()
const activeTabIndex = ref(0)
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

/** 卡片布局偏好 → 原子类(对应旧版 cardType 样式变体) */
const CARD_LAYOUTS: Record<string, { card: string, thumb: string, info: string }> = {
  lr_image_text: { card: '', thumb: 'h-[170rpx] w-[200rpx]', info: 'w-0 flex-1 pl-5' },
  lr_text_image: { card: '', thumb: 'order-2 h-[170rpx] w-[200rpx]', info: 'order-1 w-0 flex-1 pr-5' },
  tb_image_text: { card: 'flex-col', thumb: 'h-[220rpx] w-full', info: 'w-full pt-3' },
  tb_text_image: { card: 'flex-col', thumb: 'order-2 h-[220rpx] w-full', info: 'order-1 w-full pb-3' },
  only_text: { card: '', thumb: 'hidden', info: 'py-1' },
}

const calcCardLayout = computed(() => CARD_LAYOUTS[globalAppSettings.value.layout.cardType] || CARD_LAYOUTS.lr_image_text)

/* ---------------- 数据处理 ---------------- */
/** 按 tab 分组文章 */
function handleGetPosts(list: IPost[]): Record<string, IPost[]> {
  const posts: Record<string, IPost[]> = {}
  list.forEach((item) => {
    const labels = item.metadata.labels || {}
    let postItemKey = ''
    if (activeTabIndex.value === 0) {
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
    if (activeTabIndex.value === 0) {
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
    // 审核模式:真实文章按 audit-data posts 过滤(数组顺序即展示顺序)
    const auditPostNames = appConfigStore.auditData.spec?.posts || []
    try {
      const res = await getPostList({ page: 1, size: 99999, sort: ['spec.publishTime,desc'] })
      const filtered = res.data.items.filter(item => auditPostNames.includes(item.metadata.name))
      const orderMap = new Map(auditPostNames.map((name, index) => [name, index]))
      filtered.sort((a, b) => (orderMap.get(a.metadata.name) ?? 999) - (orderMap.get(b.metadata.name) ?? 999))
      const posts = handleGetPosts(filtered)
      dataList.value = handleGetShowDataList(posts)
      cacheDataList.value = filtered
      updateLoadingStatus(
        dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success,
      )
      loadMoreText.value = '呜呜，没有更多数据啦~'
      uni.hideLoading()
      uni.stopPullDownRefresh()
    }
    catch (err) {
      console.error(err)
      updateLoadingStatus(DataLoadingStatusEnum.Error)
      loadMoreText.value = '加载失败，请下拉刷新！'
    }
    return
  }

  if (isLoadMore.value) {
    uni.showLoading({ title: '加载中...' })
  }
  else {
    updateLoadingStatus(DataLoadingStatusEnum.Loading)
  }
  loadMoreText.value = '加载中...'

  try {
    // getPostList 返回 IResponse<IPostListRes>,数据在 .data 下
    const res = await getPostList({ ...queryParams.value })
    result.value = { hasNext: res.data.hasNext }
    const posts = handleGetPosts(res.data.items)
    const showDataList = handleGetShowDataList(posts)

    if (isLoadMore.value) {
      cacheDataList.value = handleUniqueCacheDatalist([...cacheDataList.value, ...res.data.items])
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
      cacheDataList.value = res.data.items
    }

    updateLoadingStatus(
      dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success,
    )
    loadMoreText.value = res.data.hasNext ? '上拉加载更多' : '呜呜，没有更多数据啦~'
  }
  catch (err) {
    console.error(err)
    updateLoadingStatus(DataLoadingStatusEnum.Error)
    loadMoreText.value = '加载失败，请下拉刷新！'
  }
  finally {
    uni.hideLoading()
    uni.stopPullDownRefresh()
  }
}

/** 顶部 tab 定义(同收藏页胶囊 chip) */
const archiveTabs = [
  { key: 'month', label: '按月份查看' },
  { key: 'year', label: '按年份查看' },
]

function handleOnTabChange(e: { index: number }) {
  activeTabIndex.value = e.index
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
  <view class="app-page min-h-screen w-screen flex flex-col bg-page">
    <!-- 自定义导航 -->
    <uh-navbar default-title="归档" title-color="text-gray-900" />

    <!-- 顶部 tab(吸顶玻璃胶囊 chip,同收藏页) -->
    <wd-sticky>
      <scroll-view scroll-x class="w-full whitespace-nowrap">
        <view class="flex gap-2 px-3 pb-1 pt-3">
          <view
            v-for="(tab, index) in archiveTabs" :key="tab.key"
            class="uh-global-card-glass uh-shadow-xs inline-block border rounded-2xl px-5 py-1.5 text-sm"
            :class="activeTabIndex === index ? 'bg-primary font-bold' : 'text-gray-500'"
            @click="handleOnTabChange({ index })"
          >
            {{ tab.label }}
          </view>
        </view>
      </scroll-view>
    </wd-sticky>

    <!-- 加载/错误/空占位(状态机) -->
    <view v-if="loadingStatus !== 'success'">
      <uh-data-loading
        :loading-status="loadingStatus"
        :empty-text="calcAuditModeEnabled ? '暂无归档的内容' : '暂无归档的文章'"
        @refresh="handleGetData"
      />
    </view>

    <!-- 内容区域 -->
    <block v-else>
      <!-- 时间线 -->
      <view class="timeline px-4 pt-3">
        <view v-for="(item, index) in dataList" :key="item.key" class="timeline-item flex">
          <view class="timeline-left w-[96rpx] flex shrink-0 flex-col items-center">
            <view class="timeline-dot mt-2 h-4 w-4 rounded-full bg-secondary shadow-[0_0_0_8rpx_rgba(215,249,76,0.3)]" />
            <view v-if="index !== dataList.length - 1" class="timeline-line mt-2 w-[2rpx] flex-1 bg-black/5" />
          </view>
          <view class="timeline-content min-w-0 flex-1 pb-10 pl-5">
            <view class="time mb-5 flex items-center gap-2">
              <text class="text-[32rpx] text-gray-900 font-bold">{{ item.year }}年</text>
              <text v-if="activeTabIndex === 0" class="text-[32rpx] text-gray-900 font-bold">{{ item.month }}月</text>
              <text class="rounded-full bg-secondary px-2 py-0.5 text-[20rpx] text-[#4d7c0f] leading-none">共 {{ item.posts.length }} 篇{{ calcAuditModeEnabled ? '内容' : '文章' }}</text>
            </view>

            <view v-if="item.posts.length !== 0">
              <view
                v-for="post in item.posts"
                :key="post.metadata.name"
                class="post uh-global-card-glass mb-4 flex rounded-2xl p-4"
                :class="calcCardLayout.card"
                @click="handleToArticleDetail(post)"
              >
                <image class="post-thumbnail shrink-0 rounded-lg" :class="calcCardLayout.thumb" :src="checkThumbnailUrl(post.spec.cover)" mode="aspectFill" lazy-load />
                <view class="post-info min-w-0" :class="calcCardLayout.info">
                  <view class="post-info-title overflow-hidden text-ellipsis whitespace-nowrap text-[28rpx] text-gray-900 font-bold">
                    {{ post.spec.title }}
                  </view>
                  <view class="post-info-summary line-clamp-2 mt-2 text-[24rpx] text-gray-400">
                    {{ post.status?.excerpt }}
                  </view>
                  <view class="post-info-time mt-2 text-[24rpx] text-gray-400">
                    发布时间：{{ formatTime(post.spec.publishTime) }}
                  </view>
                </view>
              </view>
            </view>
            <view v-else class="post-empty py-6 text-[26rpx] text-gray-400">
              该日期下暂无归档文章！
            </view>
          </view>
        </view>
      </view>

      <view class="load-text pb-6 text-center text-[24rpx] text-gray-400">
        {{ loadMoreText }}
      </view>
      <view class="to-top-btn uh-global-card-glass fixed bottom-[100rpx] right-6 z-6 h-[72rpx] w-[72rpx] flex items-center justify-center rounded-full" @click="handleToTopPage()">
        <wd-icon name="arrow-up" size="20px" color="#6b7280" />
      </view>
    </block>
  </view>
</template>
