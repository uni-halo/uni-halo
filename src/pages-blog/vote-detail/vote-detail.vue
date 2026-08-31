<script lang="ts" setup>
/**
 * 投票详情页(源自旧项目 pagesA/vote-detail,新建复刻)
 * 支持 single/multiple/pk 三种投票类型,已投票展示结果
 */
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import dayjs from 'dayjs'
import { getVoteDetail, submitVote } from '@/api/uni-halo'
import { calcVotePercent, VOTE_TYPES, voteCacheUtil } from '@/utils/vote'
import { formatTime as formatTimeUtil } from '@/utils/formatTime'
import type { IVote, IVoteOption } from '@/api/types/uni-halo'

definePage({
  style: {
    navigationBarTitleText: '投票详情',
    enablePullDownRefresh: true,
  },
})

/* ---------------- 状态 ---------------- */
const loading = ref<'loading' | 'success' | 'error'>('loading')
const submitLoading = ref(false)
const pageTitle = ref('加载中...')
const safeAreaBottom = ref(24)
const name = ref('')
const detail = ref<unknown>(null)
const vote = ref<(IVote & {
  spec?: {
    title?: string
    remark?: string
    type?: string
    maxVotes?: number
    startDate?: string
    endDate?: string
    timeLimit?: string
    canAnonymously?: boolean
    options?: (IVoteOption & {
      id?: string
      title?: string
      count?: number
      checked?: boolean
      isVoted?: boolean
      disabled?: boolean
      _uh_percent?: number
    })[]
    isVoted?: boolean
    hasEnded?: boolean
    disabled?: boolean
    _uh_type?: string
    _uh_state?: { state: string, color: string }
  }
  stats?: { voteCount?: number }
}) | null>(null)
const submitForm = ref<{ voteData: string[] }>({ voteData: [] })

/* ---------------- 计算属性 ---------------- */
const isVoted = computed(() => voteCacheUtil.has(name.value))
const isEnded = computed(() => vote.value?.spec?.hasEnded || false)

/* ---------------- 工具 ---------------- */
function formatTime(date?: string, fmt = 'yyyy-MM-dd HH:mm'): string {
  // 与旧项目一致:yyyy-MM-dd HH:mm
  return date ? formatTimeUtil({ d: date, f: fmt }) : ''
}

function showToast(content: string) {
  uni.showToast({ icon: 'none', title: content, mask: true })
}

function handleCalcIsChecked(option: { id?: string }): boolean {
  const data = voteCacheUtil.get(name.value)
  if (!data)
    return false
  return data.selected.includes(option.id || '')
}

/* ---------------- 数据加载 ---------------- */
async function handleGetData() {
  loading.value = 'loading'
  pageTitle.value = '加载中...'
  try {
    const res = await getVoteDetail(name.value)
    const tempVote = res.data as typeof vote.value
    if (tempVote) {
      pageTitle.value = `投票详情（${VOTE_TYPES[(tempVote.spec?.type || 'SINGLE') as keyof typeof VOTE_TYPES] || tempVote.spec?.type}）`
      tempVote.spec = tempVote.spec || {}
      tempVote.spec.isVoted = isVoted.value
      tempVote.spec.disabled = isVoted.value
      tempVote.spec._uh_type = VOTE_TYPES[(tempVote.spec.type || 'SINGLE') as keyof typeof VOTE_TYPES] || tempVote.spec.type

      // 计算状态
      const startTime = tempVote.spec.startDate ? new Date(tempVote.spec.startDate).getTime() : Date.now()
      const endTime = tempVote.spec.endDate ? new Date(tempVote.spec.endDate).getTime() : Date.now()
      const now = Date.now()
      if (endTime < now) {
        tempVote.spec._uh_state = { state: '已结束', color: 'red' }
        tempVote.spec.hasEnded = true
      }
      else if (startTime > now) {
        tempVote.spec._uh_state = { state: '未开始', color: 'orange' }
      }
      else {
        tempVote.spec._uh_state = { state: '进行中', color: 'green' }
      }

      // 选项计算
      tempVote.spec.options = (tempVote.spec.options || []).map((option) => {
        const checked = handleCalcIsChecked(option)
        return {
          ...option,
          value: option.id,
          label: option.title,
          isVoted: isVoted.value,
          checked,
          disabled: isVoted.value,
          _uh_percent: calcVotePercent(tempVote, option),
        }
      })
    }
    vote.value = tempVote
    detail.value = res
    setTimeout(() => {
      loading.value = 'success'
    }, 200)
  }
  catch (err) {
    console.error(err)
    loading.value = 'error'
    pageTitle.value = '加载失败，请重试...'
  }
  finally {
    setTimeout(() => {
      uni.hideLoading()
      uni.stopPullDownRefresh()
      uni.setNavigationBarTitle({ title: pageTitle.value })
    }, 200)
  }
}

/* ---------------- 交互 ---------------- */
function handleSelectSingleOption(option: { id?: string }) {
  if (vote.value?.spec?._uh_state?.state === '未开始') {
    showToast('投票未开始')
    return
  }
  if (vote.value?.spec?.hasEnded)
    return
  if (vote.value?.spec?.disabled)
    return
  vote.value!.spec!.options!.forEach((item) => {
    item.checked = option.id === item.id
  })
  submitForm.value.voteData = vote.value!.spec!.options!.filter(x => x.checked).map(item => item.id || '')
}

function handleSelectCheckboxOption(option: { id?: string }) {
  if (vote.value?.spec?._uh_state?.state === '未开始') {
    showToast('投票未开始')
    return
  }
  if (vote.value?.spec?.hasEnded)
    return
  if (vote.value?.spec?.disabled)
    return

  const checkedList = vote.value!.spec!.options!.filter(x => x.checked && x.id !== option.id)
  if (vote.value?.spec?.type === 'multiple' && checkedList.length >= (vote.value.spec.maxVotes || 0)) {
    showToast(`最多选择 ${vote.value.spec.maxVotes} 项`)
    return
  }

  vote.value!.spec!.options!.forEach((item) => {
    if (option.id === item.id) {
      item.checked = !item.checked
    }
  })
  submitForm.value.voteData = vote.value!.spec!.options!.filter(x => x.checked).map(item => item.id || '')
}

function handleSubmitTip(text: string) {
  showToast(text)
}

async function handleSubmit() {
  if (!vote.value?.spec?.canAnonymously) {
    uni.showModal({
      title: '提示',
      content: '该投票不支持匿名，请到博主的 网站端 进行投票！',
      cancelColor: '#666666',
      cancelText: '关闭',
      confirmText: '复制地址',
      success: (res) => {
        if (res.confirm) {
          uni.setClipboardData({
            data: import.meta.env.VITE_SERVER_BASEURL || '',
            showToast: false,
            success: () => {
              showToast('复制成功')
            },
          })
        }
      },
    })
    return
  }

  submitLoading.value = true
  uni.showLoading({ title: '正在保存...' })
  try {
    await submitVote(name.value, submitForm.value, vote.value.spec.canAnonymously)
    showToast('提交成功')
    voteCacheUtil.set(name.value, {
      selected: [...submitForm.value.voteData],
      data: vote.value,
    })
    setTimeout(() => {
      uni.startPullDownRefresh()
      submitLoading.value = false
    }, 1500)
  }
  catch (err) {
    console.error(err)
    showToast('提交失败，请重试')
    submitLoading.value = false
  }
  finally {
    uni.hideLoading()
  }
}

/* ---------------- 生命周期 ---------------- */
onLoad((options) => {
  name.value = options?.name || ''
  // #ifndef H5
  const systemInfo = uni.getSystemInfoSync()
  safeAreaBottom.value = systemInfo.safeAreaInsets?.bottom ? systemInfo.safeAreaInsets.bottom + 12 : 24
  // #endif
  handleGetData()
})

onPullDownRefresh(() => {
  handleGetData()
})

onShareAppMessage(() => ({
  path: `/pages-blog/vote-detail/vote-detail?name=${name.value}`,
  title: vote.value?.spec?.title || '来投个票吧',
  imageUrl: '',
}))

onShareTimeline(() => ({
  title: vote.value?.spec?.title || '来投个票吧',
  query: name.value ? `name=${name.value}` : '',
  imageUrl: '',
}))
</script>

<template>
  <view class="app-page box-border min-h-screen w-screen flex flex-col py-6 pb-[160rpx]" style="background-color: #fafafd;">
    <view v-if="loading !== 'success'" class="loading-wrap min-h-screen px-6">
      <wd-skeleton :row="4" :animated="true" />
    </view>

    <block v-else>
      <view v-if="!vote" class="empty h-[60vh] flex items-center justify-center">
        <wd-empty description="未查询到数据" />
      </view>

      <block v-else>
        <!-- 投票信息 -->
        <view class="vote-card mx-6 mb-6 flex flex-col overflow-hidden rounded-xl bg-white p-6 shadow-sm">
          <view class="sub-title relative box-border pl-6 text-[30rpx]">
            投票信息
          </view>
          <view class="vote-card-body flex flex-col gap-3 rounded-xl bg-[#f3f4f6] p-6 text-[28rpx] text-[#3f3f3f]">
            <view class="info-row">
              <text>投票类型：</text>
              <text class="tag">{{ vote.spec?._uh_type }}</text>
            </view>
            <view class="info-row">
              <text>投票状态：</text>
              <text class="tag" :style="{ color: vote.spec?._uh_state?.color }">{{ vote.spec?._uh_state?.state }}</text>
            </view>
            <view class="info-row">
              <text>投票方式：</text>
              <text class="tag" :class="vote.spec?.canAnonymously ? 'text-[#03a9f4]' : 'text-[#f44336]'">
                {{ vote.spec?.canAnonymously ? '匿名' : '不匿名' }}
              </text>
            </view>
            <view class="info-row">
              <text>开始时间：{{ formatTime(vote.spec?.startDate) }}</text>
            </view>
            <view class="info-row">
              <text v-if="vote.spec?.timeLimit === 'permanent'">结束时间：永久有效</text>
              <text v-else>结束时间：{{ formatTime(vote.spec?.endDate) }}</text>
            </view>
          </view>
        </view>

        <!-- 投票内容 -->
        <view class="vote-card mx-6 mb-6 flex flex-col overflow-hidden rounded-xl bg-white p-6 shadow-sm">
          <view class="sub-title relative box-border pl-6 text-[30rpx]">
            投票内容
          </view>
          <view class="sub-content mb-3 pt-3 text-[30rpx] text-[#2b2f33] font-bold">
            {{ vote.spec?.title }}
          </view>
          <view v-if="vote.spec?.remark" class="sub-remark mb-9 pt-3 text-[28rpx] text-[#3f3f3f]">
            {{ vote.spec.remark }}
          </view>
          <view class="sub-title relative box-border pl-6 text-[30rpx]">
            投票选项
            <text v-if="vote.spec?.type === 'multiple'" class="sub-title-count text-[24rpx] font-normal">（最多选择 {{ vote.spec?.maxVotes }} 项）</text>
          </view>
          <view class="options mt-6 flex flex-col gap-4">
            <template v-if="isVoted || isEnded">
              <view
                v-for="(option, optionIndex) in vote.spec?.options"
                :key="optionIndex"
                class="is-voted-item relative box-border min-h-[72rpx] overflow-hidden rounded-xl text-[24rpx]"
                :class="option.checked ? 'bg-[#03a9f4]/35 text-white' : 'bg-[#e5e5e5]/75'"
                :style="{ '--percent': `${option._uh_percent}%` }"
              >
                <view class="is-voted-item-content relative z-2 box-border min-h-[72rpx] px-6 py-3">
                  <view class="flex items-center justify-between">
                    <view class="flex-1 text-left">
                      {{ option.title }}
                    </view>
                    <view class="shrink-0">
                      {{ option._uh_percent }}%
                    </view>
                  </view>
                </view>
              </view>
            </template>
            <template v-else>
              <view
                v-for="(option, optionIndex) in vote.spec?.options"
                :key="optionIndex"
                class="vote-select-option box-border rounded-xl bg-[#f3f4f6] px-6 py-5 text-[24rpx]"
                :class="option.checked ? 'border-2 border-[#03a9f4] bg-[#03a9f4]/15 text-[#03a9f4]' : ''"
                @click="vote.spec?.type === 'multiple' ? handleSelectCheckboxOption(option) : handleSelectSingleOption(option)"
              >
                {{ vote.spec?.type === 'pk' ? `选项${optionIndex + 1}：` : '' }}{{ option.title }}
              </view>
            </template>
          </view>
        </view>

        <!-- 投票统计 -->
        <view class="vote-card mx-6 mb-6 flex flex-col overflow-hidden rounded-xl bg-white p-6 shadow-sm">
          <view class="sub-title relative box-border pl-6 text-[30rpx]">
            投票统计
          </view>
          <view class="stat-text mt-3 text-[26rpx] text-[#606266]">
            {{ vote.stats?.voteCount || 0 }} 人已参与
          </view>
        </view>

        <!-- 提交按钮 -->
        <view class="vote-submit fixed bottom-0 left-0 z-99 box-border w-screen border-t-2 border-[#eee] bg-white/98 px-9 py-6 shadow-sm" :style="{ paddingBottom: `${safeAreaBottom}rpx` }">
          <wd-button v-if="isVoted" disabled block>
            您已参与投票
          </wd-button>
          <wd-button v-else-if="vote.spec?._uh_state?.state === '未开始'" plain block type="warning" @click="handleSubmitTip('投票未开始')">
            投票未开始
          </wd-button>
          <wd-button v-else-if="vote.spec?._uh_state?.state === '已结束'" plain block type="danger" @click="handleSubmitTip('投票已结束')">
            投票已结束
          </wd-button>
          <wd-button v-else-if="!vote.spec?.canAnonymously" plain block type="danger" @click="handleSubmit()">
            不支持匿名投票
          </wd-button>
          <wd-button v-else-if="submitForm.voteData.length === 0" plain block @click="handleSubmitTip('请选择选项')">
            提交投票（请选择选项）
          </wd-button>
          <wd-button v-else block type="primary" :loading="submitLoading" :disabled="submitLoading" @click="handleSubmit()">
            提交投票
          </wd-button>
        </view>
      </block>
    </block>
  </view>
</template>

<style scoped lang="scss">
.vote-card {
  .sub-title {
    &::before {
      content: '';
      width: 8rpx;
      height: 28rpx;
      position: absolute;
      left: 0;
      top: 6rpx;
      background: #03a9f4;
      border-radius: 6rpx;
    }
  }

  .is-voted-item {
    &::before {
      content: '';
      width: var(--percent);
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      background-color: #d0d0d0;
      z-index: 0;
      border-radius: 6rpx;
    }
  }
}
</style>
