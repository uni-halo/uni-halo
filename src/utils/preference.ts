/**
 * 用户偏好「两层」基建(设计见插件仓库 .docs/config-system-v2-redesign.md §3-4)
 *
 * 两层语义:
 * - L0 站点默认:插件 getConfigs 下发(本模块把 getConfigs 中与偏好相关的字段收集为 Partial<IAppSettings>);
 * - L1-L 本地差异:storage 键 `uh_pref_local_v1`,只存与站点默认不同的字段(字段级覆盖,本地优先),
 *   值缺省/被删除即回退跟随站点默认;重置 = 删除本地差异。
 *
 * 读取优先级:本地差异 > 站点默认(L0) > 客户端内置默认(DefaultAppSettings)。
 */
import { DefaultAppSettings } from '@/config/appSettings'
import type { IAppSettings } from '@/config/appSettings'
import type { IAppConfig } from '@/api/types/uni-halo'
import { delCache, getCache, setCache } from '@/utils/storage'

/** 本地偏好差异存储 key(仅差异 JSON) */
export const LOCAL_PREFS_KEY = 'uh_pref_local_v1'
/** 旧版 setting store persist key(pinia-plugin-persistedstate 默认以 store id 为 key) */
export const LEGACY_SETTINGS_KEY = 'setting'

/** 深层可选类型(仅覆盖部分字段的差异) */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}

/** 本地偏好差异(只放与站点默认不同的字段) */
export type LocalPrefs = DeepPartial<IAppSettings>

/** 读取本地偏好差异(无则返回空对象) */
export function readLocalPrefs(): LocalPrefs {
  const prefs = getCache<LocalPrefs>(LOCAL_PREFS_KEY)
  return prefs && typeof prefs === 'object' ? prefs : {}
}

/** 整份覆盖写本地偏好差异(一般由 updateLocalPrefs 内部使用) */
function writeLocalPrefs(prefs: LocalPrefs): void {
  setCache(LOCAL_PREFS_KEY, prefs)
}

/**
 * 增量更新本地偏好差异(null 表示删除该键、回退跟随站点默认)
 * @param patch 仅包含被覆盖字段的差异;嵌套对象按 key 递归合并
 */
export function updateLocalPrefs(patch: LocalPrefs | null): void {
  if (patch === null) {
    clearLocalPrefs()
    return
  }
  writeLocalPrefs(mergePrefs(readLocalPrefs(), patch))
}

/** 删除本地偏好差异(重置 = 清本地,回退站点默认) */
export function clearLocalPrefs(): void {
  delCache(LOCAL_PREFS_KEY)
}

/**
 * 把 L0 站点默认(getConfigs 下发值)中与偏好相关的字段收集为本地差异形状的站点默认。
 * 偏好字段与 getConfigs 字段不完全同名,此处维护映射表:
 * - preferences.homeListLayout/homeCardType/articlesListLayout/articleCardType/
 *   archivesListLayout/archivesCardType(L0 additive 顶层键)→ layout.{home,articles,archives}.{listLayout,cardType};
 *   cardType 值为组件 layout 值(image_top/image_right/image_bottom/image_left),与设置页选项一致;
 * - preferences.avatarRadius → isAvatarRadius;
 * - pageConfig.homeConfig.bannerConfig → banner.useDot / dotPosition。
 */
export function collectSiteDefaults(configs: Partial<IAppConfig>): LocalPrefs {
  const result: LocalPrefs = {}

  // 站点级展示偏好默认(L0,GeneralConfig.preferences,2026-09-02 插件端新增)
  const preferences = configs.preferences
  if (preferences && typeof preferences === 'object') {
    const prefs = preferences as Record<string, unknown>
    /** 列表布局旧值归一化:h_row_col1/2 → single/double */
    const listLayoutOf = (v: unknown) => {
      if (typeof v !== 'string')
        return undefined
      return v === 'h_row_col2' ? 'double' : v === 'h_row_col1' ? 'single' : v
    }
    /** 页面布局:后端字段名(列表布局 + 卡片样式)→ 本地嵌套路径 */
    const setPage = (page: 'home' | 'articles' | 'archives', listKey: string, cardKey: string) => {
      const listValue = listLayoutOf(prefs[listKey])
      const cardValue = typeof prefs[cardKey] === 'string' ? prefs[cardKey] : undefined
      if (listValue === undefined && cardValue === undefined)
        return
      result.layout = {
        ...result.layout,
        [page]: {
          ...(listValue !== undefined ? { listLayout: listValue } : {}),
          ...(cardValue !== undefined ? { cardType: cardValue } : {}),
        },
      }
    }
    setPage('home', 'homeListLayout', 'homeCardType')
    setPage('articles', 'articlesListLayout', 'articleCardType')
    setPage('archives', 'archivesListLayout', 'archivesCardType')

    if (typeof prefs.avatarRadius === 'boolean') {
      result.isAvatarRadius = prefs.avatarRadius
    }
  }

  // 轮播渲染参数(L0):站点「显示指示器」→ 本地偏好 banner.useDot
  const bannerConfig = configs.pageConfig?.homeConfig?.bannerConfig
  if (bannerConfig && typeof bannerConfig === 'object') {
    result.banner = {
      useDot: bannerConfig.showIndicator,
      dotPosition: bannerConfig.dotPosition,
    }
  }

  // 预留:图库瀑布流 L0(galleryConfig.useWaterfall)随二期下发后在此补充

  return result
}

/**
 * 偏好解析合并:本地差异 > 站点默认 > 内置默认。
 * @param siteDefaults collectSiteDefaults 的结果(可空)
 * @param localPrefs readLocalPrefs 的结果(可空)
 */
export function mergeWithDefaults(
  siteDefaults?: LocalPrefs | null,
  localPrefs?: LocalPrefs | null,
): IAppSettings {
  const base = JSON.parse(JSON.stringify(DefaultAppSettings)) as IAppSettings
  const site = siteDefaults && typeof siteDefaults === 'object' ? siteDefaults : {}
  const local = localPrefs && typeof localPrefs === 'object' ? localPrefs : {}
  // base 已含完整默认结构,合并结果必然满足 IAppSettings
  return mergePrefs(mergePrefs(base, site), local) as IAppSettings
}

/**
 * 递归合并:target 为底,source 覆盖;source 中值为 null/undefined 的键删除(null 语义=跟随默认)
 * 数组等引用类型直接替换。对象用结构化克隆保证合并结果与 DefaultAppSettings 结构一致。
 */
function mergePrefs<T>(target: T, source: T): T {
  if (!isObject(source)) {
    return target
  }
  const output: Record<string, unknown> = isObject(target)
    ? { ...(target as Record<string, unknown>) }
    : {}
  const targetRecord = (target ?? {}) as Record<string, unknown>
  Object.keys(source as Record<string, unknown>).forEach((key) => {
    const sourceValue = (source as Record<string, unknown>)[key]
    if (sourceValue === null || sourceValue === undefined) {
      delete output[key]
      return
    }
    const targetValue = targetRecord[key]
    if (isObject(targetValue) && isObject(sourceValue)) {
      output[key] = mergePrefs(targetValue, sourceValue)
    }
    else {
      output[key] = sourceValue
    }
  })
  return output as T
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 旧版迁移:把旧 setting store persist 的全量本地设置(无 L0 时代)转为差异。
 * 规则:与 DefaultAppSettings 相同的键视为未覆盖(丢弃),不同键写入 uh_pref_local_v1。
 * 仅当新差异键不存在且旧键存在时执行一次;返回是否发生迁移。
 */
export function migrateLegacyLocalPrefs(): boolean {
  if (getCache<LocalPrefs>(LOCAL_PREFS_KEY)) {
    return false
  }
  const raw = uni.getStorageSync(LEGACY_SETTINGS_KEY)
  if (!raw) {
    return false
  }
  let legacy: { settings?: IAppSettings } | null = null
  try {
    legacy = typeof raw === 'string' ? JSON.parse(raw) : raw
  }
  catch {
    return false
  }
  const settings = legacy?.settings
  if (!settings || typeof settings !== 'object') {
    return false
  }
  const diff = diffFromDefaults(settings)
  writeLocalPrefs(diff)
  return true
}

/** 计算 settings 与 DefaultAppSettings 的差异(仅保留被用户改过的叶子字段) */
function diffFromDefaults(settings: IAppSettings): LocalPrefs {
  const diff: Record<string, unknown> = {}
  const defaultsRecord = DefaultAppSettings as unknown as Record<string, unknown>
  const settingsRecord = settings as unknown as Record<string, unknown>
  Object.keys(defaultsRecord).forEach((key) => {
    const defaultItem = defaultsRecord[key]
    const settingItem = settingsRecord[key]
    if (isObject(defaultItem) && isObject(settingItem)) {
      // 只保留与 default 不一致的嵌套键
      const result: Record<string, unknown> = {}
      Object.keys(defaultItem).forEach((nestedKey) => {
        const dv = defaultItem[nestedKey]
        const sv = settingItem[nestedKey]
        if (isObject(dv) && isObject(sv)) {
          const deep = diffFromDefaults({ ...dv, ...sv } as unknown as IAppSettings)
          if (Object.keys(deep).length > 0) {
            result[nestedKey] = deep
          }
        }
        else if (sv !== dv) {
          result[nestedKey] = sv
        }
      })
      if (Object.keys(result).length > 0) {
        diff[key] = result
      }
    }
    else if (settingItem !== undefined && settingItem !== defaultItem) {
      diff[key] = settingItem
    }
  })
  return diff as LocalPrefs
}

/** 判断某字段当前是否被本地差异覆盖(供设置页三态展示) */
export function isLocalOverride(localPrefs: LocalPrefs, path: string[]): boolean {
  let cursor: unknown = localPrefs
  for (const key of path) {
    if (cursor === null || cursor === undefined) {
      return false
    }
    cursor = (cursor as Record<string, unknown>)[key]
    if (cursor === undefined) {
      return false
    }
  }
  return true
}
