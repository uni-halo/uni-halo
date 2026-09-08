<script lang="ts" setup>
/**
 * 文章详情"相关投票"区块容器(源自旧项目 article-detail 的 vote-wrap 区块)
 * 只接收 voteIds;插件可用性检查/展开收起/区块标题/卡片列表全部内置
 * 插件未激活或没有投票数据时,整个组件不渲染
 */
import { onMounted, ref } from 'vue'
import { NeedPluginIds } from '@/hooks/usePluginAvailable'

const props = defineProps<{
  voteIds: string[]
}>()

/** 展开/收起(与旧项目 voteIsOpen 一致) */
const voteIsOpen = ref(true)

/** 投票插件可用性(检查失败/未安装时整个区块不显示) */
const { available: votePluginAvailable, check: checkVotePluginAvailable } = usePluginAvailable({
  pluginId: NeedPluginIds.PluginVote,
  tips: '检测到当前插件没有安装或者启用，无法使用投票功能哦，请联系管理员',
})

onMounted(() => {
  checkVotePluginAvailable()
})
</script>

<template>
  <view v-if="votePluginAvailable && voteIds.length > 0" class="box-border px-1">
    <view class="uh-global-card-glass uh-shadow-xs mb-3 rounded-xl p-3">
      <view class="flex items-center justify-between">
        <uh-section-title>相关投票</uh-section-title>
        <text class="text-[24rpx] text-gray-400" @click="voteIsOpen = !voteIsOpen">
          {{ voteIsOpen ? '收起' : '展开' }}
        </text>
      </view>

      <template v-if="voteIsOpen">
        <view class="mt-3 flex flex-col gap-3">
          <uh-article-vote-item
            v-for="(voteId, voteIdIndex) in voteIds"
            :key="voteId"
            :vote-id="voteId"
            :index="voteIdIndex"
          />
        </view>
      </template>

      <view v-if="!voteIsOpen" class="mt-2 text-center text-[24rpx] text-gray-400" @click="voteIsOpen = !voteIsOpen">
        投票已收起，点击展开 {{ voteIds.length }} 个投票项
      </view>
    </view>
  </view>
</template>
