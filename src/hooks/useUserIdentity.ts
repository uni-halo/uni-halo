/**
 * 用户公开身份(互动增强插件 + 插件端公开资料兜底,均不可用时静默降级为空数据)
 */
import { shallowRef, watch } from 'vue'
import type { WatchSource } from 'vue'
import { getUserPublicProfile } from '@/api/user'
import { getDecorationWall, getPublicIdentity } from '@/api/halo-plugin-third/interaction-plus'
import type { DecorationType, IDecorationWallItem, IPublicIdentity } from '@/api/types/halo-plugin-third/interaction-plus'
import type { IPublicUserProfile } from '@/api/user'

export function useUserIdentity(username: WatchSource<string>) {
  const identity = shallowRef<IPublicIdentity | null>(null)
  const profile = shallowRef<IPublicUserProfile | null>(null)
  const decorationWall = shallowRef<IDecorationWallItem[]>([])

  watch(username, async (name) => {
    identity.value = null
    profile.value = null
    decorationWall.value = []
    if (!name) { return }
    await getUserProfile(name)
    const [idRes, wallRes] = await Promise.allSettled([getPublicIdentity(name), getDecorationWall(name)])
    if (idRes.status === 'fulfilled') {
      identity.value = idRes.value.data
      return
    }
    if (wallRes.status === 'fulfilled') {
      decorationWall.value = wallRes.value.data || []
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

  return { identity, profile, decorationWall, getDecoration, getUserProfile }
}
