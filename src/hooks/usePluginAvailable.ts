/**
 * 插件清单与可用性 hook
 * 提供:
 * - 依赖插件 ID 常量(NeedPluginIds)与插件清单(NeedPlugins)
 * - 底层可用性检查(checkNeedPluginAvailable)
 * - 响应式 hook(usePluginAvailable):available 状态 + check 校验函数,页面免 import 直接调用
 *   (auto-import 已配置 src/hooks,无需手写 import)
 *
 * @example
 * const { available, check } = usePluginAvailable('plugin-vote')
 * onLoad(async () => {
 *   await check()
 *   if (!available.value) return
 *   handleGetData()
 * })
 */
import { ref } from 'vue';
import { checkPluginAvailable } from '@/api/halo';
import { checkUrl } from '@/utils/url';

/** 依赖插件 ID 常量 */
export const NeedPluginIds = Object.freeze({
	PluginUniHalo: 'plugin-uni-halo',
	PluginPhotos: 'PluginPhotos',
	PluginLinks: 'PluginLinks',
	PluginMoments: 'PluginMoments',
	PluginSearchWidget: 'PluginSearchWidget',
	PluginCommentWidget: 'PluginCommentWidget',
	PluginVote: 'vote',
	PluginDataStatistics: 'data-statistics'
});

interface IPluginAvailableOption {
	pluginId: string;
	// 用于提示用户插件未安装或未启用时显示的提示信息
	tips?: string;
	// 是否直接隐藏UI，不显示 uh-plugin-unavailable 组件
	hideUI?: boolean;
	// 是否默认启用插件
	initalAvailable?: boolean;
	// 检查完成后的回调函数
	callback?: (available: boolean) => void;
}

export interface IPluginInfo {
	id: string;
	name: string;
	desc: string;
	logo: string;
	url: string;
}

/** 依赖插件清单 */
export const NeedPlugins = new Map<string, IPluginInfo>([
	[
		NeedPluginIds.PluginUniHalo,
		{
			id: 'plugin-uni-halo',
			name: 'UniHalo配置',
			desc: 'uni-halo 核心插件，未安装和启用的情况下，将无法使用 uni-halo，请检查是否已安装和启用',
			logo: checkUrl('/plugins/plugin-uni-halo/assets/logo.png'),
			url: 'https://www.halo.run/store/apps/app-ryemX'
		}
	],
	[
		NeedPluginIds.PluginPhotos,
		{
			id: 'PluginPhotos',
			name: '图库管理',
			desc: '图库功能模块所需要的插件',
			logo: checkUrl('/plugins/PluginPhotos/assets/logo.svg'),
			url: 'https://www.halo.run/store/apps/app-BmQJW'
		}
	],
	[
		NeedPluginIds.PluginLinks,
		{
			id: 'PluginLinks',
			name: '链接管理',
			desc: '链接管理模块，用于网站友情链接功能模块',
			logo: checkUrl('/plugins/PluginLinks/assets/logo.svg'),
			url: 'https://www.halo.run/store/apps/app-hfbQg'
		}
	],
	[
		NeedPluginIds.PluginMoments,
		{
			id: 'PluginMoments',
			name: '瞬间',
			desc: '提供一个轻量级的内容图文、视频、音频等内容展示',
			logo: checkUrl('/plugins/PluginMoments/assets/logo.svg'),
			url: 'https://www.halo.run/store/apps/app-SnwWD'
		}
	],
	[
		NeedPluginIds.PluginSearchWidget,
		{
			id: 'PluginSearchWidget',
			name: '搜索组件',
			desc: '为应用提供统一的搜索组件',
			logo: checkUrl('/plugins/PluginSearchWidget/assets/logo.svg'),
			url: 'https://www.halo.run/store/apps/app-DlacW'
		}
	],
	[
		NeedPluginIds.PluginCommentWidget,
		{
			id: 'PluginCommentWidget',
			name: '评论组件',
			desc: '为用户前台提供完整的评论解决方案',
			logo: checkUrl('/plugins/PluginCommentWidget/assets/logo.svg'),
			url: 'https://www.halo.run/store/apps/app-YXyaD'
		}
	],
	[
		NeedPluginIds.PluginVote,
		{
			id: 'vote',
			name: '投票管理',
			desc: '投票模块所需要的插件，用于展示投票和提交投票',
			logo: checkUrl('/plugins/vote/assets/logo.png'),
			url: 'https://www.halo.run/store/apps/app-veyvzyhv'
		}
	],
	[
		NeedPluginIds.PluginDataStatistics,
		{
			id: 'data-statistics',
			name: '数据看板',
			desc: '为 Halo2 提供强大的数据可视化统计功能，支持 Umami 流量统计、uptime、网站内部数据图表（标签、分类、文章趋势、评论排行、热门文章等）',
			logo: checkUrl('/plugins/data-statistics/assets/logo.svg'),
			url: 'https://www.halo.run/store/apps/app-rtnbbgfk'
		}
	]
]);

export function usePluginAvailable(option: IPluginAvailableOption) {
	const { pluginId, callback, tips = '功能正在开发中...', initalAvailable = false } = option;
	const checking = ref(false);
	const available = ref(initalAvailable ?? false);

	/**
	 * 检查插件是否启用、安装
	 */
	function check(): Promise<boolean> {
		return new Promise<boolean>(async (resolve) => {
			try {
				checking.value = true;
				const result = await checkPluginAvailable(pluginId);
				console.log(`检查插件 ${pluginId} 可用性成功`, result);
				available.value = result.data;
				resolve(result.data);
			} catch (err) {
				console.error(`检查插件 ${pluginId} 可用性失败`, err);
				available.value = false;
				resolve(false);
			} finally {
				typeof callback === 'function' && callback(available.value);
				checking.value = false;
			}
		});
	}

	return { pluginId, tips, checking, available, check };
}
