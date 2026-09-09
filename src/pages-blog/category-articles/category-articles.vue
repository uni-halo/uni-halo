<script lang="ts" setup>
import { ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { getCategoryPostList } from '@/api/halo'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import type { IPost, IPostListReq } from '@/api/types/halo'

definePage({
  style: {
    navigationBarTitleText: '分类详情',
    enablePullDownRefresh: true,
    navigationStyle: 'custom',
  },
})

const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()
const queryParams = ref({ size: 10, page: 0 })
const name = ref('')
const pageTitle = ref('加载中...')
const navbarTitle = ref('分类详情')
const hasNext = ref(false)
const dataList = ref<IPost[]>([])
const isLoadMore = ref(false)
const loadMoreText = ref('')

/* ---------------- 排序切换(sort 参数由接口透传,见 IPostListReq.sort) ---------------- */
const sortOptions: { key: string; label: string; sort?: string[] }[] = [
  { key: 'default', label: '默认' },
  { key: 'pinned', label: '按置顶', sort: ['spec.pinned,desc'] },
  { key: 'latest', label: '按最新', sort: ['metadata.creationTimestamp,desc'] },
  { key: 'oldest', label: '按最旧', sort: ['metadata.creationTimestamp,asc'] },
]
const activeSort = ref('default')

function handleSortChange(key: string) {
  if (activeSort.value === key)
    return
  activeSort.value = key
  isLoadMore.value = false
  queryParams.value.page = 0
  handleGetData()
}

async function handleGetData() {
  if (!isLoadMore.value) {
    updateLoadingStatus(DataLoadingStatusEnum.Loading)
  }
  loadMoreText.value = '加载中...'

  try {
    const reqParams: Record<string, unknown> = { ...queryParams.value }
    const currentSort = sortOptions.find(opt => opt.key === activeSort.value)?.sort
    if (currentSort) {
      reqParams.sort = currentSort
    }
    else {
      delete reqParams.sort
    }
    const res = await getCategoryPostList(name.value, reqParams as IPostListReq)
    navbarTitle.value = `${pageTitle.value} （共${res.data.total}篇）`
    hasNext.value = res.data.hasNext
    dataList.value = isLoadMore.value
      ? dataList.value.concat(res.data.items)
      : res.data.items
    loadMoreText.value = res.data.hasNext ? '上拉加载更多' : '呜呜，没有更多数据啦~'
    setTimeout(() => {
      updateLoadingStatus(
        dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success,
      )
    }, 500)
  }
  catch (err) {
    console.error(err)
    updateLoadingStatus(DataLoadingStatusEnum.Error)
    loadMoreText.value = '加载失败，请下拉刷新！'
  }
  finally {
    setTimeout(() => {
      uni.stopPullDownRefresh()
    }, 500)
  }
}

function handleToArticleDetail(article: IPost) {
  uni.navigateTo({
    url: `/pages-blog/article-detail/article-detail?name=${article.metadata.name}`,
    animationType: 'slide-in-right',
  })
}

onLoad((options) => {
  name.value = options?.name || ''
  pageTitle.value = options?.title || '分类详情'
  navbarTitle.value = pageTitle.value
  handleGetData()
})

onPullDownRefresh(() => {
  isLoadMore.value = false
  queryParams.value.page = 0
  handleGetData()
})

onReachBottom(() => {
  if (hasNext.value) {
    queryParams.value.page += 1
    isLoadMore.value = true
    handleGetData()
  }
  else {
    uni.showToast({ icon: 'none', title: '没有更多数据了' })
  }
})

onShareAppMessage(() => ({
  title: pageTitle.value,
  path: `/pages-blog/category-articles/category-articles?name=${name.value}&title=${pageTitle.value}`,
}))

onShareTimeline(() => ({
  title: pageTitle.value,
  path: `/pages-blog/category-articles/category-articles?name=${name.value}&title=${pageTitle.value}`,
}))
</script>

<template>
  <view class="app-page min-h-screen w-screen flex flex-col" style="background-color: #fafafd;">
    <!-- 自定义导航 -->
    <uh-navbar :default-title="navbarTitle" title-color="text-gray-900" />

    <!-- 排序切换:默认 / 按置顶 / 按最新 / 按最旧 -->
    <view class="box-border flex items-center gap-2 px-3 py-2">
      <view
        v-for="opt in sortOptions"
        :key="opt.key"
        class="rounded-full px-3 py-1 text-xs"
        :class="activeSort === opt.key ? 'bg-secondary font-bold' : 'uh-global-card-glass shadow-none border text-gray-500'"
        @click="handleSortChange(opt.key)"
      >
        {{ opt.label }}
      </view>
    </view>

    <!-- 加载/错误/空占位(状态机) -->
    <view v-if="loadingStatus !== 'success'">
      <uh-data-loading
        :loading-status="loadingStatus"
        empty-text="该分类下暂无文章"
        @refresh="handleGetData"
      />
    </view>

    <block v-else>
      <view class="box-border flex flex-col gap-y-3 p-3">
        <uh-article-card
          v-for="(article, index) in dataList"
          :key="index"
          :article="article"
          @on-click="handleToArticleDetail"
        />
        <view class="load-text py-5 text-center text-[24rpx] text-[#999]">
          {{ loadMoreText }}
        </view>
      </view>
    </block>
  </view>
</template>

<style scoped>
.app-page {
  /* 布局全部由 UnoCSS 原子类实现 */
}
</style>
