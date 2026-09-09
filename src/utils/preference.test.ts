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

  it('updateLocalPrefs：字段增量合并(顶层插件字段名,无嵌套)', () => {
    updateLocalPrefs({ homeListLayout: 'double' })
    updateLocalPrefs({ homeCardType: 'image_bottom' })
    expect(readLocalPrefs()).toEqual({
      homeListLayout: 'double',
      homeCardType: 'image_bottom',
    })
  })

  it('updateLocalPrefs：null 删除该键(回退跟随站点默认)', () => {
    updateLocalPrefs({ homeListLayout: 'double', homeCardType: 'image_bottom' })
    updateLocalPrefs({ homeListLayout: null })
    expect(readLocalPrefs()).toEqual({ homeCardType: 'image_bottom' })
  })

  it('updateLocalPrefs(null)：整体清空差异', () => {
    updateLocalPrefs({ homeListLayout: 'double' })
    updateLocalPrefs(null)
    expect(readLocalPrefs()).toEqual({})
    expect(mem.has(LOCAL_PREFS_KEY)).toBe(false)
  })

  it('clearLocalPrefs：删除存储键', () => {
    updateLocalPrefs({ homeListLayout: 'double' })
    clearLocalPrefs()
    expect(readLocalPrefs()).toEqual({})
  })

  it('isLocalOverride：按路径判断是否被本地覆盖', () => {
    updateLocalPrefs({ homeListLayout: 'double' })
    expect(isLocalOverride(readLocalPrefs(), ['homeListLayout'])).toBe(true)
    expect(isLocalOverride(readLocalPrefs(), ['homeCardType'])).toBe(false)
  })
})

describe('mergeWithDefaults / collectSiteDefaults', () => {
  it('默认值兜底：无站点默认无本地差异时等于内置默认', () => {
    expect(mergeWithDefaults()).toEqual(DefaultAppSettings)
  })

  it('本地优先于站点默认，站点默认优先于内置默认', () => {
    const merged = mergeWithDefaults(
      { homeListLayout: 'single' },
      { homeListLayout: 'double' },
    )
    expect(merged.homeListLayout).toBe('double')
    expect(merged.avatarRadius).toBe(DefaultAppSettings.avatarRadius)
  })

  it('collectSiteDefaults：preferences(L0)同名字段透传(含旧值归一化)', () => {
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
    expect(site.homeListLayout).toBe('double')
    expect(site.homeCardType).toBe('image_bottom')
    expect(site.articlesListLayout).toBe('single')
    expect(site.articleCardType).toBe('image_left')
    expect(site.archivesCardType).toBe('image_top')
    expect(site.avatarRadius).toBe(true)
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
    expect(merged.homeListLayout).toBe('double')
    expect(merged.articleCardType).toBe('image_bottom')
    expect(merged.avatarRadius).toBe(true)
  })

  it('preferences L0 可被本地差异覆盖,重置后回退站点默认', () => {
    const site = collectSiteDefaults({
      preferences: {
        homeListLayout: 'h_row_col2',
        articleCardType: 'image_bottom',
        avatarRadius: true,
      },
    })
    const merged = mergeWithDefaults(site, { homeListLayout: 'single', avatarRadius: false })
    expect(merged.homeListLayout).toBe('single')
    expect(merged.articleCardType).toBe('image_bottom')
    expect(merged.avatarRadius).toBe(false)
  })

  it('未知枚举值不回退抛错(跟随默认)', () => {
    const merged = mergeWithDefaults({}, { homeListLayout: 'not-exist' })
    expect(merged.homeListLayout).toBe('not-exist')
  })
})

describe('migrateLegacyLocalPrefs', () => {
  beforeEach(() => {
    mem.clear()
    setupUniStorageMock()
  })

  it('旧 persist 存在时仅迁移与新默认结构可对比的叶子字段(旧 layout 嵌套字段不迁移)', () => {
    // 旧结构 layout.home 为 string(列表布局),类型上绕过新结构约束模拟旧数据
    const legacySettings = JSON.parse(JSON.stringify(DefaultAppSettings)) as IAppSettings & {
      layout?: unknown
    }
    legacySettings.layout = { home: 'h_row_col2' }
    legacySettings.avatarRadius = true
    mem.set('setting', JSON.stringify({ settings: legacySettings }))

    expect(migrateLegacyLocalPrefs()).toBe(true)
    expect(readLocalPrefs()).toEqual({
      avatarRadius: true,
    })
  })

  it('已存在新差异键时不再重复迁移', () => {
    updateLocalPrefs({ homeListLayout: 'single' })
    const legacySettings = JSON.parse(JSON.stringify(DefaultAppSettings)) as IAppSettings & {
      layout?: unknown
    }
    legacySettings.layout = { home: 'h_row_col2' }
    mem.set('setting', JSON.stringify({ settings: legacySettings }))

    expect(migrateLegacyLocalPrefs()).toBe(false)
    expect(readLocalPrefs()).toEqual({ homeListLayout: 'single' })
  })

  it('无旧键或格式异常时返回 false 且不写新键', () => {
    expect(migrateLegacyLocalPrefs()).toBe(false)
    mem.set('setting', 'not-json{')
    expect(migrateLegacyLocalPrefs()).toBe(false)
    expect(mem.has(LOCAL_PREFS_KEY)).toBe(false)
  })
})
