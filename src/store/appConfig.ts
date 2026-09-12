/**
 * 应用配置
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getAppConfigs, getAuditData } from '@/api/uni-halo'
import { DefaultAppConfigs } from '@/config/appConfig'
import { deepMerge } from '@/utils/merge'
import { setCache } from '@/utils/storage'
import type { IAppConfig, IAuditDataResult } from '@/api/types/uni-halo'

/** 合并后配置缓存 key(与 utils/url.ts / api/uni-halo.ts 的 APP_GLOBAL_CONFIGS 读取保持一致) */
const APP_GLOBAL_CONFIGS_KEY = 'APP_GLOBAL_CONFIGS'
/**
 * 静态配置后台刷新间隔(ms): onShow 距上次拉取在 TTL 内则不再重复请求
 */
const STATIC_TTL = 5 * 60 * 1000

export const useAppConfigStore = defineStore(
  'appConfig',
  () => {
    const configs = ref<IAppConfig>(JSON.parse(JSON.stringify(DefaultAppConfigs)))
    /** 审核模式数据(公开接口 /audit-data;enabled 联动设置页开关) */
    const auditData = ref<IAuditDataResult>({ enabled: false })
    /** 审核模式开关(单一数据源:公开接口返回的 enabled) */
    const auditModeEnabled = computed(() => !!auditData.value.enabled)
    /** 维护模式信息(configs 顶层 additive maintenance 键;undefined=未维护/已到点自动结束) */
    const maintenance = computed(() => configs.value.maintenance)
    /** 最近一次静态配置拉取时间戳(ms,0=从未拉取;TTL 判定依据) */
    const fetchedAt = ref(0)

    /** 重置为默认配置 */
    const setDefaultAppSettings = () => {
      configs.value = JSON.parse(JSON.stringify(DefaultAppConfigs))
      auditData.value = { enabled: false }
    }

    /** 获取应用配置(与默认值深合并,并存储 token) */
    const fetchConfigs = async () => {
      try {
        const res = await getAppConfigs()
        const body = res.data as IAppConfig | undefined
        if (body) {
          configs.value = deepMerge(JSON.parse(JSON.stringify(DefaultAppConfigs)), body)

          setCache(APP_GLOBAL_CONFIGS_KEY, configs.value)
          return body
        }
        setDefaultAppSettings()
        return null
      }
      catch {
        setDefaultAppSettings()
        return null
      }
    }

    /** 获取审核模式数据(公开接口;enabled=false 时 spec 为空) */
    const fetchAuditData = async () => {
      try {
        const res = await getAuditData()
        auditData.value = res.data || { enabled: false }
        return auditData.value
      }
      catch (err) {
        console.error('获取审核模式数据失败', err)
        auditData.value = { enabled: false }
        return auditData.value
      }
    }

    /**
     * 统一拉取静态配置:
     * getConfigs + audit-data 并行一次;TTL 内(默认 5 分钟,persist 恢复后
     * 亦生效)直接返回缓存,避免每次冷启动/onShow 重复请求;force=true 强制刷新。
     * 返回 ok = getConfigs 是否成功(失败时走内置默认/旧缓存,由调用方决定后续)。
     * 恋爱配置已并入 getConfigs 的 loveConfig 组(2026-09-12 起 /love-config 下线),
     * 由 love.vue 直接读 configs.loveConfig。
     */
    const bootstrap = async (options?: { force?: boolean }): Promise<{ ok: boolean, fromCache: boolean }> => {
      const force = options?.force ?? false
      if (!force && fetchedAt.value > 0 && Date.now() - fetchedAt.value < STATIC_TTL) {
        return { ok: true, fromCache: true }
      }
      const [cfg] = await Promise.all([fetchConfigs(), fetchAuditData()])
      fetchedAt.value = Date.now()
      return { ok: !!cfg, fromCache: false }
    }

    /** 强制刷新静态配置(下拉刷新/设置页手动刷新入口) */
    const refreshStatic = () => bootstrap({ force: true })

    return {
      configs,
      auditData,
      auditModeEnabled,
      maintenance,
      fetchedAt,
      fetchConfigs,
      setDefaultAppSettings,
      fetchAuditData,
      bootstrap,
      refreshStatic,
    }
  },
  {
    persist: true,
  },
)
