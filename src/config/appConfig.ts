import type { IAppConfig } from '@/api/types/uni-halo'

/** getConfigs 默认值（键缺失即回退内置默认） */
export const DefaultAppConfigs: IAppConfig = {
  featureConfig: {
    profile: {},
    pages: {
      home: {
        useCategory: true,
      },
    },
    assets: {},
    preferences: {},
    love: {},
    linkInfo: {},
  },
  safetyConfig: {},
  /** 平台接入（当前暂无插件，保留结构供后续接入） */
  integrationConfig: {
    pluginConfig: {},
  },
  themeConfig: {},
}
