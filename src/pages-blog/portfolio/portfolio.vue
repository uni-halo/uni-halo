<script lang="ts" setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { onPageScroll, onPullDownRefresh, onReachBottom, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { getFeaturedProjects, getProjectList } from '@/api/halo-plugin'
import { useAppConfigStore } from '@/store/appConfig'
import { usePageScroll } from '@/hooks/usePageScroll'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useNavbarSticky } from '@/hooks/useNavbarSticky'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { sleep } from '@/utils/common'
import { checkImageUrl } from '@/utils/url'
import { PORTFOLIO_PLATFORM_LABELS, PORTFOLIO_TYPE_LABELS, portfolioLabelOf } from '@/config/portfolio'
import type { IProject } from '@/api/types/halo-plugin'

definePage({
  style: {
    navigationBarTitleText: '项目集',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
  },
})

const { height: offsetTop } = useNavbarSticky()
const { scrollY, updatePageScrollValue } = usePageScroll()
/** 页面标题（插件端可配置，留空回退内置默认） */
const pageTitle = usePageTitle('portfolio', '项目集')
const appConfigStore = useAppConfigStore()
const { auditModeEnabled: calcAuditModeEnabled } = storeToRefs(appConfigStore)

const siteName = computed(() => appConfigStore.configs.featureConfig?.profile?.appInfo?.name || 'uni-halo')

/* ---------------- 分享 ---------------- */

onShareAppMessage(() => ({
  title: `${pageTitle.value} - ${siteName.value}`,
  path: '/pages-blog/portfolio/portfolio',
}))

onShareTimeline(() => ({
  title: `${pageTitle.value} - ${siteName.value}`,
  query: '',
}))

/* ---------------- 状态 ---------------- */
const { loadingStatus, loadMoreStatus, updateLoadingStatus, updateLoadMoreStatus, resetLoadMoreStatus } = useDataLoadingStatus()
const projectList = ref<IProject[]>([])
const queryParams = ref({ size: 10, page: 1 })

interface IFilterOption {
  label: string
  value: string
}

const typeOptions: IFilterOption[] = [
  { label: '全部', value: '' },
  { label: '推荐', value: 'featured' },
]

const sortOptions: IFilterOption[] = [
  { label: '默认排序', value: 'default' },
  { label: '最新', value: 'latest' },
  { label: '最早', value: 'oldest' },
]

const sortMap: Record<string, string[]> = {
  default: ['priority,desc'],
  latest: ['createTime,desc'],
  oldest: ['createTime,asc'],
}

const filterValues = ref<Record<string, string>>({ type: '', sort: 'default' })

/** 切换类型/排序：重置分页并重新查询 */
function handleSelectFilter(key: 'type' | 'sort', value: string) {
  if (filterValues.value[key] === value) { return }
  filterValues.value[key] = value
  resetLoadMoreStatus()
  projectList.value = []
  queryParams.value.page = 1
  handleGetProjectList()
}

/* ---------------- 数据加载 ---------------- */
async function handleGetProjectList() {
  if (calcAuditModeEnabled.value) {
    // 审核模式
    resetLoadMoreStatus()
    const auditProjectSlugs = appConfigStore.auditNamesOf('projects')
    try {
      const res = await getProjectList({ page: 1, size: 0, sort: ['priority,desc'] })
      const filtered = res.data.items.filter(item => auditProjectSlugs.includes(item.slug))
      // 按审核配置顺序展示（数组顺序即展示顺序）
      const orderMap = new Map(auditProjectSlugs.map((slug, index) => [slug, index]))
      filtered.sort((a, b) => (orderMap.get(a.slug) ?? 999) - (orderMap.get(b.slug) ?? 999))
      projectList.value = filtered
      await sleep(600)
      updateLoadingStatus(projectList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
      updateLoadMoreStatus({
        active: false,
        status: 'noMore',
        hasNext: false,
      })
    }
    catch (err) {
      console.error('获取审核项目失败', err)
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
      featured: filterValues.value.type === 'featured' ? true : undefined,
      sort: sortMap[filterValues.value.sort] || sortMap.default,
    }
    const res = filterValues.value.type === 'featured'
      ? await getFeaturedProjects(params)
      : await getProjectList(params)
    projectList.value = loadMoreStatus.value.active
      ? projectList.value.concat(res.data.items)
      : res.data.items
    if (!loadMoreStatus.value.active) {
      await sleep(600)
      updateLoadingStatus(projectList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
    }
    updateLoadMoreStatus({
      active: false,
      status: res.data.hasNext ? 'loadMore' : 'noMore',
      hasNext: res.data.hasNext,
    })
  }
  catch (err) {
    console.error('获取项目失败', err)
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

/** 跳转项目详情 */
function handleToDetail(project: IProject) {
  uni.navigateTo({ url: `/pages-blog/portfolio/detail?slug=${project.slug}` })
}

/** 平台中文标签 */
function platformLabel(value?: string) {
  return portfolioLabelOf(PORTFOLIO_PLATFORM_LABELS, value)
}

/** 类型中文标签 */
function typeLabel(value?: string) {
  return portfolioLabelOf(PORTFOLIO_TYPE_LABELS, value)
}

onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})

onLoad(() => {
  handleGetProjectList()
})

onPullDownRefresh(() => {
  if (calcAuditModeEnabled.value) {
    uni.stopPullDownRefresh()
    return
  }
  resetLoadMoreStatus()
  queryParams.value.page = 1
  projectList.value = []
  handleGetProjectList()
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
    handleGetProjectList()
  }
})
</script>

<template>
  <view class="min-h-screen w-screen flex flex-col bg-page">
    <uh-navbar :scroll-y="scrollY" :default-title="pageTitle" title-color="text-gray-900" />

    <wd-sticky :offset-top="offsetTop">
      <view class="w-screen overflow-hidden">
        <scroll-view :scroll-x="true" :show-scrollbar="false" class="w-full whitespace-nowrap pb-1.5">
          <view
            v-for="opt in typeOptions" :key="opt.value"
            class="uh-global-card-glass ml-3 inline-flex border rounded-2xl px-4 py-1.5 text-xs shadow-none"
            :class="{ '!bg-primary text-gray-900 font-semibold': filterValues.type === opt.value }"
            @click="handleSelectFilter('type', opt.value)"
          >
            {{ opt.label }}
          </view>
        </scroll-view>
        <scroll-view :scroll-x="true" :show-scrollbar="false" class="w-full whitespace-nowrap">
          <view class="box-border flex gap-2 px-3 pb-1.5">
            <view
              v-for="opt in sortOptions" :key="opt.value"
              class="uh-global-card-glass inline-flex border rounded-2xl px-4 py-1.5 text-xs shadow-none"
              :class="{ '!bg-primary text-gray-900 font-semibold': filterValues.sort === opt.value, 'text-gray-500': filterValues.sort !== opt.value }"
              @click="handleSelectFilter('sort', opt.value)"
            >
              {{ opt.label }}
            </view>
          </view>
        </scroll-view>
      </view>
    </wd-sticky>

    <uh-data-loading
      v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus"
      empty-text="啊偶，还没有任何项目哦~" min-height="65vh" @refresh="handleGetProjectList"
    />

    <view v-else class="box-border flex flex-col gap-3 p-3">
      <view
        v-for="project in projectList" :key="project.slug"
        class="uh-global-card-glass box-border overflow-hidden rounded-xl"
        @click="handleToDetail(project)"
      >
        <image
          v-if="project.cover" :src="checkImageUrl(project.cover)" mode="aspectFill"
          class="h-36 w-full"
        />
        <view v-else class="h-36 w-full flex items-center justify-center bg-gray-100 text-xs text-gray-400">
          暂无封面
        </view>
        <view class="box-border flex flex-col gap-1.5 p-3">
          <view class="flex items-center gap-2">
            <text class="flex-1 truncate text-sm text-gray-900 font-semibold">{{ project.title }}</text>
            <view
              v-if="project.featured"
              class="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-10px text-primary"
            >
              推荐
            </view>
          </view>
          <text v-if="project.summary" class="line-clamp-2 text-xs text-gray-500">{{ project.summary }}</text>
          <view v-if="project.techStacks?.length" class="mt-1 flex flex-wrap gap-1.5">
            <text
              v-for="tech in project.techStacks.slice(0, 4)" :key="tech"
              class="rounded-md bg-gray-100 px-1.5 py-0.5 text-10px text-gray-500"
            >
              {{ tech }}
            </text>
          </view>
          <view class="mt-1 flex items-center gap-2 text-10px text-gray-400">
            <text v-if="typeLabel(project.type)">{{ typeLabel(project.type) }}</text>
            <text v-if="platformLabel(project.platform)">{{ platformLabel(project.platform) }}</text>
          </view>
        </view>
      </view>
      <uh-data-loadmore :status="loadMoreStatus.status" :text="loadMoreStatus.text" />
    </view>
  </view>
</template>
