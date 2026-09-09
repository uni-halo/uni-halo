import type { IAppConfig } from '@/api/types/uni-halo'

export const DefaultAppConfigs: IAppConfig = {
  basicConfig: {},
  loveConfig: {},
  imagesConfig: {},
  authorConfig: {},
  appConfig: {},
  pluginConfig: {
    votePlugin: {},
    toolsPlugin: {},
    linksPlugin: {},
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
  },
  auditConfig: {
    auditModeEnabled: false,
  },
}
