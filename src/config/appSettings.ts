export interface IAppSettings {
  /** 评论头像是否圆形（插件端字段 avatarRadius） */
  avatarRadius: boolean
  /** 布局偏好(按页面分组,字段名 = 插件端 preferences 字段名,可直接消费 getConfigs) */
  homeListLayout: string
  homeCardType: string
  articlesListLayout: string
  articleCardType: string
  archivesListLayout: string
  archivesCardType: string
  /** 友情链接页展示偏好（插件端 preferences.linkPage） */
  linkPage?: {
    /** 小程序打开模式：fullscreen 全屏 / halfScreen 半屏 */
    miniProgramOpenMode?: string
  }
}

export const DefaultAppSettings: IAppSettings = {
  avatarRadius: false,
  homeListLayout: 'single',
  homeCardType: 'image_top',
  articlesListLayout: 'double',
  articleCardType: 'image_top',
  archivesListLayout: 'single',
  archivesCardType: 'image_top',
  linkPage: {
    miniProgramOpenMode: 'fullscreen',
  },
}
