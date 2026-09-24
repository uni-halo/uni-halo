<script lang="ts" setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { onPageScroll, onPullDownRefresh, onReachBottom, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { getCategoryList } from '@/api/halo'
import { useAppConfigStore } from '@/store/appConfig'
import { checkThumbnailUrl } from '@/utils/url'
import { sleep } from '@/utils/common'
import { usePageScroll } from '@/hooks/usePageScroll'
import { usePageTitle } from '@/hooks/usePageTitle'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import type { ICategory } from '@/api/types/halo'

definePage({
  style: {
    navigationBarTitleText: '分类',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
    backgroundColor: '#f6f3ee',
  },
})

const { scrollY, updatePageScrollValue } = usePageScroll()
/** 页面标题（插件端可配置，留空回退内置默认） */
const pageTitle = usePageTitle('category', '分类')

const appConfigStore = useAppConfigStore()

const { configs: haloConfigs, auditData, auditModeEnabled: calcAuditModeEnabled } = storeToRefs(appConfigStore)

const siteName = computed(() => haloConfigs.value.featureConfig?.profile?.appInfo?.name || 'uni-halo')

/* ---------------- 分享 ---------------- */

onShareAppMessage(() => ({
  title: `${pageTitle.value} - ${siteName.value}`,
  path: '/pages/tabbar/category/category',
}))

onShareTimeline(() => ({
  title: `${pageTitle.value} - ${siteName.value}`,
  query: '',
}))

/* ---------------- 状态 ---------------- */
const { loadingStatus, loadMoreStatus, updateLoadingStatus, updateLoadMoreStatus, resetLoadingStatus, resetLoadMoreStatus } = useDataLoadingStatus()
const queryParams = ref({
  size: 10,
  page: 1,
  fieldSelector: ['spec.hideFromList=false'],
})
const dataList = ref<ICategory[]>([])

function handleResetInit() {
  dataList.value = []
  queryParams.value.page = 1
  resetLoadingStatus()
}

function handleInitPage() {
  handleResetInit()
  handleGetData()
}

/* ---------------- 数据加载 ---------------- */
async function handleGetData() {
  if (!loadMoreStatus.value.active) {
    updateLoadingStatus(DataLoadingStatusEnum.Loading)
  }
  // 审核模式
  if (calcAuditModeEnabled.value) {
    resetLoadMoreStatus()
    const auditCategoryDetails = auditData.value.categoryDetails || []
    try {
      dataList.value = auditCategoryDetails.map(item => ({
        metadata: { name: item.name },
        spec: {
          displayName: item.title || item.name,
          slug: '',
          cover: checkThumbnailUrl(item.cover, true),
          priority: item.priority,
        },
        postCount: item.postCount ?? 0,
      } as ICategory))
      await sleep(600)
      updateLoadingStatus(dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
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
    }
    return
  }

  try {
    const res = await getCategoryList({ ...queryParams.value })

    const tempItems = res.data.items.map(item => ({
      ...item,
      postCount: item.postCount ?? 0,
      spec: { ...item.spec, cover: checkThumbnailUrl(item.spec.cover, true) },
    }))

    dataList.value = loadMoreStatus.value.active
      ? dataList.value.concat(tempItems)
      : tempItems

    if (!loadMoreStatus.value.active) {
      await sleep(600)
      updateLoadingStatus(dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
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

function handleToCategory(category: ICategory) {
  if (calcAuditModeEnabled.value) {
    return
  }
  uni.navigateTo({
    url: `/pages-blog/category-articles/category-articles?name=${category.metadata.name}&title=${category.spec.displayName}`,
  })
}

onMounted(() => {
  handleInitPage()
})

onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})

onPullDownRefresh(() => {
  handleResetInit()
  handleGetData()
})

onReachBottom(() => {
  // 如果正在请求，需要阻止继续发起请求
  if (loadMoreStatus.value.active && loadMoreStatus.value.status === 'loading') {
    return
  }
  // 有更多数据时，继续加载数据
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
  <view class="box-border min-h-screen w-screen flex flex-col bg-page">
    <uh-navbar :scroll-y="scrollY" :use-back="false" :default-title="pageTitle" title-color="text-gray-900" />

    <uh-data-loading v-if="loadingStatus !== DataLoadingStatusEnum.Success" min-height="65vh" :loading-status="loadingStatus" />

    <block v-else>
      <view class="grid grid-cols-2 mt-3 box-border gap-2.5 p-3 pt-0">
        <view
          v-for="(item, index) in dataList" :key="index"
          class="uh-global-card-glass relative box-border w-full overflow-hidden rounded-xl"
          @click="handleToCategory(item)"
        >
          <view class="h-32 w-full">
            <wd-img v-if="item.spec.cover" :src="item.spec.cover" class="block h-full w-full" mode="aspectFill" lazy-load>
              <template #loading>
                <wd-loading size="64rpx" custom-class="text-primary" />
              </template>
            </wd-img>
            <!-- 无图 -->
            <view v-else class="h-full w-full flex items-center justify-center from-[#ebfabf] to-[#f5fae8] bg-gradient-to-b text-gray-400">
              <wd-icon class-prefix="uhemoji-icon" name="-injury" size="72rpx" />
            </view>
          </view>
          <view
            class="absolute bottom-0 left-0 h-[140rpx] w-full from-black/0 to-black/30 bg-gradient-to-b"
          />
          <view class="absolute bottom-0 left-0 box-border w-full flex flex-col gap-1 p-2.5">
            <text class="truncate text-2xs text-white font-bold">
              {{ item.spec.displayName }}
            </text>
            <text v-if="item.postCount" class="text-xs text-white opacity-80">
              共 {{ item.postCount }} 篇笔记
            </text>
          </view>
        </view>
      </view>
      <uh-data-loadmore :status="loadMoreStatus.status" :text="loadMoreStatus.text" />
    </block>
  </view>
</template>
