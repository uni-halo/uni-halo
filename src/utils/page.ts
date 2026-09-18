/**
 * 页面通用工具
 * haloConfig/haloPluginsConfig/globalAppSettings 对应新架构用 Pinia store 读取,此处不再提供
 */
import { useAppConfigStore } from '@/store/appConfig'

/** 动画索引(列表动画错峰) */
let aniWaitIndex = 0

/**
 * 设置页面标题(默认取应用配置 appInfo.name)
 * @param title 标题,为空时回退 uni-halo
 */
export function handleSetPageTitle(title?: string) {
  const appConfigStore = useAppConfigStore()
  const fallbackTitle = appConfigStore.configs.featureConfig?.profile?.appInfo?.name || 'uni-halo'
  uni.setNavigationBarTitle({
    title: title || fallbackTitle,
  })
}

/**
 * 页面返回顶部
 * @param duration 滚动时长,默认 500
 */
export function handleToTopPage(duration = 500) {
  const d = Number.isNaN(duration) ? 500 : duration
  uni.pageScrollTo({
    scrollTop: 0,
    duration: d,
    fail: (err) => {
      console.error('回顶失败', err)
    },
  })
}

/**
 * 固定导航栏遮挡高度(状态栏 + 46px 导航体,与 uh-navbar 实际高度一致)
 */
function getFixedNavbarOffset(): number {
  const winInfo = uni.getWindowInfo()
  const statusHeight = winInfo.safeArea?.top || winInfo.statusBarHeight || 0
  return statusHeight + 46
}

/**
 * 滚动页面至指定元素区域(自动避开固定导航栏遮挡)
 * 通过 selectorQuery 计算目标元素绝对位置后 pageScrollTo,兼容 H5/小程序/App
 * @param selector 目标元素选择器,如 '#comment-section'
 * @param duration 滚动时长,默认 300
 */
export function handleScrollToSelector(selector: string, duration = 300) {
  uni.createSelectorQuery()
    .selectViewport().scrollOffset(() => {})
    .select(selector).boundingClientRect()
    .exec((res) => {
      const viewport = res?.[0] as { scrollTop?: number } | undefined
      const rect = res?.[1] as { top?: number } | undefined
      if (!rect || rect.top === undefined || rect.top === null) {
        console.error('滚动目标不存在:', selector)
        return
      }
      // 目标绝对位置 = 当前滚动量 + 元素相对视口位置;再扣除固定导航栏高度并预留 12px 呼吸空间
      const target = Math.max(0, (viewport?.scrollTop || 0) + rect.top - getFixedNavbarOffset() + 12)
      uni.pageScrollTo({
        scrollTop: target,
        duration,
        fail: (err) => {
          console.error('滚动失败', err)
        },
      })
    })
}

/** 初始化动画索引值(需要在每个页面调用) */
export function handleResetSetAniWaitIndex() {
  aniWaitIndex = 0
}

/**
 * 计算动画等待毫秒数(每 10 个重置为 1,与旧 mixins calcAniWait 一致)
 * @param index 当前列表索引
 * @returns 动画延迟毫秒数
 */
export function calcAniWait(index: number): number {
  if ((index + 1) % 10 === 0) {
    aniWaitIndex = 1
  }
  else {
    aniWaitIndex += 1
  }
  return aniWaitIndex * 50
}
