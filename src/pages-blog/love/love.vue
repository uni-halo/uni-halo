<script lang="ts" setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { onPageScroll, onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import { useAppConfigStore } from '@/store/appConfig'
import { checkAvatarUrl, checkImageUrl } from '@/utils/url'
import { getAvatarFallbackText } from '@/utils/avatar'
import { getLoveModuleToken } from '@/utils/loveModuleToken'
import type { LoveModuleKey } from '@/utils/loveModuleToken'
import { useLoveModuleUnlock } from '@/hooks/useLoveModuleUnlock'
import { usePageScroll } from '@/hooks/usePageScroll'
import { getLoveInfo } from '@/api/uni-halo'
import type { ILoveConfigGroup, ILoveInfo, ILoveModuleConfig } from '@/api/types/uni-halo'

definePage({
  style: {
    navigationBarTitleText: '恋爱日记',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
  },
})

const { scrollY, updatePageScrollValue } = usePageScroll()
const { configs } = storeToRefs(useAppConfigStore())
const { bootstrap, refreshStatic } = useAppConfigStore()

/* ---------------- 恋爱配置 ---------------- */
/**
 * 恋爱配置：模块入口/密码状态来自 getConfigs 的 featureConfig.love 组；
 * 恋爱信息（纪念日 + 恋人信息）单独走公开接口获取，不随 getConfigs 下发
 */
interface ILoveConfigPage extends Partial<ILoveConfigGroup> {
  enabled: boolean
  loveDateTitle: string
  loveDate: string
  loveInfo?: ILoveInfo
}

const loveConfig = ref<ILoveConfigPage>({
  enabled: false,
  loveDateTitle: '',
  loveDate: '',
  loveDiary: { passwordEnabled: false },
  ourStory: { enabled: false, passwordEnabled: false },
  lovePhoto: { enabled: false, passwordEnabled: false },
  loveDaily: { enabled: false, passwordEnabled: false },
})

/** 恋爱页背景图 */
const loveBgImage = ref('')

const loveDayCount = ref({ d: 0, h: 0, m: 0, s: 0 })
let loveDayTimer: ReturnType<typeof setTimeout> | null = null

interface ILoveNavRenderItem {
  moduleKey: LoveModuleKey
  use: boolean
  locked: boolean
  iconPrefix: string
  icon: string
  /** 跳转路径（插件下发，直接 navigateTo） */
  path: string
  title: string
  subTitle: string
  titleColor: string
  subTitleColor: string
  iconBgColor: string
}

const navList = ref<ILoveNavRenderItem[]>([])

/* ---------------- 分享 ---------------- */

onShareAppMessage(() => ({
  title: '我们的恋爱日记',
  path: '/pages-blog/love/love',
}))

onShareTimeline(() => ({
  title: '我们的恋爱日记',
  query: '',
}))

/* ---------------- 数据加载 ---------------- */
function syncLoveConfigFromStore() {
  const loveConfigs = configs.value.featureConfig?.love
  loveBgImage.value = loveConfigs?.diaryPage?.bgImageUrl || ''
  if (loveConfigs) {
    loveConfig.value = {
      ...loveConfig.value,
      loveDiary: loveConfigs.loveDiary || loveConfig.value.loveDiary,
      ourStory: loveConfigs.ourStory || loveConfig.value.ourStory,
      lovePhoto: loveConfigs.lovePhoto || loveConfig.value.lovePhoto,
      loveDaily: loveConfigs.loveDaily || loveConfig.value.loveDaily,
    }
  }

  initList()
}

/** 恋爱信息（纪念日 + 恋人信息）：独立公开接口获取；获取失败按空渲染 */
async function fetchLoveInfo() {
  try {
    const res = await getLoveInfo()
    const info = res.data || {}
    loveConfig.value = {
      ...loveConfig.value,
      ...(info.loveDateTitle ? { loveDateTitle: info.loveDateTitle } : {}),
      ...(info.loveDate ? { loveDate: info.loveDate } : {}),
      loveInfo: info,
    }
    if (info.loveDate) {
      handleInitLoveDayCount()
    }
  }
  catch {
    // 恋爱信息获取失败：顶部区域回退默认文案与占位头像
  }
  finally {
    uni.stopPullDownRefresh()
  }
}

/** 响应式追踪配置变化（bootstrap/refreshStatic 更新 configs 后自动同步恋爱配置） */
watch(() => configs.value.featureConfig?.love, () => syncLoveConfigFromStore(), { immediate: true })

/** 入口列表：由三模块配置构建（模块 key 即唯一标识，图标/跳转路径均用插件下发字段） */
function initList() {
  const configs = loveConfig.value
  const moduleKeys: LoveModuleKey[] = ['ourStory', 'lovePhoto', 'loveDaily']
  // 插件端已按 priority 降序输出，此处仍按 priority 排序兜底（缺失视为 0）
  const sorted = [...moduleKeys].sort((a, b) =>
    ((configs[b] as ILoveModuleConfig | undefined)?.priority ?? 0)
    - ((configs[a] as ILoveModuleConfig | undefined)?.priority ?? 0))
  navList.value = sorted.map((moduleKey) => {
    const moduleCfg = configs[moduleKey] as ILoveModuleConfig | undefined
    if (!moduleCfg) {
      return null
    }
    return {
      moduleKey,
      use: !!moduleCfg.enabled,
      locked: !!moduleCfg.passwordEnabled && !getLoveModuleToken(moduleKey),
      iconPrefix: moduleCfg.iconPrefix || 'uhlove-icon',
      icon: moduleCfg.icon || '',
      path: moduleCfg.path || '',
      title: moduleCfg.title || '',
      subTitle: moduleCfg.subTitle || '',
      titleColor: moduleCfg.titleColor || '#f83856',
      subTitleColor: moduleCfg.subTitleColor || '#f8385699',
      iconBgColor: moduleCfg.iconBgColor || '#fce7f3',
    }
  }).filter((item): item is ILoveNavRenderItem => item !== null)
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

/* ---------------- 跳转（模块密码拦截） ---------------- */
const {
  unlockModalVisible,
  pendingModule,
  unlockTip,
  isModuleLocked,
  openUnlock,
  handleUnlockRequest,
  handleUnlockSuccess,
} = useLoveModuleUnlock({
  onUnlocked: (moduleKey) => {
    // 恋爱日记入口解锁：刷新配置后由 watch 自动同步恋爱配置
    if (moduleKey === 'loveDiary') {
      refreshStatic()
    }
  },
})

function handleToPage(moduleKey: LoveModuleKey) {
  const moduleCfg = loveConfig.value[moduleKey] as ILoveModuleConfig | undefined
  // 模块设了密码且本地无有效 token → 先弹密码框验证
  if (isModuleLocked(moduleKey)) {
    openUnlock(moduleKey, moduleCfg?.path || '')
    return
  }
  // 跳转直接使用插件下发的 path
  if (moduleCfg?.path) {
    uni.navigateTo({
      url: moduleCfg.path,
    })
  }
}

/* ---------------- 生命周期 ---------------- */
onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})

onPullDownRefresh(async () => {
  await bootstrap()
  syncLoveConfigFromStore()
  fetchLoveInfo()
  // 恋爱日记入口（love 页本身）设了密码且本地无 token → 弹不可关闭密码框，解锁后才能查看
  if (isModuleLocked('loveDiary')) {
    openUnlock('loveDiary')
  }
})

onShow(async () => {
  await bootstrap()
  syncLoveConfigFromStore()
  fetchLoveInfo()
  // 恋爱日记入口（love 页本身）设了密码且本地无 token → 弹不可关闭密码框，解锁后才能查看
  if (isModuleLocked('loveDiary')) {
    openUnlock('loveDiary')
  }
})

onBeforeUnmount(() => {
  if (loveDayTimer) {
    clearTimeout(loveDayTimer)
  }
})
</script>

<template>
  <view class="min-h-screen w-screen bg-pink-50">
    <uh-navbar
      :scroll-y="scrollY" default-title="恋爱日记" :need-placeholder="false" back-class="text-love"
      title-color="!text-love"
    />

    <!-- 情侣信息 -->
    <view class="relative z-10 box-border h-92 w-screen flex flex-col items-center justify-center pt-12">
      <view class="relative z-10 h-full w-full flex items-center justify-center rounded-xl">
        <view class="boy uh-boy-offset flex flex-col items-center justify-center">
          <wd-avatar
            :src="checkAvatarUrl(loveConfig.loveInfo?.boyAvatar)"
            :text="getAvatarFallbackText(loveConfig.loveInfo?.boyNickname)"
            shape="round"
            custom-class="uh-global-card-glass !h-26 !w-26 !text-gray-900 !font-bold"
            class="!border-3 !border-blue-400 !rounded-full"
            mode="aspectFill"
          />
          <view class="mt-2 rounded-full bg-blue-500 px-2 py-1 text-center text-xs text-white font-bold">
            {{ loveConfig.loveInfo?.boyNickname }}
          </view>
        </view>
        <!-- 心动呼吸动画 -->
        <view class="heart-beat absolute left-1/2 top-1/2 z-50 flex items-center justify-center -mt-3">
          <wd-icon class-prefix="uhlove-icon" name="aixin" size="66rpx" />
        </view>
        <view class="girl uh-girl-offset flex flex-col items-center justify-center">
          <wd-avatar
            :src="checkAvatarUrl(loveConfig.loveInfo?.girlAvatar)"
            :text="getAvatarFallbackText(loveConfig.loveInfo?.girlNickname)"
            shape="round"
            custom-class="uh-global-card-glass !h-26 !w-26 !text-gray-900 !font-bold"
            class="!border-3 !border-love !rounded-full"
            mode="aspectFill"
          />
          <view class="mt-2 rounded-full bg-love px-2 py-1 text-center text-xs text-white font-bold">
            {{ loveConfig.loveInfo?.girlNickname }}
          </view>
        </view>
      </view>
      <view class="absolute inset-0 z-0 h-full w-full">
        <!-- 空值不渲染，wd-img 如果加载空的地址 会一直处于loading状态 -->
        <wd-img v-if="loveBgImage" :src="checkImageUrl(loveBgImage)" class="h-full w-full" mode="aspectFill">
          <template #loading>
            <wd-loading size="64rpx" custom-class="!text-love" />
          </template>
        </wd-img>
      </view>
      <view
        class="absolute bottom-0 left-0 z-2 h-36 w-full from-white/0 via-pink-50/50 to-pink-50 bg-gradient-to-b"
      />
    </view>
    <!-- 恋爱记时 -->
    <view class="mt-8 w-screen flex flex-col items-center justify-center">
      <view class="title text-xl text-love font-bold">
        {{ loveConfig.loveDateTitle }}
      </view>
      <view class="content mt-6 flex items-center justify-center">
        <text class="text text-sm">
          第
          <text class="number mx-2 text-2xl text-love font-bold">{{ loveDayCount.d }}</text>
          天
        </text>
        <text class="text text-sm">
          <text class="number mx-2 text-2xl text-blue-400 font-bold">{{ loveDayCount.h }}</text>
          小时
        </text>
        <text class="text text-sm">
          <text class="number mx-2 text-2xl text-love font-bold">{{ loveDayCount.m }}</text>
          分钟
        </text>
        <text class="text text-sm">
          <text class="number mx-2 text-2xl text-blue-400 font-bold">{{ loveDayCount.s }}</text>
          秒
        </text>
      </view>
    </view>

    <!-- 功能导航 -->
    <view class="mt-6 box-border flex flex-col items-center justify-center gap-y-4 px-4">
      <block v-for="(nav, index) in navList" :key="nav.moduleKey">
        <view
          v-if="nav.use"
          class="uh-global-card-glass box-border list-item w-full flex items-center justify-around gap-x-4 rounded-2xl bg-white/60 p-3"
          :class="`list-item-${index + 1}`" @click="handleToPage(nav.moduleKey)"
        >
          <view
            class="h-12 w-12 flex items-center justify-center rounded-xl opacity-70"
            :style="{ backgroundColor: nav.iconBgColor }"
          >
            <wd-icon :class-prefix="nav.iconPrefix" :name="nav.icon" size="66rpx" />
          </view>
          <view class="box-border flex flex-1 flex-col justify-center gap-y-1">
            <view class="name text-md font-bold" :style="{ color: nav.titleColor }">
              {{ nav.title }}
            </view>
            <view class="truncate text-xs" :style="{ color: nav.subTitleColor }">
              {{ nav.subTitle }}
            </view>
          </view>
          <view class="shrink-0">
            <wd-icon
              :name="nav.locked ? 'lock' : 'arrow-right'" :style="{ color: nav.titleColor }"
              size="32rpx"
            />
          </view>
        </view>
      </block>
    </view>
  </view>

  <!-- 模块密码验证弹窗（恋爱日记入口强制解锁不可关闭；模块入口点击可取消） -->
  <uh-unlock-popup
    v-model:show="unlockModalVisible" title="请解锁" captcha-enabled :tip="unlockTip"
    :closeable="pendingModule !== 'loveDiary'" placeholder="请输入密码" confirm-text="进入" :request="handleUnlockRequest"
    @success="handleUnlockSuccess"
  />
</template>

<style scoped lang="scss">
.heart-beat {
  animation: heartBeat 1.2s ease-in-out infinite;
}

@keyframes heartBeat {
  0%,
  100% {
    transform: translate(-50%, -50%) scale(1);
  }

  15% {
    transform: translate(-50%, -50%) scale(1.2);
  }

  30% {
    transform: translate(-50%, -50%) scale(0.95);
  }

  45% {
    transform: translate(-50%, -50%) scale(1.15);
  }

  60% {
    transform: translate(-50%, -50%) scale(1);
  }
}

.list-item-1 {
  animation: listItemAni1 3s ease-in-out infinite;
}

.list-item-2 {
  animation: listItemAni1 3s ease-in-out infinite;
  animation-delay: 1.5s;
}

.list-item-3 {
  animation: listItemAni1 3s ease-in-out infinite;
  animation-delay: 2s;
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

/* 男孩头像微偏右 */
.uh-boy-offset {
  transform: translateX(0.125rem);
}

/* 女孩头像微偏左 */
.uh-girl-offset {
  transform: translateX(-0.125rem);
}
</style>
