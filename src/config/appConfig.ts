import type { IAppConfig } from '@/api/types/uni-halo'

export const DefaultAppConfigs: IAppConfig = {
  basicConfig: {},
  loveConfig: {},
  imagesConfig: {},
  authorConfig: {},
  appConfig: {},
  pluginConfig: {
    toolsPlugin: {},
    doubanPlugin: {
      position: 'bottom',
    },
  },
  pageConfig: {
    homeConfig: {
      useCategory: true,
    },
    categoryConfig: {},
    momentConfig: {
      useTagRandomColor: true,
    },
    loveDiaryConfig: {},
  },
  auditConfig: {
    auditModeEnabled: false,
  },
}
