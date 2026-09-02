<script lang="ts" setup>
/**
 * 首页(源自旧项目 pages/tabbar/home/home.vue,新建复刻)
 * 功能:顶部栏 + 轮播 Banner + 快捷导航 + 精选分类 + 最新文章列表(分页) + 通知弹窗
 */
import { computed, ref, watch } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { getCategoryList, getPostList } from '@/api/halo'
import { useAppConfigStore } from '@/store/appConfig'
import { useSettingStore } from '@/store/setting'
import { checkAvatarUrl, checkImageUrl } from '@/utils/url'
import { t } from '@/locale'
import type { ICategory, IPost } from '@/api/types/halo'
import type { IBannerItem } from '@/components/uh-swiper/uh-swiper.vue'

definePage({
  style: {
    navigationBarTitleText: '首页',
    enablePullDownRefresh: true,
    navigationStyle: 'custom',
    backgroundColor: '#F8F8F8',
  },
})

const appConfigStore = useAppConfigStore()
const settingStore = useSettingStore()

const haloConfigs = computed(() => appConfigStore.configs)

/* ---------------- 状态 ---------------- */
const loading = ref<'loading' | 'success' | 'error'>('loading')
const isLoadMore = ref(false)
const loadMoreText = ref(t('common.loading'))
const articleList = ref<IPost[]>([])
const categoryList = ref<ICategory[]>([])
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

const calcIsShowQuickNavigationEnabled = computed(() => haloConfigs.value.pageConfig?.homeConfig?.useQuickNavigation)

const calcIsShowCategory = computed(() => {
  if (calcAuditModeEnabled.value)
    return false
  return !!haloConfigs.value.pageConfig?.homeConfig?.useCategory
})

const calcVotePluginEnabled = computed(() => !!haloConfigs.value.pluginConfig?.votePlugin?.enabled)
const calcLinksPluginEnabled = computed(() => !!haloConfigs.value.pluginConfig?.linksPlugin?.enabled)

const bannerConfig = computed(() => haloConfigs.value.pageConfig?.homeConfig?.bannerConfig)

const globalAppSettings = computed(() => settingStore.settings)

/** 快捷导航列表(由配置控制显隐) */
const navList = computed(() => {
  const loveEnabled = !!(haloConfigs.value.loveConfig as { loveEnabled?: boolean })?.loveEnabled
  const socialEnabled = !!(haloConfigs.value.authorConfig?.social as { enabled?: boolean } | undefined)?.enabled
  return [
    {
      key: 'archives',
      title: calcAuditModeEnabled.value ? '内容归档' : '文章归档',
      bgColor: 'rgba(3, 169, 244, 0.95)',
      icon: 'news',
      path: '/pages-blog/archives/archives',
      show: true,
    },
    {
      key: 'vote',
      title: '投票中心',
      bgColor: 'rgba(0, 188, 212, 0.95)',
      icon: 'box',
      path: '/pages-blog/votes/votes',
      show: !calcAuditModeEnabled.value && calcVotePluginEnabled.value,
    },
    {
      key: 'disclaimers',
      title: '友情链接',
      bgColor: 'rgba(0, 150, 136, 0.95)',
      icon: 'link',
      path: '/pages-blog/friend-links/friend-links',
      show: calcLinksPluginEnabled.value,
    },
    {
      key: 'love',
      title: '恋爱日记',
      bgColor: 'rgba(255, 76, 103, 0.95)',
      icon: 'heart',
      path: '/pages-blog/love/love',
      show: loveEnabled,
    },
    {
      key: 'contact-blogger',
      title: '联系博主',
      bgColor: 'rgba(255, 152, 0, 0.95)',
      icon: 'message',
      path: '/pages-blog/contact/contact',
      show: socialEnabled,
    },
  ]
})

/* ---------------- 数据加载 ---------------- */
async function handleQuery() {
  // 轮播图数据由 uh-swiper 组件内部请求公开 banners 接口,页面不再组装
  await Promise.all([handleGetArticleList(), handleGetCategoryList()])
}

/** 精选分类 */
async function handleGetCategoryList() {
  if (calcAuditModeEnabled.value || !calcIsShowCategory.value) {
    loading.value = 'success'
    return
  }
  try {
    const res = await getCategoryList({ fieldSelector: ['spec.hideFromList=false'], size: 10 })
    categoryList.value = res.data.items
      .map(item => ({ ...item, postCount: item.postCount ?? 0 }))
      .sort((a, b) => (b.postCount || 0) - (a.postCount || 0))
    loading.value = 'success'
  }
  catch (err) {
    console.error('获取分类失败', err)
    loading.value = 'error'
  }
  finally {
    setTimeout(() => {
      uni.hideLoading()
      uni.stopPullDownRefresh()
    }, 500)
  }
}

/** 文章列表 */
async function handleGetArticleList() {
  if (calcAuditModeEnabled.value) {
    // 审核模式:真实文章按 audit-data posts 过滤(数组顺序即展示顺序)
    const auditPostNames = appConfigStore.auditData.spec?.posts || []
    try {
      const res = await getPostList({ page: 1, size: 99999, sort: ['spec.publishTime,desc'] })
      const filtered = res.data.items.filter(item => auditPostNames.includes(item.metadata.name))
      const orderMap = new Map(auditPostNames.map((name, index) => [name, index]))
      filtered.sort((a, b) => (orderMap.get(a.metadata.name) ?? 999) - (orderMap.get(b.metadata.name) ?? 999))
      articleList.value = filtered
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
    articleList.value = isLoadMore.value
      ? articleList.value.concat(res.data.items)
      : res.data.items
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
  if (calcAuditModeEnabled.value)
    return
  uni.navigateTo({
    url: `/pages-blog/article-detail/article-detail?name=${article.metadata.name}`,
    animationType: 'slide-in-right',
  })
}

function handleToCategoryPage() {
  uni.switchTab({ url: '/pages/tabbar/category/category' })
}

function handleToCategoryBy(category: ICategory) {
  if (calcAuditModeEnabled.value)
    return
  uni.navigateTo({
    url: `/pages-blog/category-detail/category-detail?name=${category.metadata.name}&title=${category.spec.displayName}`,
  })
}

function handleToSearch() {
  uni.navigateTo({ url: '/pages-blog/search/search' })
}

function handleOnLogoToPage() {
  uni.switchTab({ url: '/pages/tabbar/about/about' })
}

function handleClickNav(item: { path: string }) {
  uni.navigateTo({ url: item.path })
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

function handleOnBannerClick(item: IBannerItem) {
  // 审核模式下照常展示 Banner,点击分发不拦截(详情页自行处理审核限制)
  if (item.type === 'custom') {
    // 自定义条目:跳转 Banner 详情页,页面内调公开详情接口展示 content/外链
    if (item.name) {
      uni.navigateTo({
        url: `/pages-blog/banner-detail/banner-detail?name=${item.name}`,
        animationType: 'slide-in-right',
      })
    }
    return
  }
  // 文章来源条目:用 postId 跳文章详情
  const postId = item.postId || String(item.id || '')
  if (!postId)
    return
  handleToArticleDetail({ metadata: { name: postId } } as IPost)
}

/* ---------------- 生命周期 ---------------- */
onLoad(() => {
  uni.setNavigationBarTitle({ title: t('page.home.title') })
})

watch(haloConfigs, () => {
  // 配置就绪后重新拉取(导航显隐依赖配置)
}, { deep: true })

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
handleQuery()
</script>

<template>
  <view class="min-h-screen w-screen flex flex-col">
    <!-- 顶部栏 -->
    <view class="header flex items-center gap-4 px-3 py-1.5">
      <image class="logo h-[60rpx] w-[60rpx] rounded-3xl" :src="appInfo.logo" mode="scaleToFill" @click="handleOnLogoToPage" />
      <view class="search-input h-[64rpx] flex flex-1 items-center rounded-3xl bg-[#f5f5f5] px-3" @click="handleToSearch">
        <view class="search-icon flex items-center">
          <wd-icon name="search" size="16px" color="#999" />
        </view>
        <text class="search-text text-grey ml-3 text-[26rpx] text-[#999]">搜索内容...</text>
      </view>
      <!-- #ifdef APP-PLUS || H5 -->
      <view class="app-name max-w-[140rpx] overflow-hidden text-ellipsis whitespace-nowrap text-[26rpx] text-[#666]">
        {{ appInfo.name }}
      </view>
      <!-- #endif -->
    </view>

    <!-- 骨架屏 -->
    <view v-if="loading !== 'success' && articleList.length === 0" class="loading-wrap px-3">
      <wd-skeleton :row="3" :animated="true" />
    </view>

    <block v-else>
      <!-- 轮播 Banner(数据由 uh-swiper 组件内部请求公开 banners 接口) -->
      <view v-if="bannerConfig?.enabled" class="mb-4 bg-white">
        <view class="banner mx-3 mt-3 overflow-hidden rounded-xl">
          <uh-swiper
            :height="bannerConfig.height"
            :dot-position="bannerConfig.dotPosition"
            :autoplay="true"
            :use-dot="bannerConfig.showIndicator"
            :use-title="bannerConfig.showTitle"
            @on-click="handleOnBannerClick"
          />
        </view>
      </view>

      <!-- 快捷导航 -->
      <view v-if="navList.filter(x => x.show).length" class="nav-box overflow-hidden rounded-xl bg-white p-3 px-4">
        <view class="page-item-title font-bold">
          快捷导航
        </view>
        <view class="nav-list grid grid-cols-5 mt-6 gap-6">
          <template v-for="item in navList.filter(x => x.show)" :key="item.key">
            <view class="nav-item flex flex-col items-center gap-3" @click="handleClickNav(item)">
              <view class="nav-item-icon h-[88rpx] w-[88rpx] flex items-center justify-center rounded-3xl" :style="{ backgroundColor: item.bgColor }">
                <wd-icon :name="item.icon" size="24px" color="#fff" />
              </view>
              <view class="nav-item-text text-[24rpx] text-[#303133]">
                {{ item.title }}
              </view>
            </view>
          </template>
        </view>
      </view>

      <!-- 精选分类 -->
      <block v-if="calcIsShowCategory">
        <view class="mb-6 mt-6 flex items-center justify-between px-3">
          <view class="page-item-title font-bold">
            精选分类
          </view>
          <view class="show-more flex items-center justify-center rounded-xl bg-white" @click="handleToCategoryPage">
            <wd-icon name="arrow-right" size="12px" color="#909399" />
          </view>
        </view>
        <scroll-view class="category mx-6 h-[200rpx] whitespace-nowrap" :scroll-x="true">
          <view v-if="categoryList.length === 0" class="cate-empty text-grey h-[180rpx] w-full flex items-center justify-center">
            还没有任何分类~
          </view>
          <view
            v-for="category in categoryList"
            v-else
            :key="category.metadata.name"
            class="category-item mr-4 inline-block"
            @click="handleToCategoryBy(category)"
          >
            <uh-category-mini-card :category="category" />
          </view>
        </scroll-view>
      </block>

      <!-- 最新文章 -->
      <view class="mb-6 mt-6 flex items-center justify-between px-3">
        <view class="page-item-title font-bold">
          最新列表
        </view>
        <view class="show-more flex items-center justify-center rounded-xl bg-white" @click="handleToSearch">
          <wd-icon name="arrow-right" size="12px" color="#909399" />
        </view>
      </view>
      <view v-if="articleList.length === 0" class="article-empty py-10">
        <wd-empty description="博主还没有发表任何内容~" />
      </view>
      <block v-else>
        <view :class="globalAppSettings.layout.home">
          <uh-article-card
            v-for="(article, index) in articleList"
            :key="index"
            from="home"
            :article="article"
            @on-click="handleToArticleDetail"
          />
        </view>
        <view class="load-text mt-3 pb-5 text-center text-[24rpx] text-[#999]">
          {{ loadMoreText }}
        </view>
        <view v-if="articleList.length > 10" class="to-top-btn" @click="handleToTopPage()">
          <wd-icon name="arrow-up" size="20px" color="#03a9f4" />
        </view>
      </block>
    </block>
  </view>
</template>
