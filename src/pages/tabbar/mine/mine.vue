<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { getBlogStatistics } from '@/api/halo'
import { useAppConfigStore } from '@/store/appConfig'
import { useTokenStore } from '@/store/token'
import { useUserStore } from '@/store/user'
import { useLoveModuleUnlock } from '@/hooks/useLoveModuleUnlock'
import { checkAvatarUrl, checkImageUrl } from '@/utils/url'
import { t } from '@/locale'
import { usePageScroll } from '@/hooks/usePageScroll'
import type { IBlogStats } from '@/api/types/halo'

definePage({
  style: {
    navigationBarTitleText: '关于',
    enablePullDownRefresh: true,
    navigationStyle: 'custom',
  },
})

const appConfigStore = useAppConfigStore()
const tokenStore = useTokenStore()
const userStore = useUserStore()
const { scrollY, updatePageScrollValue } = usePageScroll()

const haloConfigs = computed(() => appConfigStore.configs)
/** 登录态(进入页面时刷新过期判断) */
const hasLogin = computed(() => tokenStore.updateNowTime().hasLogin)

/* ---------------- 计算属性 ---------------- */
const bloggerInfo = computed(() => {
  const blogger = haloConfigs.value.featureConfig?.profile?.blogger as
    | { nickname?: string, avatar?: string, description?: string }
    | undefined
  return {
    nickname: blogger?.nickname || '',
    avatar: checkAvatarUrl(blogger?.avatar),
    description: blogger?.description || '',
  }
})

const pageConfig = computed(() => haloConfigs.value.featureConfig?.pages?.aboutConfig as
  | { bgImageUrl?: string, waveImageUrl?: string }
  | undefined)

const calcProfileStyle = computed(() => ({
  backgroundImage: `url(${checkImageUrl(pageConfig.value?.bgImageUrl)})`,
}))

const calcWaveUrl = computed(() => checkImageUrl(pageConfig.value?.waveImageUrl))

/* ---------------- 状态 ---------------- */
const statistics = ref<IBlogStats>({ post: 0, comment: 0, category: 0, visit: 0, upvote: 0 })

/** 主行统计 */
const allStats = computed(() => [
  { key: 'post', label: '内容', value: statistics.value.post },
  { key: 'visit', label: '访客', value: statistics.value.visit },
  { key: 'category', label: '分类', value: statistics.value.category },
  { key: 'comment', label: '评论', value: statistics.value.comment },
  { key: 'upvote', label: '点赞', value: statistics.value.upvote },
])

interface INavItem {
  key: string
  title: string
  iconPrefix?: string
  icon: string
  bgColor: string
  color?: string
  subTitle?: string
  path: string | null
  openType?: string
  show: boolean
  group: 'blog' | 'more'
}

interface IMyPageEntry {
  key?: string
  title?: string
  subTitle?: string
  color?: string
  bgColor?: string
  iconPrefix?: string
  icon?: string
  path?: string
  visible?: boolean
}

const configuredFeatures = computed(() => {
  const mp = haloConfigs.value.featureConfig?.pages?.myPageConfig as
    | { commonFeatures?: IMyPageEntry[], otherFeatures?: IMyPageEntry[] }
    | undefined
  if (!mp || (!mp.commonFeatures?.length && !mp.otherFeatures?.length)) {
    return null
  }
  return mp
})

const navList = ref<INavItem[]>([])
const featureMode = ref<'base' | 'list'>('base')
/** 分组渲染(过滤后空组整组隐藏；组标题对齐插件端：常用功能/其他功能) */
const calcNavGroups = computed(() => {
  const visible = navList.value.filter(n => n.show)
  const groupDefs: { key: 'blog' | 'more', title: string }[] = [
    { key: 'blog', title: '常用功能' },
    { key: 'more', title: '其他功能' },
  ]
  return groupDefs
    .map(def => ({ ...def, items: visible.filter(n => n.group === def.key) }))
    .filter(group => group.items.length > 0)
})

const commonFeatures = computed(() => {
  return navList.value.filter(f => f.show && f.group === 'blog')
})
const otherFeatures = computed(() => {
  return navList.value.filter(f => f.show && f.group === 'more')
})

/* ---------------- 功能导航 ---------------- */

async function handleGetNavList() {
  // 配置模式：插件端 myPageConfig 两组（常用功能→blog、其他功能→more），
  // 未配置/为空时回退本地内置默认（保留原显隐推导）
  const mp = configuredFeatures.value
  if (mp) {
    const mapEntry = (e: IMyPageEntry, group: 'blog' | 'more'): INavItem | null => {
      if (!e.key) { return null }
      return {
        key: e.key,
        title: e.title || '',
        iconPrefix: e.iconPrefix,
        icon: e.icon || '',
        bgColor: e.bgColor || '#969696F2',
        color: e.color,
        subTitle: e.subTitle || '',
        path: e.path || null,
        show: e.visible !== false,
        group,
      }
    }
    navList.value = [
      ...(mp.commonFeatures || []).map(e => mapEntry(e, 'blog')).filter((n): n is INavItem => n !== null),
      ...(mp.otherFeatures || []).map(e => mapEntry(e, 'more')).filter((n): n is INavItem => n !== null),
    ]
    return
  }
}

/* ---------------- 数据加载 ---------------- */
async function handleGetData() {
  try {
    const res = await getBlogStatistics()
    statistics.value = res.data
  }
  catch (err) {
    console.error('获取统计失败', err)
    uni.showToast({ icon: 'none', title: t('common.loadFailedRetry') })
  }
  finally {
    uni.stopPullDownRefresh()
  }
}

/* ---------------- 交互 ---------------- */
/* 恋爱模块解锁拦截(目前仅恋爱日记设密码,命中锁定则先解锁再跳转;样式不变) */
const {
  unlockModalVisible,
  unlockTip,
  handleUnlockRequest,
  handleUnlockSuccess,
  interceptNavigateByPath,
} = useLoveModuleUnlock()

function handleNavGoTo(data: { path: string }) {
  const { path } = data
  if (!path) { return }

  // 命中恋爱模块且锁定 → 弹解锁弹窗,解锁成功后由 hook 自动跳转
  if (interceptNavigateByPath(path)) { return }

  uni.navigateTo({ url: path })
}

/** 前往登录页 */
function handleGoLogin() {
  uni.navigateTo({ url: '/pages/auth/login' })
}

/** 登录入口点击:未登录去登录页,已登录则询问退出 */
function handleLoginEntry() {
  if (!hasLogin.value) {
    handleGoLogin()
    return
  }
  uni.showModal({
    title: '提示',
    content: '确定退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        tokenStore.logout()
      }
    },
  })
}

/* ---------------- 生命周期 ---------------- */
watch(haloConfigs, () => {
  handleGetNavList()
}, { deep: true, immediate: true })

handleGetData()

// 从登录页返回时刷新登录态展示
onShow(() => {
  tokenStore.updateNowTime()
})

onPullDownRefresh(() => {
  handleGetData()
})

onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})
</script>

<template>
  <view class="box-border min-h-screen w-screen bg-page pb-2">
    <uh-mine-navbar :scroll-y="scrollY" />

    <!-- 头部:博主信息(背景图 + 遮罩 + wave,内容区做状态栏适配) -->
    <view class="relative h-96 w-full bg-cover bg-no-repeat" :style="[calcProfileStyle]">
      <view class="relative z-6 h-full flex flex-col items-center justify-center">
        <image
          class="uh-global-card-glass h-22 w-22 border-3 rounded-full" :src="bloggerInfo.avatar"
          mode="aspectFill"
        />
        <view class="mt-4 text-lg text-white font-bold text-shadow-[0_2rpx_8rpx_rgba(0,0,0,0.4)]">
          {{ bloggerInfo.nickname }}
        </view>
        <view
          class="desc mt-2 px-10 text-center text-2xs text-white/90 leading-relaxed text-shadow-[0_2rpx_8rpx_rgba(0,0,0,0.4)]"
        >
          {{ bloggerInfo.description || '这个博主很懒，竟然没写介绍~' }}
        </view>
      </view>

      <!-- 遮罩 -->
      <view class="absolute left-0 top-0 z-0 h-full w-full bg-white/5" style="backdrop-filter:blur(4rpx)" />
      <image
        v-if="calcWaveUrl" :src="calcWaveUrl" mode="scaleToFill"
        class="gif-wave absolute bottom-0 left-0 z-90 h-18 w-full" style="mix-blend-mode: screen;"
      />
      <!-- 过渡 -->
      <view class="absolute bottom-0 left-0 z-100 h-18 w-full from-black/0 to-page bg-gradient-to-b" />
    </view>

    <!-- 站点统计 -->
    <view
      v-if="featureMode === 'list'"
      class="uh-global-card-glass uh-shadow-xs relative z-100 mx-4 flex border rounded-2xl -mt-16"
    >
      <view v-for="item in allStats" :key="item.key" class="flex-1 py-4 text-center">
        <wd-count-to
          :key="`${item.key}-${item.value}`" :start-val="0" :end-val="item.value" :duration="900"
          separator="" color="#111827" custom-class="text-lg font-bold"
        />
        <view class="mt-1 text-xs text-gray-500">
          {{ item.label }}
        </view>
      </view>
    </view>

    <!-- 功能导航：非分组模式 -->
    <template v-if="featureMode === 'base'">
      <view v-if="commonFeatures.length !== 0" class="relative z-100 box-border overflow-hidden p-4 -mt-20">
        <view class="uh-global-card-glass uh-shadow-xs grid grid-cols-4 box-border gap-2 border rounded-lb-2xl rounded-lt-3xl rounded-rb-2xl rounded-rt-3xl p-3">
          <view
            v-for="(nav) in commonFeatures" :key="nav.key"
            class="uh-global-card-glass uh-shadow-xs flex flex-col items-center justify-between rounded-2xl p-2"
            @click="handleNavGoTo(nav)"
          >
            <view
              class="uh-global-card-glass uh-shadow-xs h-8 w-8 flex items-center justify-center border rounded-xl"
              :style="{ backgroundColor: nav.bgColor }"
            >
              <wd-icon :class-prefix="nav.iconPrefix" :name="nav.icon" size="36rpx" />
            </view>
            <text class="mt-1 text-xs text-gray-900" :style="{ color: nav.color }">
              {{ nav.title }}
            </text>
          </view>
        </view>
      </view>
      <template v-if="otherFeatures.length !== 0">
        <view class="mb-3 mt-2 box-border px-4">
          <uh-section-title>
            其他功能
          </uh-section-title>
        </view>
        <view class="uh-global-card-glass uh-shadow-xs mx-4 overflow-hidden rounded-2xl">
          <view
            v-for="(nav, index) in otherFeatures" :key="nav.key"
            class="flex items-center justify-between px-4"
            :class="index < otherFeatures.length - 1 ? 'border-b border-b-solid border-black/5' : ''"
            @click="handleNavGoTo(nav)"
          >
            <view class="nav-left flex items-center gap-3 py-3">
              <view
                class="uh-global-card-glass uh-shadow-xs h-8 w-8 flex items-center justify-center border rounded-xl"
                :style="{ backgroundColor: nav.bgColor }"
              >
                <wd-icon :class-prefix="nav.iconPrefix" :name="nav.icon" size="36rpx" />
              </view>
              <text class="nav-title text-sm text-gray-900" :style="{ color: nav.color }">
                {{ nav.title }}
              </text>
            </view>
            <view class="nav-right flex items-center gap-2">
              <text class="nav-right-text text-xs text-gray-400">{{ nav.subTitle }}</text>
              <wd-icon name="arrow-right" size="24rpx" class="text-gray-400" />
            </view>
          </view>
        </view>
      </template>
    </template>

    <!-- 功能导航：分组模式 -->
    <template v-else-if="featureMode === 'list'">
      <template v-for="group in calcNavGroups" :key="group.key">
        <view class="box-border px-4">
          <uh-section-title class="mb-3 mt-8">
            {{ group.title }}
          </uh-section-title>
        </view>
        <view class="uh-global-card-glass mx-4 overflow-hidden rounded-2xl">
          <view
            v-for="(nav, index) in group.items" :key="nav.key"
            class="nav-item flex items-center justify-between px-4"
            :class="index < group.items.length - 1 ? 'border-b border-b-solid border-black/5' : ''"
            @click="handleNavGoTo(nav)"
          >
            <view class="nav-left flex items-center gap-3 py-3">
              <view
                class="uh-global-card-glass uh-shadow-xs h-8 w-8 flex items-center justify-center border rounded-xl"
                :style="{ backgroundColor: nav.bgColor }"
              >
                <wd-icon :class-prefix="nav.iconPrefix" :name="nav.icon" size="36rpx" />
              </view>
              <text class="nav-title text-sm text-gray-900" :style="{ color: nav.color }">
                {{ nav.title }}
              </text>
            </view>
            <view class="nav-right flex items-center gap-2">
              <text class="nav-right-text text-xs text-gray-400">{{ nav.subTitle }}</text>
              <wd-icon name="arrow-right" size="24rpx" class="text-gray-400" />
            </view>
          </view>
        </view>
      </template>
    </template>

    <!-- 登录入口-->
    <view class="box-border flex justify-center px-4 pt-6" @click="handleLoginEntry">
      <uh-button class="w-full flex-1" :custom-class="`uh-global-card-glass uh-shadow-xs !rounded-full py-2 ${hasLogin?'bg-red-400 text-white':''}`">
        {{ hasLogin ? `退出登录${userStore.userInfo.nickname ? `(${userStore.userInfo.nickname})` : ''}` : '登录' }}
      </uh-button>
    </view>

    <uh-page-copyright />

    <!-- 恋爱模块解锁弹窗(解锁成功自动跳转) -->
    <uh-unlock-popup
      v-model:show="unlockModalVisible" title="请解锁" captcha-enabled
      :tip="unlockTip" placeholder="请输入密码" confirm-text="进入" :request="handleUnlockRequest"
      @success="handleUnlockSuccess"
    />
  </view>
</template>
