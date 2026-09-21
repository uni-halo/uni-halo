export interface IAppSettings {
  /** 头像外观(square 方形=默认 / circle 圆形;插件端字段 avatarShape;应用于文章卡片 image_bottom 与瞬间卡片用户头像) */
  avatarShape: string
  /** 布局偏好(按页面分组,字段名 = 插件端 preferences 字段名,可直接消费 getConfigs) */
  homeListLayout: string
  homeCardType: string
  articlesListLayout: string
  articlesCardType: string
  archivesListLayout: string
  archivesCardType: string
  /** 分类笔记页布局偏好（插件端 preferences.categoryArticles*） */
  categoryArticlesListLayout: string
  categoryArticlesCardType: string
  /** 标签笔记页布局偏好（插件端 preferences.tagArticles*） */
  tagArticlesListLayout: string
  tagArticlesCardType: string
  /** 友情链接页展示偏好（插件端 preferences.linkPage） */
  linkPage?: {
    /** 小程序打开模式：fullscreen 全屏 / halfScreen 半屏 */
    miniProgramOpenMode?: string
  }
}

export const DefaultAppSettings: IAppSettings = {
  avatarShape: 'square',
  homeListLayout: 'single',
  homeCardType: 'image_top',
  articlesListLayout: 'single',
  articlesCardType: 'image_top',
  archivesListLayout: 'single',
  archivesCardType: 'image_top',
  categoryArticlesListLayout: 'single',
  categoryArticlesCardType: 'image_top',
  tagArticlesListLayout: 'single',
  tagArticlesCardType: 'image_top',
  linkPage: {
    miniProgramOpenMode: 'fullscreen',
  },
}
