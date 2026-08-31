/**
 * 应用设置 store(源自旧项目 store/setting.js)
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { DefaultAppSettings } from '@/config/appSettings'
import type { IAppSettings } from '@/config/appSettings'

export const useSettingStore = defineStore(
  'setting',
  () => {
    const settings = ref<IAppSettings>(JSON.parse(JSON.stringify(DefaultAppSettings)))

    /** 重置为默认设置 */
    const updateDefaultAppSettings = () => {
      settings.value = JSON.parse(JSON.stringify(DefaultAppSettings))
    }

    /** 检查并设置默认设置(启动时调用,persist 已保证有值,兜底处理) */
    const checkAndSetDefaultAppSettings = () => {
      if (!settings.value) {
        settings.value = JSON.parse(JSON.stringify(DefaultAppSettings))
      }
    }

    return {
      settings,
      updateDefaultAppSettings,
      checkAndSetDefaultAppSettings,
    }
  },
  {
    persist: true,
  },
)
