/**
 * AI Agent 动作解析与执行（页面跳转协议 @@UNI_HALO_APP_ACTION@@）
 * 职责：从回复文本提取动作块、剥离残缺前缀、校验站内白名单、按路由表纠正跳转类型并执行
 */
import { isPageTabbar, normalizeRoutePath } from '@/tabbar/store'

/** 动作块标记（与内置 Agent 提示词中的协议约定一致） */
export const AGENT_ACTION_TAG = '@@UNI_HALO_APP_ACTION@@'

/** Agent 跳转动作 */
export interface IAgentAction {
  action: 'navigate'
  /** 页面名称(卡片展示用, 详情页为内容标题) */
  name?: string
  type: 'switchTab' | 'navigateTo' | 'redirectTo'
  url: string
}

/** 解析结果：剥离动作块后的正文 + 提取到的动作列表 */
export interface IAgentActionResult {
  text: string
  actions: IAgentAction[]
}

/** 站内页面路径前缀白名单（清单外路径一律拒绝跳转） */
const PAGE_PATH_PREFIXES = ['/pages/', '/pages-blog/', '/pages-admin/', '/uni_modules/']

/** 完整动作块：标记 + 单行 JSON */
const ACTION_LINE_RE = /@@UNI_HALO_APP_ACTION@@\s*(\{[^\n]*\})/g
/** 流式输出中尚未输出完的动作块尾部（整体剥离，避免标记闪现） */
const ACTION_TAIL_RE = /@@UNI_HALO_APP_ACTION@@[\s\S]*$/

/** 解析单个动作 JSON，非法内容返回 null */
function parseActionJson(json: string): IAgentAction | null {
  try {
    const data = JSON.parse(json) as Partial<IAgentAction>
    if (data.action !== 'navigate' || typeof data.url !== 'string' || !data.url) {
      return null
    }
    const url = data.url
    const type = isPageTabbar(normalizeRoutePath(url))
      ? 'switchTab'
      : (data.type === 'redirectTo' ? 'redirectTo' : 'navigateTo')
    const name = typeof data.name === 'string' && data.name ? data.name : undefined
    return { action: 'navigate', name, type, url }
  }
  catch {
    return null
  }
}

/**
 * 从回复文本提取动作块
 * 返回剥离动作块后的正文（含流式中未闭合的尾部标记）与合法动作列表
 */
export function parseAgentActions(raw: string): IAgentActionResult {
  const actions: IAgentAction[] = []
  let text = (raw || '').replace(ACTION_LINE_RE, (_, json: string) => {
    const action = parseActionJson(json)
    if (action) {
      actions.push(action)
    }
    return ''
  })
  text = text.replace(ACTION_TAIL_RE, '').replace(/\s+$/, '')
  return { text, actions }
}

/** 是否为允许跳转的站内页面路径 */
export function isAllowedActionUrl(url: string): boolean {
  if (!url.startsWith('/') || url.includes('://')) {
    return false
  }
  const path = normalizeRoutePath(url)
  return PAGE_PATH_PREFIXES.some(prefix => path.startsWith(prefix))
}

/**
 * 执行跳转动作
 * 跳转类型以站内路由表（isPageTabbar）兜底纠正，成功返回 true
 */
export function executeAgentAction(action: IAgentAction): boolean {
  if (!isAllowedActionUrl(action.url)) {
    return false
  }
  const type = isPageTabbar(normalizeRoutePath(action.url))
    ? 'switchTab'
    : (action.type === 'redirectTo' ? 'redirectTo' : 'navigateTo')
  let failed = false
  uni[type]({
    url: action.url,
    fail: () => {
      failed = true
    },
  })
  return !failed
}
