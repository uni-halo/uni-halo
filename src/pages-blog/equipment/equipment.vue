<script lang="ts" setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { onLoad, onPageScroll, onPullDownRefresh, onReachBottom, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { getEquipmentGroupList, getEquipmentList } from '@/api/halo-plugin-third/equipment'
import { useAppConfigStore } from '@/store/appConfig'
import { checkImageUrl } from '@/utils/url'
import { NeedPluginIds, usePluginAvailable } from '@/hooks/usePluginAvailable'
import { usePageScroll } from '@/hooks/usePageScroll'
import { usePageTitle } from '@/hooks/usePageTitle'
import { sleep } from '@/utils/common'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { useNavbarSticky } from '@/hooks/useNavbarSticky'
import type { IEquipment, IEquipmentGroup } from '@/api/types/halo-plugin-third/equipment'

definePage({
  style: {
    navigationBarTitleText: '装备',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
  },
})

const { height: offsetTop } = useNavbarSticky()
const { scrollY, updatePageScrollValue } = usePageScroll()
/** 页面标题（插件端可配置，留空回退内置默认） */
const pageTitle = usePageTitle('equipment', '装备展示')
const appConfigStore = useAppConfigStore()
const { configs: haloConfigs } = storeToRefs(appConfigStore)

const siteName = computed(() => haloConfigs.value.featureConfig?.profile?.appInfo?.name || 'uni-halo')

/** 依赖插件(equipment) */
const { pluginId, checking, tips, available: pluginAvailable, check: checkPluginAvailable } = usePluginAvailable({
  pluginId: NeedPluginIds.PluginEquipment,
  tips: '啊偶，功能正在维护中...',
  callback: (isAvailable) => {
    if (!isAvailable) { return }
    uni.pageScrollTo({
      scrollTop: 0,
      duration: 0,
    })
    handleGetCategory()
  },
})

/* ---------------- 状态 ---------------- */
const { loadingStatus, loadMoreStatus, updateLoadingStatus, updateLoadMoreStatus, resetLoadMoreStatus } = useDataLoadingStatus()
const category = ref<{ activeIndex: number, list: IEquipmentGroup[] }>({
  activeIndex: 0,
  list: [],
})
const queryParams = ref({ size: 10, page: 1, group: '' })
const dataList = ref<IEquipment[]>([])

/* ---------------- 数据加载 ---------------- */
async function handleGetCategory() {
  try {
    const res = await getEquipmentGroupList({ page: 1, size: 0 })
    category.value.list = ((res.data as unknown as { items?: IEquipmentGroup[] })?.items || [])
      .sort((a, b) => (a.spec.priority ?? 0) - (b.spec.priority ?? 0))
    category.value.list.unshift({ metadata: { name: undefined }, spec: { displayName: '全部', priority: 0 } })
    if (category.value.list.length !== 0) {
      queryParams.value.group = category.value.list[0].metadata.name || ''
      handleGetData(true)
    }
  }
  catch (e) {
    console.error(e)
    category.value = { activeIndex: 0, list: [] }
  }
}

async function handleGetData(isClearList = false) {
  if (isClearList) {
    dataList.value = []
    queryParams.value.page = 1
    resetLoadMoreStatus()
  }

  if (!loadMoreStatus.value.active) {
    updateLoadingStatus(DataLoadingStatusEnum.Loading)
  }

  try {
    const res = await getEquipmentList({ ...queryParams.value })
    if (res.data.items.length !== 0) {
      const list = res.data.items.map(item => ({
        ...item,
        spec: { ...item.spec, cover: checkImageUrl(item.spec.cover) },
      }))
      dataList.value = loadMoreStatus.value.active
        ? dataList.value.concat(list)
        : list
    }
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

function handleGetDataByCategory(index: number, cate: IEquipmentGroup) {
  queryParams.value.group = cate.metadata.name || ''
  queryParams.value.page = 1
  uni.pageScrollTo({ scrollTop: 0, duration: 500 })
  dataList.value = []
  category.value.activeIndex = index
  handleGetData(true)
}

/* ---------------- 装备详情弹窗（无详情页：弹窗展示，底部按需提供复制装备地址） ---------------- */
const detailVisible = ref(false)
const currentEquipment = ref<IEquipment | null>(null)
const currentEquipmentUrl = computed(() => currentEquipment.value?.spec.url?.trim() || '')

function handleTapEquipment(item: IEquipment) {
  currentEquipment.value = item
  detailVisible.value = true
}

function handleCloseDetail() {
  detailVisible.value = false
}

function handleCopyEquipmentUrl() {
  if (!currentEquipmentUrl.value) { return }
  uni.setClipboardData({
    data: currentEquipmentUrl.value,
    success: () => uni.showToast({ icon: 'none', title: '装备地址已复制' }),
  })
}

function handlePreviewCover() {
  if (!currentEquipment.value) { return }
  uni.previewImage({
    urls: [currentEquipment.value.spec.cover],
    indicator: 'number',
    loop: true,
  })
}

/* ---------------- 分享 ---------------- */

onShareAppMessage(() => ({
  title: `${pageTitle.value} - ${siteName.value}`,
  path: '/pages-blog/equipment/equipment',
}))

onShareTimeline(() => ({
  title: `${pageTitle.value} - ${siteName.value}`,
  query: '',
}))

/* ---------------- 生命周期 ---------------- */
onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})

onLoad(async () => {
  // 检查插件可用性
  await checkPluginAvailable()
  if (!pluginAvailable.value) {
    uni.stopPullDownRefresh()
    return
  }
  handleGetCategory()
})

onPullDownRefresh(() => {
  if (!pluginAvailable.value) {
    uni.stopPullDownRefresh()
    return
  }
  dataList.value = []
  queryParams.value.page = 1
  handleGetData(true)
})

onReachBottom(() => {
  if (!pluginAvailable.value) { return }
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
    handleGetData(false)
  }
})
</script>

<template>
  <view class="box-border min-h-screen w-screen flex flex-col bg-page">
    <uh-navbar :scroll-y="scrollY" :default-title="pageTitle" title-color="text-gray-900" />

    <uh-plugin-unavailable
      v-if="!pluginAvailable" custom-class="h-[70vh]" :plugin-id="pluginId" :error-text="tips"
      :checking="checking" @on-refresh="checkPluginAvailable"
    />

    <template v-else>
      <wd-sticky v-if="category.list.length !== 0" :offset-top="offsetTop">
        <scroll-view :scroll-x="true" :show-scrollbar="false" class="box-border w-screen whitespace-nowrap pt-2">
          <view
            v-for="(cate, index) in category.list" :key="index"
            class="uh-global-card-glass ml-3 inline-flex border rounded-2xl px-4 py-1.5 text-xs shadow-none"
            :class="{ '!bg-primary text-gray-900 font-semibold': index === category.activeIndex }"
            @click="handleGetDataByCategory(index, cate)"
          >
            {{ cate.spec.displayName }}
            <text v-if="cate.spec.displayName !== '全部'">
              ({{ cate.status?.equipmentCount ?? 0 }})
            </text>
          </view>
        </scroll-view>
      </wd-sticky>

      <uh-data-loading
        v-if="loadingStatus !== DataLoadingStatusEnum.Success" min-height="65vh"
        :loading-status="loadingStatus" @refresh="handleGetCategory"
      />

      <view v-else class="box-border w-full p-3 pb-0">
        <view class="grid grid-cols-2 gap-2.5">
          <view
            v-for="(item, index) in dataList" :key="index"
            class="uh-global-card-glass uh-shadow-xs relative box-border w-full overflow-hidden rounded-xl"
            @click="handleTapEquipment(item)"
          >
            <wd-img class="h-30 w-full" :src="item.spec.cover" mode="aspectFill" lazy-load>
              <template #loading>
                <wd-loading size="64rpx" custom-class="text-primary" />
              </template>
            </wd-img>
            <view class="box-border w-full p-2.5">
              <view v-if="item.spec.displayName" class="line-clamp-1 text-sm text-gray-900 font-medium">
                {{ item.spec.displayName }}
              </view>
              <view v-if="item.spec.description" class="line-clamp-1 mt-1 text-xs text-gray-500">
                {{ item.spec.description }}
              </view>
              <view v-if="item.spec.specification" class="line-clamp-1 mt-1 text-xs text-gray-500">
                装备规格：{{ item.spec.specification }}
              </view>
            </view>
          </view>
        </view>
        <uh-data-loadmore :status="loadMoreStatus.status" :text="loadMoreStatus.text" />
      </view>
    </template>

    <!-- 装备详情弹窗 -->
    <uh-glass-popup
      v-model="detailVisible" position="bottom" custom-class="!rounded-2xl" :z-index="110"
      @close="handleCloseDetail"
    >
      <view v-if="currentEquipment" class="box-border flex flex-col gap-y-2.5 p-3">
        <!-- 顶部：标题 + 关闭按钮 -->
        <view class="relative mb-2 box-border w-full flex items-center justify-center">
          <text class="text-md font-bold">装备详情</text>
          <view
            class="uh-global-card-glass absolute right-0 top-0 h-6 w-6 flex items-center justify-center border rounded-lg shadow-none"
            @click="handleCloseDetail"
          >
            <wd-icon name="close" size="28rpx" class="text-gray-500" />
          </view>
        </view>

        <view class="h-50 w-full overflow-hidden rounded-lg">
          <wd-img
            class="h-full w-full" :src="currentEquipment.spec.cover" mode="aspectFill"
            @click="handlePreviewCover"
          >
            <template #loading>
              <wd-loading size="64rpx" custom-class="text-primary" />
            </template>
          </wd-img>
        </view>

        <view v-if="currentEquipment.spec.displayName" class="text-sm text-gray-900 font-medium">
          装备名称：{{ currentEquipment.spec.displayName }}
        </view>
        <view v-if="currentEquipment.spec.description" class="text-xs text-gray-500 leading-5">
          装备描述：{{ currentEquipment.spec.description }}
        </view>
        <view v-if="currentEquipment.spec.specification" class="text-xs text-gray-500">
          装备规格：{{ currentEquipment.spec.specification }}
        </view>
        <view class="box-border w-full flex items-center pt-2">
          <uh-button
            v-if="currentEquipmentUrl"
            class="w-full flex-1" custom-class="w-full uh-global-card-glass !border !shadow-none !rounded-xl !py-2" @click="handleCopyEquipmentUrl"
          >
            复制装备地址
          </uh-button>
        </view>
      </view>
    </uh-glass-popup>
  </view>
</template>
