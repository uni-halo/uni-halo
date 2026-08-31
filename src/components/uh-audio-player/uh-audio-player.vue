<script lang="ts" setup>
/**
 * 音频播放器(新建复刻,替代 uni 内置 <audio> 组件)
 * 背景:新版 @dcloudio/uni-h5(3.0.0-4070+)已移除 Audio 组件导出,
 * H5 端直接使用 <audio> 会编译报错(Cannot find module / Audio is not exported)。
 * 本组件基于 uni.createInnerAudioContext 实现,跨端(H5/小程序/APP)一致,不依赖内置 audio 组件。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{
  /** 音频地址 */
  src: string
  /** 封面图 */
  poster?: string
  /** 音频名称 */
  name?: string
  /** 作者 */
  author?: string
}>()

const isPlaying = ref(false)
const progress = ref(0)
const duration = ref(0)

let audioContext: UniApp.InnerAudioContext | null = null

onMounted(() => {
  if (!props.src)
    return
  audioContext = uni.createInnerAudioContext()
  audioContext.src = props.src
  audioContext.autoplay = false

  audioContext.onTimeUpdate(() => {
    if (audioContext?.duration) {
      duration.value = audioContext.duration
      progress.value = (audioContext.currentTime / audioContext.duration) * 100
    }
  })

  audioContext.onPlay(() => {
    isPlaying.value = true
  })

  audioContext.onPause(() => {
    isPlaying.value = false
  })

  audioContext.onStop(() => {
    isPlaying.value = false
    progress.value = 0
  })

  audioContext.onEnded(() => {
    isPlaying.value = false
    progress.value = 0
  })

  audioContext.onError(() => {
    isPlaying.value = false
    uni.showToast({ icon: 'none', title: '音频加载失败' })
  })
})

function handleTogglePlay() {
  if (!audioContext)
    return
  if (isPlaying.value) {
    audioContext.pause()
  }
  else {
    audioContext.play()
  }
}

function handleSeek(e: { detail: { value: number } }) {
  if (!audioContext?.duration)
    return
  const percent = e.detail.value
  audioContext.seek(percent / 100 * audioContext.duration)
  progress.value = percent
}

onBeforeUnmount(() => {
  audioContext?.destroy()
  audioContext = null
})
</script>

<template>
  <view class="uh-audio-player box-border flex w-full items-center gap-4 rounded-xl px-6 py-4" style="background-color: #f6f7f8;">
    <!-- 播放/暂停按钮 -->
    <view class="play-btn flex h-[72rpx] w-[72rpx] shrink-0 items-center justify-center rounded-full" style="background-color: #03a9f4;" @click="handleTogglePlay">
      <view v-if="!isPlaying" class="play-icon ml-1 border-y-[16rpx] border-l-[24rpx] border-y-transparent border-l-white" />
      <view v-else class="pause-icon flex gap-2">
        <view class="h-[28rpx] w-[8rpx] rounded-sm bg-white" />
        <view class="h-[28rpx] w-[8rpx] rounded-sm bg-white" />
      </view>
    </view>

    <!-- 音频信息 + 进度条 -->
    <view class="info flex min-w-0 flex-1 flex-col gap-2">
      <view class="audio-name overflow-hidden text-ellipsis whitespace-nowrap text-[26rpx] text-[#333]">
        {{ name || '音频' }}
      </view>
      <view class="flex items-center gap-3">
        <text class="time text-[20rpx] text-[#999]">
          {{ isPlaying ? '播放中' : (duration ? '已就绪' : '待播放') }}
        </text>
        <view class="progress-bar h-[8rpx] flex-1 overflow-hidden rounded-full" style="background-color: #e5e5e5;" @click="handleSeek">
          <view class="progress-inner h-full rounded-full" style="background-color: #03a9f4; width: 0%;" :style="{ width: `${progress}%` }" />
        </view>
      </view>
    </view>
  </view>
</template>
