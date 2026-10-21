<script lang="ts" setup>
/**
 * 画谜作品详情页：基于竞猜弹窗（uh-draw-guess-popup）设计改为整页形态。
 * 画面大图预览 + 作者信息 + 竞猜面板四态（竞猜中 / 本人已猜中 / 已揭晓 / 出题人视角）+ 猜中榜。
 * 数据经 onLoad 参数 name 加载（draw 详情 + guess-board 竞猜信息）。
 */
import { computed, onUnmounted, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import { getDrawByName, getGuessBoard, submitGuess } from '@/api/draw'
import { usePageScroll } from '@/hooks/usePageScroll'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useTokenStore } from '@/store/token'
import { useUserStore } from '@/store/user'
import { useAppConfigStore } from '@/store/appConfig'
import { NeedPluginIds, usePluginAvailable } from '@/hooks/usePluginAvailable'
import { useLoginPopup } from '@/hooks/useLoginPopup'
import { useWornSlots } from '@/hooks/useWornSlots'
import { useUserProfilePopup } from '@/hooks/useUserProfilePopup'
import { useIdentityStore } from '@/store/identity'
import { nameStyleCssOf } from '@/utils/wornDecorations'
import { checkAvatarUrl, checkThumbnailUrl } from '@/utils/url'
import { formatTime } from '@/utils/formatTime'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import type { IDraw, IGuessBoard } from '@/api/types/draw'

definePage({
  style: {
    navigationBarTitleText: '画谜详情',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
  },
})

const { scrollY, updatePageScrollValue } = usePageScroll()
/** 页面标题 */
const pageTitle = usePageTitle('drawDetail', '画谜详情')

const tokenStore = useTokenStore()
const { openLoginPopup } = useLoginPopup()
const { userInfo } = storeToRefs(useUserStore())

const { configs: haloConfigs } = storeToRefs(useAppConfigStore())

/** 应用登录整体开关（与登录页同语义） */
const loginEnabled = computed(() => {
  const client = haloConfigs.value?.loginConfig?.client
  return client?.passwordLoginEnabled !== false || client?.wechatLoginEnabled === true
})

const isLogin = computed(() => tokenStore.updateNowTime().hasLogin)

/** 依赖插件(uni-halo)，不可用时展示占位并可重试 */
const { pluginId, checking, tips, available: uniHaloPluginAvailable, check: checkPluginAvailable } = usePluginAvailable({
  pluginId: NeedPluginIds.PluginUniHalo,
  tips: '啊偶，功能正在维护中...',
  callback: (isAvailable) => {
    if (!isAvailable) { return }
    handleLoad()
  },
})

/* ---------------- 数据加载 ---------------- */
const drawName = ref('')
const draw = ref<IDraw | null>(null)
const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()

const cover = computed(() => draw.value?.spec.cover || '')
const ownerText = computed(() =>
  draw.value?.owner?.displayName || draw.value?.owner?.username || '佚名')
const ownerAvatar = computed(() => checkThumbnailUrl(draw.value?.owner?.avatar || ''))
const ownerInitial = computed(() => ownerText.value.slice(0, 1).toUpperCase())
/** 作者互动增强装饰槽位(作者缺失/插件未启用/审核模式/站点开关关闭时全 invisible,静默降级) */
const authorSlots = useWornSlots(() => draw.value?.owner?.username || draw.value?.spec.ownerName || '')
const { openUserProfilePopup } = useUserProfilePopup()

/** 点击作者:打开用户资料卡(审核模式下 hook 内直接忽略) */
function handleToAuthorCard() {
  const owner = draw.value?.owner
  const username = owner?.username || draw.value?.spec.ownerName
  if (!username) { return }
  openUserProfilePopup({
    username,
    nickname: owner?.displayName,
    avatar: owner?.avatar,
  })
}

const board = ref<IGuessBoard | null>(null)
const identityStore = useIdentityStore()

/** 猜中榜用户昵称渐变样式(identity 缓存,无则空串) */
function boardNameStyle(username: string) {
  return nameStyleCssOf(identityStore.identities[username]?.value)
}

/** 已揭晓 */
const revealed = computed(() => board.value?.revealed === true)
/** 出题人本人：不能猜自己的画 */
const isMine = computed(() =>
  !!draw.value && draw.value.spec.ownerName === userInfo.value?.username)
/** 本人已猜中 */
const solvedByMe = computed(() =>
  !!board.value?.board?.length
  && board.value.board.some(item => item.username === userInfo.value?.username))
const isPuzzle = computed(() => !!draw.value?.spec?.puzzleStatus)

async function handleLoad() {
  if (!drawName.value) {
    updateLoadingStatus(DataLoadingStatusEnum.Error)
    return
  }
  updateLoadingStatus(DataLoadingStatusEnum.Loading)
  try {
    const res = await getDrawByName(drawName.value)
    const data = res.data || null
    if (!data) {
      updateLoadingStatus(DataLoadingStatusEnum.Empty)
      return
    }
    data.spec.cover = checkThumbnailUrl(data.spec.cover)
    draw.value = data
    updateLoadingStatus(DataLoadingStatusEnum.Success)
    loadBoard()
  }
  catch (err: any) {
    console.error('获取画谜详情失败', err)
    updateLoadingStatus(DataLoadingStatusEnum.Error)
  }
  finally {
    uni.stopPullDownRefresh()
  }
}

async function loadBoard() {
  if (!draw.value) { return }
  try {
    const res = await getGuessBoard(draw.value.metadata.name)
    board.value = res.data || null
    if (!board.value) { return }
    board.value?.board.map((item) => {
      item.avatar = checkAvatarUrl(item.avatar || '')
      item._isMe = item.username === userInfo.value?.username
      return item
    })
    // 批量预热猜中榜用户互动增强身份(门控未过内部静默跳过)
    identityStore.ensureMany(board.value?.board?.map(item => item.username) || [])
  }
  catch (err: any) {
    console.error('获取画谜信息失败', err)
    uni.showToast({ title: err?.message || '获取画谜信息失败', icon: 'none', duration: 2000 })
    board.value = null
  }
}

onLoad(async (query) => {
  drawName.value = query?.name || ''
  if (!drawName.value) {
    updateLoadingStatus(DataLoadingStatusEnum.Error)
    return
  }
  await checkPluginAvailable()
  if (!uniHaloPluginAvailable.value) {
    uni.stopPullDownRefresh()
  }
})

onPullDownRefresh(() => {
  if (!uniHaloPluginAvailable.value) {
    uni.stopPullDownRefresh()
    return
  }
  handleLoad()
})

/* ---------------- 分享 ---------------- */
const siteName = computed(() =>
  haloConfigs.value?.featureConfig?.profile?.appInfo?.name || 'uni-halo')

onShareAppMessage(() => {
  const title = isPuzzle.value ? '我发现了一幅画作，快来猜猜看是什么？' : draw.value?.spec.title
  return {
    title: `${title || '画谜详情'} - ${siteName.value}`,
    path: `/pages-blog/draw-detail/draw-detail?name=${drawName.value}`,
    imageUrl: cover.value,
  }
})

onShareTimeline(() => {
  const title = isPuzzle.value ? '我发现了一幅画作，快来猜猜看是什么？' : draw.value?.spec.title
  return {
    title: `${title || '画谜详情'} - ${siteName.value}`,
    query: `name=${drawName.value}`,
    imageUrl: cover.value,
  }
})

/* ---------------- 竞猜交互 ---------------- */
const myAnswer = ref('')
const submitting = ref(false)
/** 10s 节流倒计时（秒） */
const countdown = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

const feedback = ref<{ text: string, correct: boolean } | null>(null)

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

onUnmounted(() => stopTimer())

async function handleGuess() {
  if (!draw.value || submitting.value || countdown.value > 0) { return }
  if (!tokenStore.updateNowTime().hasLogin) {
    openLoginPopup(() => handleGuess())
    return
  }
  const answer = myAnswer.value.trim()
  if (!answer) {
    uni.showToast({ title: '先输入你的答案吧', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    const res = await submitGuess(draw.value.metadata.name, answer)
    const result = res.data
    if (result?.result === 'CORRECT') {
      feedback.value = { text: `恭喜，你猜对啦！谜底：${result.answer}`, correct: true }
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
  openLoginPopup()
}

function handlePreviewCover() {
  if (!cover.value) { return }
  uni.previewImage({ urls: [cover.value] })
}

function handleRetry() {
  if (!drawName.value) {
    uni.showToast({ title: '缺少画谜标识', icon: 'none' })
    return
  }
  handleLoad()
}

onPageScroll(({ scrollTop }) => {
  updatePageScrollValue(scrollTop)
})
</script>

<template>
  <view class="box-border min-h-screen w-screen flex flex-col bg-page pb-safe">
    <uh-navbar :scroll-y="scrollY" :use-back="true" :default-title="pageTitle" title-color="text-gray-900" />

    <uh-plugin-unavailable
      v-if="!uniHaloPluginAvailable" custom-class="h-[70vh]" :plugin-id="pluginId"
      :error-text="tips" :checking="checking" @on-refresh="checkPluginAvailable"
    />

    <template v-else>
      <!-- 加载中 / 失败占位 -->
      <uh-data-loading
        v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus" empty-text="啊偶，画谜不见了或已下架~" min-height="75vh"
        @refresh="handleRetry"
      />

      <view v-else class="box-border w-full flex flex-col gap-y-3 p-3">
        <!-- 画面大图 -->
        <view
          class="uh-global-card-glass flex items-center justify-center overflow-hidden rounded-xl !border !shadow-none"
          @click="handlePreviewCover"
        >
          <wd-img :src="cover" mode="widthFix" custom-class="!block w-full">
            <template #loading>
              <wd-loading size="64rpx" custom-class="text-primary" />
            </template>
          </wd-img>
        </view>

        <uh-section-title>作品信息</uh-section-title>
        <view class="uh-global-card-glass box-border flex flex-col gap-y-2 rounded-xl p-3 !border !shadow-none">
          <!-- 标题与简介（已揭晓或本人猜中时展示） -->
          <view v-if="revealed || solvedByMe || !isPuzzle" class="w-full flex flex-col gap-y-1.5">
            <text class="text-md text-gray-900 font-bold">{{ draw.spec.title || '无题' }}</text>
            <text v-if="draw.spec.description" class="text-xs text-gray-500 leading-relaxed">
              {{ draw.spec.description }}
            </text>
          </view>

          <!-- 作者信息 -->
          <view class="flex items-center justify-between text-xs text-gray-600" @click="handleToAuthorCard()">
            <view class="w-full flex items-center gap-x-1">
              <text class="text-3xs text-gray-500">作者：</text>
              <view class="relative shrink-0">
                <wd-avatar
                  :src="ownerAvatar" :text="ownerInitial" shape="round" size="42rpx"
                  custom-class="uh-global-card-glass !shadow-none !border" mode="aspectFill"
                />
                <image
                  v-if="authorSlots.avatarFrame.visible" :src="authorSlots.avatarFrame.url"
                  class="uh-frame-center pointer-events-none absolute left-1/2 top-1/2 h-[58rpx] w-[58rpx]"
                  mode="aspectFit"
                />
              </view>
              <text class="text-3xs" :style="authorSlots.nameStyle.style">{{ ownerText }}</text>
              <image
                v-if="authorSlots.primaryBadge.visible" :src="authorSlots.primaryBadge.url"
                class="h-4 w-4 shrink-0 !block" mode="aspectFit"
              />
              <text
                v-if="authorSlots.title.visible"
                class="box-border shrink-0 truncate rounded-full px-1.5 py-[1px] text-[10px]"
                :style="authorSlots.title.style"
              >
                {{ authorSlots.title.text }}
              </text>
            </view>
            <text class="shrink-0 text-3xs text-gray-500">
              {{ formatTime({ d: draw.metadata.creationTimestamp, f: 'yyyy年MM月dd日' }) }}
            </text>
          </view>
        </view>

        <template v-if="isPuzzle">
          <!-- 竞猜面板 -->
          <uh-section-title v-if="loginEnabled">
            画谜信息
          </uh-section-title>
          <view
            v-if="loginEnabled"
            class="uh-global-card-glass box-border flex flex-col gap-y-2.5 rounded-xl p-3 !border !shadow-none"
          >
            <!-- 提示语与统计 -->
            <view v-if="draw.spec?.puzzleHint" class="text-3xs text-gray-900">
              谜底提示：{{ draw.spec.puzzleHint }}
            </view>
            <view class="flex items-center text-3xs text-gray-600">
              <text>统计数据： {{ board?.guessCount ?? 0 }} 人参与</text>
              <text>丨</text>
              <text> {{ board?.solvedCount ?? 0 }} 人猜中</text>
            </view>

            <!-- 态 1：已揭晓 -->
            <template v-if="revealed">
              <view class="flex flex-col gap-y-2.5">
                <text class="text-sm text-primary font-bold">画谜谜底：{{ board?.answer }}</text>
                <text class="text-3xs text-gray-500">本次画谜谜底已揭晓，您猜中了吗，感谢参与！</text>
              </view>
            </template>

            <!-- 态 2：本人已猜中 -->
            <template v-else-if="solvedByMe">
              <view class="flex flex-col gap-y-2.5">
                <text class="text-3xs text-primary font-bold">恭喜您，您已猜中获得积分 +1 </text>
                <template v-if="!revealed">
                  <text v-if="board?.answer" class="text-3xs text-gray-900 font-semibold">画谜谜底：{{ board.answer }}</text>
                  <text class="text-3xs text-gray-400">温馨提醒：其他小伙伴还在猜，别剧透哦</text>
                </template>
              </view>
            </template>

            <!-- 态 3：出题人本人 -->
            <template v-else-if="isMine">
              <view class="flex flex-col gap-y-2.5">
                <text class="text-3xs text-gray-900">这是你的画谜作品，你自己无法参与！</text>
                <text class="text-3xs text-gray-400">可在「我的绘画」中查看画谜记录或手动揭晓</text>
              </view>
            </template>

            <!-- 态 4：竞猜中 -->
            <template v-else>
              <view class="flex flex flex-col items-center gap-y-2.5">
                <template v-if="isLogin">
                  <view
                    class="uh-global-card-glass w-full flex flex-1 items-center border border-gray-100 rounded-lg border-solid px-3 py-2 !shadow-none"
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
            </template>
          </view>

          <!-- 猜中榜 -->
          <template v-if="board && board?.board?.length !== 0">
            <uh-section-title> 画谜榜单 </uh-section-title>
            <view class="uh-global-card-glass box-border flex flex-col gap-y-2 rounded-xl p-3 !border !shadow-none">
              <view class="w-full flex flex-wrap gap-x-3 gap-y-2">
                <view
                  v-for="item in board.board" :key="item.username"
                  class="flex w-full items-center justify-between gap-x-2"
                >
                  <view
                    class="flex min-w-0 flex-1 shrink-0 items-center gap-x-1.5"
                    @click="openUserProfilePopup({ username: item.username, nickname: item.displayName || item.username, avatar: item.avatar })"
                  >
                    <view class="relative shrink-0">
                      <wd-avatar
                        :src="item.avatar" :text="(item.displayName || item.username).charAt(0)" shape="round"
                        size="52rpx" custom-class="uh-global-card-glass !shadow-none !border !block" mode="aspectFill"
                      />
                      <image
                        v-if="identityStore.slotsOf(item.username).avatarFrame.visible" :src="identityStore.slotsOf(item.username).avatarFrame.url"
                        class="uh-frame-center pointer-events-none absolute left-1/2 top-1/2 h-12 w-12 !block"
                        mode="aspectFit"
                      />
                    </view>
                    <text
                      class="truncate text-3xs font-bold"
                      :class="[item._isMe ? 'text-primary' : 'text-gray-600']"
                      :style="[boardNameStyle(item.username)]"
                    >
                      {{ item.displayName || item.username }}
                    </text>
                    <image
                      v-if="identityStore.slotsOf(item.username).primaryBadge.visible" :src="identityStore.slotsOf(item.username).primaryBadge.url"
                      class="h-4 w-4 shrink-0 !block" mode="aspectFit"
                    />
                    <text
                      v-if="identityStore.slotsOf(item.username).title.visible"
                      class="box-border shrink-0 truncate rounded-full px-1.5 py-[1px] text-[10px]"
                      :style="identityStore.slotsOf(item.username).title.style"
                    >
                      {{ identityStore.slotsOf(item.username).title.text }}
                    </text>
                    <text v-if="item._isMe" class="shrink-0 text-3xs text-primary">
                      (我)
                    </text>
                  </view>
                  <text v-if="item.solvedAt" class="shrink-0 text-3xs text-gray-500">
                    {{ formatTime({
                      d: item.solvedAt,
                      f:
                        'yyyy年MM月dd日' }) }}
                  </text>
                </view>
              </view>
            </view>
          </template>
        </template>
        <!-- #ifdef MP -->
        <view class="box-border w-full flex items-center px-4 pt-2">
          <button
            class="uh-button-native uh-global-card-glass w-full flex-1 !border !rounded-full !bg-primary !py-2 !text-sm !text-gray-900 !shadow-none"
            open-type="share"
          >
            {{ isPuzzle ? '分享给朋友一起猜' : '分享给朋友' }}
          </button>
        </view>
        <!-- #endif -->
      </view>
    </template>
  </view>
</template>

<style scoped>
.uh-frame-center {
  transform: translate(-50%, -50%);
}
</style>
