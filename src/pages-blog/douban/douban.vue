<script lang="ts" setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { onPageScroll, onPullDownRefresh, onReachBottom, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { getDoubanMovieList } from '@/api/halo-plugin'
import { useAppConfigStore } from '@/store/appConfig'
import { usePageScroll } from '@/hooks/usePageScroll'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useNavbarSticky } from '@/hooks/useNavbarSticky'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { sleep } from '@/utils/common'
import { checkImageUrl } from '@/utils/url'
import type { IDoubanMovie } from '@/api/types/halo-plugin'

/** 类型中文映射 */
const TYPE_LABELS: Record<string, string> = {
  movie: '电影',
  book: '图书',
  music: '音乐',
  game: '游戏',
  drama: '舞台剧',
}

definePage({
  style: {
    navigationBarTitleText: '豆瓣',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
  },
})

const { height: offsetTop } = useNavbarSticky()
const { scrollY, updatePageScrollValue } = usePageScroll()
/** 页面标题（插件端可配置，留空回退内置默认） */
const pageTitle = usePageTitle('douban', '豆瓣')
const appConfigStore = useAppConfigStore()
const { auditModeEnabled: calcAuditModeEnabled } = storeToRefs(appConfigStore)

const siteName = computed(() => appConfigStore.configs.featureConfig?.profile?.appInfo?.name || 'uni-halo')

/* ---------------- 分享 ---------------- */

onShareAppMessage(() => ({
  title: `${pageTitle.value} - ${siteName.value}`,
  path: '/pages-blog/douban/douban',
}))

onShareTimeline(() => ({
  title: `${pageTitle.value} - ${siteName.value}`,
  query: '',
}))

/* ---------------- 状态 ---------------- */
const { loadingStatus, loadMoreStatus, updateLoadingStatus, updateLoadMoreStatus, resetLoadMoreStatus } = useDataLoadingStatus()
const doubanList = ref<IDoubanMovie[]>([])
const queryParams = ref({ size: 10, page: 1 })

interface IFilterOption {
  label: string
  value: string
}

const typeOptions: IFilterOption[] = [
  { label: '全部', value: '' },
  { label: '电影', value: 'movie' },
  { label: '图书', value: 'book' },
  { label: '音乐', value: 'music' },
  { label: '游戏', value: 'game' },
  { label: '舞台剧', value: 'drama' },
]

const statusOptions: IFilterOption[] = [
  { label: '全部状态', value: '' },
  { label: '想做', value: 'mark' },
  { label: '在做', value: 'doing' },
  { label: '做完', value: 'done' },
]

const filterValues = ref<Record<string, string>>({ type: '', status: '' })

/** 切换类型/状态：重置分页并重新查询 */
function handleSelectFilter(key: 'type' | 'status', value: string) {
  if (filterValues.value[key] === value) { return }
  filterValues.value[key] = value
  resetLoadMoreStatus()
  doubanList.value = []
  queryParams.value.page = 1
  handleGetDoubanList()
}

/* ---------------- 数据加载 ---------------- */
async function handleGetDoubanList() {
  if (calcAuditModeEnabled.value) {
    // 审核模式
    resetLoadMoreStatus()
    const auditDoubanIds = appConfigStore.auditNamesOf('douban')
    try {
      const res = await getDoubanMovieList({ page: 1, size: 0 })
      const filtered = res.data.items.filter(item => auditDoubanIds.includes(item.id || ''))
      // 按审核配置顺序展示（数组顺序即展示顺序）
      const orderMap = new Map(auditDoubanIds.map((id, index) => [id, index]))
      filtered.sort((a, b) => (orderMap.get(a.id || '') ?? 999) - (orderMap.get(b.id || '') ?? 999))
      doubanList.value = filtered
      await sleep(600)
      updateLoadingStatus(doubanList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
      updateLoadMoreStatus({
        active: false,
        status: 'noMore',
        hasNext: false,
      })
    }
    catch (err) {
      console.error('获取审核豆瓣记录失败', err)
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
    const res = await getDoubanMovieList({
      ...queryParams.value,
      type: filterValues.value.type || undefined,
      status: filterValues.value.status || undefined,
    })
    doubanList.value = loadMoreStatus.value.active
      ? doubanList.value.concat(res.data.items)
      : res.data.items
    if (!loadMoreStatus.value.active) {
      await sleep(600)
      updateLoadingStatus(doubanList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
    }
    updateLoadMoreStatus({
      active: false,
      status: res.data.hasNext ? 'loadMore' : 'noMore',
      hasNext: res.data.hasNext,
    })
  }
  catch (err) {
    console.error('获取豆瓣记录失败', err)
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

/** 跳转豆瓣详情（事件通道传入完整数据，详情页免二次请求） */
function handleToDetail(item: IDoubanMovie) {
  uni.navigateTo({
    url: `/pages-blog/douban/detail?name=${item.id}`,
    success: res => res.eventChannel?.emit('doubanData', item),
  })
}

onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})

onLoad(() => {
  handleGetDoubanList()
})

onPullDownRefresh(() => {
  if (calcAuditModeEnabled.value) {
    uni.stopPullDownRefresh()
    return
  }
  resetLoadMoreStatus()
  queryParams.value.page = 1
  doubanList.value = []
  handleGetDoubanList()
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
    handleGetDoubanList()
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
              v-for="opt in statusOptions" :key="opt.value"
              class="uh-global-card-glass inline-flex border rounded-2xl px-4 py-1.5 text-xs shadow-none"
              :class="{ '!bg-primary text-gray-900 font-semibold': filterValues.status === opt.value, 'text-gray-500': filterValues.status !== opt.value }"
              @click="handleSelectFilter('status', opt.value)"
            >
              {{ opt.label }}
            </view>
          </view>
        </scroll-view>
      </view>
    </wd-sticky>

    <uh-data-loading
      v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus"
      empty-text="啊偶，还没有任何记录哦~" min-height="65vh" @refresh="handleGetDoubanList"
    />

    <view v-else class="box-border flex flex-col gap-3 p-3">
      <view
        v-for="item in doubanList" :key="item.id"
        class="uh-global-card-glass box-border flex gap-3 overflow-hidden rounded-xl p-3"
        @click="handleToDetail(item)"
      >
        <image
          v-if="item.poster" :src="checkImageUrl(item.poster)" mode="aspectFill"
          class="h-27 w-20 flex-shrink-0 rounded-lg"
        />
        <view v-else class="h-27 w-20 flex flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-3xs text-gray-400">
          无封面
        </view>
        <view class="min-w-0 flex flex-1 flex-col gap-1">
          <view class="flex items-center gap-2">
            <text class="flex-1 truncate text-sm text-gray-900 font-semibold">{{ item.name }}</text>
            <text v-if="item.year" class="text-10px text-gray-400">{{ item.year }}</text>
          </view>
          <view v-if="item.score" class="flex items-center gap-1">
            <wd-icon name="star-fill" size="12px" class="text-orange-400" />
            <text class="text-xs text-orange-400">{{ item.score }}</text>
          </view>
          <text v-if="item.cardSubtitle" class="line-clamp-2 text-xs text-gray-500">{{ item.cardSubtitle }}</text>
          <view v-if="item.favesRemark" class="line-clamp-1 mt-1 rounded-md bg-gray-100 px-2 py-1 text-10px text-gray-500">
            {{ item.favesRemark }}
          </view>
          <view class="mt-auto flex items-center gap-2">
            <text
              v-if="item.type"
              class="rounded-md bg-orange-100 px-1.5 py-0.5 text-10px text-orange-500"
            >
              {{ item.type ? TYPE_LABELS[item.type] || item.type : '' }}
            </text>
            <text
              v-for="genre in (item.genres || []).slice(0, 2)" :key="genre"
              class="rounded-md bg-gray-100 px-1.5 py-0.5 text-10px text-gray-500"
            >
              {{ genre }}
            </text>
          </view>
        </view>
      </view>
      <uh-data-loadmore :status="loadMoreStatus.status" :text="loadMoreStatus.text" />
    </view>
  </view>
</template>
