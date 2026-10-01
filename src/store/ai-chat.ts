import { ref } from 'vue'
import { defineStore } from 'pinia'
import { genChatId } from '@/api/ai-chat'
import type { IAgentAction } from '@/ai/action'
import type { IChatUIMessage } from '@/api/types/ai-chat'

/** 单条对话气泡 */
export interface IChatBubble {
  id: string
  role: 'user' | 'assistant'
  text: string
  /** 助手消息时间(HH:mm) */
  time?: string
  /** 是否流式输出中(流式用纯文本渲染, 结束后交 mp-html 一次性解析, 规避连续更新打穿解析器) */
  streaming?: boolean
  /** 本轮工具调用状态: running=执行中, done=已完成 */
  toolState?: 'running' | 'done'
  /** 本轮解析出的跳转动作(输出结束 1.5s 后自动执行首个, 卡片亦可点击) */
  actions?: IAgentAction[]
}

/** 延迟写入 storage(流式期间逐 delta 变更, 合并写入避免每轮全量序列化) */
let saveTimer: ReturnType<typeof setTimeout> | null = null
const lazyStorage = {
  getItem: (key: string) => uni.getStorageSync(key),
  setItem: (key: string, value: string) => {
    if (saveTimer) {
      clearTimeout(saveTimer)
    }
    saveTimer = setTimeout(() => {
      saveTimer = null
      uni.setStorageSync(key, value)
    }, 500)
  },
}

/**
 * AI 助手会话 store(persist 持久化)
 * - 跨页面/应用重启恢复当前会话内容;新会话时清空全部数据
 */
export const useAiChatStore = defineStore(
  'ai-chat',
  () => {
    /** 当前会话标识(服务端按会话记录历史) */
    const conversationId = ref(genChatId())
    /** 访客标识(生成一次长期复用) */
    const visitorId = ref(genChatId())
    /** 会话是否已下发系统提示词(仅首轮注入一次, 后续轮次靠服务端会话历史) */
    const systemPromptSent = ref(false)
    /** 服务端 UIMessage 历史(下一轮请求回传) */
    const history = ref<IChatUIMessage[]>([])
    /** 对话气泡 */
    const bubbles = ref<IChatBubble[]>([])

    /** 开始新会话: 清空全部会话数据并重置标识 */
    function newSession() {
      conversationId.value = genChatId()
      systemPromptSent.value = false
      history.value = []
      bubbles.value = []
    }

    /** 恢复持久化数据后清理运行态标记(流式中断/工具执行中) */
    function normalize() {
      for (const bubble of bubbles.value) {
        if (bubble.streaming) {
          bubble.streaming = false
        }
        if (bubble.toolState === 'running') {
          bubble.toolState = 'done'
        }
      }
    }

    return {
      conversationId,
      visitorId,
      systemPromptSent,
      history,
      bubbles,
      newSession,
      normalize,
    }
  },
  {
    persist: {
      storage: lazyStorage,
    },
  },
)
