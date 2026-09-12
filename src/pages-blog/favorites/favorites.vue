<script lang="ts" setup>
import { computed, ref, watchEffect } from 'vue'
import { onPageScroll } from '@dcloudio/uni-app'
import { formatTime } from '@/utils/formatTime'
import { useFavoritesStore } from '@/store/favorites'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { usePageScroll } from '@/hooks/usePageScroll'
import type { FavoriteKind, IFavoriteItem } from '@/utils/favorite'

definePage({
  style: {
    navigationBarTitleText: '我的收藏',
	navigationStyle: 'custom',
  },
})

const { scrollY, updatePageScrollValue } = usePageScroll()
const favoritesStore = useFavoritesStore()

/* ---------------- Tab(文章/瞬间) ---------------- */
const activeKind = ref<FavoriteKind>('post')

const tabList = computed(() => [
  { key: 'post' as FavoriteKind, label: '文章', count: favoritesStore.counts.post },
  { key: 'moment' as FavoriteKind, label: '瞬间', count: favoritesStore.counts.moment },
])

const currentItems = computed<IFavoriteItem[]>(() =>
  activeKind.value === 'post' ? favoritesStore.postItems : favoritesStore.momentItems,
)

function handleSwitchTab(kind: FavoriteKind) {
  activeKind.value = kind
}

/* ---------------- 加载状态机(与 tabbar 页同构) ---------------- */
const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()

/** 本地数据同步可得:状态由当前 Tab 列表直接推导(空→Empty;loading/error 分支为将来异步数据源预留) */
watchEffect(() => {
  updateLoadingStatus(
    currentItems.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success,
  )
})
 
/* ---------------- 收藏时间 ---------------- */
function formatCollectTime(time: string): string {
  return formatTime({ d: time, f: 'yyyy-MM-dd' })
}

/* ---------------- 交互 ---------------- */
/** 跳转对应类型详情(原内容被删由详情页空态兜底) */
function handleToDetail(item: IFavoriteItem) {
  const base = item.kind === 'post'
    ? '/pages-blog/article-detail/article-detail'
    : '/pages-blog/moment-detail/moment-detail'
  uni.navigateTo({
    url: `${base}?name=${item.id}`,
    animationType: 'slide-in-right',
  })
}

/** 取消收藏(直接删除 + 轻提示;详情页可随时重新收藏,不弹二次确认) */
function handleRemove(item: IFavoriteItem) {
  favoritesStore.remove(item.kind, item.id)
  uni.showToast({ icon: 'none', title: '已取消收藏' })
}

/* ---------------- 空态文案 ---------------- */
const emptyText = computed(() => (activeKind.value === 'post' ? '还没有收藏文章' : '还没有收藏瞬间'))

/* ---------------- 滚动 ---------------- */
onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})
</script>

<template>
  <view class="box-border min-h-screen w-screen bg-page pb-10">
	  <!-- 自定义导航 -->
	<uh-navbar :scroll-y="scrollY" default-title="我的收藏" title-color="text-gray-900"></uh-navbar>
	  
    <!-- 顶部类型 Tab(与图库页同款:吸顶玻璃胶囊 chip) -->
    <wd-sticky>
      <scroll-view scroll-x class="w-full whitespace-nowrap">
        <view class="flex gap-2 px-3 pb-1 pt-3">
          <view
            v-for="tab in tabList" :key="tab.key"
            class="uh-global-card-glass uh-shadow-xs inline-block border rounded-2xl px-5 py-1.5 text-sm"
            :class="tab.key === activeKind ? 'bg-primary font-bold' : 'text-gray-500'"
            @click="handleSwitchTab(tab.key)"
          >
            {{ tab.label }}
            <text v-if="tab.count > 0">({{ tab.count }})</text>
          </view>
        </view>
      </scroll-view>
    </wd-sticky>

    <!-- 状态舞台 + 列表 -->
    <view class="flex flex-col gap-3 px-3 pt-2">
      <!-- 空态(当前 Tab 无收藏):uh-data-loading 统一渲染,视觉与 tabbar 页一致 -->
      <uh-data-loading
        v-if="loadingStatus !== 'success'" :loading-status="loadingStatus" min-height="65vh"
       :use-refresh-button="false" :empty-text="emptyText" empty-sub-text="快去阅读文章/瞬间点击收藏吧"
      />

      <!-- 成功态:当前 Tab 列表 -->
      <template v-else>
        <!-- 文章卡 -->
        <template v-if="activeKind === 'post'">
          <view
            v-for="item in currentItems" :key="item.id"
            class="uh-shadow-xs overflow-hidden rounded-[24rpx] bg-white" @click="handleToDetail(item)"
          >
            <view class="flex gap-3 p-4 pb-3">
              <image
                v-if="item.cover" :src="item.cover" mode="aspectFill"
                class="h-[128rpx] w-[176rpx] shrink-0 rounded-lg"
              />
              <view class="min-w-0 flex-1">
                <view class="truncate text-sm text-gray-900 font-bold">
                  {{ item.title || '未命名' }}
                </view>
                <view v-if="item.content" class="clamp-2 mt-1 text-xs text-gray-500 leading-relaxed">
                  {{ item.content }}
                </view>
              </view>
            </view>
            <!-- 元信息 + 底部操作(详情/删除) -->
            <view class="flex items-center justify-between px-4 pb-3">
              <view class="min-w-0 flex flex-1 items-center gap-1.5 text-xs text-gray-400">
                <image
                  v-if="item.owner.avatar" :src="item.owner.avatar" mode="aspectFill"
                  class="h-[36rpx] w-[36rpx] shrink-0 rounded-full"
                />
                <text class="max-w-[220rpx] truncate">{{ item.owner.displayName }}</text>
                <text class="shrink-0">· 收藏于 {{ formatCollectTime(item.createTime) }}</text>
              </view>
              <view class="flex shrink-0 items-center gap-1">
                <text class="px-2 py-1 text-xs text-primary" @click.stop="handleToDetail(item)">详情</text>
                <text class="px-2 py-1 text-xs text-gray-400" @click.stop="handleRemove(item)">删除</text>
              </view>
            </view>
          </view>
        </template>

        <!-- 瞬间卡 -->
        <template v-else>
          <view
            v-for="item in currentItems" :key="item.id"
            class="uh-shadow-xs overflow-hidden rounded-[24rpx] bg-white" @click="handleToDetail(item)"
          >
            <view class="p-4 pb-3">
              <view class="clamp-3 text-sm text-gray-800 leading-relaxed">
                {{ item.content || '(暂无内容)' }}
              </view>
            </view>
            <view class="flex items-center justify-between px-4 pb-3">
              <view class="min-w-0 flex flex-1 items-center gap-1.5 text-xs text-gray-400">
                <image
                  v-if="item.owner.avatar" :src="item.owner.avatar" mode="aspectFill"
                  class="h-[36rpx] w-[36rpx] shrink-0 rounded-full"
                />
                <text class="max-w-[220rpx] truncate">{{ item.owner.displayName }}</text>
                <text class="shrink-0">· 收藏于 {{ formatCollectTime(item.createTime) }}</text>
              </view>
              <view class="flex shrink-0 items-center gap-1">
                <text class="px-2 py-1 text-xs text-primary" @click.stop="handleToDetail(item)">详情</text>
                <text class="px-2 py-1 text-xs text-gray-400" @click.stop="handleRemove(item)">删除</text>
              </view>
            </view>
          </view>
        </template>
      </template>
    </view>
  </view>
</template>

<style scoped lang="scss">
/* 多行截断(原子类无 line-clamp,scoped 补充) */
.clamp-2 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.clamp-3 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}
</style>
