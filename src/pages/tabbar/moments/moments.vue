<script lang="ts" setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { onLoad, onPageScroll, onPullDownRefresh, onReachBottom, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import dayjs from 'dayjs'
import { getMomentList } from '@/api/halo'
import { useAppConfigStore } from '@/store/appConfig'
import { usePermission } from '@/hooks/usePermission'
import { NeedPluginIds } from '@/hooks/usePluginAvailable'
import { usePageScroll } from '@/hooks/usePageScroll'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useFavoritesStore } from '@/store/favorites'
import { checkAvatarUrl, checkThumbnailUrl } from '@/utils/url'
import { buildMomentFavoriteItem } from '@/utils/favorite'
import { generateUUID } from '@/utils/uuid'
import { sleep } from '@/utils/common'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { useNavbarSticky } from '@/hooks/useNavbarSticky'
import type { IMoment } from '@/api/types/halo'

definePage({
  style: {
    navigationBarTitleText: '瞬间',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
  },
})

const { scrollY, updatePageScrollValue } = usePageScroll()
const { height: offsetTop } = useNavbarSticky()
/** 页面标题（插件端可配置，留空回退内置默认） */
const pageTitle = usePageTitle('moments', '我的日常')
const appConfigStore = useAppConfigStore()
const favoritesStore = useFavoritesStore()
const { configs: haloConfigs, auditData, auditModeEnabled: calcAuditModeEnabled } = storeToRefs(appConfigStore)
/** 瞬间页配置 */
const momentConfig = computed(() => haloConfigs.value.featureConfig?.pages?.moment)

const calcEnableComment = computed(() => !!momentConfig.value?.enableComment)

const bloggerInfo = computed(() => {
  const blogger = haloConfigs.value.featureConfig?.profile?.blogger
  return {
    nickname: blogger?.nickname || '',
    avatar: checkAvatarUrl(blogger?.avatar),
  }
})

const siteName = computed(() => {
  const appInfo = haloConfigs.value.featureConfig?.profile?.appInfo
  return appInfo?.name || bloggerInfo.value.nickname || 'uni-halo'
})

const { pluginId, checking, tips, available: uniHaloPluginAvailable, check: checkPluginAvailable } = usePluginAvailable({
  pluginId: NeedPluginIds.PluginMoments,
  tips: '啊偶，功能正在维护中...',
  callback: (isAvailable) => {
    if (!isAvailable) { return }
    uni.pageScrollTo({
      scrollTop: 0,
      duration: 0,
    })
    handleGetData()
  },
})

async function handlePluginRefresh() {
  if (await checkPluginAvailable()) { handleGetData() }
}

/* ---------------- 状态 ---------------- */
const { loadingStatus, loadMoreStatus, updateLoadingStatus, updateLoadMoreStatus, resetLoadMoreStatus } = useDataLoadingStatus()
const queryParams = ref({ size: 10, page: 1 })
/** 月历选中月份 */
const selectedMonth = ref(dayjs().format('YYYY-MM'))
/** 选中月份的查询区间（ISO 8601，月初 ~ 下月初，供 startDate/endDate） */
const monthRange = computed(() => {
  const start = dayjs(selectedMonth.value).startOf('month')
  return {
    startDate: start.toISOString(),
    endDate: start.add(1, 'month').toISOString(),
  }
})
/** 列表卡片 */
type MomentCard = IMoment & {
  images?: { type?: string, url: string }[]
  videos?: { id?: string, url: string }[]
  audios?: { type?: string, url: string }[]
  spec: IMoment['spec'] & { newHtml?: string }
  year: string
  month: string
  day: string
  weekend: string
}
const dataList = ref<MomentCard[]>([])
const videoContexts = ref<Record<string, UniApp.VideoContext | undefined>>({})
const currentVideoId = ref<string | null>(null)

const WEEKDAY_TEXT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function splitMomentDate(timeStr?: string) {
  const d = timeStr ? dayjs(timeStr) : null
  if (!d || !d.isValid()) {
    return { year: '', month: '', day: '', weekend: '' }
  }
  return {
    year: `${d.year()}`,
    month: `${d.month() + 1}`,
    day: `${d.date()}`,
    weekend: WEEKDAY_TEXT[d.day()],
  }
}

function mapMomentItem(item: IMoment): MomentCard {
  const medium = (item.spec.content?.medium || [])
    .map(x => ({ ...x, url: x.url || '' }))
  const owner = item.owner
  return {
    ...item,
    ...splitMomentDate(item.spec?.releaseTime),
    owner: owner?.displayName
      ? owner
      : { displayName: bloggerInfo.value.nickname || '', name: bloggerInfo.value.nickname || '', avatar: bloggerInfo.value.avatar },
    spec: {
      ...item.spec,
      newHtml: item.spec.content?.html || '',
    },
    images: medium.filter(x => x.type === 'PHOTO').map(x => ({ ...x, url: checkThumbnailUrl(x.url, true) })),
    videos: medium.filter(x => x.type === 'VIDEO').map(x => ({ ...x, id: generateUUID() })),
    audios: medium.filter(x => x.type === 'AUDIO'),
  }
}

/* ---------------- 数据加载 ---------------- */
async function handleGetData() {
  if (!loadMoreStatus.value.active) {
    handleToTopPage(0)
  }
  if (calcAuditModeEnabled.value) {
    // 审核模式
    resetLoadMoreStatus()
    const auditMomentNames = appConfigStore.auditNamesOf('moments')
    try {
      const res = await getMomentList({ page: 1, size: 0, ...monthRange.value })
      const filtered = res.data.items
        .filter(x => x.spec.visible === 'PUBLIC' && auditMomentNames.includes(x.metadata.name))
      const orderMap = new Map(auditMomentNames.map((name, index) => [name, index]))
      filtered.sort((a, b) => (orderMap.get(a.metadata.name) ?? 999) - (orderMap.get(b.metadata.name) ?? 999))
      const tempItems = filtered.map(mapMomentItem)
      dataList.value = tempItems
      await sleep(600)
      updateLoadingStatus(dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
      updateLoadMoreStatus({
        active: false,
        status: 'noMore',
        hasNext: false,
      })
      uni.stopPullDownRefresh()
    }
    catch (err) {
      console.error(err)
      updateLoadingStatus(DataLoadingStatusEnum.Error)
      updateLoadMoreStatus({
        active: false,
        status: 'error',
      })
    }
    return
  }

  if (!loadMoreStatus.value.active) {
    updateLoadingStatus(DataLoadingStatusEnum.Loading)
  }

  try {
    const res = await getMomentList({ ...queryParams.value, ...monthRange.value })

    const tempItems = res.data.items
      .filter(x => x.spec.visible === 'PUBLIC')
      .map(mapMomentItem)

    dataList.value = loadMoreStatus.value.active
      ? dataList.value.concat(tempItems)
      : tempItems

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

/* ---------------- 交互 ---------------- */
function handleMonthCalendarChange(month: string) {
  selectedMonth.value = month
  refreshByMonth()
}

/** 回到本年本月 */
function handleBackToThisMonth() {
  selectedMonth.value = dayjs().format('YYYY-MM')
  refreshByMonth()
}

/** 月份变化后重置分页并重新拉取 */
const lastQueriedMonth = ref<string | null>(null)
function refreshByMonth(month = selectedMonth.value) {
  // 月份未变化则不重复请求
  if (lastQueriedMonth.value === month) { return }
  lastQueriedMonth.value = month
  resetLoadMoreStatus()
  updateLoadingStatus(DataLoadingStatusEnum.Loading)
  queryParams.value.page = 1
  handleGetData()
}

/* ---------------- 年份选择器 ---------------- */
const yearSheet = ref<{ show: boolean }>({ show: false })
const yearPickerValue = ref<(string | number)[]>([''])
/** 年份候选：今年往前推 10 年 */
const yearColumns = computed(() => {
  const nowYear = dayjs().year()
  return Array.from({ length: 10 }, (_, i) => ({
    label: `${nowYear - i}`,
    value: `${nowYear - i}`,
  }))
})

function handleOpenYearPicker() {
  yearPickerValue.value = [selectedMonth.value.split('-')[0]]
  yearSheet.value.show = true
}

/** wd-picker-view 滚动变化 */
function handleYearPickerChange(payload: { selectedValues: (string | number)[] }) {
  yearPickerValue.value = payload.selectedValues
}

function handleYearPickerCancel() {
  yearSheet.value.show = false
}

function handleYearPickerConfirm() {
  yearSheet.value.show = false
  const year = `${yearPickerValue.value[0]}`
  // 切到该年同月，月历跳到其所在页并高亮
  selectedMonth.value = `${year}-${selectedMonth.value.split('-')[1]}`
  refreshByMonth()
}

function handleToMomentDetail(moment: IMoment) {
  uni.navigateTo({
    url: `/pages-blog/moment-detail/moment-detail?name=${moment.metadata.name}`,
    animationType: 'slide-in-right',
  })
}

function handleToggleMomentFavorite(moment: MomentCard) {
  if (!moment) { return }
  const favorited = favoritesStore.toggle(buildMomentFavoriteItem(moment))
  uni.showToast({ icon: 'none', title: favorited ? '收藏成功' : '已取消收藏' })
}

/* ---------------- 点赞(useUpvote 持久化防重复) ---------------- */
const { likeByName, upvoteDisplay, recordUpvoteCount } = useUpvote('moments', () => '')

function handleMomentLike(moment: MomentCard) {
  if (!moment) { return }
  likeByName(moment.metadata.name, () => {
    if (moment.stats) {
      moment.stats.upvote = (moment.stats.upvote || 0) + 1
      recordUpvoteCount(moment.metadata.name, moment.stats.upvote)
    }
  })
}

/* ---------------- 评论(列表内直接弹评论窗) ---------------- */
const commentModal = ref({
  show: false,
  isComment: true,
  postName: '',
  title: '',
})

function handleMomentComment(moment: MomentCard) {
  // 不需要在列表评论
  return
  if (!moment) { return }
  if (!calcEnableComment.value) {
    uni.showToast({ icon: 'none', title: '评论功能未开启！' })
    return
  }
  commentModal.value = {
    show: true,
    isComment: true,
    postName: moment.metadata.name,
    title: '新增评论',
  }
}

function handleOnCommentModalClose(data: { refresh: boolean, isSubmit: boolean }) {
  const postName = commentModal.value.postName
  commentModal.value.show = false
  if (data.isSubmit) {
    // 评论成功后列表计数 +1
    const target = dataList.value.find(item => item.metadata.name === postName)
    if (target?.stats) {
      target.stats.totalComment = (target.stats.totalComment || 0) + 1
    }
  }
}

/* ---------------- 发布入口(有瞬间发布权限,APP 端，页面内弹窗) ---------------- */
const { can } = usePermission()
const canPublish = computed(() => can('MOMENT_MANAGE'))

const publishPopupVisible = ref(false)

function handleToPublish() {
  publishPopupVisible.value = true
}

function handlePublishPopupClose(data: { refresh: boolean, isSubmit: boolean }) {
  publishPopupVisible.value = false
  if (data.refresh) {
    // 发布成功后刷新列表
    resetLoadMoreStatus()
    queryParams.value.page = 1
    handleGetData()
  }
}

function handleToTopPage(duration = 500) {
  uni.pageScrollTo({
    scrollTop: 0,
    duration,
  })
}

/** 格式化瞬间时间 */
/* ---------------- 分享 ---------------- */

onShareAppMessage(() => ({
  title: `${pageTitle.value} - ${siteName.value}`,
  path: '/pages/tabbar/moments/moments',
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
  resetLoadMoreStatus()
  queryParams.value.page = 1
  videoContexts.value = {}
  currentVideoId.value = null
  handleGetData()
})

onReachBottom(() => {
  if (!uniHaloPluginAvailable.value) { return }
  // 审核模式
  if (calcAuditModeEnabled.value) {
    uni.showToast({ icon: 'none', title: '没有更多数据啦' })
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
    handleGetData()
  }
})
</script>

<template>
  <view class="box-border min-h-screen w-screen flex flex-col bg-page">
    <uh-navbar :scroll-y="scrollY" :use-back="false" :default-title="pageTitle" title-color="text-gray-900">
      <template #left>
        <view class="flex items-center gap-x-1">
          <uh-button
            custom-class="box-border uh-global-card-glass border !bg-primary text-gray-900 !px-1.5 !py-1 !text-xs !rounded-lg"
            @click="handleOpenYearPicker"
          >
            {{ selectedMonth.split('-')[0] }}
          </uh-button>
          <view
            class="uh-global-card-glass box-border border rounded-lg px-1.5 py-1 text-xs text-gray-900 !bg-primary"
            @click="handleBackToThisMonth"
          >
            本月
          </view>
        </view>
      </template>
    </uh-navbar>

    <uh-plugin-unavailable
      v-if="!uniHaloPluginAvailable" custom-class="h-[70vh]" :plugin-id="pluginId"
      :error-text="tips" :checking="checking" @on-refresh="handlePluginRefresh"
    />

    <template v-else>
      <wd-sticky :offset-top="offsetTop">
        <view class="box-border w-screen px-3 pt-2">
          <uh-month-calendar v-model="selectedMonth" :show-year="true" @change="handleMonthCalendarChange" />
        </view>
      </wd-sticky>

      <uh-data-loading
        v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus"
        min-height="65vh" @refresh="handleGetData"
      />

      <view v-else class="mt-3 box-border flex flex-col gap-3 overflow-hidden px-3">
        <view v-for="moment in dataList" :key="moment.metadata.name" class="w-full flex gap-x-2 overflow-hidden">
          <view v-if="false" class="w-13 flex shrink-0 flex-col gap-y-2">
            <view class="flex shrink-0 flex-col items-center font-bold">
              <text
                class="date-day text-xl text-primary leading-none"
              >
                {{ moment.day }}/{{ moment.month }}
              </text>
              <text class="date-year-month mt-2 text-sm text-gray-600">{{ moment.year }}</text>
              <text class="date-weekend mt-1 text-xs text-gray-600">{{ moment.weekend }}</text>
            </view>
            <view class="w-full flex flex-1 flex-col items-center">
              <view class="uh-global-card-glass h-4 w-4 shrink-0 rounded-full bg-primary" />
              <view class="uh-global-card-glass h-full w-1 flex-1 border rounded-full bg-primary" />
            </view>
          </view>
          <uh-moment-card
            class="w-full flex-1" :moment="moment" :blogger="bloggerInfo"
            :allow-comment="calcEnableComment"
            @detail="handleToMomentDetail(moment)" @like="handleMomentLike(moment)"
            @comment="handleMomentComment(moment)" @favorite="handleToggleMomentFavorite(moment)"
          />
        </view>
        <uh-data-loadmore :status="loadMoreStatus.status" :text="loadMoreStatus.text" />
      </view>
    </template>

    <!-- 发布瞬间 -->
    <view
      v-if="canPublish && uniHaloPluginAvailable && loadingStatus !== DataLoadingStatusEnum.Loading"
      class="uh-translate-x-center fixed bottom-78px left-1/2 z-50 flex items-center justify-center pb-safe"
    >
      <view
        class="uh-global-card-glass uh-shadow-xs box-border flex items-center justify-center gap-x-1 border rounded-full px-6 py-2.5 text-primary"
        @click="handleToPublish"
      >
        <wd-icon name="plus" size="28rpx" />
        <text class="shrink-0 text-3xs font-semibold">发布瞬间</text>
      </view>
    </view>
  </view>

  <!-- 评论弹窗 -->
  <uh-comment-modal
    v-if="commentModal.show" :show="commentModal.show" :is-comment="commentModal.isComment"
    :title="commentModal.title" :post-name="commentModal.postName" subject-kind="Moment"
    @on-close="handleOnCommentModalClose"
  />

  <!-- 发布瞬间弹窗 -->
  <uh-admin-moment-edit-popup :show="publishPopupVisible" @on-close="handlePublishPopupClose" />

  <!-- 年份选择器 -->
  <uh-glass-popup
    v-model="yearSheet.show" :z-index="999" :hide-when-close="true" position="bottom"
    custom-class="rounded-xl"
  >
    <!-- 弹窗容器 -->
    <view class="box-border w-full flex flex-col gap-y-3 p-3">
      <!-- 顶部 -->
      <view class="flex items-center justify-between">
        <text class="text-md font-bold">选择年份</text>
        <view
          class="uh-global-card-glass h-6 w-6 flex items-center justify-center border rounded-lg text-gray-500 shadow-none !bg-white/5"
          @click="handleYearPickerCancel"
        >
          <wd-icon name="close" size="28rpx" />
        </view>
      </view>
      <wd-picker-view
        v-model="yearPickerValue" :columns="yearColumns"
        custom-class="uh-picker-view !p-0 !bg-transparent !rounded-xl overflow-hidden"
        @change="handleYearPickerChange"
      />
      <!-- 底部固定操作区域 -->
      <view class="box-border w-full flex items-center gap-x-3">
        <uh-button
          class="flex-1"
          custom-class="flex-1 uh-global-card-glass uh-shadow-xs border !py-2.5 !rounded-xl !text-3xs !bg-white/90"
          @click="handleYearPickerCancel"
        >
          取消
        </uh-button>
        <uh-button
          class="flex-1"
          custom-class="flex-1 uh-global-card-glass uh-shadow-xs border !py-2.5 !rounded-xl !text-3xs !bg-primary text-gray-900"
          @click="handleYearPickerConfirm"
        >
          确定
        </uh-button>
      </view>
    </view>
  </uh-glass-popup>
</template>

<style scoped lang="scss">
:deep(.uh-picker-view) {
  .wd-picker-view__mask {
    background: transparent !important;
  }

  .wd-picker-view__roller {
    border-radius: 16rpx !important;
  }
}

.uh-translate-x-center {
  transform: translateX(-50%);
}
</style>
