/**
 * 应用配置 store(源自旧项目 store/config.js 的 configs/auditData 部分)
 * 注意:旧 fetchConfigs 中会把 basicConfig.tokenConfig 写入缓存,供 getPersonalToken 使用,此处保留
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getAppConfigs, getAuditData } from '@/api/uni-halo'
import { DefaultAppConfigs } from '@/config/appConfig'
import { deepMerge } from '@/utils/merge'
import { setCache } from '@/utils/storage'
import type { IAppConfig, IAuditDataResult } from '@/api/types/uni-halo'

/** 个人令牌存储 key(与 src/store/token.ts 的 getPersonalToken 保持一致) */
const APP_TOKENS_KEY = 'APP_TOKENS'

export const useAppConfigStore = defineStore(
  'appConfig',
  () => {
    const configs = ref<IAppConfig>(JSON.parse(JSON.stringify(DefaultAppConfigs)))
    /** 审核模式数据(公开接口 /audit-data;enabled 联动设置页开关) */
    const auditData = ref<IAuditDataResult>({ enabled: false })
    /** 审核模式开关(单一数据源:公开接口返回的 enabled) */
    const auditModeEnabled = computed(() => !!auditData.value.enabled)

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

          // 存储个人令牌(供 getPersonalToken 使用,如非匿名投票)
          if (body?.basicConfig?.tokenConfig) {
            setCache(APP_TOKENS_KEY, body.basicConfig.tokenConfig)
          }
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

    return {
      configs,
      auditData,
      auditModeEnabled,
      fetchConfigs,
      setDefaultAppSettings,
      fetchAuditData,
    }
  },
  {
    persist: true,
  },
)
