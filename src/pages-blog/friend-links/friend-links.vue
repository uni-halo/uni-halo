<script lang="ts" setup>
/**
 * 友情链接页(源自旧项目 pagesA/friend-links,新建复刻)
 * 展示友链列表(色彩版/简洁版),支持分组名解析、详情弹窗、申请入口
 */
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { getFriendLinkGroupList, getFriendLinkList } from '@/api/halo'
import { useAppConfigStore } from '@/store/appConfig'
import { useSettingStore } from '@/store/setting'
import { checkAvatarUrl, checkImageUrl } from '@/utils/url'
import { usePluginAvailable } from '@/utils/plugin'
import type { ILink, ILinkGroup } from '@/api/types/halo'

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

/** 依赖插件(plugin-links) */
const uniHaloPluginId = 'plugin-links'
const uniHaloPluginAvailable = ref(true)

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
    const list = res.data.items.map(item => ({
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

/* ---------------- 交互 ---------------- */
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

/* ---------------- 生命周期 ---------------- */
onLoad(async () => {
  uniHaloPluginAvailable.value = await usePluginAvailable(uniHaloPluginId)
  if (!uniHaloPluginAvailable.value) {
    uni.stopPullDownRefresh()
    return
  }
  handleGetLinkGroupData()
})

onPullDownRefresh(() => {
  if (!uniHaloPluginAvailable.value) {
    uni.stopPullDownRefresh()
    return
  }
  isLoadMore.value = false
  queryParams.value.page = 1
  dataList.value = []
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
  <view class="app-page min-h-screen w-screen flex flex-col" style="background-color: #fafafd;">
    <uh-plugin-unavailable
      v-if="!uniHaloPluginAvailable"
      :plugin-id="uniHaloPluginId"
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
  </view>
</template>

<style scoped>
.app-page {
  /* 布局全部由 UnoCSS 原子类实现 */
}
</style>
