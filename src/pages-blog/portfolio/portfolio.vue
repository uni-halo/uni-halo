<script lang="ts" setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { onPageScroll, onPullDownRefresh, onReachBottom, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { getFeaturedProjects, getProjectList } from '@/api/halo-plugin-third/portfolio'
import { useAppConfigStore } from '@/store/appConfig'
import { usePageScroll } from '@/hooks/usePageScroll'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useNavbarSticky } from '@/hooks/useNavbarSticky'
import { NeedPluginIds, usePluginAvailable } from '@/hooks/usePluginAvailable'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { sleep } from '@/utils/common'
import { formatTime } from '@/utils/formatTime'
import { checkImageUrl } from '@/utils/url'
import { PORTFOLIO_PLATFORM_LABELS, PORTFOLIO_TYPE_LABELS, portfolioLabelOf } from '@/config/portfolio'
import type { IProject } from '@/api/types/halo-plugin-third/portfolio'

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

/** 依赖插件(PluginPortfolio)，不可用时展示占位并可重试 */
const { pluginId, checking, tips, available: uniHaloPluginAvailable, check: checkPluginAvailable } = usePluginAvailable({
  pluginId: NeedPluginIds.PluginPortfolio,
  tips: '啊偶，功能正在维护中...',
  callback: (isAvailable) => {
    if (!isAvailable) { return }
    handleGetProjectList()
  },
})

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

const filterValues = ref<Record<string, string>>({ type: '' })

/** 切换类型：重置分页并重新查询 */
function handleSelectFilter(key: 'type', value: string) {
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
      const res = await getProjectList({ page: 1, size: 0 })
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

onLoad(async () => {
  await checkPluginAvailable()
  if (!uniHaloPluginAvailable.value) {
    uni.stopPullDownRefresh()
  }
})

onPullDownRefresh(() => {
  if (!uniHaloPluginAvailable.value) {
    uni.stopPullDownRefresh()
    return
  }
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
  if (!uniHaloPluginAvailable.value) { return }
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

    <uh-plugin-unavailable
      v-if="!uniHaloPluginAvailable" custom-class="h-[70vh]" :plugin-id="pluginId"
      :error-text="tips" :checking="checking" @on-refresh="checkPluginAvailable"
    />

    <wd-sticky v-if="uniHaloPluginAvailable" :offset-top="offsetTop">
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
      </view>
    </wd-sticky>

    <uh-data-loading
      v-if="uniHaloPluginAvailable && loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus"
      empty-text="啊偶，还没有任何项目哦~" min-height="65vh" @refresh="handleGetProjectList"
    />

    <view v-else-if="uniHaloPluginAvailable" class="box-border flex flex-col gap-3 p-3">
      <view
        v-for="project in projectList" :key="project.slug"
        class="uh-global-card-glass uh-shadow-xs relative overflow-hidden rounded-xl"
        @click="handleToDetail(project)"
      >
        <text
          v-if="project.featured"
          class="absolute right-0 top-0 z-20 box-border rounded-lb-lg bg-secondary px-2 py-0.5 text-gray-900 !text-xs"
        >
          推荐
        </text>
        <image
          v-if="project.cover"
          :src="checkImageUrl(project.cover)"
          class="absolute z-0 block h-full w-full"
          mode="aspectFill"
          lazy-load
        />
        <view class="uh-filter-blur-xs relative z-10 box-border flex flex-col gap-y-3 bg-black/30 p-4">
          <view class="w-full flex gap-x-3 overflow-hidden">
            <view v-if="project.cover" class="uh-global-card-glass relative h-18 w-18 shrink-0 overflow-hidden rounded-lg shadow-none">
              <wd-img width="100%" height="100%" :src="checkImageUrl(project.cover)" mode="aspectFill" lazy-load>
                <template #loading>
                  <wd-loading size="64rpx" custom-class="text-primary" />
                </template>
              </wd-img>
            </view>
            <view class="w-full flex flex-col justify-between gap-y-1 overflow-hidden">
              <view class="flex items-center gap-x-1.5 overflow-hidden">
                <text
                  v-if="project.featured"
                  class="uh-global-card-glass box-border shrink-0 border rounded-md bg-secondary px-1.5 text-gray-900 !hidden !text-xs"
                >
                  推荐
                </text>
                <text class="flex-1 truncate text-[30rpx] text-white font-semibold">{{ project.title }}</text>
              </view>
              <view
                class="text-3xs text-gray-100 leading-5"
                :class="[
                  project.techStacks?.length ? 'line-clamp-1' : 'line-clamp-2',
                ]"
              >
                {{ project.summary || '这个项目还没有介绍~' }}
              </view>
              <view v-if="project.techStacks?.length" class="box-border flex flex-wrap gap-2">
                <text
                  v-for="tech in project.techStacks.slice(0, 4)" :key="tech"
                  class="text-xs text-gray-100"
                >
                  #{{ tech }}
                </text>
              </view>
            </view>
          </view>
          <view class="box-border flex flex-col gap-y-2">
            <view class="flex items-center text-xs text-gray-200">
              <text class="min-w-0 flex-1 truncate">
                {{ [typeLabel(project.type), platformLabel(project.platform)].filter(Boolean).join(' · ') }}
              </text>
              <text v-if="project.createTime" class="flex-shrink-0 text-gray-200">{{ formatTime({ d: project.createTime, f: 'yyyy/MM/dd' }) }}</text>
            </view>
          </view>
        </view>
      </view>
      <uh-data-loadmore :status="loadMoreStatus.status" :text="loadMoreStatus.text" />
    </view>
  </view>
</template>

<style scoped lang="scss">
.uh-filter-blur-xs {
  backdrop-filter: blur(4rpx);
}
</style>
