/**
 * 维护拦截 hook(2026-09-04)
 * 统一「主插件未激活 / 维护模式开启」两项检查与维护页跳转,供入口页与首页等
 * 页面复用(auto-import 已配置 src/hooks,页面直接调用无需 import)。
 * 拦截规则:任一命中即跳转 /pages/maintenance/maintenance?from=reason,
 * 维护页按 reason 展示默认(未配置维护信息)或配置文案。设计见插件
 * .docs/maintenance-config-design.md §8。
 */
import { usePluginAvailable } from '@/utils/plugin'
import { useAppConfigStore } from '@/store/appConfig'

/** 维护拦截原因:plugin 主插件未激活 / maintenance 维护模式开启 */
export type MaintenanceInterceptReason = 'plugin' | 'maintenance'

export interface IMaintenanceInterceptResult {
  /** 是否命中拦截(需要跳转维护页) */
  intercepted: boolean
  /** 命中原因;未命中为 null */
  reason: MaintenanceInterceptReason | null
}

/** 维护页路径 */
export const MAINTENANCE_PAGE_PATH = '/pages/maintenance/maintenance'
/** 主插件 ID(与 utils/plugin NeedPluginIds.PluginUniHalo 一致) */
export const MAINTENANCE_PLUGIN_ID = 'plugin-uni-halo'

/**
 * 维护拦截能力:检查 + 跳转封装
 *
 * @example
 * const { interceptOrContinue } = useMaintenanceIntercept()
 * onLoad(async () => { if (await interceptOrContinue()) return })
 */
export function useMaintenanceIntercept() {
  const appConfigStore = useAppConfigStore()

  /**
   * 检查是否命中拦截(插件可用性 + 维护模式)。
   * @param force 是否强制刷新配置(默认 false 走 bootstrap TTL 缓存)
   */
  async function checkIntercept(force = false): Promise<IMaintenanceInterceptResult> {
    const pluginAvailable = await usePluginAvailable(MAINTENANCE_PLUGIN_ID)
    if (!pluginAvailable)
      return { intercepted: true, reason: 'plugin' }

    const { ok } = await appConfigStore.bootstrap({ force })
    if (!ok)
      return { intercepted: false, reason: null }
    if (appConfigStore.configs.maintenance)
      return { intercepted: true, reason: 'maintenance' }

    return { intercepted: false, reason: null }
  }

  /** 跳转维护页(带原因参数,供维护页区分默认/配置文案) */
  function redirectToMaintenance(reason: MaintenanceInterceptReason) {
    uni.redirectTo({ url: `${MAINTENANCE_PAGE_PATH}?from=${reason}` })
  }

  /**
   * 一站式:检查并跳转维护页。
   * @returns true = 已命中并跳转,调用方应中断后续逻辑;false = 放行
   */
  async function interceptOrContinue(force = false): Promise<boolean> {
    const { intercepted, reason } = await checkIntercept(force)
    if (intercepted && reason)
      redirectToMaintenance(reason)
    return intercepted
  }

  return { checkIntercept, redirectToMaintenance, interceptOrContinue }
}
