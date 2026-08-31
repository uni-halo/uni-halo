<script lang="ts" setup>
/**
 * 相册图片查看弹窗(源自旧项目 components/album-photo-viewer,新建复刻)
 * 双列瀑布流展示相册照片,支持大图预览
 */
import { computed, ref, watch } from 'vue'
import { checkImageUrl } from '@/utils/url'

const props = withDefaults(defineProps<{
  show: boolean
  albumName?: string
  photos?: IAlbumPhoto[]
  loading?: boolean
}>(), {
  albumName: '',
  photos: () => [],
  loading: false,
})

const emit = defineEmits<{
  (e: 'update:show', show: boolean): void
}>()

export interface IAlbumPhoto {
  name?: string
  url?: string
  title?: string
  takenDate?: string
  location?: string
  description?: string
  [key: string]: unknown
}

const isShow = ref(false)

watch(() => props.show, (val) => {
  isShow.value = val
})

/** 预处理图片路径(相对路径拼接 BASE_API) */
const photoList = computed<IAlbumPhoto[]>(() =>
  (props.photos || []).map(photo => ({
    ...photo,
    url: checkImageUrl(photo.url || ''),
  })),
)

/** 左列(偶数位照片,瀑布流错落) */
const leftPhotos = computed(() => photoList.value.filter((_, index) => index % 2 === 0))

/** 右列(奇数位照片) */
const rightPhotos = computed(() => photoList.value.filter((_, index) => index % 2 === 1))

function handleClose() {
  isShow.value = false
  emit('update:show', false)
}

/** 预览大图 */
function handlePreview(url?: string) {
  const urls = photoList.value.map(photo => photo.url || '')
  if (urls.length === 0) {
    uni.showToast({ title: '相册暂无照片', icon: 'none' })
    return
  }
  uni.previewImage({
    current: url || urls[0],
    urls,
  })
}
</script>

<template>
  <wd-popup v-model="isShow" position="center" custom-style="width:94vw;height:82vh;border-radius:12rpx;" @close="handleClose">
    <view class="album-photo-viewer h-full w-full flex flex-col overflow-hidden rounded-xl bg-white">
      <!-- 头部 -->
      <view class="viewer-header box-border flex shrink-0 items-center justify-between border-b border-black/5 px-7 py-6">
        <text class="viewer-title flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[32rpx] text-[#333] font-bold">{{ albumName }}</text>
        <view class="viewer-close h-14 w-14 flex shrink-0 items-center justify-center rounded-full bg-black/5" @click="handleClose">
          <wd-icon name="close" size="16px" color="#666" />
        </view>
      </view>

      <!-- 照片列表 -->
      <scroll-view class="viewer-body box-border min-h-0 flex-1" scroll-y :show-scrollbar="false">
        <view v-if="loading" class="viewer-empty box-border h-full flex items-center justify-center p-10">
          <view class="viewer-loading flex flex-col items-center">
            <view class="loading-text mt-7 text-[28rpx] text-[#56bbf9]">
              照片正在努力加载中啦~
            </view>
          </view>
        </view>
        <view v-else-if="photoList.length === 0" class="viewer-empty box-border h-full flex items-center justify-center p-10">
          <wd-empty description="这个相册暂时还没有照片~" />
        </view>
        <view v-else class="photo-list box-border flex items-start p-5">
          <!-- 左列 -->
          <view class="photo-column box-border min-w-0 flex-1">
            <view v-for="photo in leftPhotos" :key="photo.name" class="photo-card mb-6 box-border overflow-hidden rounded-xl bg-white shadow-sm">
              <image
                class="photo-image w-full"
                :src="photo.url"
                mode="widthFix"
                lazy-load
                @click="handlePreview(photo.url)"
              />
              <view class="photo-info box-border px-6 py-5">
                <view v-if="photo.title" class="photo-title mb-3 text-[30rpx] text-[#333] font-bold">
                  {{ photo.title }}
                </view>
                <view v-if="photo.takenDate || photo.location" class="photo-meta mb-3 flex flex-wrap items-center">
                  <text v-if="photo.takenDate" class="meta-item mr-8 text-[24rpx] text-[#999]">{{ photo.takenDate }}</text>
                  <text v-if="photo.location" class="meta-item mr-8 text-[24rpx] text-[#999]">{{ photo.location }}</text>
                </view>
                <view v-if="photo.description" class="photo-desc text-[26rpx] text-[#666] leading-[1.6]">
                  {{ photo.description }}
                </view>
              </view>
            </view>
          </view>
          <!-- 右列 -->
          <view class="photo-column box-border min-w-0 flex-1">
            <view v-for="photo in rightPhotos" :key="photo.name" class="photo-card mb-6 box-border overflow-hidden rounded-xl bg-white shadow-sm">
              <image
                class="photo-image w-full"
                :src="photo.url"
                mode="widthFix"
                lazy-load
                @click="handlePreview(photo.url)"
              />
              <view class="photo-info box-border px-6 py-5">
                <view v-if="photo.title" class="photo-title mb-3 text-[30rpx] text-[#333] font-bold">
                  {{ photo.title }}
                </view>
                <view v-if="photo.takenDate || photo.location" class="photo-meta mb-3 flex flex-wrap items-center">
                  <text v-if="photo.takenDate" class="meta-item mr-8 text-[24rpx] text-[#999]">{{ photo.takenDate }}</text>
                  <text v-if="photo.location" class="meta-item mr-8 text-[24rpx] text-[#999]">{{ photo.location }}</text>
                </view>
                <view v-if="photo.description" class="photo-desc text-[26rpx] text-[#666] leading-[1.6]">
                  {{ photo.description }}
                </view>
              </view>
            </view>
          </view>
        </view>
      </scroll-view>

      <!-- 底部关闭 -->
      <view class="viewer-footer box-border shrink-0 border-t border-black/5 px-7 py-5">
        <view class="viewer-footer-btn h-20 flex items-center justify-center rounded-[40rpx]" style="background: linear-gradient(135deg, #f88ca2, #ff6b9d); box-shadow: 0 4rpx 24rpx rgb(248 140 162 / 35%);" @click="handleClose">
          <text class="footer-text text-[30rpx] text-white font-bold">关 闭</text>
        </view>
      </view>
    </view>
  </wd-popup>
</template>

<style scoped>
.album-photo-viewer {
  /* 布局全部由 UnoCSS 原子类实现 */

  .photo-column:first-child {
    margin-right: 20rpx;
  }
}
</style>
