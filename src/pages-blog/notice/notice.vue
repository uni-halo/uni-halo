<script lang="ts" setup>
/**
 * 公告中心·列表页(plugin-uni-halo 通知公告,2026-09-03 客户端接入)
 * 公开接口 GET /notices 仅分页(脱敏不含 content);公告量小,页面一次拉取
 * size=100 后本地做「类型筛选 + 排序(最新/最早/按类型分组)」,触底续拉下一页。
 * UIUX 见 .docs/notice-module-client-design.md
 */
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { getNotices } from '@/api/uni-halo'
import type { INoticeListVo } from '@/api/types/uni-halo'

definePage({
  style: {
    navigationBarTitleText: '公告中心',
    enablePullDownRefresh: true,
  },
})

const PAGE_SIZE = 100

const loading = ref(false)
const allItems = ref<INoticeListVo[]>([])
const page = ref(1)
const total = ref(0)
const activeType = ref('')
type SortKey = 'latest' | 'earliest' | 'group'
const sortKey = ref<SortKey>('latest')

const SORT_OPTIONS: Array<{ id: SortKey, label: string }> = [
  { id: 'latest', label: '最新在前' },
  { id: 'earliest', label: '最早在前' },
  { id: 'group', label: '按类型分组' },
]

/* ---------------- 类型 chips(从已加载列表聚合) ---------------- */
const typeOptions = computed(() => {
  const map = new Map<string, { typeName: string, typeDisplayName: string, typeColor: string }>()
  for (const item of allItems.value) {
    const key = item.typeName || ''
    const display = item.typeDisplayName || '未分类'
    if (!map.has(key)) {
      map.set(key, { typeName: key, typeDisplayName: display, typeColor: item.typeColor || '' })
    }
  }
  return Array.from(map.values())
})

/* ---------------- 时间与排序 ---------------- */
function formatDate(value?: string): string {
  if (!value)
    return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime()))
    return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function timeOf(item: INoticeListVo): number {
  const time = item.publishTime ? new Date(item.publishTime).getTime() : NaN
  return Number.isNaN(time) ? 0 : time
}

/** 展示列表:先按类型筛选,再按排序键排序(时间倒序/正序/按类型分组) */
const displayList = computed(() => {
  let list = allItems.value
  if (activeType.value !== '') {
    list = list.filter(item => (item.typeName || '') === activeType.value)
  }
  if (sortKey.value === 'latest') {
    list = [...list].sort((a, b) => timeOf(b) - timeOf(a))
  }
  else if (sortKey.value === 'earliest') {
    list = [...list].sort((a, b) => timeOf(a) - timeOf(b))
  }
  else {
    // 按类型分组:未分类排最后,组内按发布时间倒序
    const groupOrder = new Map<string, number>()
    for (const item of allItems.value) {
      const key = item.typeName || ''
      if (!groupOrder.has(key)) {
        groupOrder.set(key, groupOrder.size)
      }
    }
    list = [...list].sort((a, b) => {
      const ka = a.typeName || ''
      const kb = b.typeName || ''
      const ga = groupOrder.get(ka) ?? Number.MAX_SAFE_INTEGER
      const gb = groupOrder.get(kb) ?? Number.MAX_SAFE_INTEGER
      if (ga !== gb)
        return ga - gb
      return timeOf(b) - timeOf(a)
    })
  }
  return list
})

/* ---------------- 数据加载 ---------------- */
async function loadNotices(reset: boolean) {
  if (loading.value)
    return
  loading.value = true
  try {
    const target = reset ? 1 : page.value + 1
    const res = await getNotices({ page: target, size: PAGE_SIZE })
    const body = res.data
    const items = body?.items || []
    if (reset) {
      allItems.value = items
      page.value = 1
    }
    else {
      allItems.value = [...allItems.value, ...items]
      page.value = target
    }
    total.value = body?.total ?? allItems.value.length
  }
  catch (err) {
    console.error('公告列表加载失败', err)
    uni.showToast({ icon: 'none', title: '公告加载失败' })
  }
  finally {
    loading.value = false
  }
}

function loadMore() {
  if (loading.value || allItems.value.length >= total.value)
    return
  loadNotices(false)
}

onLoad(() => {
  loadNotices(true)
})

onReachBottom(() => {
  loadMore()
})

onPullDownRefresh(async () => {
  await loadNotices(true)
  uni.stopPullDownRefresh()
})

/* ---------------- 跳转 ---------------- */
function handleToDetail(item: INoticeListVo) {
  if (!item.name)
    return
  uni.navigateTo({ url: `/pages-blog/notice/detail?name=${item.name}` })
}
</script>

<template>
  <view class="notice-page min-h-screen w-screen bg-[#f7f8fa]">
    <!-- 类型筛选(横滑 chips) -->
    <scroll-view scroll-x class="type-bar sticky top-0 z-10 w-full bg-white px-3 py-2" :show-scrollbar="false">
      <view class="flex items-center gap-2 whitespace-nowrap">
        <view
          class="rounded-full px-4 py-1.5 text-[24rpx]"
          :class="activeType === '' ? 'bg-[#f83856] text-white' : 'bg-[#f0f0f0] text-[#666]'"
          @click="activeType = ''"
        >
          全部
        </view>
        <view
          v-for="type in typeOptions"
          :key="type.typeName || '__none__'"
          class="flex items-center gap-1 rounded-full px-4 py-1.5 text-[24rpx]"
          :class="activeType === type.typeName ? 'bg-[#f83856] text-white' : 'bg-[#f0f0f0] text-[#666]'"
          @click="activeType = activeType === type.typeName ? '' : type.typeName"
        >
          <view v-if="type.typeColor" class="h-2 w-2 rounded-full" :style="{ backgroundColor: type.typeColor }" />
          <text>{{ type.typeDisplayName }}</text>
        </view>
      </view>
    </scroll-view>

    <!-- 排序 -->
    <view class="sort-bar flex items-center gap-2 px-4 py-2">
      <view
        v-for="opt in SORT_OPTIONS"
        :key="opt.id"
        class="rounded-full px-3 py-1 text-[22rpx]"
        :class="sortKey === opt.id ? 'bg-[#fdeef1] text-[#f83856]' : 'text-[#999]'"
        @click="sortKey = opt.id"
      >
        {{ opt.label }}
      </view>
    </view>

    <!-- 列表 -->
    <view v-if="displayList.length > 0" class="px-3 pb-6">
      <view
        v-for="item in displayList"
        :key="item.name"
        class="mb-3 flex overflow-hidden rounded-xl bg-white p-4"
        @click="handleToDetail(item)"
      >
        <image
          v-if="item.cover"
          class="mr-3 h-[140rpx] w-[180rpx] shrink-0 rounded-lg"
          :src="item.cover"
          mode="aspectFill"
        />
        <view class="min-w-0 flex-1">
          <view class="text-[28rpx] font-bold leading-snug text-[#333] line-clamp-2">
            {{ item.title }}
          </view>
          <view v-if="item.summary" class="mt-1 text-[24rpx] leading-relaxed text-[#888] line-clamp-2">
            {{ item.summary }}
          </view>
          <view class="mt-2 flex items-center gap-2">
            <view
              v-if="item.typeDisplayName"
              class="rounded px-1.5 py-0.5 text-[20rpx]"
              :style="{
                color: item.typeColor || '#f83856',
                backgroundColor: item.typeColor ? `${item.typeColor}1a` : '#fdeef1',
              }"
            >
              {{ item.typeDisplayName }}
            </view>
            <text class="text-[22rpx] text-[#bbb]">
              {{ formatDate(item.publishTime) }}
            </text>
          </view>
        </view>
      </view>

      <view v-if="loading" class="py-6 text-center text-[24rpx] text-[#bbb]">
        加载中...
      </view>
      <view v-else-if="allItems.length >= total.value" class="py-6 text-center text-[24rpx] text-[#bbb]">
        没有更多了
      </view>
    </view>

    <!-- 空态 -->
    <view v-else class="flex flex-col items-center justify-center py-32">
      <text class="text-[40rpx]">📢</text>
      <text class="mt-4 text-[26rpx] text-[#999]">
        {{ loading ? '加载中...' : '暂无公告' }}
      </text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.type-bar {
  white-space: nowrap;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
</style>
