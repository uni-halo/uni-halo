<script lang="ts" setup>
/**
 * 投票列表页(源自旧项目 pagesA/votes,新建复刻)
 * 展示投票列表,每个投票项用 uh-vote-card 渲染
 */
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { getVoteList } from '@/api/uni-halo'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { useAppConfigStore } from '@/store/appConfig'
import type { IVoteItem } from '@/api/types/uni-halo'

definePage({
  style: {
    navigationBarTitleText: '投票中心',
    enablePullDownRefresh: true,
    navigationStyle: 'custom',
  },
})

const appConfigStore = useAppConfigStore()
const calcAuditModeEnabled = computed(() => appConfigStore.auditModeEnabled)

/** 依赖插件(plugin-vote) */
const uniHaloPluginId = 'plugin-vote'
const { available: uniHaloPluginAvailable, check: checkPluginAvailable } = usePluginAvailable(uniHaloPluginId)

/* ---------------- 状态 ---------------- */
const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()
const dataList = ref<IVoteItem[]>([])
const hasNext = ref(false)
const queryParams = ref({ page: 1, size: 10 })
const isLoadMore = ref(false)
const loadMoreText = ref('加载中...')

async function handleGetData() {
  if (calcAuditModeEnabled.value) {
    updateLoadingStatus(
      dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success,
    )
    loadMoreText.value = '呜呜，没有更多数据啦~'
    uni.stopPullDownRefresh()
    return
  }

  uni.showLoading({ mask: true, title: '加载中...' })
  if (!isLoadMore.value) {
    updateLoadingStatus(DataLoadingStatusEnum.Loading)
  }
  loadMoreText.value = '加载中...'

  try {
    const res = await getVoteList({ ...queryParams.value })
    hasNext.value = res.data.hasNext || false
    dataList.value = isLoadMore.value
      ? dataList.value.concat(res.data.items)
      : res.data.items
    updateLoadingStatus(
      dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success,
    )
    loadMoreText.value = hasNext.value ? '上拉加载更多' : '呜呜，没有更多数据啦~'
  }
  catch (err) {
    console.error(err)
    updateLoadingStatus(DataLoadingStatusEnum.Error)
    loadMoreText.value = '加载失败，请下拉刷新！'
  }
  finally {
    setTimeout(() => {
      uni.hideLoading()
      uni.stopPullDownRefresh()
    }, 500)
  }
}

function handleOnVoteSuccess() {
  uni.showToast({ icon: 'none', title: '投票成功！' })
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
onLoad(async () => {
  await checkPluginAvailable()
  if (!uniHaloPluginAvailable.value) {
    uni.stopPullDownRefresh()
    return
  }
  handleGetData()
})

onPullDownRefresh(() => {
  if (!uniHaloPluginAvailable.value) {
    uni.stopPullDownRefresh()
    return
  }
  isLoadMore.value = false
  queryParams.value.page = 1
  handleGetData()
})

onReachBottom(() => {
  if (!uniHaloPluginAvailable.value)
    return
  if (hasNext.value) {
    queryParams.value.page += 1
    isLoadMore.value = true
    handleGetData()
  }
  else {
    uni.showToast({ icon: 'none', title: '没有更多数据了' })
  }
})
</script>

<template>
  <view class="app-page min-h-screen w-screen flex flex-col bg-page">
    <!-- 自定义导航 -->
    <uh-navbar default-title="投票中心" title-color="text-gray-900" />

    <uh-plugin-unavailable
      v-if="!uniHaloPluginAvailable"
      :plugin-id="uniHaloPluginId"
      error-text="检测到当前插件没有安装或者启用，无法使用投票功能哦，请联系管理员"
      @on-refresh="handleGetData"
    />
    <template v-else>
      <!-- 加载/错误/空占位(状态机) -->
      <view v-if="loadingStatus !== 'success'">
        <uh-data-loading
          :loading-status="loadingStatus"
          empty-text="博主还未发布投票~"
          @refresh="handleGetData"
        />
      </view>

      <view v-else class="content flex flex-col gap-4 p-3">
        <block v-if="dataList.length !== 0">
          <uh-vote-card
            v-for="vote in dataList"
            :key="vote.metadata?.name"
            :vote-name="vote.metadata?.name || ''"
            @on-vote-success="handleOnVoteSuccess"
          />
          <view class="load-text py-5 text-center text-[24rpx] text-gray-400">
            {{ loadMoreText }}
          </view>
          <view class="to-top-btn uh-global-card-glass fixed bottom-[100rpx] right-6 z-6 h-[72rpx] w-[72rpx] flex items-center justify-center rounded-full" @click="handleToTopPage()">
            <wd-icon name="arrow-up" size="20px" color="#6b7280" />
          </view>
        </block>
      </view>
    </template>
  </view>
</template>
