/**
 * Halo 全局配置 store
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getHaloGlobalInfo } from '@/api/uni-halo'
import { DefaultHaloGlobalConfigs } from '@/config/haloGlobal'
import { deepMerge } from '@/utils/merge'
import type { IHaloGlobalConfig } from '@/api/types/uni-halo'

export const useHaloStore = defineStore(
  'halo',
  () => {
    const haloConfig = ref<IHaloGlobalConfig>({ ...DefaultHaloGlobalConfigs })

    /** 重置为默认配置 */
    const setDefaultHaloGlobalConfigs = () => {
      haloConfig.value = JSON.parse(JSON.stringify(DefaultHaloGlobalConfigs))
    }

    /** 获取 Halo 全局配置(请求失败回退默认值) */
    const fetchHaloConfigs = async () => {
      try {
        const res = await getHaloGlobalInfo()
        const body = res.data as IHaloGlobalConfig | undefined
        if (body) {
          haloConfig.value = deepMerge({ ...DefaultHaloGlobalConfigs }, body)
          return body
        }
        setDefaultHaloGlobalConfigs()
        return null
      }
      catch {
        setDefaultHaloGlobalConfigs()
        return null
      }
    }

    return {
      haloConfig,
      fetchHaloConfigs,
      setDefaultHaloGlobalConfigs,
    }
  },
  {
    persist: true,
  },
)
