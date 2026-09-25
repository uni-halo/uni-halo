<script lang="ts" setup>
import { computed, ref } from 'vue'
import { onLoad, onPageScroll, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { getBannerDetail } from '@/api/uni-halo'
import { checkAvatarUrl, checkThumbnailUrl } from '@/utils/url'
import { getAvatarFallbackText } from '@/utils/avatar'
import { formatTime } from '@/utils/formatTime'
import { copyToClipboard } from '@/utils/clipboard'
import { sleep } from '@/utils/common'
import { markdownConfig } from '@/config/markdown'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { usePageScroll } from '@/hooks/usePageScroll'
import type { IBannerPublicDetail } from '@/api/types/uni-halo'

definePage({
  style: {
    navigationBarTitleText: '轮播详情',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
  },
})

const { scrollY, updatePageScrollValue } = usePageScroll()
const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()
const name = ref('')
const detail = ref<IBannerPublicDetail | null>(null)

/** 封面图:无封面时回退默认缩略图 */
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
  return formatTime({ d: detail.value.date, f: 'yyyy年MM月dd日 星期w' })
})

const content = computed(() => detail.value?.content || '')

/* ---------------- 分享 ---------------- */

onShareAppMessage(() => ({
  title: detail.value?.title || '轮播详情',
  path: `/pages-blog/banner-detail/banner-detail?name=${name.value}`,
  imageUrl: coverUrl.value,
}))

onShareTimeline(() => ({
  title: detail.value?.title || '轮播详情',
  query: name.value ? `name=${name.value}` : '',
  imageUrl: coverUrl.value,
}))

/** 外链存在即展示底部操作(复制/访问) */
const hasLink = computed(() => !!detail.value?.link)

/** 加载轮播详情(状态机;404/无数据 → 空态,其余错误 → error 态,可重试) */
async function loadDetail() {
  updateLoadingStatus(DataLoadingStatusEnum.Loading)
  if (!name.value) {
    updateLoadingStatus(DataLoadingStatusEnum.Empty)
    return
  }
  try {
    const res = await getBannerDetail(name.value)
    detail.value = res.data || null
    await sleep(600)
    updateLoadingStatus(detail.value ? DataLoadingStatusEnum.Success : DataLoadingStatusEnum.Empty)
  }
  catch (err) {
    console.error('轮播详情加载失败', err)
    const code = (err as { code?: number }).code
    updateLoadingStatus(code === 404 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Error)
  }
  finally {
    uni.stopPullDownRefresh()
  }
}

onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})

onPullDownRefresh(() => {
  loadDetail()
})

onLoad((options) => {
  name.value = options?.name || ''
  loadDetail()
})

/** 非 APP-PLUS:复制链接 */
function handleCopyLink() {
  if (!detail.value?.link) {
    return
  }
  copyToClipboard(detail.value.link, '链接已复制')
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
  <view class="box-border min-h-screen w-screen bg-page pb-safe">
    <!-- 自定义导航 -->
    <uh-navbar :scroll-y="scrollY" default-title="内容详情" title-color="text-gray-900" :scroll-title="detail?.title" />

    <!-- 加载/错误/空态(状态机) -->
    <uh-data-loading
      v-if="loadingStatus !== 'success'" :loading-status="loadingStatus" min-height="75vh"
      error-text="详情加载失败" empty-text="内容不存在或已下线" empty-sub-text="" @refresh="loadDetail"
    />

    <!-- 正文 -->
    <view v-else-if="detail" class="box-border p-4">
      <!-- 有图，wd-img 如果加载空的地址 会一直处于loading状态，所以空值我们不加载 -->
      <wd-img v-if="coverUrl" class="mb-5 h-[320rpx] w-full" :radius="12" :src="coverUrl" mode="aspectFill">
        <template #loading>
          <wd-loading size="64rpx" custom-class="text-primary" />
        </template>
      </wd-img>
      <!-- 无图 -->
      <view
        v-else
        class="mb-5 h-[320rpx] w-full flex items-center justify-center from-[#ebfabf] to-[#f5fae8] bg-gradient-to-b text-gray-400"
      >
        <wd-icon class-prefix="uhemoji-icon" name="-injury" size="72rpx" />
      </view>

      <view class="text-md text-gray-900 font-bold leading-snug">
        {{ detail.title }}
      </view>

      <!-- 作者/日期信息 -->
      <view v-if="authorName || dateText" class="mt-3 flex items-center gap-2">
        <wd-avatar
          :src="authorAvatar"
          :text="getAvatarFallbackText(authorName)"
          shape="round"
          custom-class="!h-[44rpx] !w-[44rpx] !text-[10px] !leading-none !text-gray-900 !font-bold"
          class="!rounded-full"
          mode="aspectFill"
        />
        <text v-if="authorName" class="text-[24rpx] text-gray-500">{{ authorName }}</text>
        <text v-if="dateText" class="text-[22rpx] text-gray-500">{{ dateText }}</text>
      </view>

      <!-- 富文本内容 -->
      <view v-if="content" class="mt-2 box-border w-full pb-12 pt-4 text-3xs text-gray-900">
        <mp-html
          :content="content" lazy-load :domain="markdownConfig.domain"
          :loading-img="markdownConfig.loadingGif" scroll-table selectable
          :tag-style="markdownConfig.tagStyle" :container-style="markdownConfig.containStyle"
          :markdown="true" :show-line-number="true"
          :show-language-name="true" copy-by-long-press
        />
      </view>

      <!-- 外链(平台差异,条件编译):非 APP 复制 / APP 访问 -->
      <view v-if="hasLink" class="fixed bottom-0 left-0 right-0 box-border px-4 pb-safe">
        <!-- #ifndef APP-PLUS -->
        <uh-button class="flex-1" custom-class="uh-global-card-glass border w-full !rounded-full py-2.5 font-medium !text-3xs" @click="handleCopyLink">
          复制原文地址
        </uh-button>
        <!-- #endif -->
        <!-- #ifdef APP-PLUS -->
        <uh-button class="flex-1" custom-class="uh-global-card-glass border w-full !rounded-full py-2.5 font-medium !text-3xs" @click="handleOpenLink">
          访问链接
        </uh-button>
        <!-- #endif -->
      </view>
    </view>
  </view>
</template>
