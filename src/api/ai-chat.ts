/**
 * AI 对话 API（summaraidGPT ragAgentChat，SSE 流式）
 * 底层走 src/http/sse.ts 统一流式工具
 */
import type { IChatRequest, IChatStreamChunk, IChatUIMessage } from '@/api/types/ai-chat'
import { requestSse } from '@/http/sse'
import type { SseHandle } from '@/http/sse'

export type { SseHandle }

const API_PREFIX = '/apis/api.summary.summaraidgpt.lik.cc/v1alpha1'

/** 每轮随用户消息下发的隐藏来源说明(仅进请求体, 不进气泡展示) */
const CLIENT_SOURCE_NOTE = '\n\n[系统备注] 本请求来自 UniHalo App 端（非浏览器网页端），请勿调用内置的资源打开类工具；如需页面跳转，请按系统提示词中的动作协议输出。'

/** 生成短 id */
export function genChatId(): string {
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** 从 UIMessage 中提取全部文本 */
export function messageText(message: IChatUIMessage): string {
  return message.parts
    .filter(part => part.type === 'text')
    .map(part => (part as { text: string }).text)
    .join('')
}

export interface SendChatOptions {
  /** 本轮用户输入(用于组装 messages) */
  message: string
  /** 系统提示词(非空时作为 system 消息前插, 每轮注入) */
  systemPrompt?: string
  /** 历史消息(不含本轮) */
  history?: IChatUIMessage[]
  /** 会话标识 */
  conversationId?: string
  /** 访客标识 */
  visitorId?: string
  /** 令牌携带 */
  needAuthToken?: boolean
  /** 收到增量文本 */
  onText: (fullText: string) => void
  /** 本轮发生了工具调用(服务端 finishReason=tool-calls) */
  onToolCall?: () => void
  /** 收到错误(流中 error 块或请求失败) */
  onError: (message: string) => void
  /** 流结束 */
  onDone: () => void
}

/** 原始错误 -> 友好提示 */
export function friendlyChatError(raw: string): string {
  const text = raw || ''
  if (/Connection reset by peer|ECONNRESET|error\(-104\)|SSL|protocol error/i.test(text))
    return 'AI 服务连接中断，请稍后重试'
  if (/timed? ?out|ETIMEDOUT/i.test(text))
    return 'AI 服务响应超时，请稍后重试'
  if (/network error|request:fail/i.test(text))
    return '网络连接失败，请检查网络后重试'
  if (/Cross-site AI requests|Missing request origin|only allowed from trusted/i.test(text))
    return '当前站点未授权此端访问 AI 助手'
  if (/401|Unauthorized|请登录/.test(text))
    return '请登录后再使用 AI 助手'
  if (/429|TOO_MANY|limit exceeded/i.test(text))
    return 'AI 请求过于频繁，请稍后再试'
  // 插件已翻译的中文错误或未知错误原样透出
  return text || 'AI 回复出错'
}

/** 瞬态错误(可自动重试) */
function isTransientChatError(raw: string): boolean {
  return /Connection reset by peer|ECONNRESET|error\(-104\)|timed? ?out|network error|protocol error/i.test(raw || '')
}

/**
 * 发起一轮 Agent 对话（SSE 流式）
 * 瞬态错误(如上游连接被重置)且尚未输出正文时自动重试一次
 * 返回 abort 句柄用于停止生成
 */
export function sendAgentChat(options: SendChatOptions): SseHandle {
  const userMessage: IChatUIMessage = {
    id: genChatId(),
    role: 'user',
    parts: [{ id: genChatId(), type: 'text', text: options.message + CLIENT_SOURCE_NOTE }],
  }
  const historyMessages = options.systemPrompt
    ? [{
        id: genChatId(),
        role: 'system' as const,
        parts: [{ id: genChatId(), type: 'text' as const, text: options.systemPrompt }],
      }]
    : []
  const messages = [...historyMessages, ...(options.history ?? []), userMessage]
  let activeHandle: SseHandle | null = null
  let aborted = false

  function run(attemptNo: number) {
    // 流式输出的助手消息(仅文本增量, tool 块忽略); 每次尝试独立累计
    let text = ''
    let errored = false

    const body: IChatRequest = {
      id: genChatId(),
      messages,
      trigger: 'submit-message',
      conversationId: options.conversationId,
      visitorId: options.visitorId,
      // 重试时不再让服务端重复记录这条用户消息
      recordUserMessage: attemptNo === 1,
      ragEnabledForAgent: true,
    }

    function handleChunk(data: string) {
      // DONE 标记
      if (data === '[DONE]') {
        return
      }
      let chunk: IChatStreamChunk
      try {
        chunk = JSON.parse(data) as IChatStreamChunk
      }
      catch {
        // 非JSON负载忽略
        return
      }
      if (chunk.type === 'text-delta' && typeof chunk.delta === 'string') {
        text += chunk.delta
        options.onText(text)
      }
      else if (chunk.type === 'text' && typeof (chunk as unknown as { text?: string }).text === 'string') {
        // 兼容: text 类型携带全文
        text = (chunk as unknown as { text: string }).text
        options.onText(text)
      }
      else if (chunk.type === 'error') {
        errored = true
        options.onError(friendlyChatError(chunk.errorText || 'AI 回复出错'))
      }
      else if (chunk.type === 'finish') {
        // 仅 finishReason=tool-calls 才认定本轮发生了工具调用(其余为普通回答/思考)
        const reason = chunk.finishReason || chunk.rawFinishReason || ''
        const isToolCall = reason === 'tool-calls' || reason === 'tool_calls'
        if (isToolCall)
          options.onToolCall?.()
      }
      // 其余控制类分块(start/start-step/tool-*/reasoning-* 等)由服务端处理, 客户端忽略
    }

    activeHandle = requestSse({
      url: `${API_PREFIX}/ragAgentChat`,
      method: 'POST',
      data: body,
      header: { 'Content-Type': 'application/json' },
      needAuthToken: options.needAuthToken,
      onMessage: handleChunk,
      onDone: () => {
        if (!errored)
          options.onDone()
      },
      onError: (message) => {
        // 尚无正文输出且为瞬态错误时自动重试一次
        if (!aborted && !errored && !text && attemptNo === 1 && isTransientChatError(message)) {
          run(2)
          return
        }
        errored = true
        options.onError(friendlyChatError(message))
      },
    })
  }

  run(1)
  return {
    abort: () => {
      aborted = true
      activeHandle?.abort()
    },
  }
}
