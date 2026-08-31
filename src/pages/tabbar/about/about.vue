<script lang="ts" setup>
/**
 * 关于页(源自旧项目 pages/tabbar/about/about.vue,新建复刻)
 * 功能:博主信息 + 站点统计 + 功能导航 + 版权
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
const calcAuditModeEnabled = computed(() => !!haloConfigs.value.auditConfig?.auditModeEnabled)
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
const navList = ref<{
  key: string
  title: string
  icon: string
  iconColor: string
  rightText: string
  path: string | null
  isAdmin?: boolean
  openType?: string
  show: boolean
}[]>([])

/* ---------------- 功能导航 ---------------- */
async function handleGetNavList() {
  let isWx = false
  // #ifdef MP-WEIXIN
  isWx = true
  // #endif

  const dataVisualAvailable = await usePluginAvailable('plugin-data-statistics')

  navList.value = [
    {
      key: 'data-visual',
      title: '数据看板',
      icon: 'chart',
      iconColor: '#2196f3',
      rightText: '站点数据可视化',
      path: '/pages-blog/data-visual/data-visual',
      show: dataVisualAvailable,
    },
    {
      key: 'archives',
      title: calcAuditModeEnabled.value ? '内容归档' : '文章归档',
      icon: 'folder',
      iconColor: '#f44336',
      rightText: calcAuditModeEnabled.value ? '全部已归档内容' : '全部已归档文章',
      path: '/pages-blog/archives/archives',
      show: true,
    },
    {
      key: 'love',
      title: '恋爱日记',
      icon: 'heart',
      iconColor: '#f44336',
      rightText: '博主的恋爱日记',
      path: '/pages-blog/love/love',
      show: loveEnabled.value,
    },
    {
      key: 'vote',
      title: '投票中心',
      icon: 'box',
      iconColor: '#f44336',
      rightText: '查看和进行投票',
      path: '/pages-blog/votes/votes',
      show: !calcAuditModeEnabled.value && calcVotePluginEnabled.value,
    },
    {
      key: 'friend-links',
      title: '友情链接',
      icon: 'link',
      iconColor: '#2196f3',
      rightText: '看看博主朋友们吧',
      path: '/pages-blog/friend-links/friend-links',
      show: calcLinksPluginEnabled.value,
    },
    {
      key: 'disclaimers',
      title: '免责声明',
      icon: 'map',
      iconColor: '#f44336',
      rightText: '博客内容免责声明',
      path: '/pages-blog/disclaimers/disclaimers',
      show: !!basicConfig.value?.disclaimers?.enabled,
    },
    {
      key: 'contact-blogger',
      title: '联系博主',
      icon: 'message',
      iconColor: '#ff9800',
      rightText: '博主常用联系方式',
      path: '/pages-blog/contact/contact',
      show: socialEnabled.value,
    },
    {
      key: 'about',
      title: '关于项目',
      icon: 'info',
      iconColor: '#2196f3',
      rightText: '小莫唐尼开源项目',
      path: '/pages-blog/about/about',
      show: !!basicConfig.value?.showAboutSystem,
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
  <view class="app-page min-h-screen w-screen pb-6">
    <!-- 博主信息 -->
    <view class="blogger-info relative h-[600rpx] w-full" :style="[calcProfileStyle]">
      <image class="avatar absolute left-1/2 top-[200rpx] z-2 h-[130rpx] w-[130rpx] border-6 border-white rounded-full -translate-x-1/2" :src="bloggerInfo.avatar" mode="aspectFill" />
      <view class="profile absolute left-0 top-[340rpx] z-6 w-full text-center text-white">
        <view class="author text-[34rpx] font-bold">
          {{ bloggerInfo.nickname }}
        </view>
        <view class="desc mt-4 px-12 text-[26rpx] opacity-90">
          {{ bloggerInfo.description || '这个博主很懒，竟然没写介绍~' }}
        </view>
      </view>
      <image v-if="calcWaveUrl" :src="calcWaveUrl" mode="scaleToFill" class="gif-wave absolute bottom-0 left-0 z-99 h-[100rpx] w-full" style="mix-blend-mode: screen;" />
    </view>

    <!-- 统计信息 -->
    <view class="statistics-wrap overflow-hidden rounded-b-3xl bg-white shadow-sm">
      <view class="statistics flex pb-3 pt-3">
        <view class="item flex-1 py-6 text-center">
          <view class="number text-[40rpx] font-bold" style="color: #ff9800;">
            {{ statistics.post }}
          </view>
          <view class="mt-1 text-center text-[24rpx] text-[#999]">
            内容数量
          </view>
        </view>
        <view class="item flex-1 py-6 text-center">
          <view class="number text-[40rpx] font-bold" style="color: #4caf50;">
            {{ statistics.visit }}
          </view>
          <view class="mt-1 text-[24rpx] text-[#999]">
            访客数量
          </view>
        </view>
        <view class="item flex-1 py-6 text-center">
          <view class="number text-[40rpx] font-bold" style="color: #2196f3;">
            {{ statistics.category }}
          </view>
          <view class="mt-1 text-center text-[24rpx] text-[#999]">
            分类总数
          </view>
        </view>
      </view>
      <view v-if="statisticsShowMore" class="statistics flex border-t-2 border-[#fafafa] pb-3 pt-3">
        <view class="item flex-1 py-6 text-center">
          <view class="number text-[40rpx] font-bold" style="color: #ff9800;">
            {{ statistics.comment }}
          </view>
          <view class="mt-1 text-center text-[24rpx] text-[#999]">
            评论数量
          </view>
        </view>
        <view class="item flex-1 py-6 text-center">
          <view class="number text-[40rpx] font-bold" style="color: #2196f3;">
            {{ statistics.upvote }}
          </view>
          <view class="mt-1 text-[24rpx] text-[#999]">
            点赞数量
          </view>
        </view>
      </view>
      <view class="show-more-btn pb-4 text-center text-[24rpx] text-[#999]" @click="statisticsShowMore = !statisticsShowMore">
        {{ statisticsShowMore ? '收起' : '展开' }}
      </view>
    </view>

    <!-- 功能导航 -->
    <view class="nav-wrap mx-6 mt-6 overflow-hidden rounded-xl bg-white shadow-sm">
      <template v-for="nav in navList.filter(n => n.show)" :key="nav.key">
        <view class="nav-item flex items-center justify-between border-b-2 border-[#f5f5f5] px-3 py-7" @click="handleOnNav(nav)">
          <view class="nav-left flex items-center gap-4">
            <wd-icon :name="nav.icon" size="18px" :color="nav.iconColor" />
            <text class="nav-title text-[28rpx] text-[#303133]">{{ nav.title }}</text>
          </view>
          <view class="nav-right flex items-center gap-2">
            <text class="nav-right-text text-[24rpx] text-[#c0c4cc]">{{ nav.rightText }}</text>
            <wd-icon name="arrow-right" size="12px" color="#c0c4cc" />
          </view>
        </view>
      </template>
    </view>

    <!-- 版权 -->
    <view v-if="copyrightConfig?.enabled" class="copyright mt-10 px-6 text-center text-[22rpx] text-[#c0c4c7]">
      <view>{{ copyrightConfig.content }}</view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.app-page {
  .blogger-info {
    background-size: cover;
    background-repeat: no-repeat;

    &::before {
      content: '';
      width: 100%;
      height: 100%;
      position: absolute;
      background-color: rgb(0 0 0 / 30%);
      z-index: 0;
    }
  }

  .nav-wrap {
    .nav-item {
      &:last-child {
        border-bottom: none;
      }
    }
  }
}
</style>
