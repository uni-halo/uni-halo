<script lang="ts" setup>
/**
 * 分类详情页(源自旧项目 pagesA/category-detail,新建复刻)
 * 展示某分类下的文章列表,分页加载
 */
import { ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { getCategoryPostList } from '@/api/halo'
import type { IPost } from '@/api/types/halo'

definePage({
  style: {
    navigationBarTitleText: '分类详情',
    enablePullDownRefresh: true,
  },
})

const loading = ref<'loading' | 'success' | 'error'>('loading')
const queryParams = ref({ size: 10, page: 0 })
const name = ref('')
const pageTitle = ref('加载中...')
const hasNext = ref(false)
const dataList = ref<IPost[]>([])
const isLoadMore = ref(false)
const loadMoreText = ref('')

async function handleGetData() {
  if (!isLoadMore.value) {
    loading.value = 'loading'
  }
  loadMoreText.value = '加载中...'

  try {
    const res = await getCategoryPostList(name.value, { ...queryParams.value })
    uni.setNavigationBarTitle({ title: `${pageTitle.value} （共${res.data.total}篇）` })
    hasNext.value = res.data.hasNext
    dataList.value = isLoadMore.value
      ? dataList.value.concat(res.data.items)
      : res.data.items
    loadMoreText.value = res.data.hasNext ? '上拉加载更多' : '呜呜，没有更多数据啦~'
    setTimeout(() => {
      loading.value = 'success'
    }, 500)
  }
  catch (err) {
    console.error(err)
    loading.value = 'error'
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

function handleToTopPage(duration = 500) {
  uni.pageScrollTo({
    scrollTop: 0,
    duration,
    fail: (err) => {
      console.error('回顶失败', err)
    },
  })
}

onLoad((options) => {
  name.value = options?.name || ''
  pageTitle.value = options?.title || '分类详情'
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
  path: `/pages-blog/category-detail/category-detail?name=${name.value}&title=${pageTitle.value}`,
}))

onShareTimeline(() => ({
  title: pageTitle.value,
  path: `/pages-blog/category-detail/category-detail?name=${name.value}&title=${pageTitle.value}`,
}))
</script>

<template>
  <view class="app-page min-h-screen w-screen flex flex-col py-6" style="background-color: #fafafd;">
    <!-- 加载/错误占位 -->
    <view v-if="loading !== 'success'">
      <uh-data-loading :loading-status="loading" @refresh="handleGetData" />
    </view>

    <block v-else>
      <view v-if="dataList.length === 0" class="empty h-[60vh] flex items-center justify-center">
        <wd-empty description="该分类下暂无文章" />
      </view>

      <block v-else>
        <uh-article-card
          v-for="(article, index) in dataList"
          :key="index"
          :article="article"
          @on-click="handleToArticleDetail"
        />
        <view class="load-text py-5 text-center text-[24rpx] text-[#999]">
          {{ loadMoreText }}
        </view>
      </block>

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
