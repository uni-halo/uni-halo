<script lang="ts" setup>
/**
 * 公告详情页(plugin-uni-halo 通知公告,2026-09-03 客户端接入)
 * 公开 GET /notices/{name} 返回完整 Notice extension(metadata+spec,spec 内嵌
 * typeDisplayName/typeColor);正文 content 为富文本 HTML,mp-html 渲染。
 * 不存在/删除中返回 404 → 空态提示。UIUX 见 .docs/notice-module-client-design.md
 */
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getNoticeDetail } from '@/api/uni-halo'
import { checkIsUrl } from '@/utils/url'
import { markdownConfig } from '@/config/markdown'
import type { INoticeDetail } from '@/api/types/uni-halo'

definePage({
  style: {
    navigationBarTitleText: '公告详情',
  },
})

const loading = ref(true)
const notFound = ref(false)
const detail = ref<INoticeDetail | null>(null)

const spec = computed(() => detail.value?.spec)
const content = computed(() => spec.value?.content || '')
const title = computed(() => spec.value?.title || '')
const typeColor = computed(() => spec.value?.typeColor || '')
const typeDisplayName = computed(() => spec.value?.typeDisplayName || '')
const cover = computed(() => spec.value?.cover || '')
const publishTime = computed(() => formatDate(spec.value?.publishTime))
const hasLink = computed(() => !!spec.value?.link && checkIsUrl(spec.value?.link || ''))

function formatDate(value?: string): string {
  if (!value)
    return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime()))
    return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function handleBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  }
  else {
    uni.switchTab({ url: '/pages/tabbar/home/home' })
  }
}

/** 外链 → 复用 website 承载页 */
function handleToExternal() {
  if (!spec.value?.link)
    return
  uni.navigateTo({
    url: `/pages-blog/website/website?data=${JSON.stringify({
      title: title.value || '公告原文',
      url: encodeURIComponent(spec.value.link),
    })}`,
  })
}

onLoad(async (options) => {
  const name = options?.name || ''
  if (!name) {
    notFound.value = true
    loading.value = false
    return
  }
  try {
    const res = await getNoticeDetail(name)
    detail.value = res.data || null
    if (!detail.value?.spec) {
      notFound.value = true
    }
  }
  catch (err) {
    console.error('公告详情加载失败', err)
    const code = (err as { code?: number }).code
    notFound.value = code === 404
    if (code !== 404) {
      uni.showToast({ icon: 'none', title: '公告加载失败' })
    }
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <view class="notice-detail min-h-screen w-screen bg-white pb-12">
    <!-- 加载中 -->
    <view v-if="loading" class="flex flex-col items-center justify-center py-40">
      <text class="text-[26rpx] text-[#999]">
        加载中...
      </text>
    </view>

    <!-- 不存在/已下线 -->
    <view v-else-if="notFound" class="flex flex-col items-center justify-center py-40">
      <text class="text-[60rpx]">
        🕳️
      </text>
      <text class="mt-6 text-[26rpx] text-[#999]">
        公告不存在或已下线
      </text>
      <view class="mt-10">
        <wd-button size="small" type="primary" plain @click="handleBack">
          返回
        </wd-button>
      </view>
    </view>

    <!-- 正文 -->
    <view v-else class="px-6 py-6">
      <image
        v-if="cover"
        class="mb-5 h-[320rpx] w-full rounded-xl"
        :src="cover"
        mode="aspectFill"
      />
      <view class="text-[36rpx] font-bold leading-snug text-[#222]">
        {{ title }}
      </view>

      <view class="mt-3 flex items-center gap-2">
        <view
          v-if="typeDisplayName"
          class="rounded px-2 py-0.5 text-[20rpx]"
          :style="{
            color: typeColor || '#f83856',
            backgroundColor: typeColor ? `${typeColor}1a` : '#fdeef1',
          }"
        >
          {{ typeDisplayName }}
        </view>
        <text class="text-[22rpx] text-[#bbb]">
          {{ publishTime }}
        </text>
      </view>

      <view class="mt-4 border-t border-[#f0f0f0] pt-5">
        <mp-html
          :content="content"
          lazy-load
          :domain="markdownConfig.domain ?? ''"
          scroll-table
          selectable
          :tag-style="markdownConfig.tagStyle"
          :container-style="markdownConfig.containStyle"
          :show-line-number="false"
          copy-by-long-press
        />
      </view>

      <view v-if="hasLink" class="mt-10">
        <wd-button type="primary" block round @click="handleToExternal">
          查看原文 ↗
        </wd-button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.notice-detail {
  :deep(img) {
    max-width: 100%;
    border-radius: 8rpx;
  }
}
</style>
