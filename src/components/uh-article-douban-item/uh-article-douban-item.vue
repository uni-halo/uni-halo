<script lang="ts" setup>
import { computed, ref } from 'vue'
import { getDoubanDetail } from '@/api/halo-plugin-third/douban'
import { checkThumbnailUrl } from '@/utils/url'
import { useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import type { IDoubanMovie } from '@/api/types/halo-plugin-third/douban'

const props = defineProps<{
  url: string
  index?: number
}>()

const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()
const douban = ref<IDoubanMovie | null>(null)

/** 类型中文映射 */
const TYPE_LABELS: Record<string, string> = {
  movie: '电影',
  book: '图书',
  music: '音乐',
  game: '游戏',
  drama: '舞台剧',
}

const typeLabel = computed(() => {
  const type = douban.value?.type
  return type ? TYPE_LABELS[type] || type : ''
})

async function handleGetData() {
  updateLoadingStatus('loading')
  try {
    const res = await getDoubanDetail(props.url)
    douban.value = res.data
    updateLoadingStatus(res.data ? 'success' : 'empty')
  }
  catch (err) {
    console.error('获取豆瓣内容失败', err)
    updateLoadingStatus('error')
  }
}

/** 复制文本 */
function handleCopy(text: string, title: string) {
  uni.setClipboardData({
    data: text,
    success: () => {
      uni.showToast({ icon: 'none', title })
    },
  })
}

/** 复制资源信息 */
function handleCopyInfo() {
  const d = douban.value
  if (!d) { return }
  const parts = [
    `名称：${d.name || ''}`,
    d.cardSubtitle ? `其他：${d.cardSubtitle}` : '',
    d.genres?.length ? `标签：${d.genres.join('/')}` : '',
    d.pubdate ? `时间：${d.pubdate}` : '',
    d.score ? `评分：${d.score}分` : '',
    d.link ? `链接：${d.link}` : '',
  ].filter(Boolean)
  handleCopy(parts.join('\n'), '资源信息复制成功')
}

handleGetData()
</script>

<template>
  <uh-data-loading
    v-if="loadingStatus !== 'success'" :loading-status="loadingStatus" size="mini"
    empty-text="豆瓣内容不存在哦~" min-height="22vh" @refresh="handleGetData"
  />
  <view v-else-if="douban" class="relative box-border overflow-hidden border border-[#f5c618] rounded-lg border-solid p-3">
    <!-- 角标 -->
    <view class="absolute right-0 top-0 rounded-bl-lg bg-[#f5c618] px-2 py-0.5 text-10px text-gray-900">
      豆瓣
    </view>
    <view class="flex gap-3">
      <view v-if="douban.poster" class="h-27 w-22 flex-shrink-0 overflow-hidden rounded-lg">
        <wd-img width="100%" height="100%" :src="checkThumbnailUrl(douban.poster)" mode="aspectFill" lazy-load>
          <template #loading>
            <wd-loading size="64rpx" custom-class="text-primary" />
          </template>
        </wd-img>
      </view>
      <view v-else class="h-27 w-22 flex flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-3xs text-gray-400">
        无封面
      </view>
      <view class="min-w-0 flex flex-1 flex-col gap-1">
        <text class="truncate pr-10 text-sm text-gray-900 font-semibold">{{ douban.name }}</text>
        <view v-if="douban.score" class="flex items-center gap-1">
          <wd-icon name="star-fill" size="28rpx" class="text-orange-400" />
          <text class="text-xs text-orange-400">{{ douban.score }}</text>
        </view>
        <text v-if="douban.cardSubtitle" class="line-clamp-2 text-xs text-gray-500">{{ douban.cardSubtitle }}</text>
        <view class="flex flex-wrap gap-1.5">
          <text v-if="typeLabel" class="rounded-md bg-orange-100 px-1.5 py-0.5 text-10px text-orange-500">
            {{ typeLabel }}
          </text>
          <text
            v-for="genre in (douban.genres || []).slice(0, 3)" :key="genre"
            class="rounded-md bg-gray-100 px-1.5 py-0.5 text-10px text-gray-500"
          >
            {{ genre }}
          </text>
        </view>
      </view>
    </view>
    <view class="mt-2 w-full flex flex items-center gap-2 pt-2">
      <uh-button
        class="flex-1"
        custom-class="uh-global-card-glass flex items-center gap-x-1 !rounded-lg !bg-[#f5c618] !px-3 !py-1.5 !text-xs !text-gray-900 !border !shadow-none"
        @click.stop="douban.link && handleCopy(douban.link, '豆瓣地址复制成功')"
      >
        <wd-icon name="link" size="24rpx" />
        豆瓣地址
      </uh-button>
      <uh-button
        class="flex-1"
        custom-class="uh-global-card-glass flex items-center gap-x-1 !rounded-lg !bg-[#f5c618] !px-3 !py-1.5 !text-xs !text-gray-900 !border !shadow-none"
        @click.stop="handleCopyInfo()"
      >
        <wd-icon name="copy" size="24rpx" />
        资源信息
      </uh-button>
    </view>
  </view>
</template>
