<script lang="ts" setup>
import { onBeforeUnmount, ref } from 'vue'
import { onLoad, onPageScroll, onShow } from '@dcloudio/uni-app'
import { useAppConfigStore } from '@/store/appConfig'
import { checkAvatarUrl, checkImageUrl } from '@/utils/url'
import { getLoveModuleToken } from '@/utils/loveModuleToken'
import type { LoveModuleKey } from '@/utils/loveModuleToken'
import { useLoveModuleUnlock } from '@/hooks/useLoveModuleUnlock'
import { usePageScroll } from '@/hooks/usePageScroll'
import type { ILoveConfigGroup, ILoveModuleConfig } from '@/api/types/uni-halo'

definePage({
  style: {
    navigationBarTitleText: '恋爱日记',
    navigationStyle: 'custom',
  },
})

const { scrollY, updatePageScrollValue } = usePageScroll()
const appConfigStore = useAppConfigStore()

/* ---------------- 恋爱配置 ---------------- */
/**
 * 恋爱配置（数据源为 getConfigs.loveConfig 组：恋爱日记仅密码状态；
 * 三模块入口即 app 端入口列表数据）
 */
interface ILoveConfigPage extends Partial<ILoveConfigGroup> {
  enabled: boolean
  loveDateTitle: string
  loveDate: string
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

/* ---------------- 数据加载 ---------------- */
function syncLoveConfigFromStore() {
  const loveConfigs = appConfigStore.configs.featureConfig?.love

  loveConfig.value = {
    ...loveConfig.value,
    ...(loveConfigs?.loveInfo?.loveDateTitle ? { loveDateTitle: loveConfigs.loveInfo.loveDateTitle } : {}),
    ...(loveConfigs?.loveInfo?.loveDate ? { loveDate: loveConfigs.loveInfo.loveDate } : {}),
  }

  // 恋爱页背景图：读自 featureConfig.love.diaryPage.bgImageUrl
  loveBgImage.value = loveConfigs?.diaryPage?.bgImageUrl || ''
  if (loveConfigs) {
    loveConfig.value = {
      ...loveConfig.value,
      // 恋爱信息（纪念日 + 恋人信息）需透传，否则模板 loveInfo 恒为空
      loveInfo: loveConfigs.loveInfo || loveConfig.value.loveInfo,
      loveDiary: loveConfigs.loveDiary || loveConfig.value.loveDiary,
      ourStory: loveConfigs.ourStory || loveConfig.value.ourStory,
      lovePhoto: loveConfigs.lovePhoto || loveConfig.value.lovePhoto,
      loveDaily: loveConfigs.loveDaily || loveConfig.value.loveDaily,
    }
  }

  initList()
  if (loveConfig.value.loveDate) {
    handleInitLoveDayCount()
  }
}

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
      // 模块设了密码且本地无有效 token → 锁定态；解锁后恢复箭头
      locked: !!moduleCfg.passwordEnabled && !getLoveModuleToken(moduleKey),
      // 图标/跳转路径直接消费插件下发字段（不再本地映射）
      iconPrefix: moduleCfg.iconPrefix || 'uhlove-icon',
      icon: moduleCfg.icon || '',
      path: moduleCfg.path || '',
      title: moduleCfg.title || '',
      subTitle: moduleCfg.subTitle || '',
      // 颜色直接消费插件下发的 hex8（#rrggbbaa），缺失回退内置默认
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
/** 恋爱模块解锁流程（弹窗状态/请求/成功回调统一由 hook 管理） */
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
    // 恋爱日记入口解锁：恋爱配置已并入 getConfigs loveConfig 组，刷新后重读
    if (moduleKey === 'loveDiary') {
      appConfigStore.refreshStatic().then(() => syncLoveConfigFromStore())
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

onLoad(() => {
  syncLoveConfigFromStore()
})

onShow(async () => {
  await appConfigStore.bootstrap()
  syncLoveConfigFromStore()
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
          <image
            class="uh-global-card-glass box-border h-26 w-26 border-3 border-blue-400 rounded-full"
            :src="checkAvatarUrl(loveConfig.loveInfo?.boyAvatar)" mode="aspectFill"
          />
          <view class="mt-2 rounded-lg bg-blue-500 px-2 py-1 text-center text-xs text-white font-bold">
            {{ loveConfig.loveInfo?.boyNickname }}
          </view>
        </view>
        <!-- 心动呼吸动画 -->
        <text class="heart-beat absolute z-10">
          <wd-icon
            class-prefix="uhlove-icon" name="aixin"
            size="72rpx"
          />
        </text>
        <view class="girl uh-girl-offset flex flex-col items-center justify-center">
          <image
            class="uh-global-card-glass box-border h-26 w-26 border-3 border-love rounded-full"
            :src="checkAvatarUrl(loveConfig.loveInfo?.girlAvatar)" mode="aspectFill"
          />
          <view class="mt-2 rounded-lg bg-love px-2 py-1 text-center text-xs text-white font-bold">
            {{ loveConfig.loveInfo?.girlNickname }}
          </view>
        </view>
      </view>
      <image :src="checkImageUrl(loveBgImage)" class="absolute inset-0 z-0 h-full w-full" mode="aspectFill" />
      <view
        class="absolute bottom-0 left-0 z-2 h-36 w-full from-white/0 via-pink-50/50 to-pink-50 bg-gradient-to-b"
      />
    </view>
    <!-- 恋爱记时 -->
    <view class="love-time-wrap mt-8 w-screen flex flex-col items-center justify-center">
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
              :name="nav.locked ? 'lock' : 'arrow-right'"
              :style="{ color: nav.titleColor }" size="32rpx"
            />
          </view>
        </view>
      </block>
    </view>
  </view>

  <!-- 模块密码验证弹窗（恋爱日记入口强制解锁不可关闭；模块入口点击可取消） -->
  <uh-unlock-popup
    v-model:show="unlockModalVisible" title="请解锁" captcha-enabled
    :tip="unlockTip" :closeable="pendingModule !== 'loveDiary'"
    placeholder="请输入密码" confirm-text="进入" :request="handleUnlockRequest" @success="handleUnlockSuccess"
  />
</template>

<style scoped lang="scss">
.heart-beat {
  animation: heartBeat 1.2s ease-in-out infinite;
}

@keyframes heartBeat {
  0%,
  100% {
    transform: translateY(-1rem) scale(1);
  }

  15% {
    transform: translateY(-1rem) scale(1.2);
  }

  30% {
    transform: translateY(-1rem) scale(0.95);
  }

  45% {
    transform: translateY(-1rem) scale(1.15);
  }

  60% {
    transform: translateY(-1rem) scale(1);
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
