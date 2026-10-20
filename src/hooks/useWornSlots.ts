/**
 * 单用户互动增强展示槽位（组件便捷入口）
 *
 * 自动检测插件可用性（store 内 TTL 缓存）并拉取身份缓存，
 * 返回响应式 {visible, ...} 槽位（avatarFrame/primaryBadge/title/cardBackground）；
 * 三重门控（插件未启用/审核模式/站点全局开关）未过或无数据时全 invisible，调用方零防御。
 *
 * useCardBgSrc：名片背景取值 + 加载失败兜底。
 * - 素材 URL 404/防盗链等装载失败时回退「功能设置-页面设置-博主页背景图」
 *   （identity store 的 cardBgFallback，站点未配置则为空串）
 * - 未佩戴/无素材时同样回落博主页背景，保证名片背景区域不塌空
 * - 素材 URL 变化（切换用户/换装）自动重置失败态
 */
import { computed, ref, watch } from 'vue'
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

/** 名片背景有效取值（素材装载失败或缺失时回退博主页背景图） */
export interface ICardBgSource {
  /** 实际应渲染的背景地址（可能为空串：连兜底图也未配置） */
  cardBgSrc: ComputedRef<string>
  /** 绑定 image @error，标记当前素材装载失败并切换兜底 */
  onCardBgError: () => void
}

export function useCardBgSrc(getUrl: () => string): ICardBgSource {
  const store = useIdentityStore()
  const failed = ref(false)

  watch(getUrl, () => {
    failed.value = false
  })

  const cardBgSrc = computed(() => {
    if (!failed.value) {
      const url = getUrl()
      if (url) { return url }
    }
    return store.cardBgFallback
  })

  return {
    cardBgSrc,
    onCardBgError: () => {
      failed.value = true
    },
  }
}
