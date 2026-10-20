/**
 * 用户公开身份(互动增强插件 + 插件端公开资料兜底,均不可用时静默降级为空数据)
 *
 * 身份读取走 identity store(三重门控:插件可用/非审核模式/站点全局开关 + TTL 缓存);
 * 公开资料(插件端 UserPublicEndpoint)不依赖互动增强插件,始终尝试拉取。
 */
import { shallowRef, watch } from 'vue'
import type { WatchSource } from 'vue'
import { getUserPublicProfile } from '@/api/user'
import { useIdentityStore } from '@/store/identity'
import type { DecorationType, IDecorationWallItem, IPublicIdentity } from '@/api/types/halo-plugin-third/interaction-plus'
import type { IPublicUserProfile } from '@/api/user'

export function useUserIdentity(username: WatchSource<string>) {
  const identityStore = useIdentityStore()
  const identity = shallowRef<IPublicIdentity | null>(null)
  const profile = shallowRef<IPublicUserProfile | null>(null)
  const decorationWall = shallowRef<IDecorationWallItem[]>([])
  const identityPlusAvailable = computed(() => identityStore.enabled)

  watch([username, () => identityStore.enabled], async ([name]) => {
    identity.value = null
    profile.value = null
    decorationWall.value = []
    if (!name) { return }
    getUserProfile(name)
    await identityStore.checkAvailable()
    if (!identityStore.enabled) { return }
    const [idRes, wallRes] = await Promise.allSettled([identityStore.ensure(name), identityStore.wall(name)])
    if (idRes.status === 'fulfilled') {
      identity.value = idRes.value
    }
    if (wallRes.status === 'fulfilled') {
      decorationWall.value = wallRes.value
    }
  }, { immediate: true })

  function getDecoration(type: DecorationType) {
    return decorationWall.value.find(item => item.type === type) || {}
  }

  async function getUserProfile(username: string) {
    try {
      profile.value = (await getUserPublicProfile(username)).data
    }
    catch {
      return null
    }
  }

  return { identityPlusAvailable, identity, profile, decorationWall, getDecoration, getUserProfile }
}
