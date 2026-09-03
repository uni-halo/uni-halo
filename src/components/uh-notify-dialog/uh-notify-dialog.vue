<script lang="ts" setup>
/**
 * 通知/最新公告弹窗(源自旧项目 components/notify-dialog,2026-09-03 改造为
 * plugin-uni-halo 最新公告自治宿主):挂载后自动拉取 GET /notices/latest,
 * 「今日已看」命中(键 notice_latest_{name}_{yyyyMMdd})则不打扰;
 * 「不再提醒/查看全文」写今日键;查看全文跳公告详情页。
 * 放置:页面模板中直接 <uh-notify-dialog /> 即可(easycom)。
 * UIUX 见 .docs/notice-module-client-design.md
 */
import { onMounted, ref } from 'vue'
import { getNoticeLatest } from '@/api/uni-halo'
import { getCache, setCache } from '@/utils/storage'
import type { INoticeListVo } from '@/api/types/uni-halo'

const HIDDEN_KEY_PREFIX = 'notice_latest_hidden'

const isShow = ref(false)
const notice = ref<INoticeListVo | null>(null)
const checking = ref(false)

function todayKey(name: string): string {
  const date = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${HIDDEN_KEY_PREFIX}_${name}_${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
}

function formatDate(value?: string): string {
  if (!value)
    return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime()))
    return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

async function handleCheckLatest() {
  if (checking.value)
    return
  checking.value = true
  try {
    const res = await getNoticeLatest()
    const latest = res.data
    if (!latest?.name || !latest.title)
      return
    // 今日已看过则不再打扰
    if (getCache<string>(todayKey(latest.name)))
      return
    notice.value = latest
    isShow.value = true
  }
  catch (err) {
    console.error('获取最新公告失败', err)
  }
  finally {
    checking.value = false
  }
}

/** 仅关闭(不记录,下次进入可再弹) */
function handleClose() {
  isShow.value = false
}

/** 今日不再提醒:记录后关闭 */
function handleDismissForever() {
  if (notice.value?.name) {
    setCache(todayKey(notice.value.name), '1')
  }
  isShow.value = false
}

/** 查看全文:记录今日已看并跳公告详情页 */
function handleViewAll() {
  if (notice.value?.name) {
    setCache(todayKey(notice.value.name), '1')
    const detailName = notice.value.name
    isShow.value = false
    uni.navigateTo({ url: `/pages-blog/notice/detail?name=${detailName}` })
  }
}

onMounted(() => {
  handleCheckLatest()
})
</script>

<template>
  <wd-popup
    v-model="isShow"
    position="center"
    width="80vw"
    custom-style="border-radius:16rpx;"
    @close="handleClose"
  >
    <view v-if="notice" class="uh-notify-dialog box-border w-[80vw] p-6">
      <!-- 头部:标题 + 关闭 -->
      <view class="flex items-center justify-between">
        <view class="flex items-center gap-2">
          <text class="text-[28rpx]">
            📢
          </text>
          <text class="text-[30rpx] font-bold text-[#333]">
            最新公告
          </text>
          <view
            v-if="notice.typeDisplayName"
            class="rounded px-1.5 py-0.5 text-[20rpx]"
            :style="{
              color: notice.typeColor || '#f83856',
              backgroundColor: notice.typeColor ? `${notice.typeColor}1a` : '#fdeef1',
            }"
          >
            {{ notice.typeDisplayName }}
          </view>
        </view>
        <view class="flex h-8 w-8 items-center justify-center text-[#bbb]" @click="handleClose">
          <wd-icon name="close" size="16px" />
        </view>
      </view>

      <!-- 内容 -->
      <view class="mt-4">
        <view class="text-[32rpx] font-bold leading-snug text-[#222]">
          {{ notice.title }}
        </view>
        <view v-if="notice.summary" class="mt-3 text-[26rpx] leading-relaxed text-[#666]">
          {{ notice.summary }}
        </view>
        <view v-if="notice.publishTime" class="mt-3 text-[22rpx] text-[#bbb]">
          {{ formatDate(notice.publishTime) }}
        </view>
      </view>

      <!-- 操作 -->
      <view class="mt-6 flex items-center justify-between border-t border-[#f5f5f5] pt-4">
        <view class="text-[24rpx] text-[#999]" @click="handleDismissForever">
          今日不再提醒
        </view>
        <wd-button size="small" type="primary" round @click="handleViewAll">
          查看全文 →
        </wd-button>
      </view>
    </view>
  </wd-popup>
</template>

<style scoped lang="scss">
.uh-notify-dialog {
  /* 布局全部由 UnoCSS 原子类实现 */
}
</style>
