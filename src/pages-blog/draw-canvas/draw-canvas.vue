<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useCanvasDraw } from '@/hooks/useCanvasDraw'
import { useTokenStore } from '@/store/token'
import { useAppConfigStore } from '@/store/appConfig'
import { getAttachmentPermalink, uploadAttachment } from '@/api/uni-admin'
import { createMyDraw } from '@/api/draw'
import { usePageScroll } from '@/hooks/usePageScroll'
import { useLoginPopup } from '@/hooks/useLoginPopup'
import { usePageTitle } from '@/hooks/usePageTitle'
import type { BrushStyle, DrawTool } from '@/hooks/useCanvasDraw'

import KexColorPicker from '@/uni_modules/kex-color-picker/components/kex-color-picker/kex-color-picker.vue'

definePage({
  style: {
    navigationBarTitleText: '画一幅',
    navigationStyle: 'custom',
  },
})

const { scrollY, updatePageScrollValue } = usePageScroll()
/** 页面标题（插件端可配置，留空回退内置默认） */
const pageTitle = usePageTitle('drawCanvas', '画一幅')

/* ---------------- 画布 ---------------- */
const {
  currentColor,
  currentLineWidth,
  currentBrushStyle,
  currentTool,
  shapeFilled,
  bgColor,
  canUndo,
  canRedo,
  isEmpty,
  init,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  undo,
  redo,
  clear,
  setBg,
  exportImage,
} = useCanvasDraw({
  canvasId: 'draw-canvas',
})

const canvasReady = ref(false)
const colorPickerRef = ref<typeof KexColorPicker>()

onMounted(async () => {
  try {
    await init()
    canvasReady.value = true
  }
  catch (err) {
    console.error('画布初始化失败', err)
  }
})

/* ---------------- 工具栏 ---------------- */
/** 快捷色板 */
const palette = ['#1E293B', '#EF4444', '#FACC15', '#22C55E', '#3B82F6', '#A855F7']
/** 纸张背景 */
const papers = [
  { key: '#FFFFFF', label: '白纸', icon: 'picture' },
  { key: '#FDF6E3', label: '牛皮', icon: 'picture' },
  { key: '#1E293B', label: '黑板', icon: 'picture' },
]

function openColorPicker() {
  colorPickerRef.value?.open()
}

/* ---------------- 颜色 + 透明度(统一在外合成,取色器不带 alpha 通道) ---------------- */
/** 基础色(不含透明度,hex) */
const baseColor = ref('#1E293B')
/** 画笔不透明度(%,0-100) */
const colorOpacity = ref(100)

/** hex + 不透明度 → 绘制用颜色(不透明直接用 hex,半透明转 rgba) */
function withAlpha(hex: string, opacity: number): string {
  const value = hex.trim()
  if (opacity >= 100) {
    return value
  }
  const raw = value.replace('#', '')
  const full = raw.length === 3 ? raw.split('').map(s => s + s).join('') : raw.slice(0, 6)
  if (full.length !== 6) {
    return value
  }
  const r = Number.parseInt(full.slice(0, 2), 16)
  const g = Number.parseInt(full.slice(2, 4), 16)
  const b = Number.parseInt(full.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${(opacity / 100).toFixed(2)})`
}

// 基础色或透明度变化时统一合成绘制色(hook 内笔画/橡皮/形状均消费 currentColor)
watch([baseColor, colorOpacity], () => {
  currentColor.value = withAlpha(baseColor.value, colorOpacity.value)
}, { immediate: true })

function selectColor(color: string) {
  baseColor.value = color
}

function selectPaper(color: string) {
  setBg(color)
}
const tools: { key: DrawTool, label: string, icon: string }[] = [
  { key: 'brush', label: '画笔', icon: 'edit-outline' },
  { key: 'eraser', label: '橡皮', icon: 'delete' },
  { key: 'fill', label: '填充', icon: 'fill' },
  { key: 'line', label: '直线', icon: 'arrow-right' },
  { key: 'rect', label: '矩形', icon: 'stop' },
  { key: 'circle', label: '圆形', icon: 'circle' },
]

function selectTool(tool: DrawTool) {
  currentTool.value = tool
}

/** 画笔样式选项 */
const brushStyles: { key: BrushStyle, label: string, icon: string }[] = [
  { key: 'round', label: '圆头', icon: 'checkbox-mark' },
  { key: 'square', label: '方头', icon: 'stop' },
  { key: 'crayon', label: '蜡笔', icon: 'edit-outline' },
]

function selectBrushStyle(style: BrushStyle) {
  currentBrushStyle.value = style
}

const releasePopupVisible = ref(false)

function handleShowReleasePopup() {
  releasePopupVisible.value = true
}

/* ---------------- 发布 ---------------- */
const tokenStore = useTokenStore()
const { openLoginPopup } = useLoginPopup()
const title = ref('')
const description = ref('')
const publishing = ref(false)

/* ---------------- 猜画设置（在原发布弹窗上扩展） ---------------- */
const appConfigStore = useAppConfigStore()
/** 猜画玩法总开关（插件端「绘画设置」下发；关闭时隐藏发布猜画设置，缺省开启） */
const guessModeEnabled = computed(() =>
  appConfigStore.configs?.featureConfig?.pages?.draw?.guessEnabled !== false)
const guessEnabled = ref(false)
/** 谜底（开启猜画时必填，≤20 字） */
const puzzleAnswer = ref('')
/** 提示语（选填） */
const puzzleHint = ref('')
/** 自动揭晓预设（0 = 不自动揭晓，仅手动） */
const autoRevealOptions = [
  { label: '手动揭晓', hours: 0 },
  { label: '1 小时后', hours: 1 },
  { label: '1 天后', hours: 24 },
  { label: '3 天后', hours: 72 },
] as const
const autoRevealChoice = ref(0)

/** 自动揭晓时间（RFC3339；不自动 = undefined） */
function resolveAutoRevealAt(): string | undefined {
  const hours = autoRevealOptions[autoRevealChoice.value]?.hours ?? 0
  return hours > 0 ? new Date(Date.now() + hours * 3600_000).toISOString() : undefined
}

function handlePublishValidatePuzzle(): string | null {
  if (!guessEnabled.value) { return null }
  const answer = puzzleAnswer.value.trim()
  if (!answer) {
    return '开启画谜需要填写谜底'
  }
  if (answer.length > 20) {
    return '谜底不能超过 20 字'
  }
  if (title.value.trim() && title.value.trim().includes(answer)) {
    return '标题里不要包含谜底哦'
  }
  return null
}

function resetPublishForm() {
  clear()
  guessEnabled.value = false
  title.value = ''
  description.value = ''
  puzzleAnswer.value = ''
  puzzleHint.value = ''
  autoRevealChoice.value = 0
}

/** 发布画作：导出图片 → 上传附件 → 提交绘画（owner/status 由服务端覆盖） */
async function handlePublish() {
  if (isEmpty.value) {
    uni.showToast({ title: '画布还是空的', icon: 'none' })
    return
  }
  if (!title.value.trim()) {
    uni.showToast({ title: '给画作起个标题吧', icon: 'none' })
    return
  }
  if (!tokenStore.updateNowTime().hasLogin) {
    openLoginPopup(() => handlePublish())
    return
  }
  const puzzleError = handlePublishValidatePuzzle()
  if (puzzleError) {
    uni.showToast({ title: puzzleError, icon: 'none' })
    return
  }
  publishing.value = true
  try {
    const tempPath = await exportImage()
    const attachment = await uploadAttachment(tempPath)
    const permalink = getAttachmentPermalink(attachment)
    if (!permalink) {
      throw new Error('未获取到文件地址，请稍后重试')
    }
    const res = await createMyDraw({
      title: title.value.trim(),
      description: description.value.trim() || undefined,
      cover: permalink,
      attachmentName: attachment.metadata?.name,
      // 竞猜字段（关闭猜画时不传，服务端强制清理）
      puzzleAnswer: guessEnabled.value ? puzzleAnswer.value.trim() : undefined,
      puzzleHint: guessEnabled.value && puzzleHint.value.trim()
        ? puzzleHint.value.trim()
        : undefined,
      autoRevealAt: guessEnabled.value ? resolveAutoRevealAt() : undefined,
    })
    const approved = res.data?.spec?.status === 'APPROVED'
    uni.showToast({ title: approved ? '发布成功' : '已提交，等待审核', icon: 'none' })
    releasePopupVisible.value = false
    resetPublishForm()
  }
  catch (err: any) {
    console.error('发布失败', err)
    uni.showToast({ title: err?.message || '发布失败，请稍后重试', icon: 'none', duration: 2000 })
  }
  finally {
    publishing.value = false
  }
}

onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})
</script>

<template>
  <view class="box-border min-h-screen w-screen flex flex-col gap-y-3 bg-page p-3 pt-0">
    <uh-navbar :scroll-y="scrollY" :default-title="pageTitle" :use-back="true" title-color="text-gray-900" />

    <!-- 画布(固定高度;双层 canvas:底层烘焙已完成笔画,顶层预览当前笔画,画多不卡) -->
    <view class="uh-shadow-xs relative h-[750rpx] overflow-hidden rounded-xl" :style="{ backgroundColor: bgColor }">
      <canvas
        id="draw-canvas-base" canvas-id="draw-canvas-base" type="2d"
        class="absolute left-0 top-0 h-full w-full"
      />
      <canvas
        id="draw-canvas" canvas-id="draw-canvas" type="2d" class="relative h-full w-full"
        @touchstart="onTouchStart" @touchmove.stop.prevent="onTouchMove" @touchend="onTouchEnd"
      />
    </view>

    <view class="box-border">
      <view class="uh-global-card-glass uh-shadow-xs box-border flex flex-col gap-y-3 rounded-xl p-4 !border">
        <!-- 工具选择(自动换行) -->
        <view class="flex flex-wrap gap-2">
          <text class="box-border w-10 shrink-0 pt-2 text-xs text-gray-500">工具</text>
          <view class="flex flex-1 flex-wrap items-center gap-2">
            <view
              v-for="tool in tools" :key="tool.key"
              class="box-border flex items-center border rounded-full border-solid px-2.5 py-1 !shadow-none"
              :class="currentTool === tool.key ? 'border-primary bg-primary text-gray-900' : 'uh-global-card-glass border-gray-100 text-gray-700'"
              @click="selectTool(tool.key)"
            >
              <text class="text-xs">{{ tool.label }}</text>
            </view>
          </view>
        </view>

        <!-- 画笔样式(仅画笔工具时展示) -->
        <view v-if="currentTool === 'brush'" class="flex flex-wrap items-center gap-2">
          <text class="w-10 shrink-0 text-xs text-gray-500">笔头</text>
          <view class="flex flex-1 flex-wrap items-center gap-2">
            <view
              v-for="style in brushStyles" :key="style.key"
              class="box-border flex items-center border rounded-full border-solid px-2.5 py-1 !shadow-none"
              :class="currentBrushStyle === style.key ? 'border-primary bg-primary text-gray-900' : 'uh-global-card-glass border-gray-100 text-gray-700'"
              @click="selectBrushStyle(style.key)"
            >
              <text class="text-xs">{{ style.label }}</text>
            </view>
          </view>
        </view>

        <!-- 形状填充(仅形状工具时展示) -->
        <view v-else-if="['line', 'rect', 'circle'].includes(currentTool)" class="flex flex-wrap items-center gap-2">
          <text class="w-10 shrink-0 text-xs text-gray-500">形状</text>
          <view class="flex flex-1 flex-wrap items-center gap-2">
            <view
              class="box-border flex items-center border rounded-full px-2.5 py-1 !shadow-none"
              :class="shapeFilled ? 'border-primary bg-primary text-gray-900' : 'uh-global-card-glass border-gray-100 text-gray-700'"
              @click="shapeFilled = !shapeFilled"
            >
              <text class="text-xs">{{ shapeFilled ? '填充' : '描边' }}</text>
            </view>
          </view>
        </view>

        <!-- 快捷色板 + 取色器 -->
        <view class="flex flex-wrap items-center gap-2">
          <text class="w-10 shrink-0 text-xs text-gray-500">颜色</text>
          <view class="flex flex-1 flex-wrap items-center gap-2">
            <view
              v-for="color in palette" :key="color"
              class="h-6.5 w-6.5 flex items-center justify-center rounded-full transition-transform"
              :style="{ backgroundColor: color }" @click="selectColor(color)"
            >
              <wd-icon v-if="baseColor === color" name="check" size="20rpx" class="text-white" />
            </view>
            <view
              class="uh-shadow-xs h-6.5 w-6.5 flex items-center justify-center gap-x-2 rounded-full bg-white/60"
              :style="{ backgroundColor: currentColor }" @click="openColorPicker"
            >
              <wd-icon name="plus" size="24rpx" class="text-white" />
            </view>
          </view>
        </view>

        <!-- 纸张背景 -->
        <view class="flex flex-wrap items-center gap-2">
          <text class="w-10 shrink-0 text-xs text-gray-500">纸张</text>
          <view class="flex flex-1 flex-wrap items-center gap-2">
            <view
              v-for="paper in papers" :key="paper.key"
              class="box-border flex items-center gap-1 border rounded-full px-2 py-1 !shadow-none"
              :class="bgColor === paper.key ? 'border-primary bg-primary text-gray-900' : 'uh-global-card-glass  border-gray-100 text-gray-700'"
              @click="selectPaper(paper.key)"
            >
              <view
                class="h-3 w-3 border border-gray-200 rounded-full border-solid"
                :style="{ backgroundColor: paper.key }"
              />
              <text class="text-xs">{{ paper.label }}</text>
            </view>
          </view>
        </view>

        <!-- 笔触粗细 -->
        <view class="box-border flex flex-wrap items-center gap-2 pr-12">
          <text class="w-10 shrink-0 text-xs text-gray-500">笔触</text>
          <view class="flex flex-1 items-center gap-3">
            <wd-slider v-model="currentLineWidth" :min="2" :max="40" hide-label custom-class="flex-1" />
            <text class="w-6 text-right text-xs text-gray-500">{{ currentLineWidth }}</text>
          </view>
        </view>

        <!-- 透明度(统一设置,作用于画笔/形状;取色器不含 alpha 通道) -->
        <view class="box-border flex flex-wrap items-center gap-2 pr-12">
          <text class="w-10 shrink-0 text-xs text-gray-500">透明度</text>
          <view class="flex flex-1 items-center gap-3">
            <wd-slider v-model="colorOpacity" :min="10" :max="100" hide-label custom-class="flex-1" />
            <text class="w-6 text-right text-xs text-gray-500">{{ colorOpacity }}%</text>
          </view>
        </view>

        <!-- 操作按钮(图标+文字) -->
        <view class="flex flex-wrap gap-2">
          <text class="box-border w-10 shrink-0 pt-2 text-xs text-gray-500">操作</text>
          <view class="flex flex-1 flex-wrap items-center gap-2">
            <view
              class="uh-global-card-glass flex items-center gap-1 border border-gray-100 rounded-full border-solid px-3 py-1.5 active:opacity-70 !shadow-none"
              :class="{ 'opacity-40': !canUndo }" @click="undo"
            >
              <wd-icon name="undo" size="28rpx" />
              <text class="text-xs">撤销</text>
            </view>
            <view
              class="uh-global-card-glass flex items-center gap-1 border border-gray-100 rounded-full border-solid px-3 py-1.5 active:opacity-70 !shadow-none"
              :class="{ 'opacity-40': !canRedo }" @click="redo"
            >
              <wd-icon name="redo" size="28rpx" />
              <text class="text-xs">重做</text>
            </view>
            <view
              class="uh-global-card-glass flex items-center gap-1 border border-gray-100 rounded-full border-solid px-3 py-1.5 active:opacity-70 !shadow-none"
              :class="{ 'opacity-40': isEmpty }" @click="clear"
            >
              <wd-icon name="delete" size="28rpx" />
              <text class="text-xs">清空</text>
            </view>
          </view>
        </view>

        <view class="box-border w-full pt-1">
          <uh-button
            class="w-full flex-1"
            custom-class="uh-global-card-glass flex items-center gap-1 !border  px-3 py-2 !bg-primary !rounded-full active:opacity-70 !shadow-none"
            @click="handleShowReleasePopup"
          >
            <wd-icon name="send" size="28rpx" />
            <text class="text-sm !text-gray-900">发布到作品展示</text>
          </uh-button>
        </view>
      </view>
    </view>

    <!-- 发布弹窗 -->
    <uh-glass-popup v-model="releasePopupVisible" position="bottom" :z-index="110" custom-class="!rounded-2xl">
      <view class="box-border w-full flex flex-col items-center gap-3 p-3">
        <!-- 顶部 -->
        <view class="relative box-border w-full flex items-center justify-around">
          <view class="w-full flex flex-col gap-y-1">
            <text class="text-md font-bold">发布作品</text>
            <text class="text-xs text-gray-500">发布我的绘画作品绘画展示</text>
          </view>
          <view
            class="uh-global-card-glass absolute right-0 top-0 h-6 w-6 flex items-center justify-center border rounded-lg shadow-none"
            @click="releasePopupVisible = false"
          >
            <wd-icon name="close" size="28rpx" class="text-gray-500" />
          </view>
        </view>
        <view class="uh-global-card-glass w-full flex items-center border rounded-xl px-4 py-2.5 !shadow-none">
          <input
            v-model="title" :placeholder="guessEnabled ? '给画作起个标题（必填，别写谜底哦）' : '给画作起个标题（必填）'"
            placeholder-class="text-gray-400"
            class="w-full text-sm" :maxlength="50"
          >
        </view>
        <view class="uh-global-card-glass w-full flex items-start border rounded-xl px-4 py-2.5 !shadow-none">
          <textarea
            v-model="description" placeholder="介绍一下你的创作灵感（选填）" placeholder-class="text-gray-400"
            class="h-20 w-full p-0 text-sm" :maxlength="200"
          />
        </view>

        <!-- 猜画设置（扩展在原发布弹窗上） -->
        <!-- 猜画设置（扩展在原发布弹窗上；站点关闭猜画玩法时整块隐藏） -->
        <view
          v-if="guessModeEnabled"
          class="uh-global-card-glass w-full flex flex-col gap-y-3 border rounded-xl p-3 !shadow-none"
        >
          <view class="flex items-center justify-between">
            <view class="flex flex-col gap-y-0.5">
              <text class="text-xs text-gray-900 font-medium">开启画谜</text>
              <text class="text-xs text-gray-400">其他用户可猜谜底，猜中画谜排行榜 +1</text>
            </view>
            <wd-switch v-model="guessEnabled" size="40rpx" />
          </view>
          <template v-if="guessEnabled">
            <view class="w-full flex items-center gap-x-1">
              <text class="shrink-0 text-xs text-gray-500">谜底设置：</text>
              <view
                class="uh-global-card-glass flex flex-1 items-center border border-gray-100 rounded-lg border-solid px-3 py-2 !shadow-none"
              >
                <input
                  v-model="puzzleAnswer" placeholder="谜底（必填，≤20 字，猜中需完全一致）" placeholder-class="text-gray-400"
                  class="w-full text-xs" :maxlength="20"
                >
              </view>
            </view>
            <view class="w-full flex items-center gap-x-1">
              <text class="shrink-0 text-xs text-gray-500">提示描述：</text>
              <view
                class="uh-global-card-glass flex flex-1 items-center border border-gray-100 rounded-lg border-solid px-3 py-2 !shadow-none"
              >
                <input
                  v-model="puzzleHint" placeholder="提示语（选填，如：一种动物）" placeholder-class="text-gray-400"
                  class="w-full text-xs" :maxlength="50"
                >
              </view>
            </view>

            <text class="text-xs text-gray-500">揭晓时间：</text>
            <view class="flex flex-wrap gap-x-4 gap-y-2">
              <view
                v-for="(option, index) in autoRevealOptions" :key="option.hours"
                class="box-border flex items-center gap-x-1 border rounded-full border-solid px-2 py-0.5"
                :class="[
                  autoRevealChoice === index ? 'border-primary bg-primary' : 'bg-gray-50 border-gray-100',
                ]" @click="autoRevealChoice = index"
              >
                <text
                  class="text-xs"
                  :class="autoRevealChoice === index ? 'text-gray-900' : 'text-gray-500'"
                >
                  {{ option.label }}
                </text>
              </view>
            </view>
          </template>
        </view>

        <view class="w-full">
          <uh-button
            class="w-full flex-1"
            custom-class="uh-global-card-glass uh-shadow-xs !border !rounded-xl !bg-primary !py-2 !text-sm !text-gray-900 active:opacity-80"
            :class="{ 'opacity-60': publishing }" @click="handlePublish"
          >
            确认发布画作
          </uh-button>
        </view>
      </view>
    </uh-glass-popup>

    <kex-color-picker
      ref="colorPickerRef" v-model="baseColor" title="画笔颜色" size="small" :show-trigger="false"
      :show-alpha="false" :presets="palette" :realtime="true"
    />
  </view>
</template>
