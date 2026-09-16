import type { IAppConfig } from '@/api/types/uni-halo'

/** getConfigs 默认值（键缺失即回退内置默认） */
export const DefaultAppConfigs: IAppConfig = {
  featureConfig: {
    profile: {},
    pages: {
      homeConfig: {
        useCategory: true,
      },
      categoryConfig: {},
      momentConfig: {
        useTagRandomColor: true,
      },
    },
    assets: {},
    preferences: {},
    love: {},
    linkInfo: {},
  },
  safetyConfig: {},
  integrationConfig: {
    pluginConfig: {
      toolsPlugin: {},
      doubanPlugin: {
        position: 'bottom',
      },
    },
  },
  themeConfig: {},
}
