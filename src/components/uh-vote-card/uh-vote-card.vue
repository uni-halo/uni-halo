<script lang="ts" setup>
/**
 * 投票卡片(源自旧项目 components/vote-card,新建复刻)
 * 适配 plugin-vote 真实结构:详情接口返回 VoteDetail(嵌套 vote),选项为 {id,title}
 */
import { computed, ref, watch } from 'vue'
import { getVoteDetail } from '@/api/uni-halo'
import { VOTE_STATES } from '@/utils/vote'
import type { IVote, IVoteDetail, IVoteOption } from '@/api/types/uni-halo'

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
/** 选项 id → 票数(来自 VoteDetail.voteDataList 或 Vote.stats.voteDataList) */
const voteCountMap = ref<Record<string, number>>({})

/** 投票状态(基于插件字段 spec.startDate/endDate/hasEnded/canAnonymously) */
const voteState = computed(() => {
  const spec = voteData.value?.spec
  if (!spec)
    return VOTE_STATES.NOT_VOTED
  const now = Date.now()
  const startTime = spec.startDate ? new Date(spec.startDate).getTime() : now
  const endTime = spec.endDate ? new Date(spec.endDate).getTime() : now
  if (spec.hasEnded || endTime < now)
    return VOTE_STATES.VOTE_ENDED
  if (startTime > now)
    return VOTE_STATES.NOT_VOTED
  if (voteTypes.value.length !== 0)
    return VOTE_STATES.VOTED
  if (!spec.canAnonymously)
    return VOTE_STATES.NOT_VOTED
  return VOTE_STATES.VOTING
})

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

const isSingle = computed(() => voteData.value?.spec?.type === 'single')

/** 选项票数占比(取自 voteCountMap) */
function handleCalcPercent(option: IVoteOption): number {
  const total = voteData.value?.stats?.voteCount || 0
  const count = voteCountMap.value[option.id || ''] || 0
  if (total === 0)
    return 0
  return Number(((count / total) * 100).toFixed(2))
}

async function handleGetData() {
  loading.value = true
  try {
    const res = await getVoteDetail(props.voteName)
    const detail = res.data as IVoteDetail
    const vote = detail.vote || (detail as unknown as IVote)
    voteData.value = vote
    canAnonymously.value = !!vote.spec?.canAnonymously
    voteTypes.value = []
    // 票数映射:详情 voteDataList 优先,其次 stats.voteDataList
    const countList = detail.voteDataList?.length ? detail.voteDataList : vote.stats?.voteDataList
    const map: Record<string, number> = {}
    ;(countList || []).forEach((item) => {
      if (item.id)
        map[item.id] = item.voteCount || 0
    })
    voteCountMap.value = map
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
  const optionName = option.id || ''
  if (isSingle.value) {
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
  <view class="uh-vote-card uh-global-card-glass box-border w-full rounded-2xl p-4">
    <view v-if="loading" class="loading py-6">
      <wd-skeleton :row="2" :animated="true" />
    </view>

    <view v-else-if="voteData" class="vote-body">
      <view class="vote-title text-[30rpx] text-gray-900 font-bold">
        {{ voteData.spec?.title }}
      </view>
      <view v-if="voteData.spec?.remark" class="vote-desc mt-1 text-[24rpx] text-gray-400">
        {{ voteData.spec.remark }}
      </view>

      <view class="options mt-5">
        <view
          v-for="option in voteData.spec?.options || []"
          :key="option.id"
          class="option mb-4 flex flex-col border-2 rounded-xl p-5"
          :class="voteTypes.includes(option.id || '') ? 'border-[#b9e424] bg-[#f0f7d9]' : 'border-transparent bg-[#f6f3ee]'"
          @click="handleSelectOption(option)"
        >
          <view class="option-label text-[28rpx] text-gray-700">
            <text>{{ option.title }}</text>
          </view>
          <view v-if="voteState === VOTE_STATES.VOTED" class="option-bar mt-3 h-4 overflow-hidden rounded-lg bg-black/5">
            <view class="option-bar-inner h-full rounded-lg" :style="{ width: `${handleCalcPercent(option)}%`, background: 'linear-gradient(90deg, #B9E424, #D7F94C)' }" />
          </view>
        </view>
      </view>

      <view v-if="voteState === VOTE_STATES.VOTING" class="submit-btn mt-3">
        <wd-button type="primary" size="small" block :loading="isSubmit" @click="handleSubmit">
          {{ voteLabel }}
        </wd-button>
      </view>
      <view v-else class="vote-tip mt-4 text-center text-[24rpx] text-gray-400">
        {{ voteLabel }}{{ voteResultLabel }}
      </view>
    </view>
  </view>
</template>
