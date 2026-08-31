<script lang="ts" setup>
/**
 * 分类页(源自旧项目 pages/tabbar/category/category.vue,新建复刻)
 * 两种视图:list(分类卡片网格)/ list-post(左侧分类导航 + 右侧文章列表)
 */
import { computed, ref, watch } from 'vue'
import { onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { getCategoryList, getCategoryPostList } from '@/api/halo'
import { useAppConfigStore } from '@/store/appConfig'
import { checkThumbnailUrl } from '@/utils/url'
import { t } from '@/locale'
import type { ICategory, IPost } from '@/api/types/halo'

definePage({
  style: {
    navigationBarTitleText: '分类',
    enablePullDownRefresh: true,
  },
})

const appConfigStore = useAppConfigStore()
const haloConfigs = computed(() => appConfigStore.configs)
const mockJson = computed(() => appConfigStore.mockJson)
const calcAuditModeEnabled = computed(() => !!haloConfigs.value.auditConfig?.auditModeEnabled)

const categoryConfig = computed(() => haloConfigs.value.pageConfig?.categoryConfig)

/* ---------------- 状态 ---------------- */
const loading = ref<'loading' | 'success' | 'error'>('loading')
const queryParams = ref({
  size: 20,
  page: 1,
  fieldSelector: ['spec.hideFromList=false'],
})
const hasNext = ref(false)
const dataList = ref<ICategory[]>([])
const categoryList = ref<ICategory[]>([])
const isLoadMore = ref(false)
const loadMoreText = ref(t('common.loading'))
const currentCategoryConfig = ref<{ type?: string }>({ type: 'list' })
const currentCategoryName = ref('')
const postQueryParams = ref({ size: 10, page: 0 })
const postList = ref<IPost[]>([])

/* ---------------- 计算属性 ---------------- */
const calcShowType = computed(() => currentCategoryConfig.value.type)

/* ---------------- 视图切换 ---------------- */
function handleChangeShowType() {
  currentCategoryConfig.value.type = calcShowType.value === 'list-post' ? 'list' : 'list-post'
  handleInitPage()
}

function handleResetInit() {
  postList.value = []
  dataList.value = []
  categoryList.value = []
  queryParams.value.page = 1
  postQueryParams.value.page = 0
  hasNext.value = false
  isLoadMore.value = false
  loadMoreText.value = t('common.loading')
  currentCategoryName.value = ''
}

function handleInitPage() {
  handleResetInit()
  if (calcShowType.value === 'list-post') {
    queryParams.value.size = 99999
  }
  handleGetData()
}

/* ---------------- 数据加载 ---------------- */
async function handleGetData() {
  if (calcAuditModeEnabled.value) {
    currentCategoryConfig.value.type = 'list'
    const categoryMock = mockJson.value.category as { list?: { title?: string, cover?: string }[] } | undefined
    dataList.value = (categoryMock?.list || []).map(item => ({
      metadata: { name: String(Date.now() * Math.random()) },
      spec: {
        displayName: item.title || '',
        slug: '',
        priority: 0,
        cover: checkThumbnailUrl(item.cover, true),
      },
      postCount: 0,
    }))
    loading.value = 'success'
    loadMoreText.value = t('common.noMore')
    uni.hideLoading()
    uni.stopPullDownRefresh()
    return
  }

  uni.showLoading({ mask: true, title: t('common.loading') })
  if (!isLoadMore.value) {
    loading.value = 'loading'
  }
  loadMoreText.value = t('common.loading')

  try {
    const res = await getCategoryList({ ...queryParams.value })

    if (calcShowType.value === 'list') {
      loading.value = 'success'
      loadMoreText.value = res.data.hasNext ? t('common.loadMore') : t('common.noMore')
      hasNext.value = res.data.hasNext

      const tempItems = res.data.items.map(item => ({
        ...item,
        postCount: item.postCount ?? 0,
        spec: { ...item.spec, cover: checkThumbnailUrl(item.spec.cover, true) },
      }))

      dataList.value = isLoadMore.value
        ? dataList.value.concat(tempItems)
        : tempItems
    }
    else {
      dataList.value = res.data.items
      categoryList.value = res.data.items.map(item => ({
        ...item,
        postCount: item.postCount ?? 0,
      }))
      loading.value = 'success'
      if (dataList.value.length !== 0) {
        currentCategoryName.value = dataList.value[0].metadata.name
        handleGetPostByCategory()
      }
    }
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

/** 获取当前分类下的文章 */
async function handleGetPostByCategory(isPulldownRefresh = true) {
  if (!isPulldownRefresh) {
    if (hasNext.value) {
      postQueryParams.value.page += 1
    }
    else {
      uni.showToast({ icon: 'none', title: t('common.noMoreData') })
      return
    }
  }
  else {
    postQueryParams.value.page = 0
  }

  try {
    const res = await getCategoryPostList(currentCategoryName.value, postQueryParams.value)
    hasNext.value = res.data.hasNext
    postList.value = isPulldownRefresh
      ? res.data.items
      : postList.value.concat(res.data.items)
    loadMoreText.value = res.data.hasNext ? t('common.loadMore') : t('common.noMore')
  }
  catch (err) {
    loadMoreText.value = t('common.loadFailedShort')
    console.error(err)
  }
}

/* ---------------- 交互 ---------------- */
function handleOnCategoryChange(e: { detail: { current: number } }) {
  const index = e.detail.current
  if (!dataList.value[index])
    return
  currentCategoryName.value = dataList.value[index].metadata.name
  postList.value = []
  handleGetPostByCategory()
}

function handleToCategory(category: ICategory) {
  if (calcAuditModeEnabled.value)
    return
  uni.navigateTo({
    url: `/pages-blog/category-detail/category-detail?name=${category.metadata.name}&title=${category.spec.displayName}`,
  })
}

function handleToArticleDetail(post: IPost) {
  uni.navigateTo({
    url: `/pages-blog/article-detail/article-detail?name=${post.metadata.name}`,
    animationType: 'slide-in-right',
  })
}

function handleScrollTop() {
  uni.pageScrollTo({ scrollTop: 0, duration: 500 })
}

/* ---------------- 生命周期 ---------------- */
watch(categoryConfig, (newVal) => {
  if (!newVal)
    return
  currentCategoryConfig.value = newVal
  uni.setNavigationBarTitle({ title: t('page.category.title') })
  handleInitPage()
}, { deep: true, immediate: true })

onPullDownRefresh(() => {
  isLoadMore.value = false
  queryParams.value.page = 1
  handleGetData()
})

onReachBottom(() => {
  if (calcAuditModeEnabled.value) {
    uni.showToast({ icon: 'none', title: t('common.noMoreData') })
    return
  }
  if (hasNext.value) {
    if (calcShowType.value === 'list') {
      queryParams.value.page += 1
      isLoadMore.value = true
      handleGetData()
    }
    else {
      postQueryParams.value.page += 1
      handleGetPostByCategory(false)
    }
  }
  else {
    uni.showToast({ icon: 'none', title: t('common.noMoreData') })
  }
})
</script>

<template>
  <view class="app-page min-h-screen w-screen flex flex-col" :style="{ padding: calcShowType === 'list-post' ? '0' : '24rpx 0' }">
    <!-- 骨架屏 -->
    <view v-if="loading !== 'success'" class="loading-wrap px-3">
      <wd-skeleton :row="3" :animated="true" />
    </view>

    <!-- 内容区域 -->
    <view v-else class="app-page-content flex flex-wrap gap-y-5 px-1.5" :class="[calcShowType === 'list-post' ? 'list-post' : '']">
      <view v-if="dataList.length === 0" class="h-[70vh] flex items-center justify-center content-empty">
        <wd-empty :description="t('common.empty')" />
      </view>

      <block v-else>
        <!-- list 视图:分类卡片网格 -->
        <block v-if="calcAuditModeEnabled || calcShowType === 'list'">
          <view
            v-for="(item, index) in dataList"
            :key="index"
            class="catgory-card box-border w-1/2 p-1"
            :style="{ backgroundImage: `url(${item.spec.cover})` }"
          >
            <view class="catgory-card-content h-[200rpx] flex flex-col items-center justify-center overflow-hidden rounded-xl shadow-sm" @click="handleToCategory(item)">
              <view class="catgory-name z-2 text-[32rpx] text-white">
                {{ item.spec.displayName }}
              </view>
              <view v-if="!calcAuditModeEnabled" class="catgory-count z-2 mt-1 text-[24rpx] text-white">
                共 {{ item.postCount }} 篇文章
              </view>
            </view>
          </view>
          <view class="load-text w-full py-5 text-center text-[24rpx] text-[#999]">
            {{ loadMoreText }}
          </view>
        </block>

        <!-- list-post 视图:左侧分类 + 右侧文章 -->
        <view v-else class="list-post-wrapper min-h-screen w-screen flex">
          <scroll-view class="left-nav w-[180rpx] shrink-0 bg-white" :scroll-y="true">
            <view
              v-for="(item, index) in categoryList"
              :key="item.metadata.name"
              class="left-nav-item border-l-4 px-4 py-8 text-center text-[26rpx] text-[#606266]"
              :class="{ active: currentCategoryName === item.metadata.name }"
              @click="handleOnCategoryChange({ detail: { current: index } })"
            >
              {{ item.spec.displayName }}
            </view>
          </scroll-view>

          <scroll-view class="right-content box-border h-screen flex-1" :scroll-y="true">
            <view v-if="postList.length === 0" class="article-empty flex items-center justify-center py-10">
              <wd-empty description="该分类下暂无文章~" />
            </view>
            <block v-else>
              <uh-article-min-card
                v-for="(post, index) in postList"
                :key="index"
                :article="post"
                @on-click="handleToArticleDetail"
              />
              <view class="load-text w-full py-5 text-center text-[24rpx] text-[#999]">
                {{ loadMoreText }}
              </view>
            </block>
          </scroll-view>
        </view>
      </block>
    </view>

    <!-- 悬浮按钮 -->
    <view class="flot-buttons fixed bottom-[100rpx] right-8 z-999 flex flex-col gap-1.5">
      <view class="fab-btn h-[72rpx] w-[72rpx] flex items-center justify-center rounded-full bg-white shadow-sm" @click="handleScrollTop">
        <wd-icon name="arrow-up" size="20px" color="#03a9f4" />
      </view>
      <view v-if="!calcAuditModeEnabled" class="fab-btn h-[72rpx] w-[72rpx] flex items-center justify-center rounded-full bg-white shadow-sm" @click="handleChangeShowType">
        <wd-icon :name="calcShowType === 'list' ? 'list' : 'grid'" size="20px" color="#03a9f4" />
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.app-page {
  width: 100vw;
}

.app-page-content {
  &.list-post {
    padding: 0;
    gap: 0;
  }
}

.catgory-card {
  > view {
    position: relative;
    background-repeat: no-repeat;
    background-size: cover;
    background-position: center;
  }

  .catgory-card-content::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    background-color: rgb(0 0 0 / 15%);
    backdrop-filter: blur(3rpx);
    z-index: 1;
  }
}

.list-post-wrapper {
  .left-nav {
    .left-nav-item {
      border-left-color: transparent;

      &.active {
        color: #03a9f4;
        border-left-color: #03a9f4;
        background-color: #f5f7fa;
        font-weight: bold;
      }
    }
  }
}

.flot-buttons {
  .fab-btn {
    box-shadow: 0 4rpx 16rpx rgb(0 0 0 / 10%);
  }
}
</style>
