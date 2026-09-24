<script lang="ts" setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { onPageScroll, onPullDownRefresh, onReachBottom, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { getPostList } from '@/api/halo'
import { useAppConfigStore } from '@/store/appConfig'
import { useSettingStore } from '@/store/setting'
import { usePageScroll } from '@/hooks/usePageScroll'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useNavbarSticky } from '@/hooks/useNavbarSticky'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { sleep } from '@/utils/common'
import type { IPost } from '@/api/types/halo'

definePage({
  style: {
    navigationBarTitleText: '归档',
    enablePullDownRefresh: true,
    navigationStyle: 'custom',
  },
})

const { height: offsetTop } = useNavbarSticky()
const { scrollY, updatePageScrollValue } = usePageScroll()
/** 页面标题（插件端可配置，留空回退内置默认） */
const pageTitle = usePageTitle('archives', '内容归档')
const appConfigStore = useAppConfigStore()
const { auditData, auditModeEnabled: calcAuditModeEnabled } = storeToRefs(appConfigStore)

const settingStore = useSettingStore()
const { settings } = storeToRefs(settingStore)

const siteName = computed(() => appConfigStore.configs.featureConfig?.profile?.appInfo?.name || 'uni-halo')

/** 归档页列表布局(偏好设置驱动:single=单列 / double=双列) */
const archivesListLayout = computed(() => settings.value.archivesListLayout)

/* ---------------- 分享 ---------------- */

onShareAppMessage(() => ({
  title: `${pageTitle.value} - ${siteName.value}`,
  path: '/pages-blog/archives/archives',
}))

onShareTimeline(() => ({
  title: `${pageTitle.value} - ${siteName.value}`,
  query: '',
}))

/* ---------------- 状态 ---------------- */
const { loadingStatus, loadMoreStatus, updateLoadingStatus, updateLoadMoreStatus, resetLoadMoreStatus } = useDataLoadingStatus()
const activeTabIndex = ref(0)
const queryParams = ref({ size: 10, page: 1 })
const cacheDataList = ref<IPost[]>([])
const dataList = ref<{
  sort: number
  key: string
  year: string
  month: string
  posts: IPost[]
}[]>([])

const postLabelYearKey = 'content.halo.run/archive-year'
const postLabelMonthKey = 'content.halo.run/archive-month'

/* ---------------- 数据处理 ---------------- */
/** 按 tab 分组笔记 */
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
    // 审核模式:真实笔记按 audit-data posts 过滤(数组顺序即展示顺序),一次拉取不分页
    resetLoadMoreStatus()
    const auditPostNames = appConfigStore.auditNamesOf('posts')
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
      updateLoadMoreStatus({
        active: false,
        status: 'noMore',
        hasNext: false,
      })
      uni.stopPullDownRefresh()
    }
    catch (err) {
      console.error(err)
      updateLoadingStatus(DataLoadingStatusEnum.Error)
      updateLoadMoreStatus({
        active: false,
        status: 'error',
      })
    }
    return
  }

  if (!loadMoreStatus.value.active) {
    updateLoadingStatus(DataLoadingStatusEnum.Loading)
  }

  try {
    // getPostList 返回 IResponse<IPostListRes>,数据在 .data 下
    const res = await getPostList({ ...queryParams.value })
    const posts = handleGetPosts(res.data.items)
    const showDataList = handleGetShowDataList(posts)

    if (loadMoreStatus.value.active) {
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
    if (!loadMoreStatus.value.active) {
      await sleep(500)
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
onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})

handleGetData()

onPullDownRefresh(() => {
  resetLoadMoreStatus()
  queryParams.value.page = 1
  handleGetData()
})

onReachBottom(() => {
  if (calcAuditModeEnabled.value) {
    uni.showToast({ icon: 'none', title: '没有更多数据了' })
    return
  }
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
</script>

<template>
  <view class="min-h-screen w-screen flex flex-col bg-page">
    <uh-navbar :scroll-y="scrollY" :default-title="pageTitle" title-color="text-gray-900" />

    <wd-sticky :offset-top="offsetTop">
      <scroll-view :scroll-x="true" :show-scrollbar="false" class="w-full whitespace-nowrap">
        <view
          v-for="(tab, index) in archiveTabs" :key="tab.key"
          class="uh-global-card-glass mb-2 ml-3 inline-flex border rounded-2xl px-4 py-1.5 text-xs shadow-none"
          :class="{ 'bg-primary text-gray-900 font-semibold': activeTabIndex === index }"
          @click="handleOnTabChange({ index })"
        >
          {{ tab.label }}
        </view>
      </scroll-view>
    </wd-sticky>

    <uh-data-loading
      v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus"
      empty-text="暂无归档的内容" min-height="65vh" @refresh="handleGetData"
    />

    <!-- 内容区域 -->
    <template v-else>
      <view class="box-border px-3 pt-4">
        <view v-for="item in dataList" :key="item.key" class="flex">
          <view class="flex-1 pb-4">
            <view class="mb-3 flex items-center gap-1">
              <text class="text-md text-gray-900 font-bold">{{ item.year }}年</text>
              <text
                v-if="activeTabIndex === 0"
                class="text-md text-gray-900 font-bold"
              >
                {{ item.month }}月
              </text>
              <text class="ml-2 rounded-full bg-secondary px-2 py-1 text-xs text-gray-900 leading-none">
                共
                {{ item.posts.length }} 篇{{ calcAuditModeEnabled ? '内容' : '笔记' }}
              </text>
            </view>

            <view
              v-if="item.posts.length !== 0"
              :class="archivesListLayout === 'double' ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-y-4'"
            >
              <uh-article-card
                v-for="post in item.posts" :key="post.metadata.name" from="archives"
                :variant="archivesListLayout === 'double' ? 'grid' : 'list'" :article="post"
                :audit-mode="calcAuditModeEnabled"
              />
            </view>
            <uh-data-loading
              v-else :loading-status="DataLoadingStatusEnum.Empty" empty-text="该分类下暂无笔记"
              @refresh="handleGetData"
            />
          </view>
        </view>
      </view>

      <uh-data-loadmore :status="loadMoreStatus.status" :text="loadMoreStatus.text" />
    </template>
  </view>
</template>
