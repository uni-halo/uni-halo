<script lang="ts" setup>
/**
 * 竞猜弹窗（独立弹窗，复制自画作详情弹窗结构）：
 * 详情画面 + 竞猜面板四态（竞猜中 / 本人已猜中 / 已揭晓 / 出题人视角）。
 * 提交节流；未登录引导登录；竞猜信息经 guess-board 接口加载（未揭晓时谜底仅猜中者可见）。
 */
import { computed, ref, watch } from 'vue'
import { getGuessBoard, submitGuess } from '@/api/draw'
import { useTokenStore } from '@/store/token'
import { useUserStore } from '@/store/user'
import { checkAvatarUrl, checkThumbnailUrl } from '@/utils/url'
import { formatTime } from '@/utils/formatTime'
import { useAppConfigStore } from '@/store/appConfig'
import { sleep } from '@/utils/common'
import type { IDraw, IGuessBoard } from '@/api/types/draw'
import { storeToRefs } from 'pinia'

const props = defineProps<{
  /** 竞猜画作（公开数据，不含谜底） */
  draw: IDraw | null
}>()

const emit = defineEmits<{
  /** 猜中后通知列表刷新（计数变化） */
  (event: 'solved'): void
}>()
const visible = defineModel<boolean>({ default: false })

const appConfigStore = useAppConfigStore()
const tokenStore = useTokenStore()
const { userInfo } = storeToRefs(useUserStore())

const isCollapsedBoardUsers = ref(false)

/** 应用登录整体开关（与登录页同语义：密码/微信两开关全关 = 登录不可用） */
const loginEnabled = computed(() => {
  const client = appConfigStore.configs?.loginConfig?.client
  return client?.passwordLoginEnabled !== false || client?.wechatLoginEnabled === true
})

const isLogin = computed(() => tokenStore.updateNowTime().hasLogin)

const cover = computed(() => props.draw?.spec.cover || '')
const ownerText = computed(() =>
  props.draw?.owner?.displayName || props.draw?.owner?.username || '佚名')
const ownerAvatar = computed(() => checkThumbnailUrl(props.draw?.owner?.avatar || ''))
const ownerInitial = computed(() => ownerText.value.slice(0, 1).toUpperCase())

/** 出题人本人：不能猜自己的画 */
const isMine = computed(() =>
  !!props.draw && props.draw.spec.ownerName === userInfo.value?.username)

const board = ref<IGuessBoard | null>(null)
const boardLoading = ref(false)

const revealed = computed(() => board.value?.revealed === true)
const myAnswer = ref('')
const submitting = ref(false)
/** 10s 节流倒计时（秒） */
const countdown = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

const feedback = ref<{ text: string, correct: boolean } | null>(null)

const solvedByMe = computed(() =>
  !!board.value?.board?.length
  && board.value.board.some(item => item.username === userInfo.value?.username))

watch(visible, (value) => {
  if (value && props.draw) {
    feedback.value = null
    myAnswer.value = ''
    loadBoard()
  }
  else if (!value) {
    stopTimer()
  }
})

async function loadBoard() {
  if (!props.draw) { return }
  boardLoading.value = true
  try {
    const res = await getGuessBoard(props.draw.metadata.name)
    board.value = res.data || null
    board.value?.board.map((item) => {
      item.avatar = checkAvatarUrl(item.avatar || '')
      item._isMe = item.username === userInfo.value?.username
      return item
    })
  }
  catch (err: any) {
    console.error('获取画谜信息失败', err)
    uni.showToast({ title: err?.message || '获取画谜信息失败', icon: 'none', duration: 2000 })
    board.value = null
  }
  finally {
    boardLoading.value = false
  }
}

function startTimer() {
  countdown.value = 3
  stopTimer()
  timer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) {
      stopTimer()
    }
  }, 1000)
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

async function handleGuess() {
  if (!props.draw || submitting.value || countdown.value > 0) { return }
  if (!tokenStore.updateNowTime().hasLogin) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    await sleep(1500)
    uni.navigateTo({ url: '/pages/auth/login' })
    return
  }
  const answer = myAnswer.value.trim()
  if (!answer) {
    uni.showToast({ title: '先输入你的答案吧', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    const res = await submitGuess(props.draw.metadata.name, answer)
    const result = res.data
    if (result?.result === 'CORRECT') {
      feedback.value = { text: `恭喜，你猜对啦！谜底：${result.answer}`, correct: true }
      emit('solved')
      loadBoard()
    }
    else if (result?.result === 'CLOSE') {
      feedback.value = { text: '“很接近了”，再想想～', correct: false }
    }
    else {
      feedback.value = { text: '不对哦，再想想～', correct: false }
    }
    uni.showToast({ title: feedback.value?.text || '', icon: 'none' })
    startTimer()
  }
  catch (err: any) {
    uni.showToast({ title: err?.message || '提交失败', icon: 'none', duration: 2000 })
  }
  finally {
    submitting.value = false
  }
}

function handleToLogin() {
  uni.navigateTo({ url: '/pages/auth/login' })
}

function handlePreviewCover() {
  if (!cover.value) { return }
  uni.previewImage({ urls: [cover.value] })
}

function handleToDetailPage(draw: IDraw) {
  uni.navigateTo({
    url: `/pages-blog/draw-detail/draw-detail?name=${draw.metadata.name}`,
    success: () => {
      visible.value = false
    },
  })
}
</script>

<template>
  <uh-glass-popup
    v-model="visible" position="bottom" custom-class="rounded-2xl" :z-index="110"
    @close="visible = false"
  >
    <view v-if="draw" class="box-border flex flex-col gap-y-3 p-3">
      <!-- 顶部 -->
      <view class="relative box-border w-full flex items-center justify-center">
        <view class="flex gap-y-1">
          <text class="text-md font-bold">{{ !loginEnabled || revealed ? '作品详情' : '猜猜这幅画' }}</text>
        </view>
        <view
          class="uh-global-card-glass absolute right-0 top-0 h-6 w-6 flex items-center justify-center border rounded-lg shadow-none"
          @click="visible = false"
        >
          <wd-icon name="close" size="28rpx" class="text-gray-500" />
        </view>
      </view>

      <!-- 画面 -->
      <view
        class="uh-global-card-glass h-64 flex items-center justify-center overflow-hidden rounded-xl !border !shadow-none"
      >
        <wd-img :src="cover" mode="widthFix" class="w-full" @click="handlePreviewCover">
          <template #loading>
            <wd-loading size="64rpx" custom-class="text-primary" />
          </template>
        </wd-img>
      </view>

      <view v-if="revealed || solvedByMe" class="w-full flex flex-col gap-y-1.5">
        <text class="text-sm text-gray-900 font-semibold">{{ draw.spec.title || '无题' }}</text>
        <text v-if="draw.spec.description" class="text-xs text-gray-500 leading-relaxed">
          {{ draw.spec.description }}
        </text>
      </view>

      <!-- 作者信息 -->
      <view class="flex items-center justify-between text-xs text-gray-600">
        <view class="w-full flex items-center gap-x-1">
          <text class="text-xs text-gray-500">作者：</text>
          <wd-avatar
            :src="ownerAvatar" :text="ownerInitial" shape="round" size="36rpx"
            custom-class="uh-global-card-glass !shadow-none !border" mode="aspectFill"
          />
          <text>{{ ownerText }}</text>
        </view>
        <text class="shrink-0">
          {{ formatTime({ d: draw.metadata.creationTimestamp, f: 'yyyy年MM月dd日' }) }}
        </text>
      </view>

      <!-- 竞猜面板 -->
      <view
        v-if="loginEnabled"
        class="uh-global-card-glass box-border flex flex-col gap-y-2 rounded-xl p-3 !border !shadow-none"
      >
        <!-- 提示语与统计 -->
        <view v-if="draw.spec?.puzzleHint" class="text-xs text-gray-500">
          谜底提示：{{ draw.spec.puzzleHint }}
        </view>
        <view class="flex items-center text-xs text-gray-400">
          <text>统计数据： {{ board?.guessCount ?? 0 }} 人参与</text>
          <text>丨</text>
          <text> {{ board?.solvedCount ?? 0 }} 人猜中</text>
        </view>

        <!-- 态 1：已揭晓 -->
        <template v-if="revealed">
          <view class="flex flex-col gap-y-1">
            <text class="text-sm text-primary font-bold">画谜谜底：{{ board?.answer }}</text>
            <text class="text-xs text-gray-500">本次画谜谜底已揭晓，您猜中了吗，感谢参与！</text>
          </view>
        </template>

        <!-- 态 2：本人已猜中 -->
        <template v-else-if="solvedByMe">
          <view class="flex flex-col gap-y-1">
            <text class="text-xs text-primary font-bold">恭喜您，您已猜中获得积分 +1 </text>
            <template v-if="!revealed">
              <text v-if="board?.answer" class="text-xs text-gray-900 font-semibold">画谜谜底：{{ board.answer }}</text>
              <text class="text-xs text-gray-400">温馨提醒：其他小伙伴还在猜，别剧透哦</text>
            </template>
          </view>
        </template>

        <!-- 态 3：出题人本人 -->
        <template v-else-if="isMine">
          <view class="flex flex-col gap-y-1">
            <text class="text-xs text-gray-500">这是你的画谜作品，你自己无法参与！</text>
            <text class="text-xs text-gray-400">可在「我的绘画」中查看画谜记录或手动揭晓</text>
          </view>
        </template>

        <!-- 态 4：竞猜中 -->
        <template v-else>
          <view v-if="loginEnabled" class="flex flex flex-col items-center gap-2">
            <template v-if="isLogin">
              <view
                class="uh-global-card-glass w-full flex flex-1 items-center border border-gray-100 rounded-lg border-solid px-3 py-2 !shadow-none !shadow-none"
              >
                <input
                  v-model="myAnswer" placeholder="输入你的答案" :disabled="submitting"
                  class="w-full text-3xs text-gray-500"
                >
              </view>
              <text
                v-if="feedback" class="w-full text-xs"
                :class="feedback.correct ? 'text-primary font-bold' : 'text-gray-400'"
              >
                {{ feedback.text }}
              </text>
              <text v-else class="w-full text-xs text-gray-400">说明：猜中需与谜底完全一致，有点小难度哦~</text>
              <uh-button class="w-full flex-1" custom-class="!py-2.5 !text-3xs" @click="handleGuess">
                {{ submitting ? '提交中' : countdown > 0 ? `${countdown}s` : '猜一下' }}
              </uh-button>
            </template>
            <uh-button v-else class="w-full flex-1" custom-class="!py-2.5 !text-3xs" @click="handleToLogin">
              请先登录
            </uh-button>
          </view>

          <view v-else class="box-border">
            <text class="text-xs text-orange-500">暂时无法使用猜画谜功能，请稍后再来</text>
          </view>
        </template>

        <!-- 猜中榜 -->
        <view v-if="board?.board?.length" class="mt-2 w-full flex flex-col gap-y-2">
          <view class="w-full flex items-center justify-between">
            <text class="text-xs text-gray-600 font-bold"> 猜中榜（按猜中时间） </text>
            <view class="flex shrink-0 items-center gap-x-0.5 text-gray-400" @click="isCollapsedBoardUsers = !isCollapsedBoardUsers">
              <wd-icon :name="isCollapsedBoardUsers ? 'down' : 'up'" size="28rpx" />
              <text class="text-xs">{{ isCollapsedBoardUsers ? '收起' : '展开' }}</text>
            </view>
          </view>

          <scroll-view v-if="isCollapsedBoardUsers" :scroll-y="true" :show-scrollbar="false" class="max-h-[15vh]">
            <view class="w-full flex flex-wrap gap-x-3 gap-y-1">
              <view
                v-for="item in board.board" :key="item.username"
                class="w-full flex items-center justify-between gap-x-2"
              >
                <view class="flex shrink-0 items-center gap-x-1.5">
                  <wd-avatar
                    :src="item.avatar"
                    :text="(item.displayName || item.username).charAt(0)" shape="round" size="42rpx"
                    custom-class="uh-global-card-glass !shadow-none !border !block" mode="aspectFill"
                  />
                  <text
                    class="text-xs"
                    :class="[
                      item._isMe ? 'text-primary' : 'text-gray-600',
                    ]"
                  >
                    {{ item.displayName || item.username }}
                  </text>
                  <text v-if="item._isMe" class="text-xs text-primary">(我)</text>
                </view>
                <text v-if="item.solvedAt" class="shrink-0 text-xs text-gray-500">
                  {{ formatTime({
                    d: item.solvedAt,
                    f:
                      'yyyy年MM月dd日' }) }}
                </text>
              </view>
            </view>
          </scroll-view>
        </view>
      </view>

      <!-- #ifdef MP -->
      <view class="box-border w-full flex items-center gap-x-3 pt-2">
        <uh-button
          class="w-full flex-1"
          custom-class="uh-global-card-glass !border !shadow-none !text-3xs !rounded-xl !bg-white !py-2.5 !text-gray-900"
          @action-click="visible = false"
        >
          关闭
        </uh-button>
        <uh-button
          class="w-full flex-1"
          custom-class="uh-global-card-glass !border !shadow-none !text-3xs !rounded-xl !bg-primary !py-2.5 !text-gray-900"
          @action-click="handleToDetailPage(draw)"
        >
          去分享
        </uh-button>
      </view>
      <!-- #endif -->
    </view>
  </uh-glass-popup>
</template>
