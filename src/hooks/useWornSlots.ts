/**
 * 单用户互动增强展示槽位（组件便捷入口）
 *
 * 自动检测插件可用性（store 内 TTL 缓存）并拉取身份缓存，
 * 返回响应式 {visible, ...} 槽位（avatarFrame/primaryBadge/title/cardBackground）；
 * 三重门控（插件未启用/审核模式/站点全局开关）未过或无数据时全 invisible，调用方零防御。
 */
import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { buildWornSlots } from '@/utils/wornDecorations'
import { useIdentityStore } from '@/store/identity'
import type { IWornSlots } from '@/utils/wornDecorations'

export function useWornSlots(username: () => string): ComputedRef<IWornSlots> {
  const store = useIdentityStore()
  store.checkAvailable()
  return computed(() => {
    const name = username()
    if (!name || !store.enabled) { return buildWornSlots(null) }
    store.ensure(name)
    return store.slotsOf(name)
  })
}
