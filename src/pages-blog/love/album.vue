<script lang="ts" setup>
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import dayjs from 'dayjs'
import { getLoveAlbumByName, getLoveAlbums } from '@/api/uni-halo'
import { useAppConfigStore } from '@/store/appConfig'
import { checkImageUrl } from '@/utils/url'
import { getCache, setCache } from '@/utils/storage'
import { handleLoveModuleLocked } from '@/utils/loveModuleToken'
import { sleep } from '@/utils/common'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import type { ILoveAlbum, ILovePhoto } from '@/api/types/uni-halo'

definePage({
  style: {
    navigationBarTitleText: '恋爱相册',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
  },
})

const appConfigStore = useAppConfigStore()
const loveConfig = computed(() => appConfigStore.configs.loveConfig)

/** 已解锁相册本地缓存 key */
const UNLOCKED_ALBUMS_CACHE_KEY = 'unlocked_albums'
/** 解锁 token 有效期(后端默认 30 分钟) */
const ALBUM_TOKEN_TTL_SECONDS = 30 * 60

/* ---------------- 展示层类型 ---------------- */
/** 相册展示卡片(script 预处理后的干净展示数据) */
interface ILoveAlbumCard {
  /** 相册 key(metadata.name,用于解锁/详情请求) */
  name: string
  displayName: string
  locked: boolean
  photoCount: number
  /** 封面图(已预处理 URL) */
  image: string
  /** 创建时间(格式化展示) */
  takeTime: string
  /** 相册照片(解锁后填充) */
  photos: ILovePhoto[]
}

/** 相册卡片映射:字段取值 + 封面/时间预处理(模板不感知原始接口结构) */
function mapAlbumCard(item: ILoveAlbum): ILoveAlbumCard {
  const creationTimestamp = item.metadata?.creationTimestamp
  return {
    name: item.name || item.metadata?.name || '',
    displayName: item.displayName || item.title || '',
    locked: !!item.locked,
    photoCount: Number(item.photoCount) || 0,
    image: checkImageUrl(item.cover || ''),
    takeTime: creationTimestamp ? dayjs(creationTimestamp).format('DD/MM/YYYY') : '',
    photos: item.photos || [],
  }
}

/* ---------------- 状态 ---------------- */
const { loadingStatus, loadMoreStatus, updateLoadingStatus, updateLoadMoreStatus, resetLoadMoreStatus } = useDataLoadingStatus()
const queryParams = ref({ page: 1, size: 10 })
const dataList = ref<ILoveAlbumCard[]>([])
const unlockedAlbums = ref<Record<string, string>>({})

/** 密码解锁弹窗 */
const showUnlockModal = ref(false)
const currentUnlockAlbum = ref<ILoveAlbumCard | null>(null)

/** 图片查看弹窗 */
const showPhotoViewer = ref(false)
const currentViewerAlbum = ref<ILoveAlbumCard | null>(null)

const unlockAlbumName = computed(() => currentUnlockAlbum.value?.displayName || '')
const unlockAlbumKey = computed(() => currentUnlockAlbum.value?.name || '')
const viewerAlbumName = computed(() => currentViewerAlbum.value?.displayName || '')
const viewerAlbumKey = computed(() => currentViewerAlbum.value?.name || '')
const viewerAlbumToken = computed(() => currentViewerAlbum.value
  ? (unlockedAlbums.value[currentViewerAlbum.value.name] || '')
  : '')

/* ---------------- 缓存 ---------------- */
function handleRestoreUnlockedAlbums() {
  try {
    const saved = getCache<Record<string, string>>(UNLOCKED_ALBUMS_CACHE_KEY)
    if (saved) {
      unlockedAlbums.value = saved
    }
  }
  catch (e) {
    console.error('恢复解锁状态失败', e)
  }
}

function handleSaveUnlockedAlbums() {
  try {
    setCache(UNLOCKED_ALBUMS_CACHE_KEY, unlockedAlbums.value, ALBUM_TOKEN_TTL_SECONDS)
  }
  catch (e) {
    console.error('保存解锁状态失败', e)
  }
}

/* ---------------- 数据加载 ---------------- */
async function handleGetData() {
  if (!loadMoreStatus.value.active) {
    updateLoadingStatus(DataLoadingStatusEnum.Loading)
  }
  try {
    const res = await getLoveAlbums({ ...queryParams.value })
    const items = (res.data?.items || []).map(mapAlbumCard)
    dataList.value = loadMoreStatus.value.active
      ? dataList.value.concat(items)
      : items
    if (!loadMoreStatus.value.active) {
      await sleep(600)
      updateLoadingStatus(dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
    }
    updateLoadMoreStatus({
      active: false,
      status: res.data?.hasNext ? 'loadMore' : 'noMore',
      hasNext: !!res.data?.hasNext,
    })
    if (dataList.value.length > 0)
      handleLoadUnlockedAlbumPhotos()
  }
  catch (e) {
    console.error('获取相册失败', e)
    // 模块锁 401：清除 token 并提示
    handleLoveModuleLocked('lovePhoto', e)
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

/** 加载已解锁相册的照片 */
async function handleLoadUnlockedAlbumPhotos() {
  for (const item of dataList.value) {
    const token = unlockedAlbums.value[item.name]
    if (item.locked && token) {
      try {
        const detail = await getLoveAlbumByName(item.name, { token })
        if (detail.locked) {
          delete unlockedAlbums.value[item.name]
          handleSaveUnlockedAlbums()
        }
        else if (detail.photos) {
          item.photos = detail.photos
          item.locked = false
        }
      }
      catch (e) {
        console.error('加载相册照片失败', e)
        handleLoveModuleLocked('lovePhoto', e)
      }
    }
  }
}

/* ---------------- 交互 ---------------- */
function handleOnAlbumClick(item: ILoveAlbumCard) {
  if (item.locked && !unlockedAlbums.value[item.name]) {
    currentUnlockAlbum.value = item
    showUnlockModal.value = true
    return
  }
  handleOpenPhotoViewer(item)
}

function handleOpenPhotoViewer(item: ILoveAlbumCard) {
  currentViewerAlbum.value = item
  showPhotoViewer.value = true
  // 照片数据由 uh-album-photo-viewer 内部自请求(见组件 handleLoadPhotos)
}

function handleOnUnlockSuccess(data: { albumKey: string, token: string, photos: unknown[] }) {
  unlockedAlbums.value[data.albumKey] = data.token
  handleSaveUnlockedAlbums()

  const albumIndex = dataList.value.findIndex(a => a.name === data.albumKey)
  if (albumIndex !== -1) {
    dataList.value[albumIndex].photos = data.photos as ILovePhoto[]
    dataList.value[albumIndex].locked = false
  }
  currentUnlockAlbum.value = null
  if (albumIndex !== -1) {
    handleOpenPhotoViewer(dataList.value[albumIndex])
  }
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
onLoad(() => {
  handleRestoreUnlockedAlbums()
  handleGetData()
})

onPullDownRefresh(() => {
  resetLoadMoreStatus()
  queryParams.value.page = 1
  handleGetData()
})

onReachBottom(() => {
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
  <view class="app-page box-border min-h-screen w-screen flex flex-col pb-safe">
    <!-- 自定义导航 -->
    <uh-navbar default-title="恋爱相册" title-color="text-love" back-class="text-love" />

    <!-- 加载/错误/空占位(状态机) -->
    <uh-data-loading
      v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus"
      min-height="75vh" empty-text="相册暂时还没有数据~" @refresh="handleGetData"
    />

    <!-- 相册列表(两列网格) -->
    <view v-else class="grid grid-cols-2 box-border gap-3 p-3 pt-2">
      <view
        v-for="(item) in dataList" :key="item.name"
        class="uh-global-card-glass box-border overflow-hidden rounded-xl" @click="handleOnAlbumClick(item)"
      >
        <view class="relative h-36 w-full">
          <image class="h-full w-full" :src="item.image" mode="aspectFill" lazy-load />
          <view
            v-if="item.locked && !unlockedAlbums[item.name]"
            class="absolute right-0 top-0 px-2 py-1 rounded-lb-md flex items-center justify-center gap-1 bg-black/30"
          >
            <wd-icon name="lock" size="30rpx" class="text-white" />
            <view class="text-xs text-white">
              已加密
            </view>
          </view>
        </view>
      
		<view class="absolute left-0 right-0 bottom-0 box-border p-3 pt-6 bg-gradient-to-b from-white/0 to-white/60">
          <view
            class="truncate text-sm text-love font-bold"
          >
            {{ item.displayName }}
          </view>
          <view class="album-count mt-1 text-xs text-white">
            {{ item.photoCount }} 张照片
          </view>
        </view>
		
	  </view>
	    </view>
	    <uh-data-loadmore :status="loadMoreStatus.status" :text="loadMoreStatus.text" />
	    <!-- 密码解锁弹窗 -->
    <uh-album-unlock-popup
      v-if="currentUnlockAlbum" v-model="showUnlockModal" :show="showUnlockModal" :album-name="unlockAlbumName"
      :album-key="unlockAlbumKey" @update:show="showUnlockModal = $event" @success="handleOnUnlockSuccess"
    />

    <!-- 相册图片查看弹窗(数据在组件内部自请求) -->
    <uh-album-photo-viewer
      v-if="currentViewerAlbum" v-model="showPhotoViewer" :show="showPhotoViewer"
      :album-name="viewerAlbumName" :album-key="viewerAlbumKey" :token="viewerAlbumToken"
      @update:show="showPhotoViewer = $event"
    />
  </view>
</template>

<style scoped>
.app-page {
  background: linear-gradient(
    -135deg,
    rgb(247 149 51 / 10%),
    rgb(243 112 85 / 10%) 15%,
    rgb(239 78 123 / 10%) 30%,
    rgb(161 102 171 / 10%) 44%,
    rgb(80 115 184 / 10%) 58%,
    rgb(16 152 173 / 10%) 72%,
    rgb(7 179 155 / 10%) 86%,
    rgb(109 186 130 / 10%)
  );
}
</style>
