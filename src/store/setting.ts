/**
 * 应用设置 store(两层偏好:站点默认 L0 + 本地差异 L1-L)
 *
 * - settings:合并结果缓存(= L0 站点默认 + 本地差异,本地优先),persist 持久化供离线兜底;
 * - applySiteDefaults(site):启动 fetchConfigs 后把 getConfigs 收集的 L0 与本地差异合并(含旧数据迁移);
 * - savePreference(patch):写本地差异(uh_pref_local_v1)并立即重合并;
 * - resetPreferences:清本地差异,立即回退「站点默认」(无 L0 时回退内置默认)。
 *
 * 设计依据:插件仓库 .docs/config-system-v2-redesign.md §3-4(v2.2:远端=站点默认,无用户级远端层)。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { DefaultAppSettings } from '@/config/appSettings'
import type { IAppSettings } from '@/config/appSettings'
import {
  clearLocalPrefs,
  mergeWithDefaults,
  migrateLegacyLocalPrefs,
  readLocalPrefs,
  updateLocalPrefs,
} from '@/utils/preference'
import type { LocalPrefs } from '@/utils/preference'

export const useSettingStore = defineStore(
  'setting',
  () => {
    /** 合并结果缓存(站点默认 + 本地差异;页面消费点不变) */
    const settings = ref<IAppSettings>(JSON.parse(JSON.stringify(DefaultAppSettings)))
    /** 最近一次站点默认(L0,collectSiteDefaults 结果),非持久化 */
    const siteDefaults = ref<LocalPrefs | null>(null)

    /** 重算合并结果(统一出口:写 settings 缓存) */
    function recompute(): void {
      settings.value = mergeWithDefaults(siteDefaults.value, readLocalPrefs())
    }

    /**
     * 应用站点默认并合并本地差异(启动 fetchConfigs 成功后调用;site 为 null/空时仅本地差异覆盖内置默认)
     * 首次运行时顺带迁移旧版全量 persist(见 utils/preference.migrateLegacyLocalPrefs)
     */
    const applySiteDefaults = (site: LocalPrefs | null): void => {
      siteDefaults.value = site && typeof site === 'object' ? site : null
      migrateLegacyLocalPrefs()
      recompute()
    }

    /** 保存偏好:写本地差异并立即重合并(改偏好即时生效) */
    const savePreference = (patch: LocalPrefs): void => {
      updateLocalPrefs(patch)
      recompute()
    }

    /** 重置为站点默认:清本地差异(重置=删除本地,回退 getConfigs 下发值) */
    const resetPreferences = (): void => {
      clearLocalPrefs()
      recompute()
    }

    /** 兼容旧调用点:恢复默认(新语义=重置回站点默认) */
    const updateDefaultAppSettings = (): void => {
      resetPreferences()
    }

    /** 检查并设置默认设置(启动时调用,persist 已保证有值,兜底处理) */
    const checkAndSetDefaultAppSettings = (): void => {
      if (!settings.value) {
        settings.value = JSON.parse(JSON.stringify(DefaultAppSettings))
      }
    }

    return {
      settings,
      siteDefaults,
      applySiteDefaults,
      savePreference,
      resetPreferences,
      updateDefaultAppSettings,
      checkAndSetDefaultAppSettings,
    }
  },
  {
    persist: true,
  },
)
