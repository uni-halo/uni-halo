<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { getPostList } from '@/api/halo'
import { useAppConfigStore } from '@/store/appConfig'
import { useSettingStore } from '@/store/setting'
import { checkAvatarUrl, checkImageUrl } from '@/utils/url'
import { t } from '@/locale'
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
const loading = ref<'loading' | 'success' | 'error'>('loading')
const isLoadMore = ref(false)
const loadMoreText = ref(t('common.loading'))
const articleList = ref<IPost[]>([])

const result = ref<{ hasNext: boolean }>({ hasNext: false })

const queryParams = ref({
  size: 5,
  page: 1,
  sort: ['spec.pinned,desc', 'spec.publishTime,desc'],
})

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
      loading.value = 'success'
      loadMoreText.value = t('common.noMore')
    }
    catch (err) {
      console.error('获取审核文章失败', err)
      loading.value = 'error'
      loadMoreText.value = t('common.loadFailed')
    }
    finally {
      uni.hideLoading()
      uni.stopPullDownRefresh()
    }
    return
  }

  if (!isLoadMore.value) {
    loading.value = 'loading'
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
    loading.value = 'success'
    loadMoreText.value = res.data.hasNext ? t('common.loadMore') : t('common.noMore')
  }
  catch (err) {
    loading.value = 'error'
    loadMoreText.value = t('common.loadFailed')
    console.error('获取文章失败', err)
  }
  finally {
    uni.hideLoading()
    uni.stopPullDownRefresh()
  }
}

/* ---------------- 跳转 ---------------- */
function handleToArticleDetail(article: IPost) {
  uni.navigateTo({
    url: `/pages-blog/article-detail/article-detail?name=${article.metadata.name}`,
    animationType: 'slide-in-right',
  })
}

function handleToSearch() {
  uni.navigateTo({ url: '/pages-blog/search/search' })
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

/* ---------------- 生命周期 ---------------- */

// 拦截:维护模式开启 / 主插件未激活(任一命中)→ 跳转维护页(tab 切回时重复检查)
onShow(async () => {
  intercepted.value = await interceptOrContinue()
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

// 首次加载
onMounted(() => {
  if (intercepted.value)
    return
  handleQuery()
})
</script>

<template>
  <view class="min-h-screen w-screen flex flex-col bg-page">
    <!-- 加载/错误占位(列表为空时展示,避免覆盖下拉刷新的旧内容) -->
    <view v-if="loading !== 'success' && articleList.length === 0">
      <uh-data-loading :loading-status="loading" @refresh="handleQuery" />
    </view>

    <block v-else>
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
        最新内容
        <template #right>
          <view
            class="uh-global-card-glass flex items-center justify-center rounded-md p-1 text-gray-400"
            @click="handleToSearch()"
          >
            <wd-icon name="arrow-right" size="12px" />
          </view>
        </template>
      </uh-section-title>

      <view v-if="articleList.length === 0" class="article-empty py-10">
        <wd-empty description="博主还没有发表任何内容~" />
      </view>
      <block v-else>
        <view class="flex flex-col gap-y-3 p-3 pt-0" :class="globalAppSettings.layout.home">
          <uh-article-card
            v-for="(article, index) in articleList" :key="index" from="home" :article="article"
            @on-click="handleToArticleDetail"
          />
        </view>
        <view class="load-text mt-3 pb-5 text-center text-xs text-gray-400">
          {{ loadMoreText }}
        </view>
        <view v-if="articleList.length > 10" class="to-top-btn" @click="handleToTopPage()">
          <wd-icon name="arrow-up" size="20px" color="#03a9f4" />
        </view>
      </block>
    </block>
  </view>
  <uh-notify-dialog />
</template>
