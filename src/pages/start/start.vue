<script lang="ts" setup>
/**
 * 启动页(源自旧项目 pagesA/start,新建复刻)
 * 支持颜色/图片/视频/星空四种背景类型 + logo/标题/描述 + 开始按钮 + 波浪
 */
import { computed } from 'vue'
import { checkImageUrl, checkUrl } from '@/utils/url'
import { useAppConfigStore } from '@/store/appConfig'

definePage({
  style: {
    navigationBarTitleText: 'uni-halo',
    navigationStyle: 'custom',
  },
})

const appConfigStore = useAppConfigStore()
const haloConfigs = computed(() => appConfigStore.configs)

const startConfig = computed(() => (haloConfigs.value.appConfig?.startConfig as {
  title?: string
  logo?: string
  desc1?: string
  desc2?: string
  btnText?: string
  btnClass?: string
  btnStyle?: string
  titleStyle?: string
  descStyle?: string
  backgroundType?: string
  bg?: string
  bgImage?: string
  bgImageFit?: string
  bgVideo?: string
  bgVideoFit?: string
  useWave?: boolean
} | undefined) || {})

const calcBackgroundType = computed(() => startConfig.value.backgroundType || 'star')

const calcPageClass = computed(() => {
  if (calcBackgroundType.value === 'color') {
    return [startConfig.value.bg]
  }
  return []
})

const calcPageStyle = computed(() => {
  if (calcBackgroundType.value === 'color') {
    return {}
  }
  if (calcBackgroundType.value === 'image') {
    return {
      backgroundImage: `url(${checkImageUrl(startConfig.value.bgImage)}) !important`,
      backgroundSize: startConfig.value.bgImageFit || 'cover',
    }
  }
  if (calcBackgroundType.value === 'video') {
    return {
      background: '#ffffff',
    }
  }
  return {}
})

function handleStart() {
  uni.switchTab({
    url: '/pages/tabbar/home/home',
    success: () => {
      uni.setStorageSync('APP_HAS_STARTED', true)
    },
  })
}
</script>

<template>
  <view class="app-page relative h-screen w-screen" :class="calcPageClass" :style="[calcPageStyle]">
    <!-- 星空背景 -->
    <view v-if="calcBackgroundType !== 'video'" class="star-bg fixed z-998 h-[600px] w-full shrink-0 overflow-hidden">
      <view class="stars absolute z-1 h-[400px] w-full">
        <view class="falling-stars">
          <view class="star-fall" />
          <view class="star-fall" />
          <view class="star-fall" />
          <view class="star-fall" />
        </view>
        <view class="small-stars">
          <view class="star" />
          <view class="star" />
          <view class="star" />
          <view class="star" />
          <view class="star" />
          <view class="star" />
          <view class="star" />
          <view class="star" />
          <view class="star" />
          <view class="star" />
          <view class="star" />
          <view class="star" />
        </view>
      </view>
    </view>

    <!-- 视频背景 -->
    <video
      v-else
      class="video-bg absolute left-0 top-0 z-0 h-screen w-screen"
      :object-fit="(startConfig.bgVideoFit as 'contain' | 'cover') || 'cover'"
      :src="checkUrl(startConfig.bgVideo)"
      :loop="true"
      :autoplay="true"
      :muted="true"
      :controls="false"
      :show-fullscreen-btn="false"
      :show-play-btn="false"
      :show-center-play-btn="false"
      :show-loading="false"
      :enable-progress-gesture="false"
      :show-progress="false"
    />

    <!-- 标题区域 -->
    <view v-if="startConfig.title || startConfig.logo" class="title-container absolute left-0 top-[20vh] z-999 w-screen flex flex-col items-center justify-center">
      <view v-if="startConfig.logo" class="app-logo h-[200rpx] w-[200rpx]">
        <view class="app-logo-border box-border h-full w-full overflow-hidden border-8 border-white/35 rounded-full">
          <image class="app-logo-image h-full w-full rounded-full" :src="checkImageUrl(startConfig.logo)" mode="aspectFill" />
        </view>
      </view>
      <view v-if="startConfig.title" class="app-title mt-6 text-center text-[36rpx] text-white font-semibold" :style="startConfig.titleStyle">
        「 {{ startConfig.title }} 」
      </view>
    </view>

    <!-- 底部区域 -->
    <view class="bottom-container absolute bottom-[50rpx] left-1/2 z-999 flex flex-col items-center -translate-x-1/2">
      <view class="desc-area pt-[60vh] text-white" :style="startConfig.descStyle">
        <view v-show="startConfig.desc1" class="desc1 text-center text-[44rpx]">
          {{ startConfig.desc1 }}
        </view>
        <view v-show="startConfig.desc2" class="desc2 mt-8 text-center text-[26rpx]">
          {{ startConfig.desc2 }}
        </view>
      </view>
      <view class="start-btn mb-[120rpx] mt-[60rpx] box-border border-2 border-white rounded-[50rpx] px-12 py-4 text-center text-[28rpx] text-white" :class="[startConfig.btnClass]" :style="[startConfig.btnStyle]" @click="handleStart">
        {{ startConfig.btnText || '开始体验' }}
      </view>
    </view>

    <!-- 波浪效果 -->
    <image v-if="startConfig.useWave" class="wave-img absolute bottom-0 left-0 z-99 h-[100rpx] w-full" src="/static/wave/wave-1.png" mode="scaleToFill" />
  </view>
</template>

<style scoped lang="scss">
.app-page {
  background-size: cover;
  background-repeat: no-repeat;
  background: linear-gradient(180deg, #0f1e3d 0%, #1a3a6b 100%);
}

/* 星空背景(动画无法用 UnoCSS 表达,保留样式) */
.star-bg {
  .star {
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 0 6px 0 rgb(255 255 255 / 80%);
  }

  .small-stars .star {
    position: absolute;
    width: 3px;
    height: 3px;
    opacity: 0;
    animation: star-blink 1.2s linear infinite alternate;

    &:nth-child(1) {
      left: 40px;
      bottom: 50px;
    }
    &:nth-child(2) {
      left: 200px;
      bottom: 40px;
    }
    &:nth-child(3) {
      left: 60px;
      bottom: 120px;
    }
    &:nth-child(4) {
      left: 140px;
      bottom: 250px;
    }
    &:nth-child(5) {
      left: 400px;
      bottom: 300px;
    }
    &:nth-child(6) {
      left: 170px;
      bottom: 80px;
    }
    &:nth-child(7) {
      left: 200px;
      bottom: 360px;
      animation-delay: 0.2s;
    }
    &:nth-child(8) {
      left: 250px;
      bottom: 320px;
    }
    &:nth-child(9) {
      left: 300px;
      bottom: 340px;
    }
    &:nth-child(10) {
      left: 130px;
      bottom: 320px;
      animation-delay: 0.5s;
    }
    &:nth-child(11) {
      left: 230px;
      bottom: 330px;
      animation-delay: 0.7s;
    }
    &:nth-child(12) {
      left: 300px;
      bottom: 360px;
      animation-delay: 0.3s;
    }
  }

  .star-fall {
    position: relative;
    border-radius: 2px;
    width: 80px;
    height: 2px;
    overflow: hidden;
    transform: rotate(-20deg);

    &::after {
      content: '';
      position: absolute;
      width: 50px;
      height: 2px;
      background: linear-gradient(to left, rgb(0 0 0 / 0%) 0%, rgb(255 255 255 / 40%) 100%);
      left: 100%;
      animation: star-fall 3.6s linear infinite;
    }

    &:nth-child(1) {
      left: 80px;
      bottom: -100px;
      &::after {
        animation-delay: 2.4s;
      }
    }
    &:nth-child(2) {
      left: 200px;
      bottom: -200px;
      &::after {
        animation-delay: 2s;
      }
    }
    &:nth-child(3) {
      left: 430px;
      bottom: -50px;
      &::after {
        animation-delay: 3.6s;
      }
    }
    &:nth-child(4) {
      left: 400px;
      bottom: 100px;
      &::after {
        animation-delay: 0.2s;
      }
    }
  }
}

@keyframes star-blink {
  50% {
    opacity: 1;
  }
}

@keyframes star-fall {
  20% {
    left: -100%;
  }

  100% {
    left: -100%;
  }
}

/* 波浪混合模式(无法用 UnoCSS 表达) */
.wave-img {
  mix-blend-mode: screen;
}
</style>
