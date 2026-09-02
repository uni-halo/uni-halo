<script lang="ts" setup>
/**
 * 轮播详情页(自定义 Banner 条目点击后进入)
 * 通过公开详情接口(getBannerDetail)拉取 content 富文本与外链,类文章详情页
 * 外链平台差异(条件编译):非 APP-PLUS(小程序/H5)提供复制+显示链接,APP-PLUS 提供访问按钮(web-view)
 */
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getBannerDetail } from '@/api/uni-halo'
import { checkAvatarUrl, checkThumbnailUrl } from '@/utils/url'
import { formatTime } from '@/utils/formatTime'
import { copyToClipboard } from '@/utils/restrictRead'
import type { IBannerPublicDetail } from '@/api/types/uni-halo'

definePage({
  style: {
    navigationBarTitleText: '轮播详情',
  },
})

const loading = ref<'loading' | 'success' | 'error'>('loading')
const detail = ref<IBannerPublicDetail | null>(null)
const linkCopied = ref(false)

async function handleGetData(name: string) {
  loading.value = 'loading'
  try {
    const res = await getBannerDetail(name)
    detail.value = res.data || null
    if (detail.value?.title) {
      uni.setNavigationBarTitle({ title: detail.value.title })
    }
    loading.value = 'success'
  }
  catch (err) {
    console.error('获取轮播详情失败', err)
    loading.value = 'error'
  }
}

function handleRetry() {
  const name = detail.value?.name || ''
  if (name) {
    handleGetData(name)
  }
}

onLoad((options) => {
  const name = options?.name
  if (name) {
    handleGetData(name)
  }
  else {
    loading.value = 'error'
  }
})

const coverUrl = computed(() => checkThumbnailUrl(detail.value?.cover, true))

const authorName = computed(() => detail.value?.authorName || '')

const authorAvatar = computed(() =>
  detail.value?.authorAvatar ? checkAvatarUrl(detail.value.authorAvatar) : '',
)

const dateText = computed(() => {
  if (!detail.value?.date) {
    return ''
  }
  const d = new Date(detail.value.date)
  if (Number.isNaN(d.getTime())) {
    return ''
  }
  return formatTime({ d: detail.value.date, f: 'yyyy-MM-dd' })
})

/** 非 APP-PLUS:复制链接 */
function handleCopyLink() {
  if (!detail.value?.link) {
    return
  }
  copyToClipboard(detail.value.link, '链接已复制')
  linkCopied.value = true
  setTimeout(() => {
    linkCopied.value = false
  }, 1500)
}

/** APP-PLUS:打开内置 web-view 访问外链 */
function handleOpenLink() {
  if (!detail.value?.link) {
    return
  }
  uni.navigateTo({
    url: `/pages-blog/website/website?data=${JSON.stringify({
      title: detail.value.title || '查看链接',
      url: encodeURIComponent(detail.value.link),
    })}`,
  })
}
</script>

<template>
  <view class="app-page">
    <!-- 加载骨架 -->
    <view v-if="loading === 'loading'" class="p-4">
      <wd-skeleton :row="3" :animated="true" />
    </view>

    <!-- 加载失败 -->
    <view v-else-if="loading === 'error'" class="flex flex-col items-center gap-4 py-20">
      <wd-empty description="详情加载失败" />
      <wd-button size="small" @click="handleRetry">重新加载</wd-button>
    </view>

    <!-- 详情内容 -->
    <view v-else-if="detail" class="pb-8">
      <!-- 封面图 -->
      <image v-if="coverUrl" :src="coverUrl" class="h-[420rpx] w-full" mode="aspectFill" />

      <view class="px-4">
        <!-- 标题 -->
        <view class="mt-6 text-[34rpx] font-bold leading-snug text-[#303133]">
          {{ detail.title }}
        </view>

        <!-- 作者/日期信息 -->
        <view v-if="authorName || dateText" class="mt-3 flex items-center gap-2">
          <image
            v-if="authorAvatar"
            :src="authorAvatar"
            class="h-[44rpx] w-[44rpx] rounded-full"
            mode="aspectFill"
          />
          <text class="text-[24rpx] text-[#909399]">{{ authorName }}</text>
          <text v-if="dateText" class="text-[22rpx] text-[#c0c4cc]">{{ dateText }}</text>
        </view>

        <!-- 富文本内容 -->
        <view v-if="detail.content" class="mt-6 border-t border-[#f0f0f0] pt-6">
          <mp-html :content="detail.content" />
        </view>

        <!-- 外链(平台差异,条件编译) -->
        <view v-if="detail.link" class="link-card mt-8 rounded-xl bg-[#f7f7f9] p-4">
          <view class="mb-3 text-[24rpx] text-[#909399]">相关链接</view>
          <text class="link-text block break-all text-[26rpx] leading-relaxed text-[#606266]">
            {{ detail.link }}
          </text>
          <!-- #ifndef APP-PLUS -->
          <!-- 非 App 端(小程序/H5):复制 + 提示已复制 -->
          <view
            class="link-btn mt-3 inline-flex items-center rounded-lg px-6 py-2 text-[24rpx] text-white"
            :class="linkCopied ? 'link-btn-copied' : ''"
            @click="handleCopyLink"
          >
            {{ linkCopied ? '已复制' : '复制链接' }}
          </view>
          <!-- #endif -->
          <!-- #ifdef APP-PLUS -->
          <!-- App 端:访问按钮(内置 web-view) -->
          <view class="link-btn mt-3 inline-flex items-center rounded-lg px-6 py-2 text-[24rpx] text-white" @click="handleOpenLink">
            访问链接
          </view>
          <!-- #endif -->
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.app-page {
  min-height: 100vh;
  background: #fff;
}

.link-text {
  word-break: break-all;
}

.link-btn {
  background: #2563eb;

  &.link-btn-copied {
    background: #10b981;
  }
}
</style>
