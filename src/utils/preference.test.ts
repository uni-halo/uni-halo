import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DefaultAppSettings } from '@/config/appSettings'
import type { IAppSettings } from '@/config/appSettings'
import {
  LOCAL_PREFS_KEY,
  clearLocalPrefs,
  collectSiteDefaults,
  isLocalOverride,
  mergeWithDefaults,
  migrateLegacyLocalPrefs,
  readLocalPrefs,
  updateLocalPrefs,
} from './preference'

/** 内存版 uni storage(与 utils/storage 的 {data,time,expire} 包装配合) */
const mem = new Map<string, string>()

function setupUniStorageMock() {
  vi.mocked(uni.getStorageSync).mockImplementation((key: string) => mem.get(key) ?? null)
  vi.mocked(uni.setStorageSync).mockImplementation((key: string, val: unknown) => {
    mem.set(key, val as string)
  })
  vi.mocked(uni.removeStorageSync).mockImplementation((key: string) => {
    mem.delete(key)
  })
}

describe('preference 基础读写', () => {
  beforeEach(() => {
    mem.clear()
    setupUniStorageMock()
  })

  it('readLocalPrefs：无数据时返回空对象', () => {
    expect(readLocalPrefs()).toEqual({})
  })

  it('updateLocalPrefs：嵌套字段增量合并', () => {
    updateLocalPrefs({ layout: { home: { listLayout: 'double' } } })
    updateLocalPrefs({ layout: { home: { cardType: 'image_bottom' } } })
    expect(readLocalPrefs()).toEqual({
      layout: { home: { listLayout: 'double', cardType: 'image_bottom' } },
    })
  })

  it('updateLocalPrefs：null 删除该键(回退跟随站点默认)', () => {
    updateLocalPrefs({ layout: { home: { listLayout: 'double', cardType: 'image_bottom' } } })
    updateLocalPrefs({ layout: { home: null } })
    expect(readLocalPrefs()).toEqual({ layout: {} })
  })

  it('updateLocalPrefs(null)：整体清空差异', () => {
    updateLocalPrefs({ layout: { home: { listLayout: 'double' } } })
    updateLocalPrefs(null)
    expect(readLocalPrefs()).toEqual({})
    expect(mem.has(LOCAL_PREFS_KEY)).toBe(false)
  })

  it('clearLocalPrefs：删除存储键', () => {
    updateLocalPrefs({ layout: { home: { listLayout: 'double' } } })
    clearLocalPrefs()
    expect(readLocalPrefs()).toEqual({})
  })

  it('isLocalOverride：按路径判断是否被本地覆盖', () => {
    updateLocalPrefs({ gallery: { useWaterfull: false } })
    expect(isLocalOverride(readLocalPrefs(), ['gallery', 'useWaterfull'])).toBe(true)
    expect(isLocalOverride(readLocalPrefs(), ['banner', 'useDot'])).toBe(false)
  })
})

describe('mergeWithDefaults / collectSiteDefaults', () => {
  it('默认值兜底：无站点默认无本地差异时等于内置默认', () => {
    expect(mergeWithDefaults()).toEqual(DefaultAppSettings)
  })

  it('本地优先于站点默认，站点默认优先于内置默认', () => {
    const merged = mergeWithDefaults(
      { layout: { home: { listLayout: 'single' } }, gallery: { useWaterfull: true } },
      { layout: { home: { listLayout: 'double' } } },
    )
    expect(merged.layout.home.listLayout).toBe('double')
    expect(merged.gallery.useWaterfull).toBe(true)
    expect(merged.isAvatarRadius).toBe(DefaultAppSettings.isAvatarRadius)
  })

  it('collectSiteDefaults：banner 站点默认映射(showIndicator→useDot)', () => {
    const site = collectSiteDefaults({
      pageConfig: {
        homeConfig: {
          bannerConfig: { showIndicator: false, dotPosition: 'bottom' },
        },
      },
    })
    expect(site.banner).toEqual({ useDot: false, dotPosition: 'bottom' })
  })

  it('collectSiteDefaults：preferences(L0)映射到 layout 页面分组/isAvatarRadius', () => {
    const site = collectSiteDefaults({
      preferences: {
        homeListLayout: 'h_row_col2',
        homeCardType: 'image_bottom',
        articlesListLayout: 'single',
        articleCardType: 'image_left',
        archivesCardType: 'image_top',
        avatarRadius: true,
      },
    })
    expect(site.layout).toEqual({
      home: { listLayout: 'double', cardType: 'image_bottom' },
      articles: { listLayout: 'single', cardType: 'image_left' },
      archives: { cardType: 'image_top' },
    })
    expect(site.isAvatarRadius).toBe(true)
  })

  it('preferences L0 参与合并,本地未覆盖时跟随站点默认', () => {
    const site = collectSiteDefaults({
      preferences: {
        homeListLayout: 'h_row_col2',
        articleCardType: 'image_bottom',
        avatarRadius: true,
      },
    })
    const merged = mergeWithDefaults(site, {})
    expect(merged.layout.home.listLayout).toBe('double')
    expect(merged.layout.articles.cardType).toBe('image_bottom')
    expect(merged.isAvatarRadius).toBe(true)
  })

  it('preferences L0 可被本地差异覆盖,重置后回退站点默认', () => {
    const site = collectSiteDefaults({
      preferences: {
        homeListLayout: 'h_row_col2',
        articleCardType: 'image_bottom',
        avatarRadius: true,
      },
    })
    const merged = mergeWithDefaults(site, { layout: { home: { listLayout: 'single' } }, isAvatarRadius: false })
    expect(merged.layout.home.listLayout).toBe('single')
    expect(merged.layout.articles.cardType).toBe('image_bottom')
    expect(merged.isAvatarRadius).toBe(false)
  })

  it('站点 banner 默认参与合并,本地未覆盖时跟随站点默认', () => {
    const site = collectSiteDefaults({
      pageConfig: {
        homeConfig: {
          bannerConfig: { showIndicator: false, dotPosition: 'bottom' },
        },
      },
    })
    const merged = mergeWithDefaults(site, {})
    expect(merged.banner.useDot).toBe(false)
    expect(merged.banner.dotPosition).toBe('bottom')
    expect(merged.layout.home.listLayout).toBe(DefaultAppSettings.layout.home.listLayout)
  })

  it('未知枚举值不回退抛错(跟随默认)', () => {
    const merged = mergeWithDefaults({}, { layout: { home: { listLayout: 'not-exist' } } })
    expect(merged.layout.home.listLayout).toBe('not-exist')
  })
})

describe('migrateLegacyLocalPrefs', () => {
  beforeEach(() => {
    mem.clear()
    setupUniStorageMock()
  })

  it('旧 persist 存在时仅迁移被改过的叶子字段', () => {
    const legacySettings: IAppSettings = JSON.parse(JSON.stringify(DefaultAppSettings))
    // 旧结构 layout.home 为 string(列表布局),类型上绕过新结构约束
    ;(legacySettings.layout as unknown as Record<string, unknown>).home = 'h_row_col2'
    legacySettings.gallery.useWaterfull = false
    mem.set('setting', JSON.stringify({ settings: legacySettings }))

    expect(migrateLegacyLocalPrefs()).toBe(true)
    expect(readLocalPrefs()).toEqual({
      layout: { home: 'h_row_col2' },
      gallery: { useWaterfull: false },
    })
  })

  it('已存在新差异键时不再重复迁移', () => {
    updateLocalPrefs({ layout: { home: { listLayout: 'single' } } })
    const legacySettings = JSON.parse(JSON.stringify(DefaultAppSettings)) as IAppSettings
    ;(legacySettings.layout as unknown as Record<string, unknown>).home = 'h_row_col2'
    mem.set('setting', JSON.stringify({ settings: legacySettings }))

    expect(migrateLegacyLocalPrefs()).toBe(false)
    expect(readLocalPrefs()).toEqual({ layout: { home: { listLayout: 'single' } } })
  })

  it('无旧键或格式异常时返回 false 且不写新键', () => {
    expect(migrateLegacyLocalPrefs()).toBe(false)
    mem.set('setting', 'not-json{')
    expect(migrateLegacyLocalPrefs()).toBe(false)
    expect(mem.has(LOCAL_PREFS_KEY)).toBe(false)
  })
})
