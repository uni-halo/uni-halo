/**
 * 权限判断 hook
 *
 * 两层判断能力：
 * 1. 角色判断：hasRole('admin') —— 适用于仅看角色的粗粒度场景
 * 2. API 权限规则判断：can(PERMISSIONS.MOMENT_MANAGE) —— 基于 Halo
 *    permissions 规则（apiGroups/resources/verbs，支持 '*' 通配），
 *    与服务端鉴权语义一致，为推荐方式
 *
 * 业务权限常量见 @/config/permissions
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { PERMISSIONS } from '@/config/permissions'
import type { IBizPermission, IPermissionRule, PermissionKey } from '@/config/permissions'
import { useUserStore } from '@/store/user'

/** 单条规则是否命中目标 apiGroup/resource/verb（支持 '*' 通配） */
function matchRule(rule: IPermissionRule, apiGroup: string, resource: string, verb: string): boolean {
  const groupOk = rule.apiGroups?.some(g => g === '*' || g === apiGroup) ?? false
  if (!groupOk)
    return false
  // 资源匹配：'*' 全通配；'a/*' 匹配 'a' 与 'a/子资源'；否则精确匹配
  const resourceOk = rule.resources?.some((r) => {
    if (r === '*' || r === resource)
      return true
    if (r.endsWith('/*')) {
      const base = r.slice(0, -2)
      return resource === base || resource.startsWith(`${base}/`)
    }
    return false
  }) ?? false
  if (!resourceOk)
    return false
  const verbOk = rule.verbs?.some(v => v === '*' || v === verb) ?? false
  return verbOk
}

export function usePermission() {
  const userStore = useUserStore()
  // storeToRefs 保持响应式引用（项目规范：setup store 取值统一走 storeToRefs）
  const { userInfo } = storeToRefs(userStore)

  /** 当前用户角色列表（响应式） */
  const roles = computed<string[]>(() => userInfo.value?.roles || [])
  /** 当前用户权限规则列表（响应式） */
  const rules = computed<IPermissionRule[]>(() => userInfo.value?.permissions || [])

  /** 是否已登录（有角色信息视为已登录） */
  const isLoggedIn = computed(() => roles.value.length > 0)

  /** 是否拥有任一指定角色 */
  const hasRole = (...needRoles: string[]) => {
    if (needRoles.length === 0)
      return true
    return needRoles.some(r => roles.value.includes(r))
  }

  /**
   * 是否可执行某个业务权限（任一规则命中所需 verb 即可）
   * @param permission PERMISSIONS 常量或其 key（如 'MOMENT_MANAGE'）
   */
  const can = (permission: IBizPermission | PermissionKey) => {
    const target: IBizPermission = typeof permission === 'string' ? PERMISSIONS[permission] : permission
    // 超管角色直接放行（其 rules 含 '*/*/*'，此判断仅作短路优化）
    if (hasRole('super-role', '*'))
      return true
    return rules.value.some(rule => matchRule(rule, target.apiGroup, target.resource, '*'))
      ? true
      : rules.value.some(rule => target.verbs.some(verb => matchRule(rule, target.apiGroup, target.resource, verb)))
  }

  /** 是否拥有任一指定权限字符串（旧式扁平 permissions 用法保留） */
  const hasPermission = (...needPermissions: string[]) => {
    if (needPermissions.length === 0)
      return true
    return needPermissions.some((p) => {
      return rules.value.some((rule) => {
        const joined = [...(rule.apiGroups || []), ...(rule.resources || []), ...(rule.verbs || [])].join(' ')
        return joined.includes(p)
      })
    })
  }

  /** 是否管理员（超管角色或角色名含 admin） */
  const isAdmin = computed(() => hasRole('super-role', 'admin', '*'))

  /** 是否可进入管理区（瞬间或任一恋爱模块可管理） */
  const canManage = computed(() =>
    can('MOMENT_MANAGE')
    || can('LOVE_DAILY_MANAGE')
    || can('LOVE_STORY_MANAGE')
    || can('LOVE_ALBUM_MANAGE'),
  )

  return { roles, rules, isLoggedIn, hasRole, hasPermission, can, isAdmin, canManage }
}
