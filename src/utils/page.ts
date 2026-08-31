/**
 * 页面通用工具(源自旧项目 common/mixins/index.js 的 methods/computed,改 utils 按需导出)
 * haloConfig/haloPluginsConfig/globalAppSettings 对应新架构用 Pinia store 读取,此处不再提供
 */
import { useAppConfigStore } from '@/store/appConfig'

/** 动画索引(列表动画错峰) */
let aniWaitIndex = 0

/**
 * 设置页面标题(默认取应用配置 startConfig.title)
 * @param title 标题,为空时回退 uni-halo
 */
export function handleSetPageTitle(title?: string) {
  const appConfigStore = useAppConfigStore()
  const fallbackTitle = (appConfigStore.configs.appConfig as { startConfig?: { title?: string } } | undefined)?.startConfig?.title || 'uni-halo'
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
