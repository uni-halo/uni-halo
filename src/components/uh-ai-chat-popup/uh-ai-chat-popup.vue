<script lang="ts" setup>
import { genChatId, sendAgentChat } from '@/api/ai-chat'
import { APP_AGENT_PROMPT } from '@/ai/prompt'
import { executeAgentAction, parseAgentActions } from '@/ai/action'
import type { IAgentAction } from '@/ai/action'
import { chatMarkdownConfig } from '@/config/markdown'
import { throttle } from '@/utils/common'
import { DEFAULT_DIALOG_CONFIG, dialogNeedLogin, fetchDialogConfig } from '@/api/dialog-config'
import type { IDialogConfig } from '@/api/dialog-config'
import { storeToRefs } from 'pinia'
import { useAiChatStore } from '@/store/ai-chat'
import type { IChatBubble } from '@/store/ai-chat'
import { useTokenStore } from '@/store/token'
import { useUserStore } from '@/store/user'
import { checkAvatarUrl } from '@/utils/url'
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
/** 工具调用状态文案 */
const TOOL_RUNNING_TEXT = '正在查找并调用工具…'
const TOOL_DONE_TEXT = '暂不支持工具调用'

/** 会话 store(persist 持久化, 跨页面/重启恢复; 新会话时清空全部数据) */
const aiChatStore = useAiChatStore()
const { conversationId, visitorId, systemPromptSent, history, bubbles } = storeToRefs(aiChatStore)
// 恢复持久化数据后清理运行态标记(上次会话可能在流式中断)
aiChatStore.normalize()

const inputText = ref('')
const streaming = ref(false)
const errorText = ref('')
const scrollIntoId = ref('')

/** 自动跳转定时器(输出结束 1.5s 后执行首个动作) */
let autoJumpTimer: ReturnType<typeof setTimeout> | null = null

/** 取消待执行的自动跳转 */
function clearAutoJumpTimer() {
  if (autoJumpTimer) {
    clearTimeout(autoJumpTimer)
    autoJumpTimer = null
  }
}

/** 当前流式请求句柄 */
let currentHandle: SseHandle | null = null

/** 对话框配置（dialogConfig，失败回退默认值） */
const dialogConfig = ref<IDialogConfig>({ ...DEFAULT_DIALOG_CONFIG })
const tokenStore = useTokenStore()
const userStore = useUserStore()

/** AI 助手头像与名称 */
const assistantAvatar = computed(() => checkAvatarUrl(dialogConfig.value.assistantAvatar || ''))
const assistantName = computed(() => dialogConfig.value.assistantName || 'AI 助手')
/** 欢迎语与快捷问题（站点均未配置时保持组件默认空态） */
const welcomeMessage = computed(() => (dialogConfig.value.welcomeMessage || '').trim())
const quickQuestions = computed(() => dialogConfig.value.quickQuestions || [])
const showWelcome = computed(() => !!(welcomeMessage.value || quickQuestions.value.length))
/** 登录态与用户头像 */
const hasLogin = computed(() => !!tokenStore.validToken)
const userAvatar = computed(() => (hasLogin.value ? checkAvatarUrl(userStore.userInfo?.avatar || '') : ''))
/** 需登录但未认证：应引导登录 */
const needLogin = computed(() => dialogNeedLogin(dialogConfig.value) && !hasLogin.value)
/** 最后一条助手气泡(仅其上展示重新生成) */
const lastAssistantId = computed(() => {
  for (let i = bubbles.value.length - 1; i >= 0; i--) {
    if (bubbles.value[i].role === 'assistant') { return bubbles.value[i].id }
  }
  return ''
})

/** 拉取配置：token 状态与缓存不一致时强制刷新（登录前后 authenticated 会变化） */
function loadDialogConfig(force = false) {
  const tokenChanged = hasLogin.value !== (dialogConfig.value.access?.authenticated === true)
  return fetchDialogConfig(force || tokenChanged).then((config) => {
    dialogConfig.value = config
    return config
  })
}

watch(popupVisible, (visible) => {
  if (visible) { loadDialogConfig(true) }
})

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

/** 助手消息时间(HH:mm) */
function formatTime(date = new Date()): string {
  const pad = (n: number) => `${n}`.padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** 发送一条消息 */
function handleSend() {
  const message = inputText.value.trim()
  if (!message || streaming.value) { return }
  // 需登录模式未认证：拦截发送, 由提示条引导登录（见模板 needLogin 区块）
  if (needLogin.value) { return }
  inputText.value = ''
  bubbles.value.push({ id: genChatId(), role: 'user', text: message })
  runTurn(message)
}

/** 执行一轮对话: 追加助手占位气泡并发起流式请求 */
function runTurn(message: string) {
  errorText.value = ''
  clearAutoJumpTimer()
  const assistantId = genChatId()
  bubbles.value.push({ id: assistantId, role: 'assistant', text: '', time: formatTime(), streaming: true })
  scrollNow()
  streaming.value = true

  currentHandle = sendAgentChat({
    message,
    // 系统提示词仅会话首轮随请求下发, 避免每轮重复携带消耗 token
    systemPrompt: systemPromptSent.value ? undefined : APP_AGENT_PROMPT,
    history: history.value,
    conversationId: conversationId.value,
    visitorId: visitorId.value,
    // 登录态下携带 token（authenticated_* 模式服务端要求）
    needAuthToken: hasLogin.value,
    onText: (fullText) => {
      settleToolState()
      const bubble = bubbles.value.find(item => item.id === assistantId)
      if (bubble) {
        // 流式期间直接展示原始全文, 动作块的剥离留到输出结束后统一处理
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
      bubbles.value.find(item => item.id === assistantId).streaming = false
      streaming.value = false
      currentHandle = null
    },
    onDone: () => {
      settleToolState()
      streaming.value = false
      currentHandle = null
      // 首轮成功结束后标记已下发, 后续轮次不再重复注入
      systemPromptSent.value = true
      // 空回复兜底(仅动作无正文的气泡不兜底, 由动作卡片展示)
      const bubble = bubbles.value.find(item => item.id === assistantId)
      if (bubble) {
        bubble.streaming = false
        // 输出结束后统一剥离动作块, 解析出的动作交给下方自动跳转
        const { text, actions } = parseAgentActions(bubble.text)
        bubble.text = text
        if (actions.length) {
          bubble.actions = actions
        }
        if (!bubble.text && !bubble.actions?.length)
          bubble.text = '（未收到回复，请稍后重试）'
      }
      // 输出结束 1.5s 后自动执行首个跳转动作
      clearAutoJumpTimer()
      if (bubble?.actions?.length) {
        autoJumpTimer = setTimeout(() => {
          autoJumpTimer = null
          if (bubble.actions?.length) {
            handleAction(bubble.actions[0])
          }
        }, 1500)
      }
    },
  })
}

/** 执行 AI 跳转动作(仅站内白名单路径), 成功后收起弹窗 */
function handleAction(action: IAgentAction) {
  if (executeAgentAction(action)) {
    popupVisible.value = false
  }
  else {
    uni.showToast({ title: '暂不支持跳转该页面', icon: 'none' })
  }
}

/** 复制回答内容 */
function handleCopy(bubble: IChatBubble) {
  if (!bubble.text) { return }
  uni.setClipboardData({
    data: bubble.text,
    success: () => uni.showToast({ title: '已复制', icon: 'none' }),
  })
}

/** 重新生成: 沿用该回答前最近一条用户消息重新提问 */
function handleRegenerate(bubbleId: string) {
  if (streaming.value || needLogin.value) { return }
  const index = bubbles.value.findIndex(item => item.id === bubbleId)
  if (index < 0) { return }
  let userIndex = -1
  for (let i = index - 1; i >= 0; i--) {
    if (bubbles.value[i].role === 'user') {
      userIndex = i
      break
    }
  }
  if (userIndex < 0) { return }
  const message = bubbles.value[userIndex].text
  // 丢弃该用户消息之后的所有气泡(旧回答/工具状态), 重新执行本轮
  bubbles.value.splice(userIndex + 1)
  runTurn(message)
}

/** 点击快捷问题直接发送 */
function handleQuickAsk(question: string) {
  if (streaming.value || needLogin.value) { return }
  inputText.value = question
  handleSend()
}

/** 前往登录页 */
function goLogin() {
  uni.navigateTo({
    url: '/pages/auth/login',
    success: () => {
      popupVisible.value = false
    },
  })
}

/** 停止生成 */
function handleStop() {
  currentHandle?.abort()
  currentHandle = null
  clearAutoJumpTimer()
  streaming.value = false
  settleToolState()
  const bubble = bubbles.value.find(item => item.id === lastAssistantId.value)
  if (bubble) {
    bubble.streaming = false
    // 手动停止同样是输出结束, 统一剥离动作块(可能存在未闭合的尾部标记)
    const { text, actions } = parseAgentActions(bubble.text)
    bubble.text = text
    if (actions.length) {
      bubble.actions = actions
    }
    if (!bubble.text && !bubble.actions?.length) {
      bubble.text = '（已停止生成）'
    }
  }
}

/** 新会话: 清空 store 中全部会话数据(持久化同步清空) */
function handleNewChat() {
  if (streaming.value) { handleStop() }
  aiChatStore.newSession()
  clearAutoJumpTimer()
  errorText.value = ''
}

onUnmounted(() => {
  currentHandle?.abort()
  currentHandle = null
  clearAutoJumpTimer()
  scrollToBottom.cancel()
})
</script>

<template>
  <uh-glass-popup v-model="popupVisible" position="bottom" custom-class="!rounded-2xl" :z-index="120" :close-on-click-modal="false">
    <view class="uh-ai-chat box-border flex flex-col gap-y-3 p-3">
      <!-- 顶部栏 -->
      <view class="flex items-center justify-between pb-3">
        <view class="flex flex-1 items-center gap-x-2">
          <view
            v-if="assistantAvatar"
            class="uh-global-card-glass uh-shadow-primary-xs h-5.5 w-5.5 border rounded-lg !bg-primary"
          >
            <image
              :src="assistantAvatar"
              class="block h-full w-full rounded-full"
              mode="aspectFill"
            />
          </view>
          <text class="text-base font-semibold">AI 助手</text>
        </view>
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
          <view v-if="!bubbles.length" class="w-full flex flex-col items-center">
            <!-- 站点配置了欢迎语/快捷问题：自定义欢迎态 -->
            <view v-if="showWelcome" class="mt-16 w-full flex flex-col items-center gap-y-4 px-6">
              <view v-if="assistantAvatar" class="uh-global-card-glass uh-shadow-primary-xs rounded-2xl !bg-primary">
                <image
                  :src="assistantAvatar"
                  class="block h-16 w-16 rounded-full"
                  mode="aspectFill"
                />
              </view>
              <text class="text-sm font-semibold">{{ assistantName }}</text>
              <text v-if="welcomeMessage" class="text-center text-xs color-gray-500 leading-5">
                {{ welcomeMessage }}
              </text>
              <view v-if="quickQuestions.length" class="mt-2 w-full flex flex-col gap-y-2">
                <view
                  v-for="(question, index) in quickQuestions"
                  :key="index"
                  class="uh-ai-chat__quick flex items-center rounded-lg px-3 py-2 text-xs"
                  @click="handleQuickAsk(question)"
                >
                  <text class="flex-1">{{ question }}</text>
                  <wd-icon name="arrow-right" size="24rpx" />
                </view>
              </view>
            </view>
            <!-- 未配置欢迎语/快捷问题：默认空态 -->
            <uh-data-loading
              v-else
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
            class="mb-3 flex flex-col gap-2"
            :class="bubble.role === 'user' ? 'items-end' : 'items-start'"
          >
            <!-- 消息元信息: 助手 + 时间 + 复制 + 重新生成 -->
            <view v-if="bubble.role === 'assistant'" class="w-full flex items-center gap-x-2 text-xs text-gray-500">
              <text>{{ assistantName }}</text>
              <text v-if="bubble.time">{{ bubble.time }}</text>
              <view v-if="bubble.text" class="p-0.5" @click="handleCopy(bubble)">
                <wd-icon name="copy" size="26rpx" />
              </view>
              <view
                v-if="bubble.id === lastAssistantId && !streaming"
                class="p-0.5"
                @click="handleRegenerate(bubble.id)"
              >
                <wd-icon name="refresh" size="26rpx" />
              </view>
            </view>
            <view
              class="uh-ai-chat__bubble uh-global-card-glass uh-shadow-xs max-w-[80%] flex flex-col gap-y-2 !border !text-3xs"
              :class="bubble.role === 'user' ? 'uh-ai-chat__bubble--user' : 'uh-ai-chat__bubble--assistant'"
            >
              <template v-if="bubble.role === 'assistant'">
                <!-- 流式输出中用纯文本渲染, 结束后交 mp-html 一次性解析(连续更新会打穿其异步解析器) -->
                <text v-if="bubble.streaming && bubble.text" class="whitespace-pre-wrap break-words">
                  {{ bubble.text }}
                </text>
                <mp-html
                  v-else-if="bubble.text"
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

                <!-- 跳转动作卡片 -->
                <view v-if="bubble.actions?.length" class="flex flex-col gap-y-1.5">
                  <view class="text-xs text-gray-500">
                    即将为您打开...
                  </view>
                  <view
                    v-for="(action, index) in bubble.actions"
                    :key="index"
                    class="box-border flex items-center gap-x-1 rounded-md bg-primary p-1.5 text-gray-900"
                    @click="handleAction(action)"
                  >
                    <wd-icon name="link" size="24rpx" />
                    <text class="flex-1 truncate text-xs">{{ action.name || action.url }}</text>
                    <wd-icon name="arrow-right" size="24rpx" />
                  </view>
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

      <!-- 登录引导：需登录模式未认证时展示, 用户自行选择去登录 -->
      <view
        v-if="needLogin"
        class="box-border flex items-center justify-between gap-x-2 rounded-full bg-red-50 py-1 pl-3 pr-1 text-xs color-red-500"
      >
        <text class="flex-1">提示：登录后才能继续与AI助手对话。</text>
        <uh-button
          custom-class="uh-global-card-glass !shadow-none !border !py-1 !px-3 !rounded-full !text-xs"
          @click="goLogin"
        >
          去登录
        </uh-button>
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
.uh-ai-chat__quick {
  background-color: rgb(0 0 0 / 3%);
  color: rgb(0 0 0 / 65%);
}

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
  border-top-left-radius: 6rpx;
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
