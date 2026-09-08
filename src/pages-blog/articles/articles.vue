<script lang="ts" setup>
/**
 * 文章列表页(替代 unibest 模板占位页)
 * 标准布局:uh-navbar + useDataLoadingStatus 四态 + uh-data-loading + 分页加载 + 回顶
 * 2026-09-08:新增分类筛选 + 排序(参考投票中心胶囊弹层),列表改 grid 两列紧凑卡片
 */
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { getCategoryList, getPostList } from '@/api/halo'
import { useAppConfigStore } from '@/store/appConfig'
import { checkAvatarUrl } from '@/utils/url'
import { t } from '@/locale'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
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

/* ---------------- 状态 ---------------- */
const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()
const articleList = ref<IPost[]>([])
const queryParams = ref({ size: 10, page: 1 })
const hasNext = ref(false)
const isLoadMore = ref(false)
const loadMoreText = ref(t('common.loading'))

/* ---------------- 筛选与排序(参考投票中心) ---------------- */
interface IFilterOption {
  label: string
  value: string
}

interface IFilterItem {
  key: 'category' | 'sort'
  label: string
  options: IFilterOption[]
}

/** 分类列表(筛选选项数据源) */
const categoryList = ref<ICategory[]>([])

/** 排序参数映射 */
const sortMap: Record<string, string[]> = {
  default: ['spec.pinned,desc', 'spec.publishTime,desc'],
  latest: ['spec.publishTime,desc'],
  oldest: ['spec.publishTime,asc'],
  pinned: ['spec.pinned,desc'],
}

/** 筛选维度:分类筛选 + 排序 */
const filterConfig = computed<IFilterItem[]>(() => [
  {
    key: 'category',
    label: '分类',
    options: [
      { label: '全部', value: '' },
      ...categoryList.value.map(c => ({ label: c.spec.displayName, value: c.metadata.name })),
    ],
  },
  {
    key: 'sort',
    label: '排序',
    options: [
      { label: '默认排序', value: 'default' },
      { label: '最新', value: 'latest' },
      { label: '最旧', value: 'oldest' },
      { label: '置顶', value: 'pinned' },
    ],
  },
])

/** 各维度当前选中值(空串 = 全部) */
const filterValues = ref<Record<string, string>>({ category: '', sort: 'default' })

/** 当前选中中文标签(用于筛选栏展示) */
const filterLabels = computed(() => {
  const map: Record<string, string> = {}
  for (const f of filterConfig.value) {
    const cur = filterValues.value[f.key]
    map[f.key] = f.options.find(o => o.value === cur)?.label || f.options[0].label
  }
  return map
})

/** 筛选弹层 */
const filterPopup = ref<{ show: boolean, item: IFilterItem | null }>({ show: false, item: null })

function handleOpenFilter(item: IFilterItem) {
  filterPopup.value = { show: true, item }
}

/** 选择筛选/排序:重置分页并重新查询 */
function handleSelectFilter(option: IFilterOption) {
  const item = filterPopup.value.item
  if (!item)
    return
  filterValues.value[item.key] = option.value
  filterPopup.value.show = false
  isLoadMore.value = false
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
      uni.stopPullDownRefresh()
    }
    return
  }

  if (!isLoadMore.value) {
    updateLoadingStatus(DataLoadingStatusEnum.Loading)
  }
  loadMoreText.value = t('common.loading')

  try {
    // 应用分类筛选与排序参数
    const params = {
      ...queryParams.value,
      category: filterValues.value.category || undefined,
      sort: sortMap[filterValues.value.sort] || sortMap.default,
    }
    const res = await getPostList(params)
    hasNext.value = res.data.hasNext
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
    uni.stopPullDownRefresh()
  }
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
onLoad(() => {
  handleGetCategoryList()
  handleGetArticleList()
})

onPullDownRefresh(() => {
  if (calcAuditModeEnabled.value) {
    uni.stopPullDownRefresh()
    return
  }
  isLoadMore.value = false
  queryParams.value.page = 1
  articleList.value = []
  handleGetArticleList()
})

onReachBottom(() => {
  if (calcAuditModeEnabled.value) {
    uni.showToast({ icon: 'none', title: '没有更多数据了' })
    return
  }
  if (hasNext.value) {
    queryParams.value.page += 1
    isLoadMore.value = true
    handleGetArticleList()
  }
  else {
    uni.showToast({ icon: 'none', title: '没有更多数据了' })
  }
})
</script>

<template>
  <view class="app-page min-h-screen w-screen flex flex-col bg-page">
    <!-- 自定义导航 -->
    <uh-navbar default-title="文章列表" title-color="text-gray-900" />

    <!-- 筛选栏:分类 + 排序 -->
    <view class="box-border flex items-center justify-between gap-x-2 px-3 pt-2">
      <view
        v-for="f in filterConfig" :key="f.key"
        class="uh-global-card-glass box-border flex flex-1 items-center justify-center gap-1 border rounded-full px-2 py-1 text-gray-500"
        :class="[filterValues[f.key] !== f.options[0].value ? 'bg-secondary text-gray-900 font-bold' : 'bg-white/80 text-gray-600']"
        @click="handleOpenFilter(f)"
      >
        <text class="truncate text-xs">{{ filterLabels[f.key] }}</text>
        <wd-icon name="arrow-down" size="10px" />
      </view>
    </view>

    <!-- 加载/错误/空占位(状态机) -->
    <uh-data-loading
      v-if="loadingStatus !== DataLoadingStatusEnum.Success"
      :loading-status="loadingStatus"
      empty-text="博主还没有发布文章呢~"
      min-height="60vh"
      @refresh="handleGetArticleList"
    />

    <!-- 文章列表(grid 两列) -->
    <view v-else class="box-border flex flex-col gap-4 p-3">
      <view class="grid grid-cols-2 gap-3">
        <uh-article-card
          v-for="(article, index) in articleList"
          :key="article.metadata.name || index"
          from="articles"
          variant="grid"
          :article="article"
          :audit-mode="calcAuditModeEnabled"
        />
      </view>
      <view class="box-border py-5 text-center text-xs text-gray-400">
        {{ loadMoreText }}
      </view>
    </view>

    <!-- 回顶 -->
    <view
      class="to-top-btn fixed bottom-[160rpx] right-6 z-6 h-[72rpx] w-[72rpx] flex items-center justify-center rounded-full bg-white shadow-sm"
      @click="handleToTopPage()"
    >
      <wd-icon name="arrow-up" size="20px" color="#03a9f4" />
    </view>

    <!-- 筛选弹层 -->
    <uh-glass-popup v-model="filterPopup.show" :z-index="99" position="bottom" custom-class="rounded-2xl">
      <view v-if="filterPopup.item" class="box-border p-4">
        <view class="text-md mb-4 text-center text-gray-900 font-bold">
          {{ filterPopup.item.label }}
        </view>
        <view class="flex flex-col gap-2">
          <view
            v-for="opt in filterPopup.item.options" :key="opt.label"
            class="uh-global-card-glass box-border border rounded-xl px-5 py-2 text-center text-sm"
            :class="filterValues[filterPopup.item.key] === opt.value ? 'bg-primary text-gray-900 font-bold' : 'text-gray-700'"
            @click="handleSelectFilter(opt)"
          >
            {{ opt.label }}
          </view>
        </view>
      </view>
    </uh-glass-popup>
  </view>
</template>
