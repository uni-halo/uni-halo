/**
 * 互动增强身份缓存（全局单例）
 *
 * 职责：
 * - 三重门控 enabled：插件可用（检测接口 TTL 缓存）&& 非审核模式 && 站点全局开关
 *   （功能设置-外观布局-通用外观 preferences.interactionPlusEnabled，未配置视为开启）
 * - 单用户身份缓存 ensure（并发去重，命中/查无分别 TTL）
 * - 批量身份缓存 ensureMany（POST /identities，≤50/批，供排行榜等列表场景）
 * - 槽位读取 slotsOf（buildWornSlots 包装，无数据返回全 invisible 槽位）
 * - 装扮墙缓存 wall（30s TTL，查无/失败负缓存，供资料卡等单用户场景）
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { checkPluginAvailable } from '@/api/halo'
import { getBatchIdentities, getDecorationWall, getPublicIdentity } from '@/api/halo-plugin-third/interaction-plus'
import { buildWornSlots } from '@/utils/wornDecorations'
import { useAppConfigStore } from '@/store/appConfig'
import { NeedPluginIds } from '@/hooks/usePluginAvailable'
import type { IWornSlots } from '@/utils/wornDecorations'
import type { IDecorationWallItem, IPublicIdentity } from '@/api/types/halo-plugin-third/interaction-plus'

/** 互动增强插件 ID（检测接口 path 参数） */
const PLUGIN_ID = NeedPluginIds.PluginInteractionPlus
/** 身份命中缓存时长（ms） */
const HIT_TTL = 5 * 60 * 1000
/** 查无/失败负缓存时长（ms） */
const MISS_TTL = 30 * 1000
/** 插件可用性检测缓存时长（ms） */
const AVAILABLE_TTL = 5 * 60 * 1000
/** 批量接口单次上限 */
const BATCH_LIMIT = 50

interface IIdentityCacheEntry {
  value: IPublicIdentity | null
  at: number
}

export const useIdentityStore = defineStore(
  'identity',
  () => {
    const appConfigStore = useAppConfigStore()

    /** 插件可用性（null=未检测；检测接口 TTL 缓存，运行期不反复请求） */
    const available = ref<boolean | null>(null)
    const availableCheckedAt = ref(0)
    /** 身份缓存：username → 身份（null=查无/失败的负缓存） */
    const identities = ref<Record<string, IIdentityCacheEntry>>({})
    /** 并发去重：进行中的单查 Promise */
    const pending = new Map<string, Promise<IPublicIdentity | null>>()

    /** 站点全局开关（未配置视为开启） */
    const siteEnabled = computed(() => appConfigStore.configs.featureConfig?.preferences?.interactionPlusEnabled !== false)
    /** 三重门控：全部满足才允许展示装饰 */
    const enabled = computed(() => available.value === true && !appConfigStore.auditModeEnabled && siteEnabled.value)

    /**
     * 检测插件可用性（TTL 内直接返回缓存结果；失败按不可用处理）
     */
    async function checkAvailable(force = false): Promise<boolean> {
      if (!force && available.value !== null && Date.now() - availableCheckedAt.value < AVAILABLE_TTL) {
        return available.value
      }
      try {
        const res = await checkPluginAvailable(PLUGIN_ID)
        available.value = !!res.data
      }
      catch (err) {
        console.error('检测互动增强插件可用性失败', err)
        available.value = false
      }
      availableCheckedAt.value = Date.now()
      return available.value
    }

    /** 缓存条目是否仍新鲜 */
    function isFresh(entry: IIdentityCacheEntry | undefined): boolean {
      if (!entry) { return false }
      return Date.now() - entry.at < (entry.value ? HIT_TTL : MISS_TTL)
    }

    /**
     * 确保单用户身份已缓存（门控未过/查无/失败均返回 null）
     */
    async function ensure(username: string): Promise<IPublicIdentity | null> {
      if (!username) { return null }
      await checkAvailable()
      if (!enabled.value) { return null }
      const cached = identities.value[username]
      if (isFresh(cached)) { return cached.value }
      if (pending.has(username)) { return pending.get(username)! }
      const task = getPublicIdentity(username)
        .then((res) => {
          const value = res.data || null
          identities.value[username] = { value, at: Date.now() }
          return value
        })
        .catch((err) => {
          console.error(`获取用户公开身份失败: ${username}`, err)
          identities.value[username] = { value: null, at: Date.now() }
          return null
        })
        .finally(() => pending.delete(username))
      pending.set(username, task)
      return task
    }

    /**
     * 批量确保身份已缓存（去重 + 过滤已缓存 + ≤50/批；失败整批负缓存）
     */
    async function ensureMany(usernames: string[]): Promise<void> {
      const unique = [...new Set(usernames.filter(Boolean))]
      if (!unique.length) { return }
      await checkAvailable()
      if (!enabled.value) { return }
      const need = unique.filter(name => !isFresh(identities.value[name]))
      if (!need.length) { return }
      for (let i = 0; i < need.length; i += BATCH_LIMIT) {
        const chunk = need.slice(i, i + BATCH_LIMIT)
        try {
          const res = await getBatchIdentities(chunk)
          const got = new Set<string>()
          for (const item of res.data?.items || []) {
            got.add(item.userName)
            identities.value[item.userName] = { value: item, at: Date.now() }
          }
          for (const name of chunk) {
            if (!got.has(name)) {
              identities.value[name] = { value: null, at: Date.now() }
            }
          }
        }
        catch (err) {
          console.error('批量获取用户公开身份失败', err)
          for (const name of chunk) {
            identities.value[name] = { value: null, at: Date.now() }
          }
        }
      }
    }

    /** 读取单用户展示槽位（无缓存/三重门控未过返回全 invisible 槽位；读路径统一在此把关） */
    function slotsOf(username: string): IWornSlots {
      if (!enabled.value) {
        return buildWornSlots(null)
      }
      return buildWornSlots(identities.value[username]?.value)
    }

    /** 装扮墙缓存：username → 项列表（空数组=查无/失败的负缓存） */
    const walls = ref<Record<string, { value: IDecorationWallItem[], at: number }>>({})
    const pendingWalls = new Map<string, Promise<IDecorationWallItem[]>>()
    /** 装扮墙缓存时长（ms） */
    const WALL_TTL = 30 * 1000

    /**
     * 确保单用户装扮墙已缓存（门控未过/失败返回空数组，负缓存 30s 防反复请求）
     */
    async function wall(username: string): Promise<IDecorationWallItem[]> {
      if (!username) { return [] }
      await checkAvailable()
      if (!enabled.value) { return [] }
      const cached = walls.value[username]
      if (cached && Date.now() - cached.at < WALL_TTL) {
        return cached.value
      }
      if (pendingWalls.has(username)) { return pendingWalls.get(username)! }
      const task = getDecorationWall(username)
        .then((res) => {
          const value = res.data || []
          walls.value[username] = { value, at: Date.now() }
          return value
        })
        .catch((err) => {
          console.error(`获取用户装扮墙失败: ${username}`, err)
          walls.value[username] = { value: [], at: Date.now() }
          return []
        })
        .finally(() => pendingWalls.delete(username))
      pendingWalls.set(username, task)
      return task
    }

    return {
      available,
      availableCheckedAt,
      identities,
      siteEnabled,
      enabled,
      checkAvailable,
      ensure,
      ensureMany,
      slotsOf,
      wall,
    }
  },
)
