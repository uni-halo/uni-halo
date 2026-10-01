/**
 * AI Agent 动作解析与执行（页面跳转协议 @@UNI_HALO_APP_ACTION@@）
 * 职责：从回复文本提取动作块、剥离残缺前缀、校验站内白名单、识别目标与当前页相同、按路由表纠正跳转类型并执行
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

/** 单轮动作数量上限（防止模型输出过长候选列表） */
const MAX_ACTIONS = 10

/**
 * 从指定位置起提取完整的 JSON 负载（大括号/方括号配对扫描，支持多行与数组）
 * 自动跳过代码块围栏（```json 等）；忽略字符串内的括号与引号；扫描到结尾仍未闭合返回 null（流式残缺/格式异常）
 */
function extractActionPayload(source: string, from: number): { json: string; end: number } | null {
  let start = from
  while (start < source.length && /\s/.test(source[start])) {
    start++
  }
  if (source.startsWith('```', start)) {
    const lineEnd = source.indexOf('\n', start)
    if (lineEnd === -1) {
      return null
    }
    start = lineEnd + 1
    while (start < source.length && /\s/.test(source[start])) {
      start++
    }
  }
  const openChar = source[start]
  if (openChar !== '{' && openChar !== '[') {
    return null
  }
  const closeChar = openChar === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < source.length; i++) {
    const ch = source[i]
    if (inString) {
      if (escaped) {
        escaped = false
      }
      else if (ch === '\\') {
        escaped = true
      }
      else if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
    }
    else if (ch === openChar) {
      depth++
    }
    else if (ch === closeChar) {
      depth--
      if (depth === 0) {
        // JSON 后紧随的代码块闭合围栏一并消费
        let end = i + 1
        const fence = /^\s*```/.exec(source.slice(end))
        if (fence) {
          end += fence[0].length
        }
        return { json: source.slice(start, i + 1), end }
      }
    }
  }
  return null
}

/** 校验并规范化单个动作对象，非法内容返回 null */
function normalizeAction(data: unknown): IAgentAction | null {
  if (!data || typeof data !== 'object') {
    return null
  }
  const item = data as Partial<IAgentAction>
  if (item.action !== 'navigate' || typeof item.url !== 'string' || !item.url) {
    return null
  }
  const url = item.url
  const type = isPageTabbar(normalizeRoutePath(url))
    ? 'switchTab'
    : (item.type === 'redirectTo' ? 'redirectTo' : 'navigateTo')
  const name = typeof item.name === 'string' && item.name ? item.name : undefined
  return { action: 'navigate', name, type, url }
}

/** 解析动作块负载（单对象或数组），返回合法动作列表（数组内非法项跳过） */
function parseActionPayload(json: string): IAgentAction[] {
  try {
    const data = JSON.parse(json) as unknown
    const items = Array.isArray(data) ? data : [data]
    const actions: IAgentAction[] = []
    for (const item of items) {
      const action = normalizeAction(item)
      if (action) {
        actions.push(action)
      }
      if (actions.length >= MAX_ACTIONS) {
        break
      }
    }
    return actions
  }
  catch {
    return []
  }
}

/**
 * 从回复文本提取动作块（标记后跟 JSON 负载，支持单对象/数组/多行格式）
 * 返回剥离动作块后的正文（流式未闭合的尾部标记一并剥离）与合法动作列表
 */
export function parseAgentActions(raw: string): IAgentActionResult {
  const actions: IAgentAction[] = []
  let text = ''
  let rest = raw || ''
  for (;;) {
    const index = rest.indexOf(AGENT_ACTION_TAG)
    if (index === -1) {
      text += rest
      break
    }
    text += rest.slice(0, index)
    rest = rest.slice(index + AGENT_ACTION_TAG.length)
    const payload = extractActionPayload(rest, 0)
    if (payload) {
      actions.push(...parseActionPayload(payload.json))
      rest = rest.slice(payload.end)
    }
    else {
      // 负载未闭合(流式残缺或格式异常): 标记起整体剥离, 避免标记闪现
      rest = ''
      break
    }
  }
  return { text: text.replace(/\s+$/, ''), actions }
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
 * 判断目标页面与参数是否与当前页面一致
 * 路径相同且目标的每个参数都能与当前页参数对上（当前页多出的参数忽略）即视为同页
 */
export function isSameAsCurrentPage(url: string): boolean {
  const pages = getCurrentPages()
  const current = pages[pages.length - 1]
  if (!current?.route) {
    return false
  }
  const [rawPath, rawQuery = ''] = url.split('?')
  if (normalizeRoutePath(rawPath) !== normalizeRoutePath(current.route)) {
    return false
  }
  const currentOptions = (current as unknown as { options?: Record<string, string> }).options ?? {}
  return rawQuery.split('&').every((pair) => {
    if (!pair) {
      return true
    }
    const eq = pair.indexOf('=')
    const key = eq === -1 ? pair : pair.slice(0, eq)
    const value = eq === -1 ? '' : pair.slice(eq + 1)
    return decodeURIComponent(value) === decodeURIComponent(currentOptions[key] ?? '')
  })
}

/**
 * 执行跳转动作
 * 当前已在目标页时不执行跳转（调用方提示）；跳转类型以站内路由表（isPageTabbar）兜底纠正，成功返回 true
 */
export function executeAgentAction(action: IAgentAction): boolean {
  if (!isAllowedActionUrl(action.url) || isSameAsCurrentPage(action.url)) {
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
