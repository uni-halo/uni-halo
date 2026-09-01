<script lang="ts" setup>
/**
 * 友情链接页(源自旧项目 pagesA/friend-links,新建复刻 + tabs 改造)
 * 顶部 tabs 切换「站点 / 小程序」:
 * - 站点:plugin-links 博客友链(色彩版/简洁版/详情弹窗/申请入口,保持现状)
 * - 小程序:plugin-uni-halo 小程序链接(按分组聚合展示 + 详情弹窗 + 申请收录弹窗)
 */
import { computed, ref, watch } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { getFriendLinkGroupList, getFriendLinkList } from '@/api/halo'
import { getMiniProgramLinkGroupedList } from '@/api/uni-halo'
import { useAppConfigStore } from '@/store/appConfig'
import { useSettingStore } from '@/store/setting'
import { checkAvatarUrl, checkImageUrl } from '@/utils/url'
import { NeedPluginIds, usePluginAvailable } from '@/utils/plugin'
import type { ILink, ILinkGroup } from '@/api/types/halo'
import type { IMiniProgramLink, IMiniProgramLinkGroupVo } from '@/api/types/uni-halo'

definePage({
  style: {
    navigationBarTitleText: '友情链接',
    enablePullDownRefresh: true,
  },
})

const appConfigStore = useAppConfigStore()
const settingStore = useSettingStore()

const haloPluginConfigs = computed(() => appConfigStore.configs.pluginConfig)
const globalAppSettings = computed(() => settingStore.settings)

/* ---------------- 依赖插件 ---------------- */
/** 站点 tab:plugin-links */
const sitePluginId = NeedPluginIds.PluginLinks
const sitePluginAvailable = ref(true)
/** 小程序 tab:plugin-uni-halo */
const miniPluginId = NeedPluginIds.PluginUniHalo
const miniPluginAvailable = ref(true)

/* ---------------- tabs ---------------- */
const activeTabIndex = ref(0)

function handleOnTabChange(e: { index: number }) {
  activeTabIndex.value = e.index
}

// 审核模式下小程序 tab 隐藏,强制停留在站点 tab
watch(() => appConfigStore.auditModeEnabled, (enabled) => {
  if (enabled)
    activeTabIndex.value = 0
})

/* ==================== 站点 tab(plugin-links) ==================== */
/* ---------------- 状态 ---------------- */
const loading = ref<'loading' | 'success' | 'error'>('loading')
const queryParams = ref({ size: 10, page: 1 })
const detail = ref<{ show: boolean, data: ILink | null }>({ show: false, data: null })
const hasNext = ref(false)
const isLoadMore = ref(false)
const loadMoreText = ref('')
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
    linkGroupList.value = res.data.items || []
    handleGetData()
  }
  catch (err) {
    console.error(err)
    loading.value = 'error'
  }
}

async function handleGetData() {
  if (!isLoadMore.value) {
    loading.value = 'loading'
  }
  loadMoreText.value = ''

  try {
    const res = await getFriendLinkList({ ...queryParams.value })
    hasNext.value = res.data.hasNext
    // 审核模式:站点链接仅展示选中 LinkGroup 分组内的
    let items = res.data.items
    if (appConfigStore.auditModeEnabled) {
      const auditGroupNames = appConfigStore.auditData.spec?.linkGroups || []
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
    dataList.value = dataList.value.concat(list)
    setTimeout(() => {
      loading.value = 'success'
      loadMoreText.value = res.data.hasNext ? '上拉加载更多' : '呜呜，没有更多数据啦~'
    }, 500)
  }
  catch (err) {
    console.error(err)
    loading.value = 'error'
    loadMoreText.value = '加载失败，请下拉刷新！'
  }
  finally {
    setTimeout(() => {
      uni.stopPullDownRefresh()
    }, 500)
  }
}

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

function toSubmitLinkPage() {
  uni.navigateTo({ url: '/pages-blog/submit-link/submit-link' })
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

function calcSiteThumbnail(val?: string): string {
  if (!val)
    return ''
  const _val = val.endsWith('/') ? val : `${val}/`
  return `https://image.thum.io/get/width/1000/crop/800/${_val}`
}

/* ==================== 小程序 tab(plugin-uni-halo) ==================== */
/* ---------------- 状态 ---------------- */
const miniLoading = ref<'loading' | 'success' | 'error'>('loading')
const miniGroups = ref<IMiniProgramLinkGroupVo[]>([])
const miniDetail = ref<{ show: boolean, data: IMiniProgramLink | null }>({ show: false, data: null })
const applyShow = ref(false)

/* ---------------- 数据加载 ---------------- */
async function handleGetMiniProgramLinks() {
  miniLoading.value = 'loading'
  try {
    const res = await getMiniProgramLinkGroupedList()
    miniGroups.value = res.data || []
    setTimeout(() => {
      miniLoading.value = 'success'
    }, 500)
  }
  catch (err) {
    console.error(err)
    miniLoading.value = 'error'
  }
  finally {
    setTimeout(() => {
      uni.stopPullDownRefresh()
    }, 500)
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
  if (data.refresh)
    handleGetMiniProgramLinks()
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
          uni.showModal({
            title: '保存失败',
            content: '请检查相册权限后重试',
            showCancel: false,
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

/* ---------------- 生命周期 ---------------- */
onLoad(async () => {
  ;[sitePluginAvailable.value, miniPluginAvailable.value] = await Promise.all([
    usePluginAvailable(sitePluginId),
    usePluginAvailable(miniPluginId),
  ])
  if (sitePluginAvailable.value)
    handleGetLinkGroupData()
  if (miniPluginAvailable.value)
    handleGetMiniProgramLinks()
  if (!sitePluginAvailable.value && !miniPluginAvailable.value)
    uni.stopPullDownRefresh()
})

onPullDownRefresh(() => {
  if (activeTabIndex.value === 0) {
    if (!sitePluginAvailable.value) {
      uni.stopPullDownRefresh()
      return
    }
    isLoadMore.value = false
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
    if (hasNext.value) {
      queryParams.value.page += 1
      isLoadMore.value = true
      handleGetData()
    }
    else {
      uni.showToast({ icon: 'none', title: '没有更多数据了' })
    }
  }
  else {
    uni.showToast({ icon: 'none', title: '没有更多数据了' })
  }
})
</script>

<template>
  <view class="app-page min-h-screen w-screen flex flex-col" style="background-color: #fafafd;">
    <!-- 顶部 tabs -->
    <view class="tabs-wrap sticky top-0 z-10 bg-white px-6">
      <wd-tabs v-model="activeTabIndex" align="left" @change="handleOnTabChange">
        <wd-tab title="站点" />
        <wd-tab v-if="!appConfigStore.auditModeEnabled" title="小程序" />
      </wd-tabs>
    </view>

    <!-- ==================== 站点 tab ==================== -->
    <template v-if="activeTabIndex === 0">
      <uh-plugin-unavailable
        v-if="!sitePluginAvailable"
        :plugin-id="sitePluginId"
        error-text="检测到当前插件没有安装或者启用，无法使用友情链接功能哦，请联系管理员"
        @on-refresh="handleGetLinkGroupData"
      />
      <template v-else>
        <view v-if="loading !== 'success'" class="loading-wrap min-h-screen p-3">
          <wd-skeleton :row="5" :animated="true" />
        </view>

        <view v-else class="content pt-6" :class="{ 'bg-white': dataList.length !== 0 }">
          <view v-if="dataList.length === 0" class="h-[60vh] flex items-center justify-center content-empty">
            <wd-empty description="啊偶,博主还没有朋友呢~" />
          </view>

          <!-- 友链列表 -->
          <view v-else class="link-list px-6">
            <view v-for="(link, index) in dataList" :key="index">
              <!-- 色彩版 -->
              <view
                v-if="!globalAppSettings.links.useSimple"
                class="info flex bg-white p-3"
                :class="{ 'border-b-2 border-[#f5f5f5]': index !== dataList.length - 1 }"
                @click="handleOnLinkEvent(link)"
              >
                <image class="link-logo h-[140rpx] w-[140rpx] shrink-0 rounded-xl" :src="link.spec.logo" mode="aspectFill" />
                <view class="info-detail flex flex-1 flex-col justify-center pl-7">
                  <view class="link-card-name text-[30rpx] text-[#f44336] font-bold">
                    <text class="group-tag mr-3 rounded-md px-1.5 py-0.5 text-[20rpx] text-white font-normal" style="background: linear-gradient(135deg, #64b5f6, #2196f3);">{{ link.spec.groupName || '暂未分组' }}</text>
                    {{ link.spec.displayName }}
                  </view>
                  <view class="link-card-url mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[24rpx] text-[#666]">
                    站点地址：{{ link.spec.url }}
                  </view>
                  <view class="link-card-desc mt-2 overflow-hidden text-ellipsis whitespace-nowrap text-[24rpx] text-[#303133]">
                    博客简介：{{ link.spec.description || '这个博主很懒，没写简介~' }}
                  </view>
                </view>
              </view>
              <!-- 简洁版 -->
              <view v-else class="link-card mb-6 flex items-center rounded-xl bg-white p-6 shadow-sm" @click="handleOnLinkEvent(link)">
                <image class="logo h-[80rpx] w-[80rpx] shrink-0 border-6 border-white rounded-xl" :src="link.spec.logo" mode="aspectFill" />
                <view class="link-info flex-1 pl-6">
                  <view class="name text-[30rpx] text-[#303133] font-bold">
                    {{ link.spec.displayName }}
                  </view>
                  <view class="desc mt-3 overflow-hidden text-ellipsis whitespace-nowrap text-[24rpx] text-[#909399]">
                    {{ link.spec.description }}
                  </view>
                </view>
              </view>
            </view>
          </view>

          <!-- 悬浮按钮 -->
          <view class="flot-buttons fixed bottom-[100rpx] right-8 z-999 flex flex-col gap-1.5">
            <view class="fab-btn h-[72rpx] w-[72rpx] flex items-center justify-center rounded-full bg-white shadow-sm" @click="handleToTopPage()">
              <wd-icon name="arrow-up" size="20px" color="#03a9f4" />
            </view>
            <view v-if="(haloPluginConfigs?.linksSubmitPlugin as { enabled?: boolean } | undefined)?.enabled" class="fab-btn h-[72rpx] w-[72rpx] flex items-center justify-center rounded-full bg-white shadow-sm" @click="toSubmitLinkPage">
              <wd-icon name="edit" size="20px" color="#ff9800" />
            </view>
          </view>

          <!-- 详情弹窗 -->
          <wd-popup v-model="detail.show" position="center" custom-style="width:640rpx;border-radius:12rpx;">
            <view v-if="detail.data" class="poup p-9">
              <view class="info flex">
                <image class="poup-logo h-[140rpx] w-[140rpx] shrink-0 rounded-full" :src="checkImageUrl(detail.data.spec.logo)" mode="aspectFill" />
                <view class="poup-info ml-6 flex flex-1 flex-col justify-center">
                  <view class="poup-name text-[34rpx] font-bold">
                    {{ detail.data.spec.displayName }}
                  </view>
                  <view class="poup-tag mt-2 text-[24rpx] text-[#999]">
                    {{ detail.data.spec.groupName }}
                  </view>
                  <view class="poup-link mt-3" @click="handleCopyLink(detail.data)">
                    <text class="poup-url text-[24rpx] text-[#ff9800]">{{ detail.data.spec.url }}</text>
                  </view>
                </view>
              </view>
              <view class="poup-desc mt-5 text-[28rpx] text-[#555] leading-[1.6]">
                博客简介：{{ detail.data.spec.description || '这个博主很懒，没写简介~' }}
              </view>
              <image class="poup-img mt-6 h-[320rpx] w-[568rpx] rounded-xl" :src="calcSiteThumbnail(detail.data.spec.url)" mode="aspectFill" />
            </view>
          </wd-popup>

          <view class="load-text py-5 text-center text-[24rpx] text-[#999]">
            {{ loadMoreText }}
          </view>
        </view>
      </template>
    </template>

    <!-- ==================== 小程序 tab ==================== -->
    <template v-else>
      <uh-plugin-unavailable
        v-if="!miniPluginAvailable"
        :plugin-id="miniPluginId"
        error-text="检测到当前插件没有安装或者启用，无法使用小程序链接功能哦，请联系管理员"
        @on-refresh="handleGetMiniProgramLinks"
      />
      <template v-else>
        <view v-if="miniLoading !== 'success'" class="loading-wrap min-h-screen p-3">
          <wd-skeleton :row="5" :animated="true" />
        </view>

        <view v-else class="content flex flex-1 flex-col">
          <!-- 空态 -->
          <view v-if="miniGroups.length === 0" class="h-[60vh] flex items-center justify-center content-empty">
            <wd-empty description="还没有收录的小程序呢~" />
          </view>

          <!-- 分组列表 -->
          <view v-else class="mini-link-list flex-1 px-6 py-4">
            <view v-for="group in miniGroups" :key="group.groupName || 'ungrouped'" class="group-item mb-8">
              <view class="group-title mb-4 flex items-center">
                <text class="mr-2 inline-block h-[28rpx] w-[8rpx] rounded-full" style="background-color:#2196f3;" />
                <text class="text-[30rpx] text-[#303133] font-bold">{{ group.displayName || '未分组' }}</text>
                <text class="ml-3 text-[24rpx] text-[#999]">（{{ group.links.length }}）</text>
              </view>
              <view class="group-cards flex flex-col gap-4">
                <view
                  v-for="link in group.links"
                  :key="link.metadata?.name"
                  class="mini-card flex items-center rounded-xl bg-white p-4 shadow-sm"
                  @click="handleOnMiniLinkEvent(link)"
                >
                  <image
                    class="mini-code h-[120rpx] w-[120rpx] shrink-0 rounded-lg"
                    :src="checkImageUrl(link.spec?.miniProgramCode)"
                    mode="aspectFill"
                  />
                  <view class="mini-info flex flex-1 flex-col pl-5">
                    <view class="mini-name overflow-hidden text-ellipsis whitespace-nowrap text-[30rpx] text-[#303133] font-bold">
                      {{ link.spec?.displayName }}
                    </view>
                    <view v-if="link.spec?.authorName" class="mini-author mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[24rpx] text-[#999]">
                      {{ link.spec.authorName }}
                    </view>
                    <view class="mini-desc mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[24rpx] text-[#666]">
                      {{ link.spec?.description || '暂无简介~' }}
                    </view>
                  </view>
                  <wd-icon name="arrow-right" size="16px" color="#c0c4cc" />
                </view>
              </view>
            </view>
          </view>

          <!-- 申请收录悬浮按钮 -->
          <view class="apply-btn-wrap fixed bottom-[100rpx] right-8 z-999">
            <view class="apply-btn h-[88rpx] flex items-center rounded-full bg-[#2196f3] px-6 shadow-sm" @click="handleOpenApply">
              <wd-icon name="add" size="20px" color="#fff" />
              <text class="ml-2 text-[26rpx] text-white">申请收录</text>
            </view>
          </view>
        </view>

        <!-- 小程序详情弹窗 -->
        <wd-popup v-model="miniDetail.show" position="center" custom-style="width:640rpx;border-radius:12rpx;">
          <view v-if="miniDetail.data" class="mini-poup p-8">
            <!-- 太阳码大图(点击预览/长按保存) -->
            <view class="code-area flex flex-col items-center">
              <image
                class="code-img h-[320rpx] w-[320rpx] rounded-xl"
                :src="checkImageUrl(miniDetail.data.spec?.miniProgramCode)"
                mode="aspectFill"
                @click="handlePreviewMiniProgramCode(miniDetail.data)"
                @longpress="handleSaveMiniProgramCode(miniDetail.data)"
              />
              <view class="code-tip mt-3 flex items-center text-[24rpx] text-[#999]">
                <wd-icon name="picture" size="14px" color="#999" />
                <text class="ml-1">点击预览，长按保存太阳码</text>
              </view>
            </view>

            <!-- 名称与分组 -->
            <view class="mini-head mt-5 flex items-center">
              <text class="mini-name text-[34rpx] text-[#303133] font-bold">{{ miniDetail.data.spec?.displayName }}</text>
              <text v-if="miniDetail.data.spec?.groupName" class="group-tag ml-3 rounded-md px-2 py-0.5 text-[20rpx] text-white" style="background: linear-gradient(135deg, #64b5f6, #2196f3);">
                {{ miniDetail.data.spec.groupName }}
              </text>
            </view>

            <!-- 描述 -->
            <view v-if="miniDetail.data.spec?.description" class="mini-desc mt-4 text-[28rpx] text-[#555] leading-[1.6]">
              {{ miniDetail.data.spec.description }}
            </view>

            <!-- 作者信息 -->
            <view v-if="miniDetail.data.spec?.authorName || miniDetail.data.spec?.avatar || miniDetail.data.spec?.website" class="mini-author-info mt-5 flex items-center rounded-xl bg-[#f5f5f5] p-4">
              <image v-if="miniDetail.data.spec?.avatar" class="author-avatar h-[72rpx] w-[72rpx] shrink-0 rounded-full" :src="checkAvatarUrl(miniDetail.data.spec.avatar)" mode="aspectFill" />
              <view class="author-detail ml-4 flex flex-1 flex-col">
                <text v-if="miniDetail.data.spec?.authorName" class="author-name text-[28rpx] text-[#303133] font-medium">{{ miniDetail.data.spec.authorName }}</text>
                <text v-if="miniDetail.data.spec?.website" class="author-website mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[24rpx] text-[#999]" @click="handleCopyMiniProgramCode(miniDetail.data)">
                  网站：{{ miniDetail.data.spec.website }}
                </text>
              </view>
            </view>

            <!-- 小程序地址 -->
            <view v-if="miniDetail.data.spec?.link" class="mini-link mt-5 flex items-center justify-between rounded-xl bg-[#fff8f0] p-4">
              <view class="link-text flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[26rpx] text-[#ff9800]">
                {{ miniDetail.data.spec.link }}
              </view>
              <text class="ml-3 shrink-0 text-[26rpx] text-[#ff9800]" @click="handleCopyMiniProgramCode(miniDetail.data)">复制</text>
            </view>

            <!-- 预览图轮播 -->
            <view v-if="miniDetail.data.spec?.screenshots?.length" class="mini-screenshots mt-6">
              <swiper class="screenshots-swiper h-[360rpx] w-full" indicator-dots circular>
                <swiper-item v-for="(img, idx) in miniDetail.data.spec.screenshots" :key="idx">
                  <image class="screenshot-img h-full w-full rounded-xl" :src="checkImageUrl(img)" mode="aspectFill" @click="handlePreviewMiniProgramCode({ spec: { miniProgramCode: img } } as IMiniProgramLink)" />
                </swiper-item>
              </swiper>
            </view>
          </view>
        </wd-popup>

        <!-- 小程序链接申请弹窗 -->
        <uh-mini-link-apply :show="applyShow" @on-close="handleApplyClose" />
      </template>
    </template>
  </view>
</template>

<style scoped>
.app-page {
  /* 布局全部由 UnoCSS 原子类实现 */
}
</style>
