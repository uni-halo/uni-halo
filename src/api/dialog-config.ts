/**
 * summaraidGPT 对话框配置 API（dialogConfig）
 *
 * GET /apis/api.summary.summaraidgpt.lik.cc/v1alpha1/dialogConfig
 * 公开端点：不走防盗链/访问模式校验，任何客户端可读；
 * 携带 token 时 access.authenticated 才反映真实登录态（无 token 时拦截器静默跳过）。
 * 拉取失败回退内置默认值（与官方前台 fetchRagAssistantConfig 同策略）。
 */
import { http } from '@/http/alova'
import { RequestFrom } from '@/http/tools/enum'
import type { IResponse } from '@/http/types'

const DIALOG_CONFIG_API = '/apis/api.summary.summaraidgpt.lik.cc/v1alpha1/dialogConfig'

/** 访问模式：authenticated_* 表示需登录后才能对话 */
export type TDialogAccessMode
  = 'anonymous_chat'
    | 'anonymous_chat_agent'
    | 'authenticated_chat'
    | 'authenticated_chat_agent'

/** 访问与认证状态（服务端按当前请求 principal 判定） */
export interface IDialogAccess {
  mode: TDialogAccessMode
  allowAnonymous: boolean
  agentAllowed: boolean
  /** 当前请求者是否已登录（需携带 token 才准确） */
  authenticated: boolean
}

/** 助手样式配置 */
export interface IDialogStyleConfig {
  primaryColor?: string
  secondaryColor?: string
  surfaceColor?: string
  textColor?: string
  borderRadius?: string
  colorMode?: string
}

/** 对话框配置（dialogConfig 响应，字段缺省时使用内置默认值） */
export interface IDialogConfig {
  /** 助手头像地址（可能为站点相对路径，渲染时用 checkAvatarUrl 补全） */
  assistantAvatar?: string
  assistantName?: string
  displayMode?: string
  ragEnabled?: boolean
  /** 欢迎语（含 {assistantName} 占位符），空 = 使用组件默认空态 */
  welcomeMessage?: string
  /** 快捷问题（服务端最多 8 条、每条 ≤80 字），空 = 使用组件默认空态 */
  quickQuestions?: string[]
  styleConfig?: IDialogStyleConfig
  access?: Partial<IDialogAccess>
}

const DEFAULT_ASSISTANT_NAME = '智阅助手'

/** 内置默认值：快捷问题/欢迎语为空 = 使用组件自身空态（uh-data-loading） */
export const DEFAULT_DIALOG_CONFIG: IDialogConfig = {
  assistantName: DEFAULT_ASSISTANT_NAME,
  quickQuestions: [],
  access: {
    mode: 'anonymous_chat_agent',
    allowAnonymous: true,
    agentAllowed: true,
    authenticated: false,
  },
}

let cached: IDialogConfig | null = null
let cachedAt = 0
let inflight: Promise<IDialogConfig> | null = null
let inflightRaw: Promise<IDialogConfig | null> | null = null
const CACHE_TTL = 5 * 60 * 1000

/** 规范化：合并默认值、清洗快捷问题、替换欢迎语占位符 */
function normalizeDialogConfig(raw?: Partial<IDialogConfig>): IDialogConfig {
  const config = { ...DEFAULT_DIALOG_CONFIG, ...(raw || {}) }
  const assistantName = (config.assistantName || '').trim() || DEFAULT_ASSISTANT_NAME
  const quickQuestions = (config.quickQuestions || [])
    .map(item => `${item || ''}`.trim())
    .filter(Boolean)
    .slice(0, 8)
  const welcomeMessage = (config.welcomeMessage || '')
    .trim()
    .replace(/\{assistantName\}/g, assistantName)
  return {
    ...config,
    assistantName,
    quickQuestions,
    welcomeMessage,
    access: {
      mode: (config.access?.mode || 'anonymous_chat_agent') as TDialogAccessMode,
      allowAnonymous: config.access?.allowAnonymous !== false,
      agentAllowed: config.access?.agentAllowed === true,
      authenticated: config.access?.authenticated === true,
    },
  }
}

/** 原始拉取（失败抛错，由调用方决定兜底策略） */
function requestDialogConfig(): Promise<IDialogConfig> {
  return http.Get<IResponse<IDialogConfig>>(DIALOG_CONFIG_API, {
    cacheFor: 0 as const,
    meta: { requestFrom: RequestFrom.Halo },
  }).then(res => normalizeDialogConfig(res?.data))
}

/**
 * 拉取对话框配置（带 token；5 分钟缓存；失败回退默认值）
 * @param force 忽略缓存强制刷新（登录态变化后使用）
 */
export function fetchDialogConfig(force = false): Promise<IDialogConfig> {
  if (!force && cached && Date.now() - cachedAt < CACHE_TTL) {
    return Promise.resolve(cached)
  }
  if (inflight) {
    return inflight
  }
  inflight = requestDialogConfig()
    .then((config) => {
      cached = config
      cachedAt = Date.now()
      return config
    })
    .catch(() => ({ ...DEFAULT_DIALOG_CONFIG }))
    .finally(() => {
      inflight = null
    })
  return inflight
}

/**
 * 拉取对话框配置，接口不可用时返回 null（不兜底默认值）
 * 用于"插件是否启用"判断：404/请求失败 = 插件未启用或未安装
 */
export function fetchDialogConfigOrNull(force = false): Promise<IDialogConfig | null> {
  if (!force && cached && Date.now() - cachedAt < CACHE_TTL) {
    return Promise.resolve(cached)
  }
  if (inflightRaw) {
    return inflightRaw
  }
  inflightRaw = requestDialogConfig()
    .then((config) => {
      cached = config
      cachedAt = Date.now()
      return config
    })
    .catch(() => null)
    .finally(() => {
      inflightRaw = null
    })
  return inflightRaw
}

/** 清空配置缓存（登录态变化后配合 force 刷新使用） */
export function clearDialogConfigCache() {
  cached = null
  cachedAt = 0
  inflight = null
}

/** 当前访问模式是否要求登录后才能对话 */
export function dialogRequireLogin(config: IDialogConfig): boolean {
  const mode = config.access?.mode
  return mode === 'authenticated_chat' || mode === 'authenticated_chat_agent'
}

/** 是否处于"需登录但当前未认证"状态（应引导登录） */
export function dialogNeedLogin(config: IDialogConfig): boolean {
  return dialogRequireLogin(config) && config.access?.authenticated !== true
}
