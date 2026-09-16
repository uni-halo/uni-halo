/**
 * 权限常量配置（事实源）
 *
 * 插件端（Halo）返回的 permissions 是精细化 API 规则：
 *   { apiGroups: string[], resources: string[], verbs: string[] }
 * 客户端按「业务能力」维度抽象为常量，权限判断统一走
 * usePermission().can(PERMISSIONS.xxx)，避免散落硬编码。
 *
 * 规则匹配语义（与 Halo 服务端一致）：
 * - apiGroups：命中任一 group 即匹配；规则含 '*' 通配所有 group
 * - resources：支持 '*' 通配；'a/*' 匹配 'a' 及 'a/任意子资源'
 * - verbs：命中任一 verb 即匹配；'*' 通配所有动词
 */

/** Halo 权限规则（登录结果 permissions 数组元素） */
export interface IPermissionRule {
  apiGroups: string[]
  resources: string[]
  verbs: string[]
  [key: string]: unknown
}

/** 业务权限定义：判断用户是否可执行某操作所需的 API 规则 */
export interface IBizPermission {
  /** 权限标识（仅注释用途，便于排查） */
  id: string
  apiGroup: string
  /** 资源名，如 'moments'、'plugins/uni-halo/love-albums' */
  resource: string
  /** 需要的动词（任一命中即可） */
  verbs: string[]
}

/** API 分组常量 */
export const API_GROUP = {
  /** 瞬间插件 UC API（最终用户自助） */
  MOMENT_UC: 'uc.api.moment.halo.run',
  /** 附件 UC API（个人中心附件配置） */
  STORAGE_UC: 'uc.api.storage.halo.run',
  /** uni-halo 插件 API */
  UNIHALO: 'api.unihalo.ialley.cn',
} as const

/**
 * 业务权限常量表
 * 依据真实 super-role 返回的 permissions 定义；普通角色按需裁剪，
 * 规则匹配支持 '*' 通配（见文件头说明），因此这些常量对所有角色安全。
 */
export const PERMISSIONS = {
  /** 发布/管理瞬间（UC API） */
  MOMENT_MANAGE: {
    id: 'moment:manage',
    apiGroup: API_GROUP.MOMENT_UC,
    resource: 'moments',
    verbs: ['create', 'update', 'delete'],
  },
  /** 附件上传（个人中心存储） */
  ATTACHMENT_UPLOAD: {
    id: 'attachment:upload',
    apiGroup: API_GROUP.STORAGE_UC,
    resource: 'attachments/upload',
    verbs: ['create'],
  },
  /** 恋爱清单管理 */
  LOVE_DAILY_MANAGE: {
    id: 'love-daily:manage',
    apiGroup: API_GROUP.UNIHALO,
    resource: 'plugins/uni-halo/love-daily-items',
    verbs: ['create', 'update', 'delete'],
  },
  /** 恋爱故事管理 */
  LOVE_STORY_MANAGE: {
    id: 'love-story:manage',
    apiGroup: API_GROUP.UNIHALO,
    resource: 'plugins/uni-halo/love-stories',
    verbs: ['create', 'update', 'delete'],
  },
  /** 恋爱相册管理（含照片增删） */
  LOVE_ALBUM_MANAGE: {
    id: 'love-album:manage',
    apiGroup: API_GROUP.UNIHALO,
    resource: 'plugins/uni-halo/love-albums',
    verbs: ['create', 'update', 'delete'],
  },
} as const satisfies Record<string, IBizPermission>

/** 业务权限标识（供组件/页面引用，避免直接传对象） */
export type PermissionKey = keyof typeof PERMISSIONS
