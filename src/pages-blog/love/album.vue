<script lang="ts" setup>
/**
 * 恋爱相册页(源自旧项目 pagesA/love/album.vue,新建复刻)
 * 相册列表(两列网格)+ 加密相册密码解锁 + 图片查看弹窗
 */
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import dayjs from 'dayjs'
import { getLoveAlbumByName, getLoveAlbums } from '@/api/uni-halo'
import { useAppConfigStore } from '@/store/appConfig'
import { checkImageUrl } from '@/utils/url'
import { getCache, setCache } from '@/utils/storage'
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
const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()
const dataList = ref<ILoveAlbumCard[]>([])
const unlockedAlbums = ref<Record<string, string>>({})

/** 密码解锁弹窗 */
const showUnlockModal = ref(false)
const currentUnlockAlbum = ref<ILoveAlbumCard | null>(null)

/** 图片查看弹窗 */
const showPhotoViewer = ref(false)
const currentViewerAlbum = ref<ILoveAlbumCard | null>(null)
const viewerLoading = ref(false)

const unlockAlbumName = computed(() => currentUnlockAlbum.value?.displayName || '')
const unlockAlbumKey = computed(() => currentUnlockAlbum.value?.name || '')
const viewerAlbumName = computed(() => currentViewerAlbum.value?.displayName || '')
const viewerPhotos = computed(() => currentViewerAlbum.value?.photos || [])

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
  updateLoadingStatus(DataLoadingStatusEnum.Loading)
  try {
    const res = await getLoveAlbums({})
    const items = res.data?.items || []
    dataList.value = items.map(mapAlbumCard)
    updateLoadingStatus(dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
    if (dataList.value.length > 0)
      handleLoadUnlockedAlbumPhotos()
  }
  catch (e) {
    console.error('获取相册失败', e)
    updateLoadingStatus(DataLoadingStatusEnum.Error)
  }
  finally {
    setTimeout(() => {
      uni.stopPullDownRefresh()
    }, 200)
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

async function handleOpenPhotoViewer(item: ILoveAlbumCard) {
  currentViewerAlbum.value = item
  showPhotoViewer.value = true
  if (item.photos.length > 0)
    return
  viewerLoading.value = true
  try {
    const token = unlockedAlbums.value[item.name] || ''
    const detail = await getLoveAlbumByName(item.name, { token })
    if (detail) {
      if (detail.locked) {
        delete unlockedAlbums.value[item.name]
        handleSaveUnlockedAlbums()
      }
      else if (detail.photos) {
        item.photos = detail.photos
        item.locked = false
      }
    }
  }
  catch (e) {
    console.error('获取相册照片失败', e)
    uni.showToast({ icon: 'none', title: '照片加载失败，请稍后重试' })
  }
  finally {
    viewerLoading.value = false
  }
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

/* ---------------- 生命周期 ---------------- */
onLoad(() => {
  handleRestoreUnlockedAlbums()
  handleGetData()
})

onPullDownRefresh(() => {
  handleGetData()
})
</script>

<template>
  <view class="app-page box-border min-h-screen w-screen flex flex-col pb-[144rpx]" style="background: linear-gradient(-135deg, rgb(247 149 51 / 10%), rgb(243 112 85 / 10%) 15%, rgb(239 78 123 / 10%) 30%, rgb(161 102 171 / 10%) 44%, rgb(80 115 184 / 10%) 58%, rgb(16 152 173 / 10%) 72%, rgb(7 179 155 / 10%) 86%, rgb(109 186 130 / 10%));">
    <!-- 自定义导航 -->
    <uh-navbar default-title="恋爱相册" title-color="text-gray-900" />

    <!-- 加载/错误/空占位(状态机) -->
    <uh-data-loading
      v-if="loadingStatus !== DataLoadingStatusEnum.Success"
      :loading-status="loadingStatus"
      min-height="60vh"
      empty-text="相册暂时还没有数据~"
      @refresh="handleGetData"
    />

    <!-- 相册列表(两列网格) -->
    <view v-else class="album-list box-border flex flex-wrap px-6">
      <view v-for="(item, index) in dataList" :key="item.name" class="album-card mb-6 box-border overflow-hidden rounded-xl bg-white shadow-sm" :class="index % 2 === 0 ? 'mr-6 w-[calc((100%-24rpx)/2)]' : 'w-[calc((100%-24rpx)/2)]'" @click="handleOnAlbumClick(item)">
        <view class="album-cover-wrap relative h-[320rpx] w-full">
          <image class="album-cover h-full w-full" :src="item.image" mode="aspectFill" lazy-load />
          <view v-if="item.locked && !unlockedAlbums[item.name]" class="album-lock-mask absolute left-0 top-0 h-full w-full flex flex-col items-center justify-center bg-black/45">
            <view class="lock-icon text-[64rpx]">
              🔒
            </view>
            <view class="lock-tip mt-3 text-[26rpx] text-white">
              已加密
            </view>
          </view>
        </view>
        <view class="album-info box-border p-5">
          <view class="album-name overflow-hidden text-ellipsis whitespace-nowrap text-[30rpx] text-[#333] font-bold">
            {{ item.displayName }}
          </view>
          <view class="album-count mt-1 text-[24rpx] text-[#999]">
            {{ item.photoCount }} 张照片
          </view>
        </view>
      </view>
    </view>

    <!-- 密码解锁弹窗 -->
    <uh-album-unlock-modal
      v-if="currentUnlockAlbum"
      :show="showUnlockModal"
      :album-name="unlockAlbumName"
      :album-key="unlockAlbumKey"
      @update:show="showUnlockModal = $event"
      @success="handleOnUnlockSuccess"
    />

    <!-- 相册图片查看弹窗 -->
    <uh-album-photo-viewer
      v-if="currentViewerAlbum"
      :show="showPhotoViewer"
      :album-name="viewerAlbumName"
      :photos="viewerPhotos"
      :loading="viewerLoading"
      @update:show="showPhotoViewer = $event"
    />
  </view>
</template>

<style scoped>
.app-page {
  /* 布局全部由 UnoCSS 原子类实现 */
}
</style>
