<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { onLoad, onPageScroll, onPullDownRefresh, onReachBottom, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { getFriendLinkGroupList, getFriendLinkList } from '@/api/halo'
import { getMiniProgramLinkGroupedList } from '@/api/uni-halo'
import { useAppConfigStore } from '@/store/appConfig'
import { sleep } from '@/utils/common'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { usePageScroll } from '@/hooks/usePageScroll'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useDialog } from '@wot-ui/ui'
import { DIALOG_CANCEL_BUTTON_PROPS, DIALOG_CONFIRM_BUTTON_PROPS } from '@/config/dialog'
import { useNavbarSticky } from '@/hooks/useNavbarSticky'
import { checkAvatarUrl, checkImageUrl } from '@/utils/url'
import { getAvatarFallbackText } from '@/utils/avatar'
import { NeedPluginIds } from '@/hooks/usePluginAvailable'
import type { ILink, ILinkGroup } from '@/api/types/halo'
import type { IMiniProgramLink, IMiniProgramLinkGroupVo } from '@/api/types/uni-halo'

const dialog = useDialog()

definePage({
  style: {
    navigationBarTitleText: '友情链接',
    enablePullDownRefresh: true,
    navigationStyle: 'custom',
  },
})

const { height: offsetTop } = useNavbarSticky()
const { scrollY, updatePageScrollValue } = usePageScroll()
/** 页面标题（插件端可配置，留空回退内置默认） */
const pageTitle = usePageTitle('friendLinks', '友情链接')
const appConfigStore = useAppConfigStore()
const { configs, auditData, auditModeEnabled } = storeToRefs(appConfigStore)

/* ---------------- 分享 ---------------- */

onShareAppMessage(() => ({
  title: pageTitle.value,
  path: '/pages-blog/friend-links/friend-links',
}))

onShareTimeline(() => ({
  title: pageTitle.value,
  query: '',
}))

/* ---------------- 依赖插件 ---------------- */
/** 站点 tab:PluginLinks */
const { pluginId: sitePluginId, checking: siteChecking, tips: siteTips, available: sitePluginAvailable, check: checkSitePluginAvailable } = usePluginAvailable({
  pluginId: NeedPluginIds.PluginLinks,
  tips: '啊偶，功能正在维护中...',
  callback: (isAvailable) => {
    if (!isAvailable) { return }
    uni.pageScrollTo({
      scrollTop: 0,
      duration: 0,
    })
    handleGetLinkGroupData()
  },
})
/** 小程序 tab:uni-halo */
const { pluginId: miniPluginId, checking: miniChecking, tips: miniTips, available: miniPluginAvailable, check: checkMiniPluginAvailable } = usePluginAvailable({
  pluginId: NeedPluginIds.PluginUniHalo,
  tips: '啊偶，功能正在维护中...',
  callback: (isAvailable) => {
    if (!isAvailable) { return }
    uni.pageScrollTo({
      scrollTop: 0,
      duration: 0,
    })
    handleGetMiniProgramLinks()
  },
})

/** 重新检测站点插件:可用则拉取友链数据(供 uh-plugin-unavailable 刷新按钮) */
async function handleSitePluginRefresh() {
  if (await checkSitePluginAvailable())
    handleGetLinkGroupData()
}

/** 重新检测小程序插件:可用则拉取小程序链接数据(供 uh-plugin-unavailable 刷新按钮) */
async function handleMiniPluginRefresh() {
  if (await checkMiniPluginAvailable())
    handleGetMiniProgramLinks()
}

/** 是否开放公开提交申请（通用配置-友链信息-基本配置 submissionEnabled；默认 true） */
const submissionEnabled = computed(() => (configs.value.featureConfig?.linkInfo?.submissionEnabled ?? true))

/* ---------------- tabs ---------------- */
const activeTabIndex = ref(0)

/** 顶部 tab 定义(同收藏页胶囊 chip;审核模式下小程序 tab 隐藏) */
const friendLinkTabs = computed(() => [
  { key: 'site', label: '站点' },
  ...(auditModeEnabled.value ? [] : [{ key: 'mini', label: '小程序' }]),
])

function handleOnTabChange(e: { index: number }) {
  activeTabIndex.value = e.index
}

// 审核模式下小程序 tab 隐藏,强制停留在站点 tab
watch(() => auditModeEnabled.value, (enabled) => {
  if (enabled)
    activeTabIndex.value = 0
})

/* ==================== 站点 tab(plugin-links) ==================== */
/* ---------------- 状态 ---------------- */
const { loadingStatus: siteLoadingStatus, loadMoreStatus: siteLoadMoreStatus, updateLoadingStatus: updateSiteLoadingStatus, updateLoadMoreStatus: updateSiteLoadMoreStatus, resetLoadMoreStatus: resetSiteLoadMoreStatus } = useDataLoadingStatus()
const queryParams = ref({ size: 10, page: 1 })
const detail = ref<{ show: boolean, data: ILink | null }>({ show: false, data: null })
const linkGroupList = ref<ILinkGroup[]>([])
const dataList = ref<ILink[]>([])

/* ---------------- 数据加载 ---------------- */
function findLinkGroupDisplayNameByGroupMetadataName(groupName?: string): string {
  if (linkGroupList.value.length === 0)
    return groupName || '未分组'
  const found = linkGroupList.value.find(item => item.metadata.name === groupName)
  return found?.spec.displayName || groupName || '未分组'
}

async function handleGetLinkGroupData() {
  try {
    const res = await getFriendLinkGroupList({ page: 1, size: 0 })
    linkGroupList.value = res.data || []
    handleGetData()
  }
  catch (err) {
    console.error(err)
    updateSiteLoadingStatus(DataLoadingStatusEnum.Error)
  }
}

async function handleGetData() {
  if (!siteLoadMoreStatus.value.active) {
    updateSiteLoadingStatus(DataLoadingStatusEnum.Loading)
  }

  try {
    const res = await getFriendLinkList({ ...queryParams.value })
    // 审核模式:站点链接仅展示选中 LinkGroup 分组内的
    let items = res.data.items
    if (auditModeEnabled.value) {
      const auditGroupNames = appConfigStore.auditNamesOf('linkGroups')
      items = items.filter(item => item.spec.groupName && auditGroupNames.includes(item.spec.groupName))
    }
    const list = items.map(item => ({
      ...item,
      spec: {
        ...item.spec,
        logo: checkAvatarUrl(item.spec.logo),
        groupName: findLinkGroupDisplayNameByGroupMetadataName(item.spec.groupName),
      },
    }))
    // 分页加载时累加,首次/刷新时覆盖(修复重复数据)
    dataList.value = siteLoadMoreStatus.value.active ? dataList.value.concat(list) : list
    if (!siteLoadMoreStatus.value.active) {
      await sleep(600)
      updateSiteLoadingStatus(
        dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success,
      )
    }
    updateSiteLoadMoreStatus({
      active: false,
      status: res.data.hasNext ? 'loadMore' : 'noMore',
      hasNext: res.data.hasNext,
    })
  }
  catch (err) {
    console.error(err)
    if (siteLoadMoreStatus.value.active) {
      updateSiteLoadMoreStatus({
        active: false,
        status: 'error',
      })
    }
    else {
      updateSiteLoadingStatus(DataLoadingStatusEnum.Error)
    }
  }
  finally {
    uni.stopPullDownRefresh()
  }
}

/** 站点友链按分组聚合(无分组链接归入「未分组」,参考小程序 tab 分组展示) */
const siteGroups = computed(() => {
  const map = new Map<string, ILink[]>()
  for (const link of dataList.value) {
    const key = link.spec.groupName || '未分组'
    if (!map.has(key))
      map.set(key, [])
    map.get(key)!.push(link)
  }
  return Array.from(map.entries()).map(([groupName, links]) => ({ groupName, links }))
})

/* ---------------- 站点交互 ---------------- */
function handleOnLinkEvent(link: ILink) {
  detail.value = { show: true, data: link }
}

function handleCopyLink(link: ILink) {
  uni.setClipboardData({
    data: `${link.spec.displayName}:${link.spec.url}`,
    showToast: false,
    success: () => {
      uni.showToast({ icon: 'none', title: '链接复制成功！' })
    },
    fail: () => {
      uni.showToast({ icon: 'none', title: '复制失败！' })
    },
  })
}

/** 站点友链申请弹窗 */
const siteApplyShow = ref(false)
/** 站点友链信息弹窗 */
const infoShow = ref(false)

function handleOpenSiteApply() {
  siteApplyShow.value = true
}

function handleSiteApplyClose() {
  siteApplyShow.value = false
}

function handleOpenInfo() {
  infoShow.value = true
}

function handleInfoClose() {
  infoShow.value = false
}

/** 小程序友链信息弹窗(展示小程序申请提交的信息) */
const miniInfoShow = ref(false)

function handleOpenMiniInfo() {
  miniInfoShow.value = true
}

function handleMiniInfoClose() {
  miniInfoShow.value = false
}

/* ==================== 小程序 tab(uni-halo) ==================== */
/* ---------------- 状态 ---------------- */
const { loadingStatus: miniLoadingStatus, updateLoadingStatus: updateMiniLoadingStatus } = useDataLoadingStatus()
const miniGroups = ref<IMiniProgramLinkGroupVo[]>([])
const miniDetail = ref<{ show: boolean, data: IMiniProgramLink | null }>({ show: false, data: null })
const applyShow = ref(false)

/* ---------------- 数据加载 ---------------- */
async function handleGetMiniProgramLinks() {
  updateMiniLoadingStatus(DataLoadingStatusEnum.Loading)
  try {
    const res = await getMiniProgramLinkGroupedList()
    miniGroups.value = res.data || []
    await sleep(600)
    updateMiniLoadingStatus(
      miniGroups.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success,
    )
  }
  catch (err) {
    console.error(err)
    updateMiniLoadingStatus(DataLoadingStatusEnum.Error)
  }
  finally {
    uni.stopPullDownRefresh()
  }
}

function handleOnMiniLinkEvent(link: IMiniProgramLink) {
  miniDetail.value = { show: true, data: link }
}

function handleOpenApply() {
  applyShow.value = true
}

function handleApplyClose(data: { isSubmit: boolean, refresh: boolean }) {
  applyShow.value = false
  if (data.refresh) { handleGetMiniProgramLinks() }
}

/** 复制小程序地址 */
function handleCopyMiniProgramCode(link: IMiniProgramLink) {
  const url = link.spec?.link
  if (!url) {
    uni.showToast({ icon: 'none', title: '该小程序未填写跳转地址' })
    return
  }
  uni.setClipboardData({
    data: url,
    showToast: false,
    success: () => {
      uni.showToast({ icon: 'none', title: '地址复制成功！' })
    },
    fail: () => {
      uni.showToast({ icon: 'none', title: '复制失败！' })
    },
  })
}

/** 预览太阳码(支持长按识别/保存) */
function handlePreviewMiniProgramCode(link: IMiniProgramLink) {
  const code = link.spec?.miniProgramCode
  if (!code)
    return
  uni.previewImage({
    urls: [checkImageUrl(code)],
    current: checkImageUrl(code),
  })
}

/** 保存太阳码到相册 */
function handleSaveMiniProgramCode(link: IMiniProgramLink) {
  const code = link.spec?.miniProgramCode
  if (!code)
    return
  uni.showLoading({ title: '保存中...' })
  uni.downloadFile({
    url: checkImageUrl(code),
    success: (res) => {
      uni.saveImageToPhotosAlbum({
        filePath: res.tempFilePath,
        success: () => {
          uni.showToast({ icon: 'none', title: '已保存到相册' })
        },
        fail: () => {
          dialog.alert({
            title: '保存失败',
            msg: '请检查相册权限后重试',
            zIndex: 9999,
            confirmButtonProps: DIALOG_CONFIRM_BUTTON_PROPS,
            cancelButtonProps: DIALOG_CANCEL_BUTTON_PROPS,
          })
        },
        complete: () => {
          uni.hideLoading()
        },
      })
    },
    fail: () => {
      uni.hideLoading()
      uni.showToast({ icon: 'none', title: '图片下载失败' })
    },
  })
}

/** 小程序打开模式：fullscreen 全屏（navigateToMiniProgram，默认）/ halfScreen 半屏（openEmbeddedMiniProgram） */
const miniProgramOpenMode = computed<'fullscreen' | 'halfScreen'>(() => {
  const mode = configs.value.featureConfig?.preferences?.linkPage?.miniProgramOpenMode
  return mode === 'halfScreen' ? 'halfScreen' : 'fullscreen'
})

function handleToMiniProgram(data: IMiniProgramLink) {
  const appId = data.spec?.appId?.trim() || ''
  if (!appId) {
    uni.showToast({ icon: 'none', title: '该链接未配置小程序 AppID' })
    return
  }
  const path = data.spec?.path?.trim() || ''
  const common = {
    appId,
    path,
    success: (res: unknown) => {
      console.log('打开小程序成功', res)
    },
    fail: (res: unknown) => {
      console.log('打开小程序失败', res)
    },
  }
  if (miniProgramOpenMode.value === 'halfScreen') {
    uni.openEmbeddedMiniProgram(common)
  }
  else {
    uni.navigateToMiniProgram(common)
  }
}

/* ---------------- 生命周期 ---------------- */
onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})

onLoad(async () => {
  await Promise.all([
    checkSitePluginAvailable(),
    checkMiniPluginAvailable(),
  ])
  if (sitePluginAvailable.value) { handleGetLinkGroupData() }
  if (miniPluginAvailable.value) { handleGetMiniProgramLinks() }
  if (!sitePluginAvailable.value && !miniPluginAvailable.value) { uni.stopPullDownRefresh() }
})

onPullDownRefresh(() => {
  if (activeTabIndex.value === 0) {
    if (!sitePluginAvailable.value) {
      uni.stopPullDownRefresh()
      return
    }
    resetSiteLoadMoreStatus()
    queryParams.value.page = 1
    dataList.value = []
    handleGetData()
  }
  else {
    if (!miniPluginAvailable.value) {
      uni.stopPullDownRefresh()
      return
    }
    handleGetMiniProgramLinks()
  }
})

onReachBottom(() => {
  if (activeTabIndex.value === 0) {
    if (!sitePluginAvailable.value)
      return
    // 正在加载时阻止重复请求
    if (siteLoadMoreStatus.value.active) {
      return
    }
    // 有更多数据时继续加载
    if (siteLoadMoreStatus.value.hasNext) {
      queryParams.value.page += 1
      updateSiteLoadMoreStatus({
        active: true,
        status: 'loading',
      })
      handleGetData()
    }
  }
  else {
    uni.showToast({ icon: 'none', title: '没有更多数据了' })
  }
})
</script>

<template>
  <wd-dialog />
  <view class="app-page min-h-screen w-screen flex flex-col bg-page">
    <!-- 自定义导航 -->
    <uh-navbar :scroll-y="scrollY" :default-title="pageTitle" title-color="text-gray-900" />

    <!-- 顶部 -->
    <wd-sticky :offset-top="offsetTop">
      <scroll-view :scroll-x="true" :show-scrollbar="false" class="w-full whitespace-nowrap">
        <view
          v-for="(tab, index) in friendLinkTabs" :key="tab.key"
          class="uh-global-card-glass mb-2 ml-3 inline-flex border rounded-2xl px-4 py-1.5 text-xs shadow-none"
          :class="{ 'bg-primary text-gray-900 font-semibold': activeTabIndex === index }"
          @click="handleOnTabChange({ index })"
        >
          {{ tab.label }}
        </view>
      </scroll-view>
    </wd-sticky>

    <!-- ==================== 站点 tab ==================== -->
    <template v-if="activeTabIndex === 0">
      <uh-plugin-unavailable
        v-if="!sitePluginAvailable" custom-class="h-[60vh]" :plugin-id="sitePluginId"
        :error-text="siteTips" :checking="siteChecking" @on-refresh="handleSitePluginRefresh"
      />
      <template v-else>
        <view v-if="siteLoadingStatus !== 'success'">
          <uh-data-loading
            :loading-status="siteLoadingStatus" empty-text="啊偶,博主还没有朋友呢~"
            @refresh="handleGetData"
          />
        </view>

        <view v-else class="box-border pt-4">
          <!-- 友链分组列表(参考小程序 tab 分组展示) -->
          <view class="box-border px-4 pb-4">
            <view v-for="group in siteGroups" :key="group.groupName" class="group-item mb-4">
              <view class="mb-3 flex items-center">
                <text class="mr-2 inline-block h-4 w-1 rounded-full bg-secondary" />
                <text class="text-sm text-gray-900 font-bold">{{ group.groupName }}</text>
                <text class="ml-1 text-xs text-gray-400">（{{ group.links.length }}）</text>
              </view>
              <view class="group-cards flex flex-col gap-3">
                <view
                  v-for="link in group.links" :key="link.metadata?.name || link.spec.displayName"
                  class="uh-global-card-glass uh-shadow-xs box-border flex overflow-hidden rounded-xl p-3"
                  @click="handleOnLinkEvent(link)"
                >
                  <!-- 有图，wd-img 如果加载空的地址 会一直处于loading状态，所以空值我们不加载 -->
                  <wd-img
                    v-if="link.spec.logo" class="h-16 w-16 shrink-0" :radius="8" :src="link.spec.logo"
                    mode="aspectFill"
                  >
                    <template #loading>
                      <wd-loading size="64rpx" custom-class="text-primary" />
                    </template>
                  </wd-img>
                  <!-- 无图 -->
                  <view
                    v-else
                    class="h-16 w-16 flex shrink-0 items-center justify-center from-[#ebfabf] to-[#f5fae8] bg-gradient-to-b text-gray-400"
                  >
                    <wd-icon class-prefix="uhemoji-icon" name="-injury" size="48rpx" />
                  </view>
                  <view class="box-border flex flex-1 flex-col justify-center overflow-hidden pl-4">
                    <view class="flex items-center text-sm text-gray-900 font-bold">
                      <text class="flex-1 truncate">{{ link.spec.displayName }}</text>
                    </view>
                    <view
                      class="mt-1 overflow-hidden truncate whitespace-nowrap text-xs text-gray-400"
                    >
                      站点地址：{{ link.spec.url }}
                    </view>
                    <view
                      class="mt-2 overflow-hidden truncate whitespace-nowrap text-xs text-gray-600"
                    >
                      博客简介：{{ link.spec.description || '这个博主很懒，没写简介~' }}
                    </view>
                  </view>
                </view>
              </view>
            </view>
          </view>

          <!-- 详情弹窗 -->
          <uh-glass-popup
            v-model="detail.show" position="bottom" :z-index="999"
            custom-class="rounded-xl !border"
          >
            <!-- 弹窗容器 -->
            <view class="box-border w-full flex flex-col gap-y-3 p-3">
              <!-- 顶部 -->
              <view class="relative box-border w-full flex items-center justify-around">
                <view class="w-full flex flex-col gap-y-1">
                  <text class="text-md font-bold">站点详情</text>
                </view>
                <view
                  class="uh-global-card-glass absolute right-0 top-0 h-6 w-6 flex items-center justify-center border rounded-lg text-gray-500 shadow-none !bg-white/5"
                  @click="miniDetail.show = false"
                >
                  <wd-icon name="close" size="28rpx" />
                </view>
              </view>
              <!-- 滚动区域 -->
              <scroll-view
                v-if="detail.data" :scroll-y="true" :show-scrollbar="false"
                class="box-border max-h-[60vh]"
              >
                <!-- 滚动内部容器 -->
                <view class="w-full flex flex-col gap-y-3">
                  <view class="flex">
                    <!-- 有图，wd-img 如果加载空的地址 会一直处于loading状态，所以空值我们不加载 -->
                    <wd-img
                      v-if="detail.data.spec.logo" class="uh-global-card-glass h-20 w-20 shrink-0"
                      :radius="16" :src="checkImageUrl(detail.data.spec.logo)" mode="aspectFill"
                    >
                      <template #loading>
                        <wd-loading size="64rpx" custom-class="text-primary" />
                      </template>
                    </wd-img>
                    <!-- 无图 -->
                    <view
                      v-else
                      class="uh-global-card-glass h-20 w-20 flex shrink-0 items-center justify-center from-[#ebfabf] to-[#f5fae8] bg-gradient-to-b text-gray-400"
                    >
                      <wd-icon class-prefix="uhemoji-icon" name="-injury" size="48rpx" />
                    </view>
                    <view class="ml-4 flex flex-1 flex-col justify-center gap-y-1.5">
                      <view class="text-md text-gray-900 font-bold">
                        {{ detail.data.spec.displayName }}
                      </view>
                      <view class="flex items-center gap-x-2">
                        <text
                          class="uh-global-card-glass uh-shadow-xs border rounded-lg bg-secondary px-2 py-0.5 text-xs text-gray-500 text-gray-900"
                        >
                          {{ detail.data.spec.groupName }}
                        </text>
                      </view>
                      <view @click="handleCopyLink(detail.data)">
                        <text class="text-xs text-gray-900">{{ detail.data.spec.url }}</text>
                      </view>
                    </view>
                  </view>
                  <view class="poup-desc text-xs text-gray-600 leading-5">
                    {{ detail.data.spec.description || '这个博主很懒，没写简介~' }}
                  </view>
                </view>
              </scroll-view>
              <!-- 底部固定操作区域 -->
              <view class="box-border w-full flex items-center">
                <uh-button
                  class="flex-1"
                  custom-class="flex-1 uh-global-card-glass uh-shadow-xs border py-2 !rounded-xl"
                  @click="handleCopyLink(detail.data)"
                >
                  复制信息
                </uh-button>
              </view>
            </view>
          </uh-glass-popup>

          <uh-data-loadmore :status="siteLoadMoreStatus.status" :text="siteLoadMoreStatus.text" />
        </view>

        <!-- 底部悬浮操作栏(通用组件) -->
        <uh-links-actions :actions="['apply', 'info']" @apply="handleOpenSiteApply" @info="handleOpenInfo" />
      </template>
    </template>

    <!-- ==================== 小程序 tab ==================== -->
    <template v-else>
      <uh-plugin-unavailable
        v-if="!miniPluginAvailable" custom-class="h-[60vh]" :plugin-id="miniPluginId"
        :error-text="miniTips" :checking="miniChecking" @on-refresh="handleMiniPluginRefresh"
      />
      <template v-else>
        <uh-data-loading
          v-if="miniLoadingStatus !== 'success'" :loading-status="miniLoadingStatus"
          empty-text="还没有收录的小程序呢~" @refresh="handleGetMiniProgramLinks"
        />
        <view v-else class="box-border flex flex-1 flex-col pt-4">
          <!-- 分组列表 -->
          <view class="box-border flex-1 px-4 pb-4">
            <view v-for="group in miniGroups" :key="group.groupName || 'ungrouped'" class="group-item mb-4">
              <view class="mb-3 flex items-center">
                <text class="mr-2 inline-block h-4 w-1 rounded-full bg-secondary" />
                <text class="text-sm text-gray-900 font-bold">
                  {{ group.displayName || '未分组' }}
                </text>
                <text class="ml-1 text-xs text-gray-400">（{{ group.links.length }}）</text>
              </view>
              <view class="group-cards flex flex-col gap-4">
                <view
                  v-for="link in group.links" :key="link.metadata?.name"
                  class="uh-global-card-glass uh-shadow-xs box-border flex items-center rounded-2xl p-3"
                  @click="handleOnMiniLinkEvent(link)"
                >
                  <!-- 有图，wd-img 如果加载空的地址 会一直处于loading状态，所以空值我们不加载 -->
                  <wd-img
                    v-if="link.spec?.miniProgramCode" class="h-16 w-16 shrink-0" :radius="8"
                    :src="checkImageUrl(link.spec?.miniProgramCode)" mode="aspectFill"
                  >
                    <template #loading>
                      <wd-loading size="64rpx" custom-class="text-primary" />
                    </template>
                  </wd-img>
                  <!-- 无图 -->
                  <view
                    v-else
                    class="h-16 w-16 flex shrink-0 items-center justify-center from-[#ebfabf] to-[#f5fae8] bg-gradient-to-b text-gray-400"
                  >
                    <wd-icon class-prefix="uhemoji-icon" name="-injury" size="48rpx" />
                  </view>
                  <view class="box-border flex flex-1 flex-col pl-4">
                    <view
                      class="overflow-hidden truncate whitespace-nowrap text-[30rpx] text-gray-900 font-bold"
                    >
                      {{ link.spec?.displayName }}
                    </view>
                    <view
                      v-if="link.spec?.authorName"
                      class="mini-author mt-1 overflow-hidden truncate whitespace-nowrap text-xs text-gray-400"
                    >
                      {{ link.spec.authorName }}
                    </view>
                    <view
                      class="mini-desc mt-1 overflow-hidden truncate whitespace-nowrap text-xs text-gray-500"
                    >
                      {{ link.spec?.description || '暂无简介~' }}
                    </view>
                  </view>
                  <wd-icon name="arrow-right" size="36rpx" class="text-primary" />
                </view>
              </view>
            </view>
          </view>
        </view>

        <!-- 小程序详情弹窗 -->
        <uh-glass-popup
          v-model="miniDetail.show" :z-index="999" position="bottom"
          custom-class="!rounded-xl !border"
        >
          <!-- 弹窗容器 -->
          <view class="box-border w-full flex flex-col gap-y-3 p-3">
            <!-- 顶部 -->
            <view class="relative box-border w-full flex items-center justify-around">
              <view class="w-full flex flex-col gap-y-1">
                <text class="text-md font-bold">小程序详情</text>
              </view>
              <view
                class="uh-global-card-glass absolute right-0 top-0 h-6 w-6 flex items-center justify-center border rounded-lg text-gray-500 shadow-none !bg-white/5"
                @click="miniDetail.show = false"
              >
                <wd-icon name="close" size="28rpx" />
              </view>
            </view>
            <!-- 滚动区域 -->
            <scroll-view
              v-if="miniDetail.data" :scroll-y="true" :show-scrollbar="false"
              class="box-border max-h-[60vh]"
            >
              <!-- 滚动内部容器 -->
              <view class="w-full flex flex-col gap-y-3">
                <view class="w-full flex items-center gap-x-3">
                  <!-- 太阳码大图(点击预览/长按保存) -->
                  <view class="code-area flex flex-col items-center">
                    <!-- 有图，wd-img 如果加载空的地址 会一直处于loading状态，所以空值我们不加载 -->
                    <wd-img
                      v-if="miniDetail.data.spec?.miniProgramCode" class="h-16 w-16" :radius="999"
                      :src="checkImageUrl(miniDetail.data.spec?.miniProgramCode)"
                      mode="aspectFill" @click="handlePreviewMiniProgramCode(miniDetail.data)"
                      @longpress="handleSaveMiniProgramCode(miniDetail.data)"
                    >
                      <template #loading>
                        <wd-loading size="64rpx" custom-class="text-primary" />
                      </template>
                    </wd-img>
                    <!-- 无图 -->
                    <view
                      v-else
                      class="h-16 w-16 flex items-center justify-center from-[#ebfabf] to-[#f5fae8] bg-gradient-to-b text-gray-400"
                    >
                      <wd-icon class-prefix="uhemoji-icon" name="-injury" size="48rpx" />
                    </view>
                  </view>

                  <view class="w-full flex flex-col gap-y-1">
                    <!-- 名称与分组 -->
                    <text class="text-lg text-gray-900 font-semibold">
                      {{ miniDetail.data.spec?.displayName }}
                    </text>

                    <!-- 描述 -->
                    <view
                      v-if="miniDetail.data.spec?.description"
                      class="mini-desc text-2xs text-gray-600 leading-[1.6]"
                    >
                      {{ miniDetail.data.spec.description }}
                    </view>
                  </view>
                </view>
                <view class="code-tip flex items-center">
                  <text class="text-xs text-gray-400">提示：点击预览，长按保存太阳码</text>
                </view>

                <!-- 小程序地址 -->
                <view
                  v-if="miniDetail.data.spec?.link"
                  class="mini-link flex items-center justify-between rounded-xl bg-secondary p-4"
                >
                  <view
                    class="link-text flex-1 overflow-hidden truncate whitespace-nowrap text-[26rpx] text-[#4d7c0f]"
                  >
                    {{ miniDetail.data.spec.link }}
                  </view>
                  <text
                    class="ml-3 shrink-0 text-[26rpx] text-[#4d7c0f] font-bold"
                    @click="handleCopyMiniProgramCode(miniDetail.data)"
                  >
                    复制
                  </text>
                </view>

                <!-- 预览图轮播 -->
                <view v-if="miniDetail.data.spec?.screenshots?.length" class="mini-screenshots">
                  <swiper class="screenshots-swiper h-[360rpx] w-full" indicator-dots circular>
                    <swiper-item v-for="(img, idx) in miniDetail.data.spec.screenshots" :key="idx">
                      <wd-img
                        class="screenshot-img h-full w-full" :radius="12"
                        :src="checkImageUrl(img)" mode="aspectFill"
                        @click="handlePreviewMiniProgramCode({ spec: { miniProgramCode: img } } as IMiniProgramLink)"
                      >
                        <template #loading>
                          <wd-loading size="64rpx" custom-class="text-primary" />
                        </template>
                      </wd-img>
                    </swiper-item>
                  </swiper>
                </view>

                <!-- 作者信息 -->
                <view
                  v-if="miniDetail.data.spec?.authorName || miniDetail.data.spec?.avatar || miniDetail.data.spec?.website"
                  class="uh-global-card-glass flex items-center border rounded-xl p-4 shadow-none"
                >
                  <wd-avatar
                    :src="checkAvatarUrl(miniDetail.data.spec?.avatar)"
                    :text="getAvatarFallbackText(miniDetail.data.spec?.authorName)"
                    custom-class="!h-[72rpx] !w-[72rpx] !shrink-0 !text-gray-900 !font-bold"
                    class="!rounded-full"
                    mode="aspectFill"
                  />
                  <view class="author-detail ml-4 flex flex-1 flex-col">
                    <text
                      v-if="miniDetail.data.spec?.authorName"
                      class="author-name text-[28rpx] text-gray-900 font-medium"
                    >
                      {{ miniDetail.data.spec.authorName }}
                    </text>
                    <text
                      v-if="miniDetail.data.spec?.website"
                      class="author-website mt-1 overflow-hidden truncate whitespace-nowrap text-xs text-gray-400"
                      @click="handleCopyMiniProgramCode(miniDetail.data)"
                    >
                      网站：{{ miniDetail.data.spec.website }}
                    </text>
                  </view>
                </view>
              </view>
            </scroll-view>
            <!-- #ifdef MP-WEIXIN -->
            <!-- 底部固定操作区域 -->
            <view class="box-border w-full flex items-center">
              <uh-button
                class="flex-1"
                custom-class="flex-1 uh-global-card-glass uh-shadow-xs border py-2 !rounded-xl"
                @action-click="handleToMiniProgram(miniDetail.data)"
              >
                点击访问
              </uh-button>
            </view>
            <!-- #endif -->
          </view>
        </uh-glass-popup>

        <!-- 底部悬浮操作栏(通用组件)；提交申请入口按 submissionEnabled 显隐 -->
        <uh-links-actions
          :actions="submissionEnabled ? ['apply', 'info'] : ['info']" @apply="handleOpenApply"
          @info="handleOpenMiniInfo"
        />
      </template>
    </template>

    <!-- 站点友链申请弹窗 -->
    <uh-links-site-apply :show="siteApplyShow" @on-close="handleSiteApplyClose" />
    <!-- 站点友链信息弹窗 -->
    <uh-links-site-info :show="infoShow" @on-close="handleInfoClose" />
    <!-- 小程序链接申请弹窗 -->
    <uh-links-mini-apply :show="applyShow" @on-close="handleApplyClose" />
    <!-- 小程序友链信息弹窗(展示小程序申请提交的信息) -->
    <uh-links-mini-info :show="miniInfoShow" @on-close="handleMiniInfoClose" />
  </view>
</template>
