<script lang="ts" setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { onPageScroll, onPullDownRefresh, onReachBottom, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { getDoubanMovieList } from '@/api/halo-plugin-third/douban'
import { useAppConfigStore } from '@/store/appConfig'
import { usePageScroll } from '@/hooks/usePageScroll'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useNavbarSticky } from '@/hooks/useNavbarSticky'
import { NeedPluginIds, usePluginAvailable } from '@/hooks/usePluginAvailable'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { sleep } from '@/utils/common'
import { checkImageUrl } from '@/utils/url'
import { DOUBAN_TYPE_LABELS, doubanStatusLabelOf, doubanStatusOptionsOf } from '@/config/douban'
import { formatTime } from '@/utils/formatTime'
import { copyToClipboard } from '@/utils/clipboard'
import type { IDoubanMovie } from '@/api/types/halo-plugin-third/douban'

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

/** 依赖插件(PluginDouban)，不可用时展示占位并可重试 */
const { pluginId, checking, tips, available: uniHaloPluginAvailable, check: checkPluginAvailable } = usePluginAvailable({
  pluginId: NeedPluginIds.PluginDouban,
  tips: '啊偶，功能正在维护中...',
  callback: (isAvailable) => {
    if (!isAvailable) { return }
    handleGetDoubanList()
  },
})

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

/** 状态筛选项(文案随类型筛选联动) */
const filterValues = ref<Record<string, string>>({ type: '', status: '' })

const statusOptions = computed(() => doubanStatusOptionsOf(filterValues.value.type))

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
    const dataItems = res.data.items.map((item) => {
      item._score = Number(item.score)
      return item
    })
    doubanList.value = loadMoreStatus.value.active
      ? doubanList.value.concat(dataItems)
      : dataItems
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

/** 记录状态文案(如 看过/想读，随类型联动) */
function statusLabelOf(item: IDoubanMovie) {
  return doubanStatusLabelOf(item.type, item.favesStatus)
}

function handleCopy(item: IDoubanMovie) {
  copyToClipboard(item.link || '', '链接已复制成功！')
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
  doubanList.value = []
  handleGetDoubanList()
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
    handleGetDoubanList()
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
      v-if="uniHaloPluginAvailable && loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus"
      empty-text="啊偶，还没有任何记录哦~" min-height="65vh" @refresh="handleGetDoubanList"
    />

    <view v-else-if="uniHaloPluginAvailable" class="box-border flex flex-col gap-3 p-3">
      <view
        v-for="item in doubanList" :key="item.id"
        class="uh-global-card-glass uh-shadow-xs box-border flex gap-3 overflow-hidden rounded-xl p-3"
      >
        <!-- 海报(与右侧内容等高，状态角标压底部) -->
        <view class="relative w-28 flex-shrink-0 self-stretch overflow-hidden rounded-lg">
          <image
            v-if="item.poster" :src="checkImageUrl(item.poster)" mode="aspectFill"
            class="h-full w-full"
          />
          <view v-else class="h-full w-full flex items-center justify-center bg-gray-100 text-3xs text-gray-400">
            无封面
          </view>
          <view
            v-if="statusLabelOf(item)"
            class="absolute bottom-0 left-0 w-full bg-black/50 py-0.5 text-center text-3xs text-white"
          >
            {{ statusLabelOf(item) }}
          </view>
        </view>
        <view class="min-w-0 flex flex-1 flex-col gap-1.5 py-0.5">
          <view class="flex items-baseline gap-2">
            <text class="min-w-0 flex-1 truncate text-sm text-gray-900 font-bold">{{ item.name }}</text>
            <text v-if="item.favesCreateTime" class="flex-shrink-0 text-3xs text-gray-400">{{ formatTime({ d: item.favesCreateTime, f: 'yyyy/MM' }) }}</text>
          </view>
          <view v-if="item.score" class="flex items-center gap-1">
            <text class="text-xs text-gray-600">评分（<text class="text-xs text-orange-400">{{ item.score }}</text>）</text>
            <view class="flex shrink-0 items-center gap-x-2">
              <wd-rate v-model="item._score" size="32rpx" readonly allow-half custom-style="--wot-rate-item-space:4rpx" />
            </view>
          </view>
          <text v-if="item.cardSubtitle" class="line-clamp-1 text-3xs text-gray-600 leading-5">{{ item.cardSubtitle }}</text>
          <view v-if="item.favesRemark" class="mt-0.5 flex gap-2">
            <view class="w-0.5 flex-shrink-0 self-stretch rounded bg-primary" />
            <text class="min-w-0 flex-1 truncate text-3xs text-gray-400 leading-5">短评：{{ item.favesRemark }}</text>
          </view>
          <view class="mt-auto flex items-center gap-1.5 pt-1">
            <view class="flex flex-1 items-center gap-x-1.5">
              <text
                v-if="item.type"
                class="rounded-xl bg-orange-100 px-2 py-0.5 text-xs text-orange-500"
              >
                {{ DOUBAN_TYPE_LABELS[item.type] || item.type }}
              </text>
              <text
                v-for="genre in (item.genres || []).slice(0, 2)" :key="genre"
                class="rounded-xl bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
              >
                {{ genre }}
              </text>
            </view>
            <uh-button class="shrink-0" custom-class="uh-global-card-glass !border !py-0.5 !px-2 !text-xs !rounded-md" @click="handleCopy(item)">
              复制链接
            </uh-button>
          </view>
        </view>
      </view>
      <uh-data-loadmore :status="loadMoreStatus.status" :text="loadMoreStatus.text" />
    </view>
  </view>
</template>
