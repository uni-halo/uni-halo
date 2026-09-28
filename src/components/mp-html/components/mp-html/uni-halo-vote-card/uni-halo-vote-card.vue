<template>
  <view class="uh-vote-card" :class="[loading]">
    <!-- 三态（加载中 / 失败 / 无数据）：虚线状态卡 -->
    <view v-if="loading !== 'success'" class="card-error" @click.stop="getData()">
      {{ loadingText }}
    </view>
    <template v-else-if="vote">
      <!-- 头部：类型/状态徽章 + 投票详情入口 -->
      <view class="card-head">
        <view class="flex items-center justify-between">
          <view class="flex flex-wrap items-center badge-row">
            <text v-if="voteTypeLabel" class="badge-type">{{ voteTypeLabel }}</text>
            <text class="badge-state" :class="voteState.cls">{{ voteState.state }}</text>
          </view>
          <view class="head-more" @click.stop="onDetail">投票详情 ›</view>
        </view>
        <view class="card-title">{{ vote.spec.title }}</view>
      </view>

      <view class="card-body">
        <view v-if="vote.spec.remark" class="remark">{{ vote.spec.remark }}</view>

        <!-- 单选 -->
        <view v-if="vote.spec.type === 'single'" class="option-list">
          <template v-if="showResult">
            <view
              v-for="(option, index) in vote.spec.options"
              :key="index"
              class="result-item"
              :class="{ checked: option.checked }"
              :style="{ '--percent': option.percent + '%' }"
            >
              <view class="result-item-content">
                <view class="flex-1 text-left">{{ option.title }}</view>
                <view class="flex-shrink-0">{{ option.percent }}%</view>
              </view>
            </view>
          </template>
          <template v-else>
            <view
              v-for="(option, index) in vote.spec.options"
              :key="index"
              class="select-option"
              :class="{ checked: option.checked }"
              @click.stop="selectOption(option)"
            >
              {{ option.title }}
            </view>
          </template>
        </view>

        <!-- 多选 -->
        <view v-else-if="vote.spec.type === 'multiple'" class="option-list">
          <template v-if="showResult">
            <view
              v-for="(option, index) in vote.spec.options"
              :key="index"
              class="result-item"
              :class="{ checked: option.checked }"
              :style="{ '--percent': option.percent + '%' }"
            >
              <view class="result-item-content">
                <view class="flex-1 text-left">{{ option.title }}</view>
                <view class="flex-shrink-0">{{ option.percent }}%</view>
              </view>
            </view>
          </template>
          <template v-else>
            <view
              v-for="(option, index) in vote.spec.options"
              :key="index"
              class="select-option"
              :class="{ checked: option.checked }"
              @click.stop="selectOption(option)"
            >
              {{ option.title }}
            </view>
          </template>
        </view>

        <!-- PK -->
        <view v-else-if="vote.spec.type === 'pk'" class="option-list">
          <view class="pk-container">
            <view
              v-for="(option, index) in vote.spec.options"
              :key="index"
              class="radio-item"
              :style="{ width: option.percent + '%' }"
            >
              <view class="option-item" :class="index === 0 ? 'option-item-left' : 'option-item-right'">
                {{ option.percent }}%
              </view>
            </view>
          </view>
          <template v-if="showResult">
            <view
              v-for="(option, index) in vote.spec.options"
              :key="index"
              class="result-item"
              :class="{ checked: option.checked }"
              :style="{ '--percent': option.percent + '%' }"
            >
              <view class="result-item-content">
                <view class="flex-1 text-left">选项{{ index + 1 }}：{{ option.title }}</view>
                <view class="flex-shrink-0">{{ option.percent }}%</view>
              </view>
            </view>
          </template>
          <template v-else>
            <view
              v-for="(option, index) in vote.spec.options"
              :key="index"
              class="select-option"
              :class="{ checked: option.checked }"
              @click.stop="selectOption(option)"
            >
              选项{{ index + 1 }}：{{ option.title }}
            </view>
          </template>
        </view>
      </view>

      <!-- 底部：时间 + 参与人数/已投票 -->
      <view class="card-foot">
        <text v-if="vote.spec.timeLimit === 'permanent'">结束：永久有效</text>
        <text v-else-if="voteState.state === '未开始'">开始：{{ startDateText }}</text>
        <text v-else>结束：{{ endDateText }}</text>
        <view class="foot-right">
          <text>{{ (vote.stats && vote.stats.voteCount) || 0 }} 人已参与</text>
          <text v-if="isVoted" class="voted-badge">已投票</text>
        </view>
      </view>

      <!-- 提交按钮（选择后出现的状态机） -->
      <view v-if="submitForm.voteData.length !== 0" class="submit-row">
        <view v-if="isVoted" class="submit-btn">您已参与投票</view>
        <view v-else-if="voteState.state === '未开始'" class="submit-btn" @click.stop="showToast('投票未开始')">投票未开始</view>
        <view v-else-if="voteState.state === '已结束'" class="submit-btn" @click.stop="showToast('投票已结束')">投票已结束</view>
        <view v-else-if="!vote.spec.canAnonymously" class="submit-btn" @click.stop="submit">不支持匿名投票</view>
        <view v-else class="submit-btn" @click.stop="submit">{{ submitLoading ? '正在提交...' : '提交投票' }}</view>
      </view>
    </template>
  </view>
</template>

<script>
import constants from './constant'
import utils from './utils'

const VOTE_BASE = '/apis/api.vote.kunkunyu.com/v1alpha1/votes'

/**
 * @description 已投记录本地缓存（跨端 storage，key 独立于宿主避免格式耦合）
 */
const voteCache = {
  key (id) {
    return 'uh-mp-html-vote-' + id
  },
  get (id) {
    try {
      return uni.getStorageSync(this.key(id)) || null
    } catch (e) {
      return null
    }
  },
  set (id, data) {
    try {
      uni.setStorageSync(this.key(id), data)
    } catch (e) { /* 存储失败忽略，仅影响已投标记 */ }
  },
  has (id) {
    return !!this.get(id)
  }
}

/** 投票状态展示（中文 + 徽章配色，对齐文章卡片） */
const VOTE_STATE_CLS = {
  未开始: { state: '未开始', cls: 'state-not-start' },
  进行中: { state: '进行中', cls: 'state-running' },
  已结束: { state: '已结束', cls: 'state-ended' }
}

export default {
  name: 'UniHaloVoteCard',
  props: {
    mode: {
      type: Boolean,
      default: false
    },
    // 投票 ID（由 <vote-block id="xxx"> 解析而来）
    voteId: String,
    // mp-html 传入的标签结构体，attrs.options 含 domain 等解析配置
    n: {
      type: Object,
      default () {
        return {}
      }
    }
  },
  data () {
    return {
      loading: 'loading',
      loadingText: '加载中，请稍等...',
      vote: null,
      voteCountMap: {},
      // 服务端返回的当前用户已投选项 id（详情接口 userVoteData 字段）
      userVoteData: [],
      submitForm: { voteData: [] },
      submitLoading: false
    }
  },
  computed: {
    // mp-html 解析配置（domain 等），通过标签结构体 n.attrs.options 透传
    options () {
      return (this.n && this.n.attrs && this.n.attrs.options) || {}
    },
    isVoted () {
      return this.userVoteData.length > 0 || voteCache.has(this.voteId)
    },
    /** 已投选项 id：服务端 userVoteData 优先，本地缓存兜底 */
    votedIds () {
      if (this.userVoteData.length > 0) return this.userVoteData
      const cached = voteCache.get(this.voteId)
      return (cached && cached.selected) || []
    },
    /** 是否展示百分比结果（已投票 或 已结束） */
    showResult () {
      return this.isVoted || !!(this.vote && this.vote.spec.hasEnded)
    },
    voteState () {
      if (!this.vote) return VOTE_STATE_CLS['进行中']
      const base = utils.calcVoteState(this.vote)
      // utils 返回 { state, color }，这里统一映射为文章卡片同款徽章配色
      return VOTE_STATE_CLS[base.state] || base
    },
    voteTypeLabel () {
      return this.vote ? (constants.VOTE_TYPES[this.vote.spec.type] || '投票') : '投票'
    },
    startDateText () {
      return this.vote ? utils.formatTime({ d: this.vote.spec.startDate, f: 'yyyy/MM/dd HH:mm' }) : ''
    },
    endDateText () {
      return this.vote ? utils.formatTime({ d: this.vote.spec.endDate, f: 'yyyy/MM/dd HH:mm' }) : ''
    }
  },
  created () {
    this.getData()
  },
  methods: {
    showToast (content) {
      uni.showToast({ icon: 'none', title: content, mask: true })
    },
    // 选项票数百分比（两位小数）；PK 按两阵营票数之和归一化且合计恒为 100（对齐官方 vote-block）
    decorateOptions (vote) {
      const votedIds = this.votedIds
      const options = (vote.spec.options || []).map(option => Object.assign({}, option, {
        checked: votedIds.includes(option.id),
        percent: 0
      }))
      if (vote.spec.type === 'pk') {
        const sum = options.reduce((total, o) => total + (this.voteCountMap[o.id] || 0), 0)
        const first = sum === 0 ? 50 : Math.round((this.voteCountMap[options[0].id] || 0) / sum * 100)
        options.forEach((o, index) => { o.percent = index === 0 ? first : 100 - first })
      } else {
        const total = (vote.stats && vote.stats.voteCount) || 0
        options.forEach(o => {
          o.percent = total === 0 ? 0 : Number(((this.voteCountMap[o.id] || 0) / total * 100).toFixed(2))
        })
      }
      return options
    },
    getData () {
      const domain = this.options.domain
      if (!domain) {
        this.loading = 'error'
        this.loadingText = '未配置基础域名'
        return
      }
      if (!this.voteId) {
        this.loading = 'error'
        this.loadingText = '组件不存在 [id] 参数'
        return
      }
      this.loadingText = '加载中，请稍等...'
      this.loading = 'loading'
      uni.request({
        url: domain + VOTE_BASE + '/' + this.voteId + '/detail',
        method: 'GET',
        header: { 'content-type': 'application/json' },
        success: (res) => {
          const body = res.data
          const vote = body && body.vote
          if (vote && vote.spec) {
            // 票数映射：详情 voteDataList 优先，其次 stats.voteDataList
            const countList = (body.voteDataList && body.voteDataList.length
              ? body.voteDataList
              : (vote.stats && vote.stats.voteDataList)) || []
            const map = {}
            countList.forEach((item) => {
              if (item.id) map[item.id] = item.voteCount || 0
            })
            this.voteCountMap = map
            this.userVoteData = body.userVoteData || []
            vote.spec.options = this.decorateOptions(vote)
            this.vote = vote
            this.submitForm.voteData = []
            setTimeout(() => {
              this.loading = 'success'
            }, 200)
          } else {
            this.loading = 'error'
            this.loadingText = '加载失败，点击重试'
          }
        },
        fail: () => {
          this.loading = 'error'
          this.loadingText = '加载失败，点击重试'
        }
      })
    },
    // 选择选项：单选互斥，多选受 maxVotes 限制
    selectOption (option) {
      const spec = this.vote.spec
      if (this.voteState.state === '未开始') {
        this.showToast('投票未开始')
        return
      }
      if (spec.hasEnded || this.isVoted) return
      if (spec.type === 'multiple' && spec.maxVotes > 0) {
        const checkedCount = spec.options.filter(x => x.checked && x.id !== option.id).length
        if (!option.checked && checkedCount >= spec.maxVotes) {
          this.showToast(`最多选择 ${spec.maxVotes} 项`)
          return
        }
      }
      spec.options = spec.options.map(item => {
        const checked = spec.type === 'multiple'
          ? (option.id === item.id ? !item.checked : item.checked)
          : option.id === item.id
        return Object.assign({}, item, { checked })
      })
      this.submitForm.voteData = spec.options.filter(x => x.checked).map(item => item.id)
    },
    submit () {
      const spec = this.vote.spec
      if (this.submitForm.voteData.length === 0) {
        this.showToast('请先选择选项')
        return
      }
      if (!spec.canAnonymously) {
        // 不支持匿名：复制站点地址引导到网站端投票（对齐文章卡片行为）
        uni.setClipboardData({
          data: this.options.domain || '',
          success: () => this.showToast('已复制站点地址，请到网站端投票')
        })
        return
      }
      this.submitLoading = true
      uni.showLoading({ title: '正在保存...', mask: true })
      uni.request({
        url: this.options.domain + VOTE_BASE + '/' + this.voteId + '/submit',
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data: { voteData: [...this.submitForm.voteData] },
        success: (res) => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            this.showToast('提交成功')
            voteCache.set(this.voteId, { selected: [...this.submitForm.voteData], data: this.vote })
            setTimeout(() => {
              this.getData()
            }, 300)
          } else {
            this.showToast('提交失败，请重试')
          }
        },
        fail: () => {
          this.showToast('提交失败，请重试')
        },
        complete: () => {
          this.submitLoading = false
          uni.hideLoading()
        }
      })
    },
    // 详情不做内部跳转，抛给宿主处理：<mp-html @uhe-vote-actions="..." />
    onDetail () {
      this.$emit('actions', { action: 'detail', data: { id: this.voteId } })
    }
  }
}
</script>

<style scoped>
/* ===== 卡片容器（对齐文章卡片：玻璃质感 + primary 边框） ===== */
.uh-vote-card {
  --uh-primary: var(--wot-color-theme, #b9e424);
  width: 100%;
  box-sizing: border-box;
  position: relative;
  margin: 12rpx 0;
  padding: 24rpx;
  border-radius: 16rpx;
  border: 2rpx solid var(--uh-primary);
  background-color: #ffffff;
  overflow: hidden;
  line-height: 1.5;
}

/* ===== 三态（保留虚线状态卡设计） ===== */
.uh-vote-card.error,
.uh-vote-card.empty {
  border-style: dashed;
  border-color: #e88080;
  color: #e88080;
  background-color: rgba(232, 128, 128, 0.075);
}

.uh-vote-card.loading {
  border-style: dashed;
  border-color: rgba(3, 174, 252, 1);
  color: rgba(3, 174, 252, 1);
  background-color: rgba(3, 174, 252, 0.075);
}

.card-error {
  width: 100%;
  text-align: center;
  font-size: 24rpx;
}

/* ===== 头部 ===== */
.badge-row {
  gap: 8rpx;
}

.badge-type {
  border-radius: 8rpx;
  background-color: var(--uh-primary);
  padding: 4rpx 12rpx;
  font-size: 24rpx;
  color: #111827;
}

.badge-state {
  border-radius: 8rpx;
  padding: 4rpx 12rpx;
  font-size: 24rpx;
}

.badge-state.state-not-start {
  color: #fb923c;
  background-color: #ffedd5;
}

.badge-state.state-running {
  color: #ffffff;
  background-color: #22c55e;
}

.badge-state.state-ended {
  color: #f87171;
  background-color: #fee2e2;
}

.head-more {
  flex-shrink: 0;
  font-size: 24rpx;
  color: #9ca3af;
}

.card-title {
  margin-top: 16rpx;
  font-size: 28rpx;
  font-weight: bold;
  color: #111827;
}

/* ===== 主体 ===== */
.card-body {
  margin-top: 16rpx;
}

.remark {
  margin-bottom: 24rpx;
  font-size: 24rpx;
  color: #9ca3af;
}

.option-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

/* 已投/已结束：百分比结果条 */
.result-item {
  min-height: 72rpx;
  box-sizing: border-box;
  position: relative;
  border-radius: 12rpx;
  background-color: #f3f4f6;
  font-size: 24rpx;
  color: #111827;
  overflow: hidden;
}

.result-item::before {
  content: "";
  width: var(--percent);
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background-color: #e5e7eb;
  z-index: 0;
  border-radius: 6rpx;
}

.result-item.checked {
  background-color: var(--uh-primary);
  color: #111827;
  font-weight: 600;
}

.result-item.checked::before {
  background-color: rgba(0, 0, 0, 0.08);
}

.result-item-content {
  box-sizing: border-box;
  min-height: 72rpx;
  padding: 20rpx 32rpx;
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8rpx;
}

/* 未投：可点选项 */
.select-option {
  box-sizing: border-box;
  padding: 20rpx 32rpx;
  font-size: 24rpx;
  color: #111827;
  border-radius: 24rpx;
  background-color: #f3f4f6;
  transition: all 0.1s ease-in-out;
}

.select-option.checked {
  background-color: var(--uh-primary);
  font-weight: 600;
}

/* PK 对抗条 */
.pk-container {
  box-sizing: border-box;
  width: 100%;
  display: flex;
}

.radio-item {
  flex-grow: 1;
  min-width: 30%;
  max-width: 70%;
}

.option-item {
  box-sizing: border-box;
  width: 100%;
  padding: 20rpx 32rpx;
  border-radius: 20rpx;
  color: #ffffff;
}

.option-item-left {
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
  clip-path: polygon(0 0, calc(100% - 40rpx) 0, 100% 100%, 0 100%);
}

.option-item-right {
  background: linear-gradient(90deg, #f87171, #ef4444);
  clip-path: polygon(0 0, 100% 0, 100% 100%, 40rpx 100%);
  text-align: right;
}

/* ===== 底部 ===== */
.card-foot {
  margin-top: 24rpx;
  padding-top: 16rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 24rpx;
  color: #9ca3af;
}

.foot-right {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.voted-badge {
  border-radius: 4rpx;
  background-color: #d7f94c;
  padding: 2rpx 8rpx;
  font-size: 24rpx;
  color: #6b7280;
}

/* ===== 提交按钮（胶囊，primary 底） ===== */
.submit-row {
  margin-top: 24rpx;
}

.submit-btn {
  width: 100%;
  box-sizing: border-box;
  text-align: center;
  padding: 16rpx 0;
  border-radius: 999rpx;
  background-color: var(--uh-primary);
  border: 2rpx solid rgba(255, 255, 255, 0.8);
  font-size: 24rpx;
  color: #111827;
}

/* ===== 通用 ===== */
.flex {
  display: flex;
}

.items-center {
  align-items: center;
}

.justify-between {
  justify-content: space-between;
}

.flex-wrap {
  flex-wrap: wrap;
}

.flex-1 {
  flex: 1;
}

.flex-shrink-0 {
  flex-shrink: 0;
}

.text-left {
  text-align: left;
}
</style>
