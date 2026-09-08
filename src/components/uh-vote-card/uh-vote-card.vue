<script lang="ts" setup>
import { formatTime as formatTimeUtil } from '@/utils/formatTime'

interface IVoteCardOption {
  id?: string
  title?: string
  checked?: boolean
  _uh_percent?: number
  [key: string]: unknown
}

interface IVoteCardData {
  metadata?: { name?: string, [key: string]: unknown }
  spec?: {
    title?: string
    remark?: string
    type?: string
    timeLimit?: string
    startDate?: string
    endDate?: string
    isVoted?: boolean
    _uh_type?: string
    _uh_state?: { state: string, color: string }
    options?: IVoteCardOption[]
    [key: string]: unknown
  }
  stats?: { voteCount?: number, voteDataList?: { id?: string, voteCount?: number }[] }
  [key: string]: unknown
}

const props = defineProps<{
  vote: IVoteCardData
}>()

/** 跳转投票详情 */
function handleToDetail() {
  uni.navigateTo({
    url: `/pages-blog/vote-detail/vote-detail?name=${props.vote?.metadata?.name || ''}`,
  })
}

/** 格式化时间 */
function formatTime(date?: string, fmt = 'yyyy-MM-dd HH:mm'): string {
  return date ? formatTimeUtil({ d: date, f: fmt }) : ''
}
</script>

<template>
  <view class="uh-global-card-glass box-border w-full rounded-2xl p-4" @click="handleToDetail">
    <!-- 头部:类型/状态/已投票 -->
    <view class="flex items-center justify-between">
      <view class="flex flex-wrap items-center gap-1">
        <text
          v-if="vote.spec?._uh_type"
          class="rounded-md bg-secondary px-1.5 py-0.5 text-[22rpx] text-[#4d7c0f]"
        >
          {{ vote.spec._uh_type }}
        </text>
        <text
          v-if="vote.spec?._uh_state"
          class="rounded-md px-1.5 py-0.5 text-[22rpx]"
          :style="{ color: vote.spec._uh_state.color, backgroundColor: `${vote.spec._uh_state.color}1a` }"
        >
          {{ vote.spec._uh_state.state }}
        </text>
        <text v-if="vote.spec?.isVoted" class="rounded-md bg-primary/15 px-1.5 py-0.5 text-[22rpx] text-primary">
          已投票
        </text>
      </view>
      <wd-icon name="arrow-right" size="32rpx" class="text-primary" />
    </view>

    <!-- 标题 + 备注 -->
    <view class="vote-title mt-2 text-[30rpx] font-bold text-gray-900">
      {{ vote.spec?.title }}
    </view>
    <view v-if="vote.spec?.remark" class="vote-desc mt-1 text-[24rpx] text-gray-400">
      {{ vote.spec.remark }}
    </view>

    <!-- 底部:时间 + 参与人数 -->
    <view class="vote-card-foot mt-3 flex items-center justify-between border-t border-black/5 pt-2">
      <text v-if="vote.spec?.timeLimit === 'permanent'" class="text-[22rpx] text-gray-400">
        结束：永久有效
      </text>
      <text v-else-if="vote.spec?._uh_state?.state === '未开始'" class="text-[22rpx] text-gray-400">
        开始：{{ formatTime(vote.spec?.startDate) }}
      </text>
      <text v-else class="text-[22rpx] text-gray-400">
        结束：{{ formatTime(vote.spec?.endDate) }}
      </text>
      <text class="text-[22rpx] text-gray-400">{{ vote.stats?.voteCount || 0 }} 人已参与</text>
    </view>
  </view>
</template>
