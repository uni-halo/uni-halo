import type { IAppConfig, IQuickNavItem } from '@/api/types/uni-halo'

/** getConfigs 默认值（键缺失即回退内置默认） */
export const DefaultAppConfigs: IAppConfig = {
  featureConfig: {
    profile: {},
    pages: {
      homeConfig: {
        useCategory: true,
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
    },
  },
  themeConfig: {},
}

/** 首页快捷导航内置默认项（插件端未配置/为空时回退，与插件端默认一致） */
export const DefaultQuickNavigation: IQuickNavItem[] = [
  { key: 'love', title: '恋爱日记', subTitle: '博主的恋爱日记', color: '#FF4C67', bgColor: '#FF4C6724', iconPrefix: 'uhemoji2-icon', icon: '-in-love', path: '/pages-blog/love/love', visible: true },
  { key: 'contact-blogger', title: '联系博主', subTitle: '博主常用联系方式', color: '#FF9800', bgColor: '#FF980024', iconPrefix: 'uhemoji2-icon', icon: '-wink', path: '/pages-blog/contact/contact', visible: true },
  { key: 'favorites', title: '我的收藏', subTitle: '笔记和瞬间收藏', color: '#FFB300', bgColor: '#FFB30024', iconPrefix: 'uhemoji2-icon', icon: '-smiling', path: '/pages-blog/favorites/favorites', visible: true },
  { key: 'friend-links', title: '友情链接', subTitle: '看看博主朋友们吧', color: '#009688', bgColor: '#00968824', iconPrefix: 'uhemoji2-icon', icon: '-cool', path: '/pages-blog/friend-links/friend-links', visible: true },
  { key: 'about', title: '关于项目', subTitle: '小莫唐尼的开源项目', color: '#607D8B', bgColor: '#607D8B24', iconPrefix: 'uhemoji2-icon', icon: '-happy-', path: '/pages-blog/about-project/about-project', visible: true },
]
