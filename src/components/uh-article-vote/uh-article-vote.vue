<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { NeedPluginIds } from '@/hooks/usePluginAvailable'

const props = defineProps<{
  voteIds: string[]
}>()

const voteIsOpen = ref(true)

const { available: votePluginAvailable, check: checkVotePluginAvailable } = usePluginAvailable({
  pluginId: NeedPluginIds.PluginVote,
  tips: '啊偶，功能正在维护中...',
})

onMounted(() => {
  checkVotePluginAvailable()
})
</script>

<template>
  <view v-if="votePluginAvailable && voteIds.length > 0" class="mb-3 box-border px-3">
    <view class="uh-global-card-glass box-border rounded-xl p-3">
      <uh-section-title>
        相关投票
        <template #right>
          <text class="text-xs text-gray-400" @click="voteIsOpen = !voteIsOpen">
            <wd-icon :name="voteIsOpen ? 'up' : 'down'" /> {{ voteIsOpen ? '收起' : '展开' }}
          </text>
        </template>
      </uh-section-title>

      <template v-if="voteIsOpen">
        <view class="mt-3 flex flex-col gap-3">
          <uh-article-vote-item
            v-for="(voteId, voteIdIndex) in voteIds" :key="voteId" :vote-id="voteId"
            :index="voteIdIndex"
          />
        </view>
      </template>

      <view
        v-if="!voteIsOpen" class="mt-3 rounded-xl bg-gray-100 py-3 text-center text-xs text-gray-400"
        @click="voteIsOpen = !voteIsOpen"
      >
        投票已收起，点击展开 {{ voteIds.length }} 个投票项
      </view>
    </view>
  </view>
</template>
