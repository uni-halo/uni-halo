<script lang="ts" setup>
/**
 * 权限组件：根据角色/权限规则控制子元素渲染（跨端可靠方案）
 *
 * 用法：
 *   <uh-permission permission="MOMENT_MANAGE">...</uh-permission>   // 业务权限常量 key（推荐）
 *   <uh-permission :permission="['MOMENT_MANAGE', 'LOVE_ALBUM_MANAGE']">...</uh-permission>
 *   <uh-permission roles="admin,author">...</uh-permission>          // 仅角色判断
 *   <uh-permission permission="MOMENT_MANAGE" roles="admin">...</uh-permission> // 组合（与关系）
 */
import { computed } from 'vue'
import { PERMISSIONS } from '@/config/permissions'
import type { PermissionKey } from '@/config/permissions'
import { usePermission } from '@/hooks/usePermission'

interface IProps {
  /** 业务权限常量 key（PERMISSIONS），单个或数组（任一命中即可见） */
  permission?: PermissionKey | PermissionKey[]
  /** 允许的角色列表（逗号分隔字符串或数组），任一命中即可见 */
  roles?: string | string[]
}

const props = withDefaults(defineProps<IProps>(), {
  permission: () => [],
  roles: () => [],
})

function toPermissionKeys(v: PermissionKey | PermissionKey[]) {
  return Array.isArray(v) ? v : v ? [v] : []
}
function toRoleArray(v: string | string[]) {
  return Array.isArray(v) ? v : v ? v.split(',').map(s => s.trim()).filter(Boolean) : []
}

const { can, hasRole } = usePermission()

const visible = computed(() => {
  const needPerms = toPermissionKeys(props.permission)
  const needRoles = toRoleArray(props.roles)
  const permOk = needPerms.length === 0 || needPerms.some(k => can(PERMISSIONS[k]))
  const roleOk = needRoles.length === 0 || hasRole(...needRoles)
  return permOk && roleOk
})
</script>

<template>
  <template v-if="visible">
    <slot />
  </template>
</template>
