/**
 * 应用配置默认值(源自旧项目 config/index.js 的 DefaultAppConfigs)
 * 与 src/api/uni-halo.ts 的 getAppConfigs(plugin-uni-halo/getConfigs)配合,deepMerge 使用
 * 页面/组件依赖其字段结构(pluginConfig.toolsPlugin.Authorization 等),改动需谨慎
 */
import type { IAppConfig } from '@/api/types/uni-halo'

export const DefaultAppConfigs: IAppConfig = {
  basicConfig: {
    tokenConfig: {
      personalToken: '',
    },
  },
  loveConfig: {},
  imagesConfig: {},
  authorConfig: {},
  appConfig: {},
  pluginConfig: {
    votePlugin: {},
    toolsPlugin: {},
    linksPlugin: {},
    linksSubmitPlugin: {},
    doubanPlugin: {
      position: 'bottom',
    },
  },
  pageConfig: {
    homeConfig: {
      pageTitle: '首页',
      useCategory: true,
      bannerConfig: {
        enabled: true,
        showTitle: true,
        showIndicator: true,
        height: '400rpx',
        dotPosition: 'right',
        type: 'post',
        list: [],
      },
    },
    categoryConfig: {
      type: 'list',
    },
    momentConfig: {
      useTagRandomColor: true,
    },
  },
  auditConfig: {
    auditModeEnabled: false,
    auditModeData: {
      jsonUrl: '',
      jsonData: '',
    },
  },
}
