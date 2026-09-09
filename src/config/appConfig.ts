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
    // 保留:友链提交授权头(pluginConfig.linksSubmitPlugin.Authorization)与站点信息展示仍读取
    linksSubmitPlugin: {},
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
