/**
 * 应用配置默认值(源自旧项目 config/index.js 的 DefaultAppConfigs)
 * 与 src/api/uni-halo.ts 的 getAppConfigs(plugin-uni-halo/getConfigs)配合,deepMerge 使用
 * 页面/组件依赖其字段结构(pluginConfig.toolsPlugin.Authorization 等),改动需谨慎
 * 2026-09-08 清理:与插件端 getConfigs 结构统一,移除已下线/无消费的默认字段
 * (tokenConfig/pageTitle/bannerConfig/categoryConfig.type 等)
 */
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
