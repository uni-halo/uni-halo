<script lang="ts" setup>
/**
 * 关于页(源自旧项目 pages/tabbar/about/about.vue,新建复刻)
 * 功能:博主信息 + 站点统计 + 功能导航 + 版权
 * 风格:对齐全站设计语言(bg-page + uh-global-card-glass + uh-section-title + 彩色图标块)
 */
import { computed, ref, watch } from 'vue'
import { onPullDownRefresh } from '@dcloudio/uni-app'
import { getBlogStatistics } from '@/api/halo'
import { useAppConfigStore } from '@/store/appConfig'
import { checkAvatarUrl, checkImageUrl } from '@/utils/url'
import { checkHasAdminLogin } from '@/utils/auth'
import { t } from '@/locale'
import { usePluginAvailable } from '@/utils/plugin'
import type { IBlogStats } from '@/api/types/halo'

definePage({
  style: {
    navigationBarTitleText: '关于',
    enablePullDownRefresh: true,
    navigationStyle: 'custom',
  },
})

const appConfigStore = useAppConfigStore()
const haloConfigs = computed(() => appConfigStore.configs)
const calcAuditModeEnabled = computed(() => appConfigStore.auditModeEnabled)
const calcVotePluginEnabled = computed(() => !!haloConfigs.value.pluginConfig?.votePlugin?.enabled)
const calcLinksPluginEnabled = computed(() => !!haloConfigs.value.pluginConfig?.linksPlugin?.enabled)

/* ---------------- 计算属性 ---------------- */
const bloggerInfo = computed(() => {
  const blogger = haloConfigs.value.authorConfig?.blogger as
    | { nickname?: string, avatar?: string, description?: string }
    | undefined
  return {
    nickname: blogger?.nickname || '',
    avatar: checkAvatarUrl(blogger?.avatar),
    description: blogger?.description || '',
  }
})

const pageConfig = computed(() => haloConfigs.value.pageConfig?.aboutConfig as
  | { bgImageUrl?: string, waveImageUrl?: string }
  | undefined)

const calcProfileStyle = computed(() => ({
  backgroundImage: `url(${checkImageUrl(pageConfig.value?.bgImageUrl)})`,
}))

const calcWaveUrl = computed(() => checkImageUrl(pageConfig.value?.waveImageUrl))

const basicConfig = computed(() => haloConfigs.value.basicConfig as
  | {
    copyrightConfig?: { enabled?: boolean, content?: string }
    disclaimers?: { enabled?: boolean }
    showAboutSystem?: boolean
  }
  | undefined)

const copyrightConfig = computed(() => basicConfig.value?.copyrightConfig)

const loveEnabled = computed(() => !!(haloConfigs.value.loveConfig as { loveEnabled?: boolean } | undefined)?.loveEnabled)
const socialEnabled = computed(() => !!(haloConfigs.value.authorConfig?.social as { enabled?: boolean } | undefined)?.enabled)

/* ---------------- 状态 ---------------- */
const statisticsShowMore = ref(false)
const statistics = ref<IBlogStats>({ post: 0, comment: 0, category: 0, visit: 0, upvote: 0 })

/** 主行统计(常驻展示) */
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
  icon: string
  /** 图标块背景色(与首页快捷导航同色板,同一功能同色) */
  bgColor: string
  rightText: string
  path: string | null
  isAdmin?: boolean
  openType?: string
  show: boolean
  /** 分组:blog=博客功能 more=更多信息 */
  group: 'blog' | 'more'
}

const navList = ref<INavItem[]>([])

/** 分组渲染(过滤后空组整组隐藏) */
const calcNavGroups = computed(() => {
  const visible = navList.value.filter(n => n.show)
  const groupDefs: { key: 'blog' | 'more', title: string }[] = [
    { key: 'blog', title: '博客功能' },
    { key: 'more', title: '其他功能' },
  ]
  return groupDefs
    .map(def => ({ ...def, items: visible.filter(n => n.group === def.key) }))
    .filter(group => group.items.length > 0)
})

/* ---------------- 功能导航 ---------------- */
/** 图标块浅色背景:品牌深色 rgba 降透明度 → 轻量底色 */
function toLightBg(rgba: string) {
  return rgba.replace('0.95)', '0.15)')
}

/** 图标颜色:品牌深色实色 */
function toSolidColor(rgba: string) {
  return rgba.replace('0.95)', '1)')
}

async function handleGetNavList() {
  const dataVisualAvailable = await usePluginAvailable('plugin-data-statistics')

  navList.value = [
    {
      key: 'data-visual',
      title: '数据看板',
      icon: 'chart',
      bgColor: 'rgba(102, 60, 201, 0.95)',
      rightText: '站点数据可视化',
      path: '/pages-blog/data-visual/data-visual',
      show: dataVisualAvailable,
      group: 'blog',
    },
    {
      key: 'archives',
      title: calcAuditModeEnabled.value ? '内容归档' : '文章归档',
      icon: 'folder',
      bgColor: 'rgba(3, 169, 244, 0.95)',
      rightText: calcAuditModeEnabled.value ? '全部已归档内容' : '全部已归档文章',
      path: '/pages-blog/archives/archives',
      show: true,
      group: 'blog',
    },
    {
      key: 'love',
      title: '恋爱日记',
      icon: 'heart',
      bgColor: 'rgba(255, 76, 103, 0.95)',
      rightText: '博主的恋爱日记',
      path: '/pages-blog/love/love',
      show: loveEnabled.value,
      // show: true,
      group: 'blog',
    },
    {
      key: 'vote',
      title: '投票中心',
      icon: 'box',
      bgColor: 'rgba(0, 188, 212, 0.95)',
      rightText: '查看和进行投票',
      path: '/pages-blog/votes/votes',
      show: !calcAuditModeEnabled.value && calcVotePluginEnabled.value,
      // show: true,
      group: 'blog',
    },
    {
      key: 'friend-links',
      title: '友情链接',
      icon: 'link',
      bgColor: 'rgba(0, 150, 136, 0.95)',
      rightText: '看看博主朋友们吧',
      path: '/pages-blog/friend-links/friend-links',
      show: calcLinksPluginEnabled.value,
      // show: true,
      group: 'blog',
    },
    {
      key: 'disclaimers',
      title: '免责声明',
      icon: 'map',
      bgColor: 'rgba(121, 85, 72, 0.95)',
      rightText: '博客内容免责声明',
      path: '/pages-blog/disclaimers/disclaimers',
      show: !!basicConfig.value?.disclaimers?.enabled,
      // show: true,
      group: 'more',
    },
    {
      key: 'contact-blogger',
      title: '联系博主',
      icon: 'message',
      bgColor: 'rgba(255, 152, 0, 0.95)',
      rightText: '博主常用联系方式',
      path: '/pages-blog/contact/contact',
      show: socialEnabled.value,
      // show: true,
      group: 'more',
    },
    {
      key: 'about',
      title: '关于项目',
      icon: 'info',
      bgColor: 'rgba(96, 125, 139, 0.95)',
      rightText: '小莫唐尼开源项目',
      path: '/pages-blog/about/about',
      show: !!basicConfig.value?.showAboutSystem,
      // show: true,
      group: 'more',
    },
    {
      key: 'setting',
      title: '偏好设置',
      icon: 'settings',
      bgColor: 'rgba(121, 134, 203, 0.95)',
      rightText: '首页布局、卡片样式等本地偏好',
      path: '/pages-blog/setting/setting',
      show: true,
      group: 'more',
    },
  ]
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
function handleOnNav(data: { path: string | null, isAdmin?: boolean }) {
  const { path, isAdmin } = data
  if (!path)
    return

  // 拦截后台管理页面(需超管登录)
  if (isAdmin && !checkHasAdminLogin()) {
    uni.showModal({
      title: '提示',
      content: '未登录超管账号或登录状态已过期，是否立即登录？',
      showCancel: true,
      cancelText: '否',
      cancelColor: '#999999',
      confirmText: '是',
      confirmColor: '#03a9f4',
      success: (res) => {
        if (res.confirm) {
          uni.navigateTo({ url: '/pages/auth/login' })
        }
      },
    })
    return
  }

  uni.navigateTo({ url: path })
}

/* ---------------- 生命周期 ---------------- */
watch(haloConfigs, () => {
  handleGetNavList()
}, { deep: true, immediate: true })

handleGetData()

onPullDownRefresh(() => {
  handleGetData()
})
</script>

<template>
  <view class="box-border min-h-screen w-screen bg-page pb-8">
    <!-- 头部:博主信息(背景图 + 遮罩 + wave,内容区做状态栏适配) -->
    <view class="blogger-info relative h-76 w-full bg-cover bg-no-repeat" :style="[calcProfileStyle]">
      <!-- 背景遮罩 -->
      <view class="absolute left-0 top-0 z-0 h-full w-full bg-black/30 backdrop-blur-[2rpx]" />
      <view class="relative z-6 h-full flex flex-col items-center justify-center pb-[140rpx] pt-safe">
        <image
          class="uh-global-card-glass h-20 w-20 rounded-full" :src="bloggerInfo.avatar"
          mode="aspectFill"
        />
        <view class="mt-4 text-lg text-white font-bold text-shadow-[0_2rpx_8rpx_rgba(0,0,0,0.4)]">
          {{ bloggerInfo.nickname }}
        </view>
        <view
          class="desc mt-2 px-10 text-center text-[26rpx] text-white/90 leading-relaxed text-shadow-[0_2rpx_8rpx_rgba(0,0,0,0.4)]"
        >
          {{ bloggerInfo.description || '这个博主很懒，竟然没写介绍~' }}
        </view>
      </view>
      <image
        v-if="calcWaveUrl" :src="calcWaveUrl" mode="scaleToFill"
        class="gif-wave absolute bottom-0 left-0 z-99 h-[100rpx] w-full" style="mix-blend-mode: screen;"
      />
    </view>

    <!-- 站点统计(上浮玻璃卡,与头部衔接) -->
    <view class="uh-global-card-glass relative z-100 mx-4 flex border rounded-2xl -mt-12">
      <view v-for="item in allStats" :key="item.key" class="flex-1 py-6 text-center">
        <view class="text-lg text-gray-900 font-bold">
          {{ item.value }}
        </view>
        <view class="mt-1 text-xs text-gray-500">
          {{ item.label }}
        </view>
      </view>
    </view>

    <!-- 功能导航(分组玻璃卡) -->
    <template v-for="group in calcNavGroups" :key="group.key">
      <uh-section-title class="mx-4 mb-3 mt-8">
        {{ group.title }}
      </uh-section-title>
      <view class="nav-wrap uh-global-card-glass mx-4 overflow-hidden rounded-2xl">
        <view
          v-for="(nav, index) in group.items" :key="nav.key"
          class="nav-item flex items-center justify-between px-4"
          :class="index < group.items.length - 1 ? 'border-b border-b-solid border-black/5' : ''" @click="handleOnNav(nav)"
        >
          <view class="nav-left flex items-center gap-3 py-3">
            <view
              class="h-9 w-9 flex items-center justify-center border border-black/5 rounded-xl"
              :style="{ backgroundColor: toLightBg(nav.bgColor) }"
            >
              <wd-icon :name="nav.icon" size="20px" :color="toSolidColor(nav.bgColor)" />
            </view>
            <text class="nav-title text-sm text-gray-900 font-bold">{{ nav.title }}</text>
          </view>
          <view class="nav-right flex items-center gap-2">
            <text class="nav-right-text text-xs text-gray-400">{{ nav.rightText }}</text>
            <wd-icon name="arrow-right" size="12px" color="#c8c2b4" />
          </view>
        </view>
      </view>
    </template>

    <!-- 版权 -->
    <view v-if="copyrightConfig?.enabled" class="mt-6 px-6 text-center text-xs text-gray-400">
      <view>{{ copyrightConfig.content }}</view>
    </view>
  </view>
</template>
