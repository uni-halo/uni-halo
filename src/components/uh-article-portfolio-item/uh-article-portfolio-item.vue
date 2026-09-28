<script lang="ts" setup>
import { computed, ref } from 'vue'
import { getProjectDetail } from '@/api/halo-plugin-third/portfolio'
import { checkImageUrl } from '@/utils/url'
import { PORTFOLIO_TYPE_LABELS, portfolioLabelOf } from '@/config/portfolio'
import { useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import type { IProject } from '@/api/types/halo-plugin-third/portfolio'

const props = defineProps<{
  slug: string
  index?: number
}>()

const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()
const project = ref<IProject | null>(null)

async function handleGetData() {
  updateLoadingStatus('loading')
  try {
    const res = await getProjectDetail(props.slug)
    project.value = res.data
    updateLoadingStatus(res.data ? 'success' : 'empty')
  }
  catch (err) {
    console.error('获取项目失败', err)
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

/** 复制链接 */
function handleCopyLink(url: string | undefined, label: string) {
  if (!url) { return }
  handleCopy(url, `${label}链接复制成功`)
}

const linkButtons = computed(() => [
  { label: '仓库', url: project.value?.repoUrl },
  { label: '演示', url: project.value?.demoUrl },
  { label: '文档', url: project.value?.docsUrl },
].filter(item => item.url))

handleGetData()
</script>

<template>
  <uh-data-loading
    v-if="loadingStatus !== 'success'" :loading-status="loadingStatus" size="small"
    empty-text="项目不存在哦~" min-height="120px" @refresh="handleGetData"
  />
  <view v-else-if="project" class="box-border border border-black/5 rounded-xl p-3">
    <view class="flex gap-3">
      <image
        v-if="project.cover" :src="checkImageUrl(project.cover)" mode="aspectFill"
        class="h-20 w-20 flex-shrink-0 rounded-lg"
      />
      <view v-else class="h-20 w-20 flex flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-3xs text-gray-400">
        暂无封面
      </view>
      <view class="min-w-0 flex flex-1 flex-col gap-1">
        <view class="flex items-center gap-2">
          <text class="flex-1 truncate text-sm text-gray-900 font-semibold">{{ project.title }}</text>
          <view
            v-if="project.featured"
            class="inline-flex rounded-full bg-primary px-2 py-0.5 text-10px text-gray-900"
          >
            推荐
          </view>
        </view>
        <text v-if="project.summary" class="line-clamp-2 text-xs text-gray-500">{{ project.summary }}</text>
        <view v-if="project.type" class="flex items-center gap-1 text-10px text-gray-400">
          {{ portfolioLabelOf(PORTFOLIO_TYPE_LABELS, project.type) }}
        </view>
        <view v-if="project.techStacks?.length" class="flex flex-wrap gap-1.5">
          <text
            v-for="tech in project.techStacks.slice(0, 4)" :key="tech"
            class="rounded-md bg-gray-100 px-1.5 py-0.5 text-10px text-gray-500"
          >
            {{ tech }}
          </text>
        </view>
      </view>
    </view>
    <view v-if="linkButtons.length" class="mt-2 flex flex-wrap gap-2 border-t border-black/5 pt-2">
      <view
        v-for="btn in linkButtons" :key="btn.label"
        class="inline-flex items-center gap-0.5 border border-gray-200 rounded-full px-2.5 py-1 text-10px text-gray-600"
        @click.stop="handleCopyLink(btn.url, btn.label)"
      >
        <wd-icon name="link" size="12px" />
        {{ btn.label }}
      </view>
    </view>
  </view>
</template>
