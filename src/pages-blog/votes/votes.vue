<script lang="ts" setup>
/**
 * 投票列表页(源自旧项目 pagesA/votes,新建复刻)
 * 展示投票列表,每个投票项用 uh-vote-card 渲染
 */
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { getVoteList } from '@/api/uni-halo'
import { useAppConfigStore } from '@/store/appConfig'
import { usePluginAvailable } from '@/utils/plugin'
import type { IVoteItem } from '@/api/types/uni-halo'

definePage({
  style: {
    navigationBarTitleText: '投票中心',
    enablePullDownRefresh: true,
  },
})

const appConfigStore = useAppConfigStore()
const calcAuditModeEnabled = computed(() => appConfigStore.auditModeEnabled)

/** 依赖插件(plugin-vote) */
const uniHaloPluginId = 'plugin-vote'
const uniHaloPluginAvailable = ref(true)

/* ---------------- 状态 ---------------- */
const loading = ref<'loading' | 'success' | 'error'>('loading')
const dataList = ref<IVoteItem[]>([])
const hasNext = ref(false)
const queryParams = ref({ page: 1, size: 10 })
const isLoadMore = ref(false)
const loadMoreText = ref('加载中...')

async function handleGetData() {
  if (calcAuditModeEnabled.value) {
    loading.value = 'success'
    loadMoreText.value = '呜呜，没有更多数据啦~'
    uni.stopPullDownRefresh()
    return
  }

  uni.showLoading({ mask: true, title: '加载中...' })
  if (!isLoadMore.value) {
    loading.value = 'loading'
  }
  loadMoreText.value = '加载中...'

  try {
    const res = await getVoteList({ ...queryParams.value })
    loading.value = 'success'
    hasNext.value = (res.data as unknown as { hasNext?: boolean }).hasNext || false
    dataList.value = isLoadMore.value
      ? dataList.value.concat(res.data as IVoteItem[])
      : (res.data as IVoteItem[])
    loadMoreText.value = hasNext.value ? '上拉加载更多' : '呜呜，没有更多数据啦~'
  }
  catch (err) {
    console.error(err)
    loading.value = 'error'
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
  uniHaloPluginAvailable.value = await usePluginAvailable(uniHaloPluginId)
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
    <uh-plugin-unavailable
      v-if="!uniHaloPluginAvailable"
      :plugin-id="uniHaloPluginId"
      error-text="检测到当前插件没有安装或者启用，无法使用投票功能哦，请联系管理员"
      @on-refresh="handleGetData"
    />
    <template v-else>
      <view v-if="loading !== 'success'" class="loading-wrap p-3">
        <wd-skeleton :row="3" :animated="true" />
      </view>

      <view v-else class="content flex flex-col gap-4 p-3">
        <view v-if="dataList.length === 0" class="min-h-[60vh] flex items-center justify-center content-empty">
          <wd-empty description="博主还未发布投票~" />
        </view>
        <block v-else>
          <uh-vote-card
            v-for="vote in dataList"
            :key="vote.name"
            :vote-name="vote.name"
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
