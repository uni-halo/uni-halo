/**
 * 应用设置默认值与类型(源自旧项目 utils/app.js 的 _DefaultAppSettings)
 * 布局偏好字段命名与插件端 getConfigs.preferences 一致(2026-09-08 起去映射,以插件端字段为准)
 * 2026-09-08 清理:banner/ad/gallery/links/about/article/contact 等无消费字段已移除,
 * 仅保留偏好相关字段(与插件端 preferences 结构对齐)
 */

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
