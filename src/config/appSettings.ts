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
}

export const DefaultAppSettings: IAppSettings = {
  avatarRadius: false,
  homeListLayout: 'single',
  homeCardType: 'image_top',
  articlesListLayout: 'double',
  articleCardType: 'image_top',
  archivesListLayout: 'single',
  archivesCardType: 'image_top',
}
