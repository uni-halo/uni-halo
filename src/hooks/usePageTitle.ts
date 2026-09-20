import { computed } from 'vue'
import { useAppConfigStore } from '@/store/appConfig'

/** 全站页面标题（插件端「功能配置 → 页面设置 → 页面标题」配置） */
export type PageTitleKey =
	| 'home'
	| 'gallery'
	| 'category'
	| 'moments'
	| 'blogger'
	| 'articles'
	| 'archives'
	| 'postDetail'
	| 'categoryArticles'
	| 'tags'
	| 'tagArticles'
	| 'search'
	| 'favorites'
	| 'friendLinks'
	| 'notice'
	| 'noticeDetail'
	| 'votes'
	| 'voteDetail'
	| 'contact'
	| 'setting'
	| 'aboutProject'
	| 'disclaimers'
	| 'dataVisual'
	| 'login'
	| 'register'

/**
 * 页面标题（uh-navbar default-title）：
 * 读取插件端 pageConfig.titles[key]，留空回退传入的内置默认标题
 */
export function usePageTitle(key: PageTitleKey, fallback: string) {
	const appConfigStore = useAppConfigStore()
	return computed(() => {
		const title = appConfigStore.configs.featureConfig?.pages?.titles?.[key]
		return title?.trim() ? title : fallback
	})
}
