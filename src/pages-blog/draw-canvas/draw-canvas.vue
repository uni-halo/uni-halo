<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import KexColorPicker from '@/uni_modules/kex-color-picker/components/kex-color-picker/kex-color-picker.vue'
import { useCanvasDraw } from '@/hooks/useCanvasDraw'
import { useTokenStore } from '@/store/token'
import { toLoginPage } from '@/utils/toLoginPage'
import { getAttachmentPermalink, uploadAttachment } from '@/api/uni-admin'
import { createMyDraw } from '@/api/draw'
import type { BrushStyle, DrawTool } from '@/hooks/useCanvasDraw'

definePage({
  style: {
    navigationBarTitleText: '画一幅',
    navigationStyle: 'custom',
    disableScroll: true,
  },
})

/* ---------------- 画布 ---------------- */
const textInputVisible = ref(false)

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
  commitText,
  undo,
  redo,
  clear,
  setBg,
  exportImage,
} = useCanvasDraw({
  canvasId: 'draw-canvas',
  onTextRequest: () => {
    textInputVisible.value = true
  },
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

function selectColor(color: string) {
  currentColor.value = color
}

function selectPaper(color: string) {
  setBg(color)
}
const tools: { key: DrawTool, label: string, icon: string }[] = [
  { key: 'brush', label: '画笔', icon: 'edit-outline' },
  { key: 'eraser', label: '橡皮', icon: 'delete' },
  { key: 'fill', label: '填充', icon: 'fill' },
  { key: 'text', label: '文字', icon: 'font' },
  { key: 'line', label: '直线', icon: 'arrow-right' },
  { key: 'rect', label: '矩形', icon: 'stop' },
  { key: 'circle', label: '圆形', icon: 'circle' },
]

function selectTool(tool: DrawTool) {
  currentTool.value = tool
  if (tool === 'text') {
    textInputVisible.value = true
  }
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

/* ---------------- 文字工具 ---------------- */
const textInputValue = ref('')

function confirmText() {
  commitText(textInputValue.value)
  textInputValue.value = ''
  textInputVisible.value = false
  // 文字落笔后回到画笔工具
  currentTool.value = 'brush'
}

const releasePopupVisible = ref(false)

function handleShowReleasePopup() {
  releasePopupVisible.value = true
}

/* ---------------- 发布 ---------------- */
const tokenStore = useTokenStore()
const title = ref('')
const publishing = ref(false)

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
    uni.showToast({ title: '请先登录', icon: 'none' })
    toLoginPage()
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
      cover: permalink,
      attachmentName: attachment.metadata?.name,
    })
    const approved = res.data?.spec?.status === 'APPROVED'
    uni.showToast({ title: approved ? '发布成功' : '已提交，等待审核', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 1200)
  }
  catch (err: any) {
    console.error('发布失败', err)
    uni.showToast({ title: err?.message || '发布失败，请稍后重试', icon: 'none' })
  }
  finally {
    publishing.value = false
  }
}
</script>

<template>
  <view class="box-border min-h-screen w-screen flex flex-col gap-y-3 bg-page p-3 pt-0">
    <uh-navbar default-title="画一幅" :use-back="true" />

    <!-- 画布(固定高度,背景色动态跟随纸张) -->
    <view class="uh-shadow-xs h-[750rpx] overflow-hidden rounded-xl" :style="{ backgroundColor: bgColor }">
      <canvas
        id="draw-canvas" canvas-id="draw-canvas" type="2d" class="h-full w-full" @touchstart="onTouchStart"
        @touchmove.stop.prevent="onTouchMove" @touchend="onTouchEnd"
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
              <wd-icon v-if="currentColor === color" name="check" size="20rpx" class="text-white" />
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
        <view class="flex flex-wrap items-center gap-2">
          <text class="w-10 shrink-0 text-xs text-gray-500">笔触</text>
          <view class="flex flex-1 items-center gap-3">
            <wd-slider v-model="currentLineWidth" :min="2" :max="40" hide-label custom-class="flex-1" />
            <text class="w-6 text-right text-xs text-gray-500">{{ currentLineWidth }}</text>
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
              <wd-icon name="redo" size="28rpx" />
              <text class="text-xs">撤销</text>
            </view>
            <view
              class="uh-global-card-glass flex items-center gap-1 border border-gray-100 rounded-full border-solid px-3 py-1.5 active:opacity-70 !shadow-none"
              :class="{ 'opacity-40': !canRedo }" @click="redo"
            >
              <wd-icon name="refresh" size="28rpx" />
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
            custom-class="uh-global-card-glass flex items-center gap-1 border border-gray-100 rounded-full border-solid px-3 py-2 !bg-primary !rounded-full active:opacity-70 !shadow-none"
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
        <view class="uh-global-card-glass w-full flex flex-1 items-center border rounded-xl px-4 py-2.5 !shadow-none">
          <textarea v-model="title" placeholder="说一说你的创作，画作描述..." class="w-full text-sm" :maxlength="30" />
        </view>
        <view class="w-full">
          <uh-button
            class="w-full flex-1"
            custom-class="uh-global-card-glass uh-shadow-xs !border !rounded-xl !bg-primary !py-2 !text-sm !text-gray-900 active:opacity-80"
            :class="{ 'opacity-60': publishing }" @click="handlePublish"
          >
            发布画作
          </uh-button>
        </view>
      </view>
    </uh-glass-popup>

    <!-- 文字输入弹窗 -->
    <uh-glass-popup v-model="textInputVisible" position="bottom" :z-index="110" custom-class="!rounded-2xl">
      <view class="box-border flex flex-col gap-3 p-3">
        <!-- 顶部 -->
        <view class="relative box-border w-full flex items-center justify-center">
          <view class="flex gap-y-1">
            <text class="text-md font-bold">添加文字</text>
          </view>
          <view
            class="uh-global-card-glass absolute right-0 top-0 h-6 w-6 flex items-center justify-center border rounded-lg shadow-none"
            @click="releasePopupVisible = false"
          >
            <wd-icon name="close" size="28rpx" class="text-gray-500" />
          </view>
        </view>
        <view class="uh-global-card-glass w-full flex flex-1 items-center border rounded-xl px-4 py-2.5 !shadow-none">
          <textarea v-model="textInputValue" placeholder="请输入文字内容..." class="w-full text-sm" :maxlength="30" />
        </view>

        <view class="w-full">
          <uh-button
            class="w-full flex-1"
            custom-class="uh-global-card-glass uh-shadow-xs !border !rounded-xl !bg-primary !py-2 !text-sm !text-gray-900 active:opacity-80"
            @click="confirmText"
          >
            确认
          </uh-button>
        </view>
      </view>
    </uh-glass-popup>

    <kex-color-picker
      ref="colorPickerRef" v-model="currentColor" title="画笔颜色" size="small" :show-trigger="false"
      :show-alpha="true" :presets="palette" :realtime="true"
    />
  </view>
</template>
