<script lang="ts" setup>
/**
 * 首页公告滚动条(plugin-uni-halo 通知公告,2026-09-03 客户端新增)
 * 展示最新/置顶公告(公开 GET /notices 服务端默认 priority desc + publishTime desc),
 * 取前 6 条标题垂直循环轮播:点击当前标题跳公告详情,右侧「更多」跳公告列表页。
 * 无公告(或加载失败)时整条不渲染,不占首页空间。
 * UIUX 见 .docs/notice-module-client-design.md
 */
import { computed, onMounted, ref } from 'vue'
import { getNotices } from '@/api/uni-halo'
import type { INoticeListVo } from '@/api/types/uni-halo'

/** 轮播展示条数上限(垂直循环) */
const MAX_SHOW = 6

const list = ref<INoticeListVo[]>([])
const showList = computed(() => list.value.slice(0, MAX_SHOW))

async function fetchNotices() {
  try {
    const res = await getNotices({ page: 1, size: MAX_SHOW })
    list.value = res.data?.items || []
  }
  catch (err) {
    console.error('首页公告获取失败', err)
    list.value = []
  }
}

/** 点击单条公告标题 → 详情页 */
function handleTap(item: INoticeListVo) {
  if (!item.name)
    return
  uni.navigateTo({ url: `/pages-blog/notice/detail?name=${item.name}` })
}

/** 点击「公告/更多」→ 公告列表页 */
function handleGoList() {
  uni.navigateTo({ url: '/pages-blog/notice/notice' })
}

onMounted(() => {
  fetchNotices()
})
</script>

<template>
  <view
    v-if="showList.length > 0"
    class="mx-3 mb-2 flex items-center rounded-xl bg-white px-3 py-1.5 shadow-sm"
  >
    <!-- 左侧公告入口 -->
    <view class="flex shrink-0 items-center gap-1 py-2 pr-3" @click="handleGoList">
      <text class="text-[28rpx]">
        📢
      </text>
      <text class="text-[24rpx] font-bold text-[#f83856]">
        公告
      </text>
    </view>

    <!-- 标题轮播(仅一条时静态展示) -->
    <view class="h-[60rpx] min-w-0 flex-1 overflow-hidden">
      <swiper
        v-if="showList.length > 1"
        class="h-full w-full"
        vertical
        circular
        autoplay
        :interval="3500"
        :duration="400"
      >
        <swiper-item
          v-for="(item, index) in showList"
          :key="item.name || index"
          class="h-full w-full"
        >
          <view
            class="flex h-full w-full items-center truncate text-[24rpx] text-[#555]"
            @click="handleTap(item)"
          >
            {{ item.title }}
          </view>
        </swiper-item>
      </swiper>
      <view
        v-else
        class="flex h-full w-full items-center truncate text-[24rpx] text-[#555]"
        @click="handleTap(showList[0])"
      >
        {{ showList[0]?.title }}
      </view>
    </view>

    <!-- 右侧更多入口 -->
    <view class="flex shrink-0 items-center gap-0.5 py-2 pl-2" @click="handleGoList">
      <text class="text-[22rpx] text-[#bbb]">
        更多
      </text>
      <wd-icon name="arrow-right" size="12px" color="#bbb" />
    </view>
  </view>
</template>

<style scoped lang="scss">
/* 布局由 UnoCSS 原子类实现 */
</style>
