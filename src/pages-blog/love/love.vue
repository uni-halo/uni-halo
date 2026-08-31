<script lang="ts" setup>
/**
 * 恋爱主页(源自旧项目 pagesA/love/love.vue,新建复刻)
 * 情侣信息 + 恋爱计时 + 功能导航(恋爱故事/相册/清单)
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getLoveConfig } from '@/api/uni-halo'
import { useAppConfigStore } from '@/store/appConfig'
import { checkAvatarUrl, checkImageUrl } from '@/utils/url'

definePage({
  style: {
    navigationBarTitleText: '恋爱日记',
  },
})

const appConfigStore = useAppConfigStore()

/* ---------------- 恋爱配置 ---------------- */
interface ILoveConfigPage {
  enabled: boolean
  loveDateTitle: string
  loveDate: string
  loveInfo: {
    boyNickname: string
    boyAvatar: string
    girlNickname: string
    girlAvatar: string
  }
  pageImages: {
    bgImageUrl: string
    waveImageUrl: string
    heartImageUrl: string
  }
  ourStory: { enabled: boolean, iconUrl: string }
  lovePhoto: { enabled: boolean, iconUrl: string }
  loveDaily: { enabled: boolean, iconUrl: string }
  [key: string]: unknown
}

const loveConfig = ref<ILoveConfigPage>({
  enabled: false,
  loveDateTitle: '',
  loveDate: '',
  loveInfo: {
    boyNickname: '',
    boyAvatar: '',
    girlNickname: '',
    girlAvatar: '',
  },
  pageImages: {
    bgImageUrl: '',
    waveImageUrl: '',
    heartImageUrl: '',
  },
  ourStory: { enabled: false, iconUrl: '' },
  lovePhoto: { enabled: false, iconUrl: '' },
  loveDaily: { enabled: false, iconUrl: '' },
})

const loveDayCount = ref({ d: 0, h: 0, m: 0, s: 0 })
let loveDayTimer: ReturnType<typeof setTimeout> | null = null

const navList = ref<{ key: string, use: boolean, iconImageUrl: string, title: string, desc: string }[]>([])

/* ---------------- 计算属性 ---------------- */
const loveWrapStyle = computed(() => ({
  backgroundImage: `url(${checkImageUrl(loveConfig.value.pageImages.bgImageUrl)})`,
}))

/* ---------------- 数据加载 ---------------- */
async function handleGetLoveConfig() {
  try {
    const loveConfigRes = await getLoveConfig()
    if (loveConfigRes) {
      loveConfig.value = {
        ...loveConfig.value,
        ...loveConfigRes,
      }
    }
    // 同时从 getConfigs 获取模块开关和图片配置
    const appConfigs = appConfigStore.configs
    const loveModuleConfig = appConfigs.loveConfig as Partial<ILoveConfigPage> | undefined
    if (loveModuleConfig) {
      loveConfig.value = {
        ...loveConfig.value,
        pageImages: loveModuleConfig.pageImages || loveConfig.value.pageImages,
        ourStory: loveModuleConfig.ourStory || loveConfig.value.ourStory,
        lovePhoto: loveModuleConfig.lovePhoto || loveConfig.value.lovePhoto,
        loveDaily: loveModuleConfig.loveDaily || loveConfig.value.loveDaily,
      }
    }
    initList()
    handleInitLoveDayCount()
  }
  catch (e) {
    console.error('获取恋爱配置失败', e)
    // 降级:从旧配置读取
    const appConfigs = appConfigStore.configs
    const loveModuleConfig = appConfigs.loveConfig as ILoveConfigPage | undefined
    if (loveModuleConfig) {
      loveConfig.value = loveModuleConfig
      initList()
      handleInitLoveDayCount()
    }
  }
}

function initList() {
  const configs = loveConfig.value
  navList.value = [
    {
      key: 'journey',
      use: configs.ourStory.enabled,
      iconImageUrl: configs.ourStory.iconUrl,
      title: '恋爱故事',
      desc: '我们一起度过的那些经历',
    },
    {
      key: 'album',
      use: configs.lovePhoto.enabled,
      iconImageUrl: configs.lovePhoto.iconUrl,
      title: '恋爱相册',
      desc: '定格了我们的那些小美好',
    },
    {
      key: 'list',
      use: configs.loveDaily.enabled,
      iconImageUrl: configs.loveDaily.iconUrl,
      title: '恋爱清单',
      desc: '你我之间的约定我们都在努力实现',
    },
  ]
}

/* ---------------- 恋爱计时 ---------------- */
function handleInitLoveDayCount() {
  if (loveDayTimer) {
    clearTimeout(loveDayTimer)
  }
  const countDownFn = () => {
    loveDayTimer = setTimeout(countDownFn, 1000)
    const formatStartDate = loveConfig.value.loveDate.replace(/-/g, '/')
    const start = new Date(formatStartDate)
    const now = new Date()
    const T = now.getTime() - start.getTime()
    const i = 24 * 60 * 60 * 1000
    const d = T / i
    const D = Math.floor(d)
    const h = (d - D) * 24
    const H = Math.floor(h)
    const m = (h - H) * 60
    const M = Math.floor(m)
    const s = (m - M) * 60
    const S = Math.floor(s)
    loveDayCount.value = { d: D, h: H, m: M, s: S }
  }
  countDownFn()
}

/* ---------------- 跳转 ---------------- */
function handleToPage(pageName: string) {
  uni.navigateTo({
    url: `/pages-blog/love/${pageName}`,
  })
}

/* ---------------- 生命周期 ---------------- */
onLoad(() => {
  uni.setNavigationBarTitle({ title: '恋爱日记' })
  handleGetLoveConfig()
})

onBeforeUnmount(() => {
  if (loveDayTimer) {
    clearTimeout(loveDayTimer)
  }
})
</script>

<template>
  <view class="app-page min-h-screen w-screen">
    <!-- 情侣信息 -->
    <view class="lover-wrap relative h-[50vh] w-screen flex items-center justify-center" :style="[loveWrapStyle]">
      <view class="lover-card absolute left-1/2 top-[58%] z-2 w-[90vw] flex items-center justify-around rounded-xl -translate-x-1/2 -translate-y-1/2">
        <view class="boy">
          <image class="avatar box-border h-[180rpx] w-[180rpx] border-8 rounded-full" :style="{ borderColor: 'rgb(58 184 228 / 70%)' }" :src="checkAvatarUrl(loveConfig.loveInfo.boyAvatar)" mode="aspectFit" />
          <view class="name mt-2 text-center text-[32rpx] text-white font-bold tracking-[2rpx]">
            {{ loveConfig.loveInfo.boyNickname }}
          </view>
        </view>
        <image class="like h-[120rpx] w-[120rpx]" :src="checkImageUrl(loveConfig.pageImages.heartImageUrl)" mode="scaleToFill" />
        <view class="girl">
          <image class="avatar box-border h-[180rpx] w-[180rpx] border-8 rounded-full" :style="{ borderColor: 'rgb(245 122 179 / 70%)' }" :src="checkAvatarUrl(loveConfig.loveInfo.girlAvatar)" mode="aspectFit" />
          <view class="name mt-2 text-center text-[32rpx] text-white font-bold tracking-[2rpx]">
            {{ loveConfig.loveInfo.girlNickname }}
          </view>
        </view>
      </view>
      <image class="wave-image absolute bottom-0 left-0 h-[120rpx] w-full" :src="checkImageUrl(loveConfig.pageImages.waveImageUrl)" mode="scaleToFill" />
    </view>

    <!-- 恋爱记时 -->
    <view class="love-time-wrap mt-20 w-screen flex flex-col items-center justify-center">
      <view class="title text-[42rpx] text-[#333] font-bold">
        {{ loveConfig.loveDateTitle }}
      </view>
      <view class="content mt-6 flex items-center justify-center">
        <text class="text text-[28rpx]">
          第
          <text class="number mx-2 text-[46rpx] text-[#f83856] font-bold">{{ loveDayCount.d }}</text>
          天
        </text>
        <text class="text text-[28rpx]">
          <text class="number mx-2 text-[46rpx] text-[#f83856] font-bold">{{ loveDayCount.h }}</text>
          小时
        </text>
        <text class="text text-[28rpx]">
          <text class="number mx-2 text-[46rpx] text-[#f83856] font-bold">{{ loveDayCount.m }}</text>
          分钟
        </text>
        <text class="text text-[28rpx]">
          <text class="number mx-2 text-[46rpx] text-[#f83856] font-bold">{{ loveDayCount.s }}</text>
          秒
        </text>
      </view>
    </view>

    <!-- 功能导航 -->
    <view class="list-wrap mt-[75rpx] box-border flex flex-col items-center justify-center px-9">
      <block v-for="(nav, index) in navList" :key="index">
        <view v-if="nav.use" class="mb-8 box-border list-item w-full flex items-center justify-around rounded-[50rpx] bg-white px-8 py-7 shadow-sm" :class="`list-item-${index + 1}`" @click="handleToPage(nav.key)">
          <view class="left h-[120rpx] w-[120rpx]">
            <image class="icon h-full w-full" :src="checkImageUrl(nav.iconImageUrl)" mode="aspectFit" />
          </view>
          <view class="right box-border flex flex-1 flex-col justify-center pl-10">
            <view class="name text-[32rpx] text-[#333] font-bold">
              {{ nav.title }}
            </view>
            <view class="desc mt-2 text-[26rpx] text-[#777]">
              {{ nav.desc }}
            </view>
          </view>
        </view>
      </block>
    </view>
  </view>
</template>

<style scoped lang="scss">
.app-page {
  background: linear-gradient(
    -45deg,
    rgb(247 149 51 / 10%),
    rgb(243 112 85 / 10%) 15%,
    rgb(239 78 123 / 10%) 30%,
    rgb(161 102 171 / 10%) 44%,
    rgb(80 115 184 / 10%) 58%,
    rgb(16 152 173 / 10%) 72%,
    rgb(7 179 155 / 10%) 86%,
    rgb(109 186 130 / 10%)
  );
}

.lover-wrap {
  background-size: cover;
  background-repeat: no-repeat;
  background-position: 50% 50%;

  &::before {
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    content: '';
    background-color: rgb(255 255 255 / 10%);
    z-index: 0;
    backdrop-filter: blur(4rpx);
    overflow: hidden;
  }

  &::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: -60rpx;
    width: 100vw;
    height: 60rpx;
    background-image: linear-gradient(to bottom, rgb(255 255 255), rgb(255 255 255 / 0%));
  }

  .like {
    animation: likeani 1s ease-in-out infinite;
  }

  .wave-image {
    mix-blend-mode: screen;
  }
}

/* 列表项漂浮动画(无法用 UnoCSS 表达) */
.list-item {
  &:nth-child(1) {
    animation: listItemAni1 3s ease-in-out infinite;
  }

  &:nth-child(2) {
    animation: listItemAni1 3s ease-in-out infinite;
    animation-delay: 1.5s;
  }

  &:nth-child(3) {
    animation: listItemAni1 3s ease-in-out infinite;
    animation-delay: 2s;
  }
}

@keyframes likeani {
  0% {
    transform: scale(1);
  }

  25% {
    transform: scale(1.2);
  }

  50% {
    transform: scale(1.1);
  }

  75% {
    transform: scale(1.3);
  }

  100% {
    transform: scale(1);
  }
}

@keyframes listItemAni1 {
  0% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-10rpx);
  }

  100% {
    transform: translateY(0);
  }
}
</style>
