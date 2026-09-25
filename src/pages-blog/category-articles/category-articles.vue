<script lang="ts" setup>
import { computed, ref } from 'vue'
import { onLoad, onPageScroll, onPullDownRefresh, onReachBottom, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { getCategoryPostList } from '@/api/halo'
import { sleep } from '@/utils/common'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { usePageScroll } from '@/hooks/usePageScroll'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useNavbarSticky } from '@/hooks/useNavbarSticky'
import { useSettingStore } from '@/store/setting'
import { storeToRefs } from 'pinia'
import type { IPost, IPostListReq } from '@/api/types/halo'

definePage({
  style: {
    navigationBarTitleText: '分类详情',
    enablePullDownRefresh: true,
    navigationStyle: 'custom',
  },
})

const { scrollY, updatePageScrollValue } = usePageScroll()
/** 吸顶偏移 = 自定义导航栏高度(与 notice/votes 等列表页同用法) */
const { height: offsetTop } = useNavbarSticky()
/** 分类笔记列表页默认标题（插件端可配置，动态分类名加载后覆盖） */
const configTitle = usePageTitle('categoryArticles', '分类详情')
const { settings } = storeToRefs(useSettingStore())
/** 列表布局(偏好设置驱动:single=单列 / double=双列) */
const listLayout = computed(() => settings.value.categoryArticlesListLayout)
const { loadingStatus, loadMoreStatus, updateLoadingStatus, updateLoadMoreStatus, resetLoadMoreStatus } = useDataLoadingStatus()
const queryParams = ref({ size: 10, page: 0 })
const name = ref('')
const pageTitle = ref('加载中...')
const navbarTitle = ref(configTitle.value)
const dataList = ref<IPost[]>([])

/* ---------------- 排序切换(sort 参数由接口透传,见 IPostListReq.sort) ---------------- */
const sortOptions: { key: string, label: string, sort?: string[] }[] = [
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
  resetLoadMoreStatus()
  queryParams.value.page = 0
  handleGetData()
}

async function handleGetData() {
  if (!loadMoreStatus.value.active) {
    updateLoadingStatus(DataLoadingStatusEnum.Loading)
  }

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
    dataList.value = loadMoreStatus.value.active
      ? dataList.value.concat(res.data.items)
      : res.data.items
    if (!loadMoreStatus.value.active) {
      await sleep(600)
      updateLoadingStatus(
        dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success,
      )
    }
    updateLoadMoreStatus({
      active: false,
      status: res.data.hasNext ? 'loadMore' : 'noMore',
      hasNext: res.data.hasNext,
    })
  }
  catch (err) {
    console.error(err)
    if (loadMoreStatus.value.active) {
      updateLoadMoreStatus({
        active: false,
        status: 'error',
      })
    }
    else {
      updateLoadingStatus(DataLoadingStatusEnum.Error)
    }
  }
  finally {
    uni.stopPullDownRefresh()
  }
}

function handleToArticleDetail(article: IPost) {
  uni.navigateTo({
    url: `/pages-blog/article-detail/article-detail?name=${article.metadata.name}`,
    animationType: 'slide-in-right',
  })
}

onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})

onLoad((options) => {
  name.value = options?.name || ''
  pageTitle.value = options?.title || configTitle.value
  navbarTitle.value = pageTitle.value
  handleGetData()
})

onPullDownRefresh(() => {
  resetLoadMoreStatus()
  queryParams.value.page = 0
  handleGetData()
})

onReachBottom(() => {
  // 正在加载时阻止重复请求
  if (loadMoreStatus.value.active) {
    return
  }
  // 有更多数据时继续加载
  if (loadMoreStatus.value.hasNext) {
    queryParams.value.page += 1
    updateLoadMoreStatus({
      active: true,
      status: 'loading',
    })
    handleGetData()
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
  <view class="app-page min-h-screen w-screen flex flex-col bg-[#fafafd]">
    <!-- 自定义导航 -->
    <uh-navbar :scroll-y="scrollY" :default-title="navbarTitle" title-color="text-gray-900" />

    <!-- 排序切换吸顶 -->
    <wd-sticky :offset-top="offsetTop">
      <view class="box-border w-screen flex items-center gap-2 px-3 py-2">
        <view
          v-for="opt in sortOptions" :key="opt.key" class="uh-global-card-glass uh-shadow-xs box-border border rounded-full px-3 py-1 text-xs"
          :class="activeSort === opt.key ? '!bg-secondary font-bold' : 'text-gray-500'"
          @click="handleSortChange(opt.key)"
        >
          {{ opt.label }}
        </view>
      </view>
    </wd-sticky>

    <!-- 加载/错误/空占位(状态机) -->
    <view v-if="loadingStatus !== 'success'">
      <uh-data-loading :loading-status="loadingStatus" empty-text="该分类下暂无笔记" min-height="65vh" @refresh="handleGetData" />
    </view>

    <block v-else>
      <view :class="listLayout === 'double' ? 'grid grid-cols-2 gap-3 p-3' : 'box-border flex flex-col gap-y-3 p-3'">
        <uh-article-card
          v-for="(article, index) in dataList" :key="index" :article="article"
          :variant="listLayout === 'double' ? 'grid' : 'list'" @on-click="handleToArticleDetail"
        />
        <uh-data-loadmore :status="loadMoreStatus.status" :text="loadMoreStatus.text" />
      </view>
    </block>
  </view>
</template>
