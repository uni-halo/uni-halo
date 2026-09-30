<script lang="ts" setup>
import { genChatId, sendAgentChat } from '@/api/ai-chat'
import { chatMarkdownConfig } from '@/config/markdown'
import { throttle } from '@/utils/common'
import type { IChatUIMessage } from '@/api/types/ai-chat'
import type { SseHandle } from '@/api/ai-chat'

defineOptions({
  options: {
    styleIsolation: 'apply-shared',
  },
})

const props = defineProps<IProps>()

const emits = defineEmits<IEmits>()

interface IProps {
  /** v-model:是否显示 */
  modelValue: boolean
}

interface IEmits {
  (e: 'update:modelValue', value: boolean): void
}

const popupVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emits('update:modelValue', value),
})

/* ---------------- 会话状态 ---------------- */
interface IChatBubble {
  id: string
  role: 'user' | 'assistant'
  text: string
  /** 本轮工具调用状态: running=执行中, done=已完成 */
  toolState?: 'running' | 'done'
}

/** 工具调用状态文案 */
const TOOL_RUNNING_TEXT = '正在查找并调用工具…'
const TOOL_DONE_TEXT = '暂不支持工具调用'

const bubbles = ref<IChatBubble[]>([])
const inputText = ref('')
const streaming = ref(false)
const errorText = ref('')
const scrollIntoId = ref('')

/** 会话与服务端记录标识 */
let conversationId = genChatId()
const visitorId = genChatId()
/** 服务端 UIMessage 历史(下一轮请求回传) */
let history: IChatUIMessage[] = []
/** 当前流式请求句柄 */
let currentHandle: SseHandle | null = null

/** 立即滚动到底部锚点(清空后再设置, 触发 scroll-into-view 重新定位) */
function scrollNow() {
  scrollIntoId.value = ''
  nextTick(() => { scrollIntoId.value = 'chat-bottom-anchor' })
}

/** 流式输出期间节流跟随 */
const scrollToBottom = throttle(() => {
  scrollNow()
}, 200)

/** 将执行中的工具状态置为完成 */
function settleToolState() {
  for (const bubble of bubbles.value) {
    if (bubble.toolState === 'running') {
      bubble.toolState = 'done'
    }
  }
}

/** 发送一条消息 */
function handleSend() {
  const message = inputText.value.trim()
  if (!message || streaming.value) { return }
  inputText.value = ''
  errorText.value = ''
  bubbles.value.push({ id: genChatId(), role: 'user', text: message })
  const assistantId = genChatId()
  bubbles.value.push({ id: assistantId, role: 'assistant', text: '' })
  scrollNow()
  streaming.value = true

  currentHandle = sendAgentChat({
    message,
    history,
    conversationId,
    visitorId,
    onText: (fullText) => {
      settleToolState()
      const bubble = bubbles.value.find(item => item.id === assistantId)
      if (bubble) {
        bubble.text = fullText
        scrollToBottom()
      }
    },
    onToolCall: () => {
      // 工具调用在服务端执行, 在当前回答气泡内嵌展示进度
      const bubble = bubbles.value.find(item => item.id === assistantId)
      if (bubble && !bubble.toolState) {
        bubble.toolState = 'running'
      }
      scrollToBottom()
    },
    onError: (message) => {
      errorText.value = message
      settleToolState()
      streaming.value = false
      currentHandle = null
    },
    onDone: () => {
      settleToolState()
      streaming.value = false
      currentHandle = null
      // 空回复兜底
      const bubble = bubbles.value.find(item => item.id === assistantId)
      if (bubble && !bubble.text)
        bubble.text = '（未收到回复，请稍后重试）'
    },
  })
}

/** 停止生成 */
function handleStop() {
  currentHandle?.abort()
  currentHandle = null
  streaming.value = false
  settleToolState()
}

/** 新会话 */
function handleNewChat() {
  if (streaming.value) { handleStop() }
  conversationId = genChatId()
  history = []
  bubbles.value = []
  errorText.value = ''
}

onUnmounted(() => {
  currentHandle?.abort()
  currentHandle = null
  scrollToBottom.cancel()
})
</script>

<template>
  <uh-glass-popup v-model="popupVisible" position="bottom" custom-class="!rounded-2xl" :z-index="120" :close-on-click-modal="false">
    <view class="uh-ai-chat box-border flex flex-col gap-y-3 p-3">
      <!-- 顶部栏 -->
      <view class="flex items-center justify-between pb-3">
        <text class="text-base font-semibold">AI 助手</text>
        <view class="flex items-center gap-3">
          <view
            class="uh-global-card-glass h-6 flex items-center justify-center gap-x-1 text-gray-900 !border !rounded-lg !px-2 !shadow-none"
            @click="handleNewChat"
          >
            <wd-icon name="plus" size="26rpx" />
            <text class="text-xs">新会话</text>
          </view>
          <view
            class="uh-global-card-glass box-border h-6 w-6 flex items-center justify-center border rounded-lg text-gray-500 shadow-none !bg-white/5"
            @click="popupVisible = false"
          >
            <wd-icon name="close" size="28rpx" />
          </view>
        </view>
      </view>

      <!-- 消息列表 -->
      <scroll-view
        class="uh-ai-chat__list box-border flex-1"
        :scroll-y="true"
        :show-scrollbar="false"
        :scroll-into-view="scrollIntoId"
        :scroll-anchoring="true"
      >
        <view class="h-[56vh] w-full">
          <view v-if="!bubbles.length" class="flex flex-col items-center">
            <uh-data-loading
              loading-status="loading" size="small" min-height="56vh"
              :use-refresh-button="false"
              :loading-spinner="false"
              loading-text="你好，欢迎使用助手"
              loading-sub-text="向 AI 助手提问，快速检索站内内容"
            />
          </view>
          <view
            v-for="bubble in bubbles"
            :id="`chat-bubble-${bubble.id}`"
            :key="bubble.id"
            class="mb-3 flex"
            :class="bubble.role === 'user' ? 'justify-end' : 'justify-start'"
          >
            <view
              class="uh-ai-chat__bubble uh-global-card-glass uh-shadow-xs max-w-[80%] flex flex-col gap-y-2 !border !text-3xs"
              :class="bubble.role === 'user' ? 'uh-ai-chat__bubble--user' : 'uh-ai-chat__bubble--assistant'"
            >
              <template v-if="bubble.role === 'assistant'">
                <mp-html
                  v-if="bubble.text"
                  :content="bubble.text"
                  lazy-load :domain="chatMarkdownConfig.domain"
                  :loading-img="chatMarkdownConfig.loadingGif"
                  scroll-table selectable
                  :tag-style="chatMarkdownConfig.tagStyle"
                  :container-style="chatMarkdownConfig.containStyle"
                  :markdown="true" :show-line-number="true"
                  :show-language-name="true" copy-by-long-press
                />
                <view v-else class="uh-ai-chat__status">
                  <view class="uh-ai-chat__dots">
                    <text />
                    <text />
                    <text />
                  </view>
                </view>

                <!-- 工具调用记录 -->
                <view
                  v-if="bubble.toolState"
                  class="box-border flex items-center gap-x-1 rounded-md p-1.5 text-xs"
                  :class="[bubble.toolState === 'running' ? 'bg-gray-200 text-gray-500' : 'bg-red-100 text-red-400']"
                >
                  <wd-icon name="tool" size="28rpx" />
                  <text>{{ bubble.toolState === 'running' ? TOOL_RUNNING_TEXT : TOOL_DONE_TEXT }}</text>
                </view>
              </template>
              <text v-else class="whitespace-pre-wrap">{{ bubble.text }}</text>
            </view>
          </view>
          <!-- 底部跟随锚点 -->
          <view id="chat-bottom-anchor" class="h-px w-full" />
        </view>
      </scroll-view>

      <!-- 错误提示 -->
      <view v-if="errorText" class="box-border rounded-full bg-red-50 px-3 py-2 text-xs color-red-500">
        {{ errorText }}
      </view>

      <!-- 输入区 -->
      <view class="uh-ai-chat__input box-border w-full flex items-center gap-3">
        <input
          v-model="inputText"
          class="uh-ai-chat__input-field uh-global-card-glass flex-1 text-sm !border !shadow-none"
          placeholder="输入你的问题…"
          confirm-type="send"
          :disabled="streaming"
          @confirm="handleSend"
        >
        <uh-button
          v-if="streaming"
          class="shrink-0"
          custom-class="uh-global-card-glass !shadow-none !border !py-2.5 !rounded-full !text-3xs"
          @click="handleStop"
        >
          停止
        </uh-button>
        <uh-button
          v-else
          class="shrink-0"
          custom-class="uh-global-card-glass !shadow-none !border !py-2.5 !rounded-full !text-3xs"
          @click="handleSend"
        >
          发送
        </uh-button>
      </view>
    </view>
  </uh-glass-popup>
</template>

<style scoped lang="scss">
.uh-ai-chat__bubble {
  box-sizing: border-box;
  padding: 16rpx 24rpx;
  border-radius: 20rpx;
  word-break: break-word;
}

.uh-ai-chat__bubble--user {
  color: #333;
  background-color: #b9e424;
  border-bottom-right-radius: 6rpx;
}

.uh-ai-chat__bubble--assistant {
  background-color: rgb(0 0 0 / 4%);
  border-bottom-left-radius: 6rpx;
}

.uh-ai-chat__input-field {
  box-sizing: border-box;
  height: 72rpx;
  padding: 0 24rpx;
  font-size: 14px;
  background-color: rgb(0 0 0 / 4%);
  border-radius: 36rpx;
}

.uh-ai-chat__status {
  display: flex;
  gap: 16rpx;
  align-items: center;
}

.uh-ai-chat__dots {
  display: flex;
  gap: 8rpx;
  align-items: center;
  padding: 8rpx 0;

  text {
    width: 10rpx;
    height: 10rpx;
    background-color: rgb(0 0 0 / 30%);
    border-radius: 50%;
    animation: uh-chat-dot 1.2s ease-in-out infinite;

    &:nth-child(2) {
      animation-delay: 0.2s;
    }
    &:nth-child(3) {
      animation-delay: 0.4s;
    }
  }
}

@keyframes uh-chat-dot {
  0%,
  60%,
  100% {
    opacity: 0.3;
    transform: translateY(0);
  }
  30% {
    opacity: 1;
    transform: translateY(-6rpx);
  }
}
</style>
