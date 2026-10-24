/**
 * 我的装扮组合式状态
 * 持有库存/佩戴草稿/保存与开关操作,供头部预览与装扮面板共用
 */
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import {
  getDecorationMetadata,
  getMyDecorationInventory,
  getMyDecorationProfile,
  saveMyDecorationProfile,
  saveMyDecorationVisibility,
} from '@/api/halo-plugin-third/interaction-plus-uc'
import type { IDecorationRarity } from '@/api/halo-plugin-third/interaction-plus-uc'
import type { DecorationType, IIdentityMark } from '@/api/types/halo-plugin-third/interaction-plus'
import { useIdentityStore } from '@/store/identity'
import { useUserStore } from '@/store/user'
import { checkImageUrl } from '@/utils/url'
import type {
  IDecorationInventoryItem,
  IDecorationProfileView,
} from '@/api/types/halo-plugin-third/interaction-plus-uc'

/** 装扮槽位 key(对应佩戴视图字段) */
export type DecorationSlotKey
  = | 'avatarFrame'
    | 'title'
    | 'primaryBadge'
    | 'badgeShowcase'
    | 'cardBackground'
    | 'nameStyle'

/** 槽位定义 */
export interface IDecorationSlotDef {
  key: DecorationSlotKey
  label: string
  type: DecorationType
  /** 多选槽(展示勋章) */
  multiple?: boolean
}

/** 六个佩戴槽位 */
export const DECORATION_SLOTS: IDecorationSlotDef[] = [
  { key: 'avatarFrame', label: '头像框', type: 'avatar_frame' },
  { key: 'title', label: '称号', type: 'title' },
  { key: 'primaryBadge', label: '主勋章', type: 'badge' },
  { key: 'cardBackground', label: '名片背景', type: 'card_background' },
  { key: 'nameStyle', label: '昵称样式', type: 'name_style' },
  { key: 'badgeShowcase', label: '展示勋章', type: 'badge', multiple: true },
]

/** 展示勋章上限 */
export const SHOWCASE_LIMIT = 8

/** 佩戴草稿:槽位 → 资产内部名列表(单选槽最多 1 个) */
export type DecorationDraft = Record<DecorationSlotKey, string[]>

const EMPTY_DRAFT: DecorationDraft = {
  avatarFrame: [],
  title: [],
  primaryBadge: [],
  badgeShowcase: [],
  cardBackground: [],
  nameStyle: [],
}

function normalizeDraft(view: IDecorationProfileView | null | undefined): DecorationDraft {
  if (!view) {
    return { ...EMPTY_DRAFT, badgeShowcase: [] }
  }
  return {
    avatarFrame: view.avatarFrame ? [view.avatarFrame] : [],
    title: view.title ? [view.title] : [],
    primaryBadge: view.primaryBadge ? [view.primaryBadge] : [],
    badgeShowcase: [...(view.badgeShowcase || [])],
    cardBackground: view.cardBackground ? [view.cardBackground] : [],
    nameStyle: view.nameStyle ? [view.nameStyle] : [],
  }
}

/** 昵称样式 → CSS(渐变文字/纯色) */
function nameStyleCssOfItem(item: IDecorationInventoryItem): string {
  const ns = item.payload?.nameStyle
  if (!ns) {
    return ''
  }
  if (ns.mode === 'gradient' && ns.colors?.length) {
    return `background-image:linear-gradient(135deg,${ns.colors.join(',')});-webkit-background-clip:text;background-clip:text;color:transparent`
  }
  const solid = ns.mode === 'solid' ? ns.colors?.[0] : ''
  return solid ? `color:${solid}` : ''
}

/** 称号 → chip 样式 */
function titleCssOfItem(item: IDecorationInventoryItem): string {
  const p = item.payload
  const bg = p?.titleBackgroundSecondary
    ? `linear-gradient(135deg,${p.titleBackground},${p.titleBackgroundSecondary})`
    : p?.titleBackground
  return `${bg ? `background-image:${bg};` : ''}${p?.titleColor ? `color:${p.titleColor};` : ''}`
}

export function useMyDecorations() {
  /* ---------------- 状态 ---------------- */
  const loading = ref(false)
  const loaded = ref(false)
  const saving = ref(false)
  const inventory = ref<IDecorationInventoryItem[]>([])
  const savedDraft = ref<DecorationDraft>({ ...EMPTY_DRAFT, badgeShowcase: [] })
  const draft = ref<DecorationDraft>({ ...EMPTY_DRAFT, badgeShowcase: [] })
  const visibility = ref(true)
  const invalidCount = ref(0)
  const rarities = ref<IDecorationRarity[]>([])
  const identityMarks = ref<IIdentityMark[]>([])

  const identityStore = useIdentityStore()
  const { userInfo } = storeToRefs(useUserStore())

  /* ---------------- 计算属性 ---------------- */

  /** 草稿是否有改动 */
  const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(savedDraft.value))

  /** 改动槽位数 */
  const dirtyCount = computed(() =>
    DECORATION_SLOTS.filter(s => JSON.stringify(draft.value[s.key]) !== JSON.stringify(savedDraft.value[s.key])).length)

  /** 可佩戴库存(按类型分组) */
  const availableByType = computed(() => {
    const map = {} as Record<DecorationType, IDecorationInventoryItem[]>
    for (const item of inventory.value) {
      if (!item.available) {
        continue
      }
      (map[item.type] = map[item.type] || []).push(item)
    }
    return map
  })

  /** 可佩戴总数 */
  const availableCount = computed(() => inventory.value.filter(i => i.available).length)

  function itemByName(assetName?: string | null) {
    if (!assetName) {
      return null
    }
    return inventory.value.find(i => i.assetName === assetName && i.available) || null
  }

  /** 稀有度信息(名称 → 显示名/颜色) */
  function rarityOf(rarityName?: string) {
    if (!rarityName) {
      return null
    }
    const hit = rarities.value.find(r => r.metadata?.name === rarityName)
    if (!hit) {
      return null
    }
    return { displayName: hit.spec?.displayName || '', color: hit.spec?.color || '' }
  }

  /** 槽位当前草稿对应的库存项列表 */
  function wornItemsOf(key: DecorationSlotKey) {
    return draft.value[key].map(n => itemByName(n)).filter(Boolean) as IDecorationInventoryItem[]
  }

  /* ---------------- 头部实时预览(随草稿即时变化) ---------------- */
  const previewFrameUrl = computed(() => checkImageUrl(wornItemsOf('avatarFrame')[0]?.asset?.url))
  const previewPrimaryBadgeUrl = computed(() => checkImageUrl(wornItemsOf('primaryBadge')[0]?.asset?.url))
  const previewCardBgUrl = computed(() => checkImageUrl(wornItemsOf('cardBackground')[0]?.asset?.url))
  const previewNameStyleCss = computed(() => {
    const item = wornItemsOf('nameStyle')[0]
    return item ? nameStyleCssOfItem(item) : ''
  })
  const previewTitle = computed(() => {
    const item = wornItemsOf('title')[0]
    if (!item) {
      return null
    }
    return { text: item.payload?.titleText || item.displayName || '', style: titleCssOfItem(item) }
  })
  const previewShowcaseUrls = computed(() => wornItemsOf('badgeShowcase').map(i => checkImageUrl(i.asset?.url)).filter(Boolean))

  /* ---------------- 数据加载 ---------------- */
  async function load() {
    loading.value = true
    try {
      const [invRes, profileRes, metaRes] = await Promise.allSettled([
        getMyDecorationInventory(),
        getMyDecorationProfile(),
        getDecorationMetadata(),
      ])
      if (invRes.status === 'fulfilled') {
        inventory.value = invRes.value.data || []
      }
      if (profileRes.status === 'fulfilled') {
        const view = profileRes.value.data
        savedDraft.value = normalizeDraft(view)
        draft.value = normalizeDraft(view)
        visibility.value = view?.publicDecorationsVisible !== false
        invalidCount.value = view?.invalidItems?.length || 0
        identityMarks.value = view?.identityMarks || []
      }
      if (metaRes.status === 'fulfilled') {
        rarities.value = metaRes.value.data?.rarities || []
      }
      loaded.value = true
    }
    finally {
      loading.value = false
    }
  }

  /* ---------------- 草稿操作 ---------------- */

  /** 点选槽位库存项:单选替换/同项取下,多选切换 */
  function toggleSlot(key: DecorationSlotKey, assetName: string) {
    const slot = DECORATION_SLOTS.find(s => s.key === key)
    const list = draft.value[key]
    if (slot?.multiple) {
      draft.value = {
        ...draft.value,
        [key]: list.includes(assetName)
          ? list.filter(n => n !== assetName)
          : [...list, assetName],
      }
      return
    }
    draft.value = {
      ...draft.value,
      [key]: list[0] === assetName ? [] : [assetName],
    }
  }

  /** 取下槽位 */
  function clearSlot(key: DecorationSlotKey) {
    draft.value = { ...draft.value, [key]: [] }
  }

  /* ---------------- 保存 ---------------- */
  async function save() {
    saving.value = true
    try {
      const req = {
        avatarFrame: draft.value.avatarFrame[0] || null,
        title: draft.value.title[0] || null,
        primaryBadge: draft.value.primaryBadge[0] || null,
        badgeShowcase: draft.value.badgeShowcase,
        cardBackground: draft.value.cardBackground[0] || null,
        nameStyle: draft.value.nameStyle[0] || null,
      }
      const res = await saveMyDecorationProfile(req)
      const view = res.data
      savedDraft.value = normalizeDraft(view)
      draft.value = normalizeDraft(view)
      invalidCount.value = view?.invalidItems?.length || 0
      identityStore.invalidate(userInfo.value.username)
      uni.showToast({ icon: 'none', title: '装扮已保存' })
      return true
    }
    catch (error: any) {
      console.error('装扮保存失败:', error)
      uni.showToast({ icon: 'none', title: error?.data?.detail || error?.message || '装扮保存失败' })
      return false
    }
    finally {
      saving.value = false
    }
  }

  /** 切换装扮墙公开开关 */
  async function toggleVisibility(value: boolean) {
    const prev = visibility.value
    visibility.value = value
    try {
      await saveMyDecorationVisibility({ publicDecorationsVisible: value })
      identityStore.invalidate(userInfo.value.username)
      uni.showToast({ icon: 'none', title: value ? '装扮墙已公开' : '装扮墙已隐藏' })
    }
    catch (error: any) {
      visibility.value = prev
      console.error('装扮墙开关保存失败:', error)
      uni.showToast({ icon: 'none', title: error?.data?.detail || error?.message || '保存失败' })
    }
  }

  return {
    loading,
    loaded,
    saving,
    inventory,
    draft,
    visibility,
    invalidCount,
    dirty,
    dirtyCount,
    availableByType,
    availableCount,
    rarities,
    identityMarks,
    previewFrameUrl,
    previewPrimaryBadgeUrl,
    previewCardBgUrl,
    previewNameStyleCss,
    previewTitle,
    previewShowcaseUrls,
    itemByName,
    rarityOf,
    load,
    toggleSlot,
    clearSlot,
    save,
    toggleVisibility,
  }
}

export type UseMyDecorations = ReturnType<typeof useMyDecorations>
