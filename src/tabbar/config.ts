import type { TabBar } from '@uni-helper/vite-plugin-uni-pages';
import type { CustomTabBarItem, NativeTabBarItem } from './types';

/**
 * tabbar 选择的策略，更详细的介绍见 tabbar.md 文件
 * 0: 'NO_TABBAR' `无 tabbar`
 * 1: 'NATIVE_TABBAR'  `原生 tabbar`
 * 2: 'CUSTOM_TABBAR' `自定义 tabbar`
 *
 * 温馨提示：本文件的任何代码更改了之后，都需要重新运行，否则 pages.json 不会更新导致配置不生效
 */
export const TABBAR_STRATEGY_MAP = {
	NO_TABBAR: 0,
	NATIVE_TABBAR: 1,
	CUSTOM_TABBAR: 2
};

// TODO: 1/3. 通过这里切换使用tabbar的策略
// 如果是使用 NO_TABBAR(0)，nativeTabbarList 和 customTabbarList 都不生效
// 如果是使用 NATIVE_TABBAR(1)，只需要配置 nativeTabbarList，customTabbarList 不生效
// 如果是使用 CUSTOM_TABBAR(2)，只需要配置 customTabbarList，nativeTabbarList 不生效
export const selectedTabbarStrategy = TABBAR_STRATEGY_MAP.CUSTOM_TABBAR;

// TODO: 2/3. 使用 NATIVE_TABBAR 时，更新下面的 tabbar 配置
export const nativeTabbarList: NativeTabBarItem[] = [
	{
		iconPath: 'static/tabbar/select_home.png',
		selectedIconPath: 'static/tabbar/select_home_active.png',
		pagePath: 'pages/tabbar/home/home',
		text: '%tabbar.home%'
	},
	{
		iconPath: 'static/tabbar/select_category.png',
		selectedIconPath: 'static/tabbar/select_category_active.png',
		pagePath: 'pages/tabbar/category/category',
		text: '%tabbar.category%'
	},
	{
		iconPath: 'static/tabbar/select_gallery.png',
		selectedIconPath: 'static/tabbar/select_gallery_active.png',
		pagePath: 'pages/tabbar/gallery/gallery',
		text: '%tabbar.gallery%'
	},
	{
		iconPath: 'static/tabbar/select_links.png',
		selectedIconPath: 'static/tabbar/select_links_active.png',
		pagePath: 'pages/tabbar/moments/moments',
		text: '%tabbar.moments%'
	},
	{
		iconPath: 'static/tabbar/select_mine.png',
		selectedIconPath: 'static/tabbar/select_mine_active.png',
		pagePath: 'pages/tabbar/about/about',
		text: '%tabbar.about%'
	}
];

// TODO: 3/3. 使用 CUSTOM_TABBAR 时，更新下面的 tabbar 配置
// 如果需要配置鼓包，需要在 'tabbar/store.ts' 里面设置，最后在 `tabbar/index.vue` 里面更改鼓包的图片
export const customTabbarList: CustomTabBarItem[] = [
	// {
	//   text: '%tabbar.home%',
	//   pagePath: 'pages/index/index',
	//   // 注意 unocss 图标需要如下处理：（二选一）
	//   // 1）在fg-tabbar.vue页面上引入一下并注释掉（见tabbar/index.vue代码第2行）
	//   // 2）配置到 unocss.config.ts 的 safelist 中
	//   iconType: 'unocss',
	//   icon: 'i-carbon-home',
	//   // badge: 'dot',
	// },
	// // 鼓包配置示例（2025-12-31）
	// // 中间鼓包tabbarItem配置：通常是扫描按钮、发布按钮、更多按钮等，点击触发业务逻辑
	// // {
	// //   pagePath: 'pages/me/me',
	// //   text: '我的',
	// //   // 1）在fg-tabbar.vue页面上引入一下并注释掉（见tabbar/index.vue代码第2行）
	// //   // 2）配置到 unocss.config.ts 的 safelist 中
	// //   iconType: 'image',
	// //   icon: '/static/tabbar/scan.png',
	// //   isBulge: true,
	// // },
	// {
	//   pagePath: 'pages/tabbar/home/home',
	//   text: '%tabbar.i18n%',
	//   iconType: 'unocss',
	//   icon: 'i-carbon-ibm-watson-language-translator',
	//   // badge: 10,
	// },
	// {
	//   pagePath: 'pages/tabbar/about/about',
	//   text: '%tabbar.about%',
	//   // 1）在fg-tabbar.vue页面上引入一下并注释掉（见tabbar/index.vue代码第2行）
	//   // 2）配置到 unocss.config.ts 的 safelist 中
	//   iconType: 'unocss',
	//   icon: 'i-carbon-menu',
	//   // badge: 10,
	//   roles: ['admin'],
	// },
	// {
	//   pagePath: 'pages/tabbar/moments/moments',
	//   text: '%tabbar.me%',
	//   iconType: 'unocss',
	//   icon: 'i-carbon-user',
	//   // badge: 10,
	// },

	// 其他类型演示
	// 1、uiLib
	// {
	//   pagePath: 'pages/index/index',
	//   text: '首页',
	//   iconType: 'uiLib',
	//   icon: 'home',
	// },
	// 2、iconfont
	// {
	//   pagePath: 'pages/index/index',
	//   text: '首页',
	//   // 注意 iconfont 图标需要额外加上 'iconfont'，如下
	//   iconType: 'iconfont',
	//   icon: 'iconfont icon-my',
	// },
	// 3、image
	// {
	//   pagePath: 'pages/index/index',
	//   text: '首页',
	//   // 使用 ‘image’时，需要配置 icon + iconActive 2张图片
	//   iconType: 'image',
	//   icon: '/static/tabbar/home.png',
	//   iconActive: '/static/tabbar/homeHL.png',
	// },
	{
		icon: '/static/tabbar/select_home.png',
		iconActive: '/static/tabbar/select_home_active.png',
		iconType: 'image',
		pagePath: 'pages/tabbar/home/home',
		text: '%tabbar.home%'
	},
	{
		icon: '/static/tabbar/select_category.png',
		iconActive: '/static/tabbar/select_category_active.png',
		iconType: 'image',
		pagePath: 'pages/tabbar/category/category',
		text: '%tabbar.category%'
	},

	{
		icon: '/static/tabbar/select_gallery.png',
		iconActive: '/static/tabbar/select_gallery_active.png',
		iconType: 'image',
		pagePath: 'pages/tabbar/gallery/gallery',
		text: '%tabbar.gallery%'
	},
	{
		icon: '/static/tabbar/select_links.png',
		iconActive: '/static/tabbar/select_links_active.png',
		iconType: 'image',
		pagePath: 'pages/tabbar/moments/moments',
		text: '%tabbar.moments%',
	},
	{
		icon: '/static/tabbar/select_mine.png',
		iconActive: '/static/tabbar/select_mine_active.png',
		iconType: 'image',
		pagePath: 'pages/tabbar/about/about',
		text: '%tabbar.about%'
	},

	// 搜索按钮
	// {
	// 	icon: 'search-line',
	// 	iconType: 'uiLib',
	// 	isRightButton: true,
	// 	pagePath: 'pages-blog/search/search',
	// 	text: '%tabbar.search%',
	// 	onClick: (item: CustomTabBarItem) => {
	// 		uni.navigateTo({
	// 			url: item.pagePath
	// 		});
	// 	}
	// }
];

/**
 * 是否启用 tabbar 缓存
 * NATIVE_TABBAR(1) 和 CUSTOM_TABBAR(2) 时，需要tabbar缓存
 */
export const tabbarCacheEnable = [TABBAR_STRATEGY_MAP.NATIVE_TABBAR, TABBAR_STRATEGY_MAP.CUSTOM_TABBAR].includes(selectedTabbarStrategy);

/**
 * 是否启用自定义 tabbar
 * CUSTOM_TABBAR(2) 时，启用自定义tabbar
 */
export const customTabbarEnable = [TABBAR_STRATEGY_MAP.CUSTOM_TABBAR].includes(selectedTabbarStrategy);

/**
 * 是否需要隐藏原生 tabbar
 * CUSTOM_TABBAR(2) 时，需要隐藏原生tabbar
 */
export const needHideNativeTabbar = selectedTabbarStrategy === TABBAR_STRATEGY_MAP.CUSTOM_TABBAR;

const _tabbarList = customTabbarEnable ? customTabbarList.filter((item) => !item.isRightButton).map((item) => ({ text: item.text, pagePath: item.pagePath })) : nativeTabbarList;
export const tabbarList = customTabbarEnable ? customTabbarList : nativeTabbarList;

// NATIVE_TABBAR(1) 时，显示原生Tabbar，在i18n的情况下需要 setTabbarItem (框架已经处理)
export const isNativeTabbar = selectedTabbarStrategy === TABBAR_STRATEGY_MAP.NATIVE_TABBAR;

const _tabbar: TabBar = {
	// 只有微信小程序支持 custom。App 和 H5 不生效
	custom: selectedTabbarStrategy === TABBAR_STRATEGY_MAP.CUSTOM_TABBAR,
	color: '#303133',
	selectedColor: '#03a9f4',
	backgroundColor: '#ffffff',
	borderStyle: 'white',
	// height: '50px',
	// fontSize: '10px',
	// iconWidth: '24px',
	// spacing: '3px',
	list: _tabbarList as unknown as TabBar['list']
};

export const tabBar = tabbarCacheEnable ? _tabbar : undefined;
