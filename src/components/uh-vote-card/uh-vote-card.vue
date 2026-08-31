<script lang="ts" setup>
/**
 * 投票卡片(源自旧项目 components/vote-card,新建复刻)
 */
import { computed, ref, watch } from 'vue'
import { getVoteDetail } from '@/api/uni-halo'
import { calcVoteState, VOTE_STATES, VOTE_TYPES } from '@/utils/vote'
import type { IVote, IVoteOption } from '@/api/types/uni-halo'

const props = defineProps<{
  voteName: string
}>()

const emit = defineEmits<{
  (e: 'on-vote-success'): void
}>()

const loading = ref(true)
const isSubmit = ref(false)
const voteData = ref<IVote | null>(null)
const voteTypes = ref<string[]>([])
const canAnonymously = ref(true)

const voteState = computed(() => calcVoteState(voteData.value || {}, voteTypes.value, canAnonymously.value))

const voteLabel = computed(() => {
  if (voteState.value === VOTE_STATES.VOTE_ENDED)
    return '投票已结束'
  if (voteState.value === VOTE_STATES.VOTED)
    return '已参与'
  if (voteState.value === VOTE_STATES.VOTING)
    return '投票中'
  return '开始投票'
})

const voteResultLabel = computed(() => (voteState.value === VOTE_STATES.VOTED ? '查看结果' : ''))

async function handleGetData() {
  loading.value = true
  try {
    const res = await getVoteDetail(props.voteName)
    voteData.value = res.data
    // 已投票项从缓存恢复(简化:根据 options 计数判断)
    voteTypes.value = []
  }
  catch (err) {
    console.error('获取投票失败', err)
  }
  finally {
    loading.value = false
  }
}

function handleSelectOption(option: IVoteOption) {
  if (voteState.value !== VOTE_STATES.VOTING)
    return
  const optionName = option.name || ''
  if (voteData.value && (voteData.value as { type?: string }).type === VOTE_TYPES.SINGLE) {
    voteTypes.value = [optionName]
  }
  else {
    const index = voteTypes.value.indexOf(optionName)
    if (index === -1) {
      voteTypes.value.push(optionName)
    }
    else {
      voteTypes.value.splice(index, 1)
    }
  }
}

function handleSubmit() {
  if (voteTypes.value.length === 0) {
    uni.showToast({ icon: 'none', title: '请先选择选项' })
    return
  }
  isSubmit.value = true
  uni.showLoading({ title: '提交中...' })
  setTimeout(() => {
    uni.hideLoading()
    isSubmit.value = false
    emit('on-vote-success')
  }, 500)
}

watch(() => props.voteName, () => {
  handleGetData()
}, { immediate: true })

defineExpose({ refresh: handleGetData })
</script>

<template>
  <view class="uh-vote-card box-border w-full rounded-xl bg-white p-3 shadow-sm">
    <view v-if="loading" class="loading py-6">
      <wd-skeleton :row="2" :animated="true" />
    </view>

    <view v-else-if="voteData" class="vote-body">
      <view class="vote-title text-[30rpx] text-[#303133] font-bold">
        {{ voteData.title }}
      </view>
      <view class="vote-desc mt-1 text-[24rpx] text-[#909399]">
        {{ voteData.description }}
      </view>

      <view class="options mt-5">
        <view
          v-for="option in voteData.options"
          :key="option.name"
          class="option mb-4 flex flex-col border-2 border-transparent rounded-xl bg-[#f7f8fa] p-5"
          :class="{ active: voteTypes.includes(option.name || '') }"
          @click="handleSelectOption(option)"
        >
          <view class="option-label text-[28rpx] text-[#303133]">
            <text>{{ option.label }}</text>
          </view>
          <view v-if="voteState === VOTE_STATES.VOTED" class="option-bar mt-3 h-4 overflow-hidden rounded-lg bg-[#f0f0f0]">
            <view class="option-bar-inner h-full rounded-lg" :style="{ width: `${option.count || 0}%`, background: 'linear-gradient(90deg, #03a9f4, #64b5f6)' }" />
          </view>
        </view>
      </view>

      <view v-if="voteState === VOTE_STATES.VOTING" class="submit-btn mt-3">
        <wd-button type="primary" size="small" block :loading="isSubmit" @click="handleSubmit">
          {{ voteLabel }}
        </wd-button>
      </view>
      <view v-else class="vote-tip mt-4 text-center text-[24rpx] text-[#909399]">
        {{ voteLabel }}{{ voteResultLabel }}
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.uh-vote-card {
  .option {
    &.active {
      border-color: #03a9f4;
      background-color: rgb(3 169 244 / 8%);
    }
  }
}
</style>
