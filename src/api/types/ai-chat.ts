/** AI 对话（summaraidGPT ragAgentChat）类型定义 */

/** UIMessage 消息部件：文本(服务端校验要求 id 非空) */
export interface IChatTextPart {
  type: 'text'
  /** 部件标识, 服务端要求非空 */
  id: string
  text: string
}

/** UIMessage 消息部件：其他（tool-call / step 等，仅透传不渲染） */
export interface IChatOtherPart {
  type: string
  [key: string]: unknown
}

export type IChatMessagePart = IChatTextPart | IChatOtherPart

/** UIMessage（AI Foundation UIMessage 协议） */
export interface IChatUIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  parts: IChatMessagePart[]
  [key: string]: unknown
}

/** ragAgentChat 请求体 */
export interface IChatRequest {
  /** UIMessage 协议字段 */
  id: string
  messages: IChatUIMessage[]
  trigger?: 'submit-message' | 'regenerate-message'
  /** 会话标识 */
  conversationId?: string
  /** 访客标识 */
  visitorId?: string
  /** 是否由服务端记录用户消息 */
  recordUserMessage?: boolean
  /** Agent 是否启用 RAG 站内检索 */
  ragEnabledForAgent?: boolean
}

/** UI 消息流分块（SSE data 负载） */
export interface IChatStreamChunk {
  type: string
  /** type=text 时增量文本 */
  delta?: string
  /** type=error 时错误信息 */
  errorText?: string
  messageId?: string
  [key: string]: unknown
}
