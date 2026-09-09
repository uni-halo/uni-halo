/**
 * 偏好设置展示行与交互(页面 setting.vue 与全局弹窗 uh-settings-popup 共用)
 * 收敛:字段定义(PrefDef/页面分组/布局/功能)、三态(跟随站点默认/已自定义/恢复默认)、
 * 行构建、选值交互。两个消费方不再各自重复定义。
 */
import { computed } from 'vue';
import { DefaultAppSettings } from '@/config/appSettings';
import { useSettingStore } from '@/store/setting';
import { isLocalOverride, readLocalPrefs } from '@/utils/preference';
import type { LocalPrefs } from '@/utils/preference';

/** 偏好字段定义 */
export interface PrefDef {
	key: string;
	label: string;
	kind: 'bool' | 'enum';
	path: string[];
	options?: { label: string; value: string }[];
	siteLabelOf?: (value: string) => string;
}

/** 布局设置按页面分组(每组:列表布局 + 卡片样式) */
export const PAGE_GROUPS = [
	{ key: 'home', label: '首页' },
	{ key: 'articles', label: '文章页面' },
	{ key: 'archives', label: '归档页面' }
];

/** 布局偏好字段(页面分组 × 列表布局/卡片样式) */
export const LAYOUT_PREFS: PrefDef[] = PAGE_GROUPS.flatMap((group) => [
	{
		key: `${group.key}ListLayout`,
		label: '列表布局',
		kind: 'enum',
		path: ['layout', group.key, 'listLayout'],
		options: [
			{ label: '单列', value: 'single' },
			{ label: '双列', value: 'double' }
		]
	},
	{
		key: `${group.key}CardType`,
		label: '卡片样式',
		kind: 'enum',
		path: ['layout', group.key, 'cardType'],
		options: [
			{ label: '上图下文', value: 'image_top' },
			{ label: '左文右图', value: 'image_right' },
			{ label: '上文下图', value: 'image_bottom' },
			{ label: '左图右文', value: 'image_left' }
		]
	}
]);

/** 功能偏好字段 */
export const FEATURE_PREFS: PrefDef[] = [{ key: 'isAvatarRadius', label: '是否圆形头像', kind: 'bool', path: ['isAvatarRadius'] }];

/** 顶部分段器(布局 / 功能) */
export const SETTING_TABS: { key: 'layout' | 'feature'; label: string }[] = [
	{ key: 'layout', label: '布局' },
	{ key: 'feature', label: '功能' }
];

export function usePreferenceRows() {
	const settingStore = useSettingStore();

	/* ---------------- 路径取值工具 ---------------- */
	function getByPath(obj: unknown, path: string[]): unknown {
		let cursor: unknown = obj;
		for (const key of path) {
			if (cursor === null || cursor === undefined) {
				return undefined;
			}
			cursor = (cursor as Record<string, unknown>)[key];
		}
		return cursor;
	}

	/** 按路径构造差异 patch(null 表示删除该键=跟随站点默认) */
	function buildPatch(path: string[], value: unknown): LocalPrefs {
		const [head, ...rest] = path;
		if (rest.length === 0) return { [head]: value } as LocalPrefs;
		return { [head]: buildPatch(rest, value) } as LocalPrefs;
	}

	/* ---------------- 状态读取 ---------------- */
	function prefValueOf(path: string[]): unknown {
		return getByPath(settingStore.settings, path);
	}

	/** 站点默认值(未配置时回退内置默认) */
	function siteDefaultOf(path: string[]): unknown {
		const site = getByPath(settingStore.siteDefaults, path);
		if (site !== undefined && site !== null) return site;
		return getByPath(DefaultAppSettings, path);
	}

	function isOverridden(path: string[]): boolean {
		return isLocalOverride(readLocalPrefs(), path);
	}

	function enumLabelOf(def: PrefDef, value: unknown): string {
		const hit = def.options?.find((opt) => opt.value === value);
		if (hit) return hit.label;
		if (def.siteLabelOf && typeof value === 'string') return def.siteLabelOf(value);
		return value === undefined || value === null ? '—' : String(value);
	}

	/* ---------------- 展示行(预计算,避免模板渲染期函数调用) ---------------- */
	interface PrefRow extends PrefDef {
		displayValue: string;
		following: boolean;
		/** 仅 kind==='bool' 使用 */
		boolValue: boolean;
	}

	function buildRows(defs: PrefDef[]): PrefRow[] {
		return defs.map((def) => ({
			...def,
			displayValue: enumLabelOf(def, prefValueOf(def.path)),
			following: isFollowing(def.path),
			boolValue: def.kind === 'bool' ? prefValueOf(def.path) === true : false
		}));
	}

	const layoutRows = computed(() => buildRows(LAYOUT_PREFS));
	const featureRows = computed(() => buildRows(FEATURE_PREFS));

	/** 布局设置按页面分组的展示行 */
	const layoutGroups = computed(() =>
		PAGE_GROUPS.map((group) => ({
			key: group.key,
			label: group.label,
			rows: layoutRows.value.filter((row) => row.path[1] === group.key)
		}))
	);

	/** 当前项是否处于「跟随站点默认」(本地未覆盖) */
	function isFollowing(path: string[]): boolean {
		return !isOverridden(path);
	}

	/** 单项还原为跟随站点默认 */
	function handleRevert(path: string[]): void {
		settingStore.savePreference(buildPatch(path, null));
	}

	/** 开关类:选值等于站点默认则还原为跟随(只存差异) */
	function handleBoolChange(path: string[], next: boolean): void {
		settingStore.savePreference(buildPatch(path, next));
	}

	/** 给定页面分组下字段路径,判断该页面列表布局是否为双列 */
	function isDoubleColumn(path: string[]): boolean {
		if (path.length >= 2 && path[0] === 'layout') {
			return prefValueOf(['layout', path[1], 'listLayout']) === 'double';
		}
		return false;
	}

	/** 卡片样式选项是否因双列约束被禁用(双列仅允许 image_top) */
	function isCardTypeOptionDisabled(path: string[], value: string): boolean {
		return path[2] === 'cardType' && isDoubleColumn(path) && value !== 'image_top';
	}

	function handleChoose(path: string[], value: string | null): void {
		if (value === null) {
			handleRevert(path);
		} else {
			settingStore.savePreference(buildPatch(path, value));
			// 双列约束:列表布局改为双列时,卡片样式强制为 image_top
			if (path[0] === 'layout' && path[2] === 'listLayout' && value === 'double') {
				const cardTypePath = ['layout', path[1], 'cardType'];
				if (prefValueOf(cardTypePath) !== 'image_top') {
					settingStore.savePreference(buildPatch(cardTypePath, 'image_top'));
				}
			}
		}
	}

	return {
		settingStore,
		PAGE_GROUPS,
		SETTING_TABS,
		getByPath,
		buildPatch,
		prefValueOf,
		siteDefaultOf,
		isOverridden,
		enumLabelOf,
		buildRows,
		layoutRows,
		featureRows,
		layoutGroups,
		isFollowing,
		handleRevert,
		handleBoolChange,
		handleChoose,
		isDoubleColumn,
		isCardTypeOptionDisabled
	};
}
