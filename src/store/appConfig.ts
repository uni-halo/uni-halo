/**
 * 应用配置 store(源自旧项目 store/config.js 的 configs/mockJson 部分)
 * 注意:旧 fetchConfigs 中会把 basicConfig.tokenConfig 写入缓存,供 getPersonalToken 使用,此处保留
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getAppConfigs } from '@/api/uni-halo'
import { DefaultAppConfigs } from '@/config/appConfig'
import { deepMerge } from '@/utils/merge'
import { setCache } from '@/utils/storage'
import { checkUrl } from '@/utils/url'
import type { IAppConfig, IMockJson } from '@/api/types/uni-halo'

/** 个人令牌存储 key(与 src/store/token.ts 的 getPersonalToken 保持一致) */
const APP_TOKENS_KEY = 'APP_TOKENS'

export const useAppConfigStore = defineStore(
  'appConfig',
  () => {
    const configs = ref<IAppConfig>(JSON.parse(JSON.stringify(DefaultAppConfigs)))
    const mockJson = ref<IMockJson>({})

    /** 重置为默认配置 */
    const setDefaultAppSettings = () => {
      configs.value = JSON.parse(JSON.stringify(DefaultAppConfigs))
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

    /** 请求模拟数据(审计模式) */
    const fetchMockJson = async () => {
      const mockJsonUrl = checkUrl(configs.value.auditConfig?.auditModeData?.jsonUrl)
      return new Promise<{ ok: boolean, data: unknown }>((resolve) => {
        uni.request({
          url: mockJsonUrl,
          method: 'GET',
          success: (res) => {
            mockJson.value = res.data as IMockJson
            resolve({ ok: true, data: res.data })
          },
          fail: (err) => {
            resolve({ ok: false, data: err })
          },
        })
      })
    }

    /** 设置模拟数据(jsonData 本地解析场景) */
    const setMockJson = (data: IMockJson) => {
      mockJson.value = data
    }

    return {
      configs,
      mockJson,
      fetchConfigs,
      setDefaultAppSettings,
      fetchMockJson,
      setMockJson,
    }
  },
  {
    persist: true,
  },
)
