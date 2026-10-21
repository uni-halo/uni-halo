<script lang="ts" setup>
/**
 * 播客播放器(智阅全能AI助手播客听读,新建)
 * 传入文章 postName,内部请求公开播客接口;无播客数据时整体不渲染
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { getArticlePodcast } from '@/api/halo-plugin-third/summaraid-gpt'
import { NeedPluginIds, usePluginAvailable } from '@/hooks/usePluginAvailable'
import { useAppConfigStore } from '@/store/appConfig'
import { checkUrl } from '@/utils/url'
import type { IPodcastTurn, IPublicPodcast } from '@/api/types/halo-plugin-third/summaraid-gpt'

interface IProps {
  /** 文章资源名(Halo post metadata.name) */
  postName: string
}

const props = defineProps<IProps>()

const emit = defineEmits<{
  'on-loaded': [data: IPublicPodcast]
  'on-error': []
  'on-visible': [visible: boolean]
}>()

const podcast = ref<IPublicPodcast | null>(null)
const isPlaying = ref(false)
const currentMs = ref(0)
const speedIndex = ref(0)
const speeds = [1, 1.25, 1.5, 2, 0.75] as const

const appConfigStore = useAppConfigStore()
const { configs, auditModeEnabled } = storeToRefs(appConfigStore)
const { available: pluginAvailable, check: checkPluginAvailable } = usePluginAvailable({
  pluginId: NeedPluginIds.PluginSummaraidGPT,
})

/** 显示判定:插件启用 + 非审核模式 + 插件端「显示播客听读」开关(未配置视为开启) + 有已发布播客数据 */
const isVisible = computed(() =>
  pluginAvailable.value
  && !auditModeEnabled.value
  && configs.value?.featureConfig?.pages?.postDetail?.podcastEnabled !== false
  && !!podcast.value)

watch(isVisible, (visible) => {
  if (visible) { emit('on-visible', visible) }
}, { immediate: true })

let audioContext: UniApp.InnerAudioContext | null = null

const audio = computed(() => podcast.value?.audio)
const showTurns = ref(false)
const turns = computed<IPodcastTurn[]>(() => audio.value?.turns ?? [])

/** 当前播放进度命中的台词轮次 */
const activeTurnIndex = computed(() => {
  return turns.value.findIndex(
    turn =>
      turn.startMs !== undefined
      && turn.endMs !== undefined
      && currentMs.value >= turn.startMs
      && currentMs.value < turn.endMs,
  )
})

/** scroll-into-view 定位到当前轮次 */
const activeTurnId = computed(() => (activeTurnIndex.value >= 0 ? `turn-${activeTurnIndex.value}` : ''))

const durationSec = computed(() => Math.round((audio.value?.durationMs ?? 0) / 1000))

/* ---------------- 展示工具 ---------------- */

function formatTime(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/* ---------------- 数据加载 ---------------- */

async function handleLoad() {
  const available = await checkPluginAvailable()
  if (!available || appConfigStore.auditModeEnabled)
    return
  try {
    const res = await getArticlePodcast(props.postName)
    if (!res.data?.audio?.url) { return }
    podcast.value = res.data
    initAudio()
    emit('on-loaded', res.data)
  }
  catch (err) {
    // 未生成/未发布播客时接口 404,静默不展示播放器
    console.error('[uh-podcast-player] 获取播客失败', err)
    emit('on-error')
  }
}

function initAudio() {
  if (!audio.value) { return }
  audioContext = uni.createInnerAudioContext()
  audioContext.src = checkUrl(audio.value.url)
  audioContext.autoplay = false
  audioContext.playbackRate = speeds[speedIndex.value]

  audioContext.onTimeUpdate(() => {
    currentMs.value = audioContext ? audioContext.currentTime * 1000 : 0
  })
  audioContext.onPlay(() => {
    isPlaying.value = true
  })
  audioContext.onPause(() => {
    isPlaying.value = false
  })
  audioContext.onStop(() => {
    isPlaying.value = false
    currentMs.value = 0
  })
  audioContext.onEnded(() => {
    isPlaying.value = false
  })
  audioContext.onError(() => {
    isPlaying.value = false
    uni.showToast({ icon: 'none', title: '播客音频加载失败' })
  })
}

/* ---------------- 交互 ---------------- */

function handleTogglePlay() {
  if (!audioContext) { return }
  if (isPlaying.value)
    audioContext.pause()
  else
    audioContext.play()
}

function handleToggleShowTurns() {
  showTurns.value = !showTurns.value
  console.log('showTurns', showTurns.value)
}

function handleSeekPercent(percent: number) {
  if (!audioContext || !durationSec.value) { return }
  audioContext.seek((percent / 100) * durationSec.value)
  currentMs.value = (percent / 100) * durationSec.value * 1000
}

function handleSeekTurn(turn: IPodcastTurn) {
  if (turn.startMs === undefined) { return }
  handleSeekPercent((turn.startMs / 1000 / durationSec.value) * 100)
  if (!isPlaying.value)
    audioContext?.play()
}

function handleToggleSpeed() {
  speedIndex.value = (speedIndex.value + 1) % speeds.length
  applyPlaybackRate()
}

/** 重新播放 */
function handleReplay() {
  if (!audioContext) { return }
  audioContext.stop()
  currentMs.value = 0
  audioContext.play()
}

/** 应用倍速(部分平台播放中改 playbackRate 不生效,需 stop 后从当前位置续播) */
function applyPlaybackRate() {
  if (!audioContext) { return }
  audioContext.playbackRate = speeds[speedIndex.value]
  if (isPlaying.value) {
    const atSec = audioContext.currentTime
    audioContext.stop()
    audioContext.seek(atSec)
    audioContext.play()
  }
}

/* ---------------- 生命周期 ---------------- */

onMounted(() => {
  handleLoad()
})

onBeforeUnmount(() => {
  audioContext?.destroy()
  audioContext = null
})
</script>

<template>
  <view
    v-if="isVisible"
    class="uh-podcast-player uh-global-card-glass uh-shadow-xs box-border w-full flex flex-col gap-y-3 p-3 !border !rounded-xl"
  >
    <view class="w-full flex items-center justify-between gap-2 overflow-hidden">
      <view class="flex flex-1 flex-col gap-y-0.5">
        <view class="flex items-center gap-x-1.5 text-gray-900">
          <wd-icon name="live-broadcast" size="32rpx" />
          <text class="text-3xs font-bold"> 播客听读 </text>
        </view>

        <view class="min-w-0 flex flex-1 items-center gap-x-0.5">
          <text class="mr-1 text-xs text-gray-400">双人对谈</text>
          <text class="shrink-0 text-xs text-gray-400">
            {{ formatTime(currentMs) }}
          </text>
          <text class="text-xs text-gray-400">/</text>
          <text class="shrink-0 text-xs text-gray-400">
            {{ formatTime(audio?.durationMs ?? 0) }}
          </text>
        </view>
      </view>
      <view class="flex shrink-0 items-center justify-end gap-x-2">
        <!-- #ifdef APP -->
        <view class="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500" @click="handleToggleSpeed">
          {{ speeds[speedIndex] }}x
        </view>
        <!-- #endif -->
        <view
          class="box-border flex cursor-pointer items-center justify-center gap-x-0.5 rounded-full bg-gray-900 px-2.5 py-1 text-white"
          @click="handleTogglePlay"
        >
          <wd-icon :name="isPlaying ? 'pause' : 'play-arrow-fill'" size="28rpx" />
          <text class="text-xs text-white">{{ isPlaying ? '暂停' : '播放' }}</text>
        </view>
        <view
          class="box-border flex cursor-pointer items-center justify-center rounded-full bg-gray-900 px-2.5 py-1 text-white"
          @click="handleReplay"
        >
          <wd-icon name="refresh" size="28rpx" />
        </view>
        <view
          class="box-border flex cursor-pointer items-center justify-center gap-x-0.5 rounded-full bg-gray-900 px-2.5 py-1 text-white"
          @click="handleToggleShowTurns"
        >
          <wd-icon :name="showTurns ? 'up' : 'down'" size="28rpx" />
          <!-- <text class="text-xs text-white">台词</text> -->
        </view>
      </view>
    </view>

    <!-- 对话稿台词(带时间戳时可点击跳转) -->
    <scroll-view
      v-if="showTurns && turns.length" :scroll-y="true" class="max-h-60" :scroll-into-view="activeTurnId"
      :scroll-with-animation="true"
    >
      <view class="w-full flex flex-col gap-y-2">
        <view
          v-for="(turn, index) in turns" :id="`turn-${index}`" :key="index"
          class="flex flex-col gap-1 rounded-xl px-3 py-2"
          :class="index === activeTurnIndex ? 'bg-gray-100' : 'bg-gray-50'" @click="handleSeekTurn(turn)"
        >
          <text class="text-xs" :class="turn.speaker === 'A' ? 'text-gray-500' : 'text-gray-500'">
            {{ turn.speaker === 'A' ? '主持人 A' : '主持人 B' }} <text class="ml-2 text-xs text-gray-500">
              {{
                formatTime(turn.startMs) }}
            </text>
          </text>
          <text class="text-xs leading-relaxed" :class="index === activeTurnIndex ? 'text-gray-900' : 'text-gray-500'">
            {{ turn.text }}
          </text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>
