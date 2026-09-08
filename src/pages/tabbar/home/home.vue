<script lang="ts" setup>
import { computed, ref } from 'vue'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { getPostList } from '@/api/halo'
import { useAppConfigStore } from '@/store/appConfig'
import { useSettingStore } from '@/store/setting'
import { checkAvatarUrl, checkImageUrl } from '@/utils/url'
import { t } from '@/locale'
import { useMaintenanceIntercept } from '@/hooks/useMaintenanceIntercept'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import type { IPost } from '@/api/types/halo'

definePage({
  style: {
    navigationBarTitleText: '首页',
    enablePullDownRefresh: true,
    navigationStyle: 'custom',
  },
})

const appConfigStore = useAppConfigStore()
const settingStore = useSettingStore()

/** 维护拦截(插件可用性 + 维护模式,任一命中跳维护页;与入口页共用 hooks) */
const { interceptOrContinue } = useMaintenanceIntercept()
/** 是否已被拦截(配置已带维护键时同步置位,避免首载闪跳) */
const intercepted = ref(!!appConfigStore.configs.maintenance)

const haloConfigs = computed(() => appConfigStore.configs)

/* ---------------- 状态 ---------------- */
const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()
const isLoadMore = ref(false)
const loadMoreText = ref(t('common.loading'))
const articleList = ref<IPost[]>([])

const result = ref<{ hasNext: boolean }>({ hasNext: false })

const queryParams = ref({
  size: 10,
  page: 1,
  sort: ['spec.pinned,desc', 'spec.publishTime,desc'],
})

/* ---------------- 最新推荐模式(默认/置顶/最新/最旧) ---------------- */
const recommendTabs = [
  { label: '默认', value: 'default' },
  { label: '置顶', value: 'pinned' },
  { label: '最新', value: 'latest' },
  { label: '最旧', value: 'oldest' },
]

const recommendMode = ref<'default' | 'pinned' | 'latest' | 'oldest'>('default')

/** 各模式对应排序参数(默认 = 置顶优先 + 发布时间倒序) */
const recommendSortMap: Record<string, string[]> = {
  default: ['spec.pinned,desc', 'spec.publishTime,desc'],
  pinned: ['spec.pinned,desc'],
  latest: ['spec.publishTime,desc'],
  oldest: ['spec.publishTime,asc'],
}

/** 切换推荐模式:重置分页并重新查询 */
function handleRecommendModeChange(mode: 'default' | 'pinned' | 'latest' | 'oldest') {
  if (recommendMode.value === mode)
    return
  recommendMode.value = mode
  isLoadMore.value = false
  articleList.value = []
  queryParams.value.page = 1
  queryParams.value.sort = recommendSortMap[mode]
  handleGetArticleList()
}

/* ---------------- 计算属性 ---------------- */
const appInfo = computed(() => {
  const appInfoData = haloConfigs.value.appConfig?.appInfo as { name?: string, logo?: string } | undefined
  return {
    name: appInfoData?.name || 'uni-halo',
    logo: checkImageUrl(appInfoData?.logo),
  }
})

const bloggerInfo = computed(() => {
  const blogger = haloConfigs.value.authorConfig?.blogger as { nickname?: string, avatar?: string } | undefined
  return {
    nickname: blogger?.nickname || '',
    avatar: checkAvatarUrl(blogger?.avatar),
  }
})

const calcAuditModeEnabled = computed(() => appConfigStore.auditModeEnabled)

const globalAppSettings = computed(() => settingStore.settings)

/* ---------------- 数据加载 ---------------- */
async function handleQuery() {
  handleGetArticleList()
}

/** 文章列表 */
async function handleGetArticleList() {
  if (calcAuditModeEnabled.value) {
    // 审核模式:真实文章按 audit-data posts 过滤(数组顺序即展示顺序)
    const auditPostNames = appConfigStore.auditData.spec?.posts || []
    try {
      const res = await getPostList({ page: 1, size: 0, sort: ['spec.publishTime,desc'] })
      const filtered = res.data.items.filter(item => auditPostNames.includes(item.metadata.name))
      articleList.value = filtered.map((item) => {
        item.owner.avatar = checkAvatarUrl(item.owner.avatar)
        return item
      })
      updateLoadingStatus(articleList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
      loadMoreText.value = t('common.noMore')
    }
    catch (err) {
      console.error('获取审核文章失败', err)
      updateLoadingStatus(DataLoadingStatusEnum.Error)
      loadMoreText.value = t('common.loadFailed')
    }
    finally {
      uni.hideLoading()
      uni.stopPullDownRefresh()
    }
    return
  }

  if (!isLoadMore.value) {
    updateLoadingStatus(DataLoadingStatusEnum.Loading)
  }
  loadMoreText.value = t('common.loading')

  try {
    const res = await getPostList({ ...toRaw(queryParams.value) })
    result.value.hasNext = res.data.hasNext
    articleList.value = (isLoadMore.value
      ? articleList.value.concat(res.data.items)
      : res.data.items).map((item) => {
      item.owner.avatar = checkAvatarUrl(item.owner.avatar)
      return item
    })
    updateLoadingStatus(articleList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
    loadMoreText.value = res.data.hasNext ? t('common.loadMore') : t('common.noMore')
  }
  catch (err) {
    updateLoadingStatus(DataLoadingStatusEnum.Error)
    loadMoreText.value = t('common.loadFailed')
    console.error('获取文章失败', err)
  }
  finally {
    uni.hideLoading()
    uni.stopPullDownRefresh()
  }
}

/* ---------------- 跳转 ---------------- */

/** 更多文章:跳转文章列表页 */
function handleToArticles() {
  uni.navigateTo({ url: '/pages-blog/articles/articles' })
}

function handleOnLogoToPage() {
  uni.switchTab({ url: '/pages/tabbar/about/about' })
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

function init() {
  if (!intercepted.value) {
    handleQuery()
  }
}
init()

/* ---------------- 生命周期 ---------------- */

// 维护检查
onShow(async () => {
  intercepted.value = await interceptOrContinue()
  console.log('拦截状态', intercepted.value)
})

onPullDownRefresh(() => {
  isLoadMore.value = false
  queryParams.value.page = 1
  handleQuery()
})

onReachBottom(() => {
  if (calcAuditModeEnabled.value) {
    uni.showToast({ icon: 'none', title: t('common.noMoreData') })
    return
  }
  if (result.value.hasNext) {
    queryParams.value.page += 1
    isLoadMore.value = true
    handleGetArticleList()
  }
  else {
    uni.showToast({ icon: 'none', title: t('common.noMoreData') })
  }
})
</script>

<template>
  <view class="min-h-screen w-screen flex flex-col bg-page">
    <!-- 轮播 -->
    <uh-home-banner />

    <!-- 公告 -->
    <uh-home-notify />

    <!-- 快捷导航 -->
    <uh-home-quick-nav />

    <!-- 精选分类 -->
    <uh-home-category />

    <!-- 最新文章 -->
    <uh-section-title class="mb-4 box-border px-3">
      最新推荐
      <template #right>
        <view class="flex items-center gap-2">
          <!-- 推荐模式分段器:默认 / 置顶 / 最新 -->
          <view class="uh-global-card-glass uh-shadow-xs flex scale-95 items-center gap-1 border rounded-lg p-0.5">
            <view
              v-for="tab in recommendTabs" :key="tab.value"
              class="rounded-md px-2 py-0.5 text-xs"
              :class="recommendMode === tab.value ? 'bg-secondary text-gray-900' : 'text-gray-500'"
              @click="handleRecommendModeChange(tab.value as 'default' | 'pinned' | 'latest' | 'oldest')"
            >
              {{ tab.label }}
            </view>
          </view>
          <!-- 更多(查看全部文章) -->
          <view
            class="uh-global-card-glass flex items-center justify-center gap-x-1 rounded-md p-1 text-gray-400"
            @click="handleToArticles()"
          >
            <wd-icon name="arrow-right" size="24rpx" />
          </view>
        </view>
      </template>
    </uh-section-title>

    <!-- 加载/错误占位 -->
    <uh-data-loading
      v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus"
      min-height="36vh" @refresh="handleQuery"
    />

    <block v-else>
      <view class="box-border flex flex-col gap-y-3 p-3 pt-0" :class="globalAppSettings.layout.home">
        <uh-article-card
          v-for="(article, index) in articleList" :key="index"
          from="home" :article="article" :audit-mode="calcAuditModeEnabled"
        />
      </view>
      <view class="mt-3 box-border pb-5 text-center text-xs text-gray-400">
        {{ loadMoreText }}
      </view>
    </block>
  </view>
  <uh-notify-dialog />
</template>
