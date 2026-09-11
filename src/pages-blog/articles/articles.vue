<script lang="ts" setup>
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { getCategoryList, getPostList } from '@/api/halo'
import { useAppConfigStore } from '@/store/appConfig'
import { useSettingStore } from '@/store/setting'
import { checkAvatarUrl } from '@/utils/url'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { sleep } from '@/utils/common'
import type { ICategory, IPost } from '@/api/types/halo'

definePage({
  style: {
    navigationBarTitleText: '文章列表',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
  },
})

const appConfigStore = useAppConfigStore()
const calcAuditModeEnabled = computed(() => appConfigStore.auditModeEnabled)

const settingStore = useSettingStore()

/** 文章列表页列表布局(偏好设置驱动:single=单列 / double=双列) */
const articlesListLayout = computed(() => settingStore.settings.articlesListLayout)

/* ---------------- 状态 ---------------- */
const { loadingStatus, loadMoreStatus, updateLoadingStatus, updateLoadMoreStatus, resetLoadMoreStatus } = useDataLoadingStatus()
const articleList = ref<IPost[]>([])
const queryParams = ref({ size: 10, page: 1 })

interface IFilterOption {
  label: string
  value: string
}

const categoryList = ref<ICategory[]>([])

const sortMap: Record<string, string[]> = {
  default: ['spec.pinned,desc', 'spec.publishTime,desc'],
  latest: ['spec.publishTime,desc'],
  oldest: ['spec.publishTime,asc'],
  pinned: ['spec.pinned,desc'],
}

const categoryOptions = computed<IFilterOption[]>(() => [
  { label: '全部', value: '' },
  ...categoryList.value.map(c => ({ label: c.spec.displayName, value: c.metadata.name })),
])

const sortOptions: IFilterOption[] = [
  { label: '默认排序', value: 'default' },
  { label: '最新', value: 'latest' },
  { label: '最旧', value: 'oldest' },
  { label: '置顶', value: 'pinned' },
]

const filterValues = ref<Record<string, string>>({ category: '', sort: 'default' })

/** 切换分类/排序:重置分页并重新查询 */
function handleSelectFilter(key: 'category' | 'sort', value: string) {
  if (filterValues.value[key] === value)
    return
  filterValues.value[key] = value
  resetLoadMoreStatus()
  articleList.value = []
  queryParams.value.page = 1
  handleGetArticleList()
}

/** 拉取分类列表(用于筛选选项) */
async function handleGetCategoryList() {
  try {
    const res = await getCategoryList({ page: 1, size: 0, tree: true })
    categoryList.value = res.data.items || []
  }
  catch (err) {
    console.error('获取分类列表失败', err)
  }
}

/* ---------------- 数据加载 ---------------- */
async function handleGetArticleList() {
  if (calcAuditModeEnabled.value) {
    // 审核模式:真实文章按 audit-data posts 过滤(数组顺序即展示顺序),一次拉取不分页
    resetLoadMoreStatus()
    const auditPostNames = appConfigStore.auditData.spec?.posts || []
    try {
      const res = await getPostList({ page: 1, size: 0, sort: ['spec.publishTime,desc'] })
      const filtered = res.data.items.filter(item => auditPostNames.includes(item.metadata.name))
      articleList.value = filtered.map((item) => {
        item.owner.avatar = checkAvatarUrl(item.owner.avatar)
        return item
      })
      await sleep(600)
      updateLoadingStatus(articleList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
      updateLoadMoreStatus({
        active: false,
        status: 'noMore',
        hasNext: false,
      })
    }
    catch (err) {
      console.error('获取审核文章失败', err)
      updateLoadingStatus(DataLoadingStatusEnum.Error)
      updateLoadMoreStatus({
        active: false,
        status: 'error',
      })
    }
    finally {
      uni.stopPullDownRefresh()
    }
    return
  }

  if (!loadMoreStatus.value.active) {
    updateLoadingStatus(DataLoadingStatusEnum.Loading)
  }

  try {
    const params = {
      ...queryParams.value,
      category: filterValues.value.category || undefined,
      sort: sortMap[filterValues.value.sort] || sortMap.default,
    }
    const res = await getPostList(params)
    articleList.value = (loadMoreStatus.value.active
      ? articleList.value.concat(res.data.items)
      : res.data.items).map((item) => {
      item.owner.avatar = checkAvatarUrl(item.owner.avatar)
      return item
    })
    if (!loadMoreStatus.value.active) {
      await sleep(600)
      updateLoadingStatus(articleList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
    }
    updateLoadMoreStatus({
      active: false,
      status: res.data.hasNext ? 'loadMore' : 'noMore',
      hasNext: res.data.hasNext,
    })
  }
  catch (err) {
    console.error('获取文章失败', err)
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

onLoad(() => {
  handleGetCategoryList()
  handleGetArticleList()
})

onPullDownRefresh(() => {
  if (calcAuditModeEnabled.value) {
    uni.stopPullDownRefresh()
    return
  }
  resetLoadMoreStatus()
  queryParams.value.page = 1
  articleList.value = []
  handleGetArticleList()
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
    handleGetArticleList()
  }
})
</script>

<template>
  <view class="min-h-screen w-screen flex flex-col bg-page">
    <uh-navbar default-title="文章列表" title-color="text-gray-900" />

    <wd-sticky v-if="categoryOptions.length > 1" class="w-full">
      <scroll-view :scroll-x="true" :show-scrollbar="false" class="w-full whitespace-nowrap pt-2">
        <view
          v-for="cate in categoryOptions" :key="cate.value"
          class="uh-global-card-glass uh-shadow-xs mb-1 ml-3 inline-flex border rounded-2xl px-4 py-1 text-sm"
          :class="{ 'bg-primary text-gray-900 font-bold': filterValues.category === cate.value }"
          @click="handleSelectFilter('category', cate.value)"
        >
          {{ cate.label }}
        </view>
      </scroll-view>
    </wd-sticky>

    <scroll-view :scroll-x="true" :show-scrollbar="false" class="w-full whitespace-nowrap">
      <view class="box-border flex gap-2 px-3 py-2">
        <view
          v-for="opt in sortOptions" :key="opt.value"
          class="uh-global-card-glass uh-shadow-xs inline-flex border rounded-full px-3 py-1 text-xs"
          :class="{ 'bg-secondary text-gray-900 font-bold': filterValues.sort === opt.value }"
          @click="handleSelectFilter('sort', opt.value)"
        >
          {{ opt.label }}
        </view>
      </view>
    </scroll-view>

    <uh-data-loading
      v-if="loadingStatus !== DataLoadingStatusEnum.Success"
      :loading-status="loadingStatus"
      empty-text="啊偶，还没有任何内容哦~"
      min-height="75vh"
      @refresh="handleGetArticleList"
    />

    <view v-else class="box-border flex flex-col gap-4 p-3">
      <view :class="articlesListLayout === 'double' ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-3'">
        <uh-article-card
          v-for="(article, index) in articleList"
          :key="article.metadata.name || index"
          from="articles"
          :variant="articlesListLayout === 'double' ? 'grid' : 'list'"
          :article="article"
          :audit-mode="calcAuditModeEnabled"
        />
      </view>
      <uh-data-loadmore :status="loadMoreStatus.status" :text="loadMoreStatus.text" />
    </view>
  </view>
</template>
