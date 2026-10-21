<script lang="ts" setup>
import type { IPhoto } from '@/api/types/halo'

interface IProps {
  visiblePhotoName: boolean
  photos: IPhoto[]
  item: IPhoto
}
const props = withDefaults(defineProps<IProps>(), {
})

/* ---------------- 图片预览 ---------------- */
function handlePreview(data: IPhoto) {
  const current = props.photos.findIndex(x => x.metadata.name === data.metadata.name)
  uni.previewImage({
    current,
    urls: props.photos.map(x => x.spec.url),
    indicator: 'number',
    loop: true,
  })
}
</script>

<template>
  <view
    v-if="props.item"
    class="uh-global-card-glass uh-shadow-xs relative w-full overflow-hidden rounded-xl"
    @click="handlePreview(props.item)"
  >
    <view class="relative h-32 w-full">
      <wd-img
        custom-class="!h-full !w-full" :src="props.item.spec.url"
        mode="aspectFill" lazy-load
      >
        <template #loading>
          <wd-loading size="64rpx" custom-class="text-primary" />
        </template>
      </wd-img>
    </view>
    <view
      v-if="props.visiblePhotoName && props.item.spec.displayName"
      class="absolute bottom-0 z-2 box-border w-full from-white/0 to-black/40 bg-gradient-to-b p-3 pt-6"
    >
      <text class="line-clamp-2 text-xs text-white">{{ props.item.spec.displayName }}</text>
    </view>
  </view>
</template>

<style scoped></style>
