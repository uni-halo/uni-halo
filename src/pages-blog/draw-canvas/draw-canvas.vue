<script lang="ts" setup>
import { computed, getCurrentInstance, onMounted, ref, watch } from 'vue'
import { useCanvasDraw } from '@/hooks/useCanvasDraw'
import { useTokenStore } from '@/store/token'
import { useAppConfigStore } from '@/store/appConfig'
import { getAttachmentPermalink, uploadAttachment } from '@/api/uni-admin'
import { createMyDraw } from '@/api/draw'
import { usePageScroll } from '@/hooks/usePageScroll'
import { useLoginPopup } from '@/hooks/useLoginPopup'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useNavbarSticky } from '@/hooks/useNavbarSticky'
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
/** 吸顶偏移（自定义导航栏高度） */
const { height: offsetTop } = useNavbarSticky()

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
  // 贴图(插入图片二创)
  activeImage,
  imagePlacement,
  insertImage,
  setImagePlacement,
  commitActiveImage,
  cancelActiveImage,
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
  { key: 'image', label: '贴图', icon: 'picture' },
]

function selectTool(tool: DrawTool) {
  // 贴图不是绘制工具:点击直接进入选图流程,不切换当前工具
  if (tool === 'image') {
    handleInsertImage()
    return
  }
  currentTool.value = tool
}

/* ---------------- 贴图(插入图片二创) ---------------- */
/** 贴图是否为置底层级 */
const isBottomPlacement = computed(() => imagePlacement.value === 'bottom')

/**
 * 选择图片来源并插入画布;默认置顶,层级由画布上浮动工具条调整。
 * 注意:直接调用 chooseImage(不经 showActionSheet 转发),否则 H5 端回调脱离用户激活,
 * 浏览器会拦截文件选择器("只能在用户激活时显示");微信端 chooseImage 自带拍摄/相册选择 UI。
 */
function handleInsertImage() {
  if (activeImage.value) {
    uni.showToast({ title: '先完成或删除当前贴图', icon: 'none' })
    return
  }
  uni.chooseImage({
    count: 1,
    sourceType: ['album', 'camera'],
    success: (res) => {
      const src = res.tempFilePaths?.[0]
      if (src)
        insertImage(src, 'top')
    },
  })
}

/** 浮动工具条:切换选中贴图层级 */
function toggleImagePlacement() {
  setImagePlacement(imagePlacement.value === 'bottom' ? 'top' : 'bottom')
}

/** 浮动工具条:删除选中贴图(不落版不计入历史) */
function removeActiveImage() {
  cancelActiveImage()
}

/** 浮动工具条:落版确认 */
async function confirmActiveImage() {
  await commitActiveImage()
}

/* ---------------- 顶部模式分段器:手绘 / 上传 ---------------- */
/** 创作模式:draw=手绘画布(现有能力) upload=上传图片(直接作为作品) */
const canvasMode = ref<'draw' | 'upload'>('draw')
/** 上传模式选中的图片(临时路径) */
const uploadSrc = ref('')
/** 上传图片尺寸信息(原始宽高 + 预览区适配后的宽高,px) */
const uploadImg = ref<{ w: number, h: number, fitW: number, fitH: number } | null>(null)
/** movable-view 摆放状态(相对预览区左上角,px;scale 为双指缩放倍数) */
const uploadTransform = ref({ x: 0, y: 0, scale: 1 })
/** 手势过程中的实际摆放(不回绑到 movable-view,回写会导致缩放被重置) */
const uploadPlacement = ref({ x: 0, y: 0, scale: 1 })

/** 切换创作模式;离开手绘态时放弃未落版的贴图选中 */
function switchCanvasMode(mode: 'draw' | 'upload') {
  if (mode === canvasMode.value)
    return
  if (activeImage.value)
    cancelActiveImage()
  canvasMode.value = mode
}

/** getImageInfo promise 封装 */
function getImageInfoAsync(src: string): Promise<{ width: number, height: number }> {
  return new Promise((resolve, reject) => {
    uni.getImageInfo({
      src,
      success: info => resolve({ width: info.width, height: info.height }),
      fail: reject,
    })
  })
}

/** 查询上传预览区尺寸(px) */
function queryUploadArea(): Promise<{ width: number, height: number }> {
  return new Promise((resolve, reject) => {
    const instance = getCurrentInstance()
    const query = instance ? uni.createSelectorQuery().in(instance.proxy) : uni.createSelectorQuery()
    query.select('#upload-area').boundingClientRect((rect: any) => {
      rect && rect.width > 0
        ? resolve({ width: rect.width, height: rect.height })
        : reject(new Error('预览区未就绪'))
    }).exec()
  })
}

/** 选图后计算预览适配尺寸并居中初始化摆放 */
async function applyUploadSrc(src: string) {
  try {
    const [info, area] = await Promise.all([getImageInfoAsync(src), queryUploadArea()])
    // 默认占满预览区:以最长边为准(cover),短边可超出,可拖动调整
    const fit = Math.max(area.width / info.width, area.height / info.height)
    const fitW = info.width * fit
    const fitH = info.height * fit
    uploadImg.value = { w: info.width, h: info.height, fitW, fitH }
    uploadTransform.value = { x: (area.width - fitW) / 2, y: (area.height - fitH) / 2, scale: 1 }
    uploadPlacement.value = { ...uploadTransform.value }
    uploadSrc.value = src
  }
  catch (err) {
    console.error('【上传作品】图片读取失败', err)
    uni.showToast({ title: '图片读取失败', icon: 'none' })
  }
}

/** 上传模式:选择图片(直接 chooseImage 保持用户激活,同 handleInsertImage 的 H5 兼容说明) */
function handleChooseUpload() {
  uni.chooseImage({
    count: 1,
    sourceType: ['album', 'camera'],
    success: (res) => {
      const src = res.tempFilePaths?.[0]
      if (src)
        applyUploadSrc(src)
    },
  })
}

/** movable-view 拖动:记录摆放位置 */
function handleUploadMove(e: any) {
  uploadPlacement.value.x = e.detail.x
  uploadPlacement.value.y = e.detail.y
}

/** movable-view 缩放:记录缩放倍数(事件同时带最新 x/y,一并同步) */
function handleUploadScale(e: any) {
  uploadPlacement.value.scale = e.detail.scale
  uploadPlacement.value.x = e.detail.x
  uploadPlacement.value.y = e.detail.y
}

/** 上传模式:移除已选图片 */
function handleRemoveUpload() {
  uploadSrc.value = ''
  uploadImg.value = null
  uploadTransform.value = { x: 0, y: 0, scale: 1 }
  uploadPlacement.value = { x: 0, y: 0, scale: 1 }
}

/** 查询隐藏合成画布节点(canvas 2d) */
function queryComposeNode(): Promise<any> {
  return new Promise((resolve, reject) => {
    const instance = getCurrentInstance()
    const query = instance ? uni.createSelectorQuery().in(instance.proxy) : uni.createSelectorQuery()
    query.select('#upload-compose').fields({ node: true, size: true }, () => {}).exec((res: any[]) => {
      res?.[0]?.node ? resolve(res[0].node) : reject(new Error('合成画布未就绪'))
    })
  })
}

/**
 * 合成上传作品:隐藏 canvas 以预览区同尺寸绘制(纸张底色 + 按摆放变换的图片),
 * 导出比例与手绘画布一致,发布链路复用现有附件上传。
 */
async function composeUploadImage(): Promise<string> {
  const src = uploadSrc.value
  const img = uploadImg.value
  if (!src || !img)
    throw new Error('图片未就绪')
  const [area, node] = await Promise.all([queryUploadArea(), queryComposeNode()])
  const dpr = Math.min(uni.getSystemInfoSync().pixelRatio || 2, 2)
  node.width = area.width * dpr
  node.height = area.height * dpr
  const ctx = node.getContext('2d')
  ctx.scale(dpr, dpr)
  // 底色与手绘纸张一致
  ctx.fillStyle = bgColor.value
  ctx.fillRect(0, 0, area.width, area.height)
  // 加载图片(小程序 canvas 2d 用 createImage,H5 用 Image)
  const drawable = await new Promise<any>((resolve, reject) => {
    let image: any
    if (typeof node.createImage === 'function') {
      image = node.createImage()
    }
    else {
      // #ifdef H5
      image = new Image()
      // #endif
    }
    if (!image) {
      reject(new Error('当前环境不支持图片合成'))
      return
    }
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片加载失败'))
    image.src = src
  })
  const t = uploadPlacement.value
  ctx.drawImage(drawable, t.x, t.y, img.fitW * t.scale, img.fitH * t.scale)
  return new Promise((resolve, reject) => {
    uni.canvasToTempFilePath({
      canvas: node,
      fileType: 'png',
      success: (res: any) => resolve(res.tempFilePath),
      fail: () => reject(new Error('作品合成失败')),
    } as any)
  })
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
  // 标题可含谜底:竞猜期间公开接口不下发标题(服务端脱敏),揭晓后恢复,无需客户端限制
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
  uploadSrc.value = ''
  uploadImg.value = null
  uploadTransform.value = { x: 0, y: 0, scale: 1 }
  uploadPlacement.value = { x: 0, y: 0, scale: 1 }
}

/** 发布画作：导出图片(手绘)或直用选图(上传) → 上传附件 → 提交绘画（owner/status 由服务端覆盖） */
async function handlePublish() {
  // 上传模式:必须已选图片;手绘模式:画布不能为空
  if (canvasMode.value === 'upload') {
    if (!uploadSrc.value) {
      uni.showToast({ title: '请先选择图片', icon: 'none' })
      return
    }
  }
  else if (isEmpty.value) {
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
    let tempPath: string
    if (canvasMode.value === 'upload') {
      // 上传模式:按摆放变换合成作品(纸张底色 + 图片),导出比例与手绘画布一致
      tempPath = await composeUploadImage()
    }
    else {
      // 手绘模式:未落版的贴图在导出前自动合并,避免丢素材
      if (activeImage.value) {
        await commitActiveImage()
        uni.showToast({ title: '已自动合并贴图', icon: 'none' })
      }
      tempPath = await exportImage()
    }
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
  <view class="box-border min-h-screen w-screen bg-page">
    <uh-navbar :scroll-y="scrollY" :default-title="pageTitle" :use-back="true" title-color="text-gray-900" />

    <!-- 创作模式分段器:手绘 / 上传(吸顶,样式对齐偏好设置页分段器) -->
    <wd-sticky :offset-top="offsetTop">
      <view class="box-border w-screen px-3 pt-2">
        <view class="uh-global-card-glass uh-shadow-xs flex rounded-xl p-1 !border">
          <view
            class="box-border flex-1 rounded-lg py-2 text-center text-3xs transition-colors"
            :class="canvasMode === 'draw' ? 'bg-primary font-medium' : 'text-gray-500'"
            @click="switchCanvasMode('draw')"
          >
            手绘创作
          </view>
          <view
            class="box-border flex-1 rounded-lg py-2 text-center text-3xs transition-colors"
            :class="canvasMode === 'upload' ? 'bg-primary font-medium' : 'text-gray-500'"
            @click="switchCanvasMode('upload')"
          >
            选择作品
          </view>
        </view>
      </view>
    </wd-sticky>

    <view class="box-border flex flex-col gap-y-3 p-3">
      <!-- 画布(固定高度;双层 canvas:底层烘焙已完成笔画,顶层预览当前笔画,画多不卡) -->
      <view
        v-show="canvasMode === 'draw'"
        class="uh-shadow-xs relative h-76 overflow-hidden rounded-xl" :style="{ backgroundColor: bgColor }"
      >
        <canvas
          id="draw-canvas-base" canvas-id="draw-canvas-base" type="2d"
          class="absolute left-0 top-0 h-full w-full"
        />
        <canvas
          id="draw-canvas" canvas-id="draw-canvas" type="2d" class="relative h-full w-full"
          @touchstart="onTouchStart" @touchmove.stop.prevent="onTouchMove" @touchend="onTouchEnd"
        />
        <!-- 贴图选中态操作提示 -->
        <view
          v-if="activeImage"
          class="absolute inset-x-0 top-2 z-10 text-center"
        >
          <text class="rounded-full bg-black/50 px-3 py-1 text-xs text-white">单指拖动 · 双指缩放旋转 · 点「完成」落版</text>
        </view>
        <!-- 贴图选中态浮动工具条(落版前可拖动/双指缩放旋转;与上传模式按钮位置一致) -->
        <view
          v-if="activeImage"
          class="absolute inset-x-0 bottom-3 z-10 flex items-center justify-center gap-2"
        >
          <view
            class="flex items-center gap-1 rounded-full bg-black/60 px-3 py-1.5 active:opacity-70"
            @click="toggleImagePlacement"
          >
            <wd-icon :name="isBottomPlacement ? 'arrow-down' : 'arrow-up'" size="26rpx" class="text-white" />
            <text class="text-xs text-white">{{ isBottomPlacement ? '置底' : '置顶' }}</text>
          </view>
          <view
            class="flex items-center gap-1 rounded-full bg-black/60 px-3 py-1.5 active:opacity-70"
            @click="removeActiveImage"
          >
            <wd-icon name="delete" size="26rpx" class="text-white" />
            <text class="text-xs text-white">删除</text>
          </view>
          <view
            class="flex items-center gap-1 rounded-full bg-black/60 px-3 py-1.5 active:opacity-70"
            @click="confirmActiveImage"
          >
            <wd-icon name="check" size="26rpx" class="text-white" />
            <text class="text-xs text-white">完成</text>
          </view>
        </view>
      </view>

      <!-- 上传模式:选图/预览区(可拖动/双指缩放摆放,发布时按变换合成) -->
      <!-- upload-area 挂外层容器:空态/选图态都要可查询(选图流程先量尺寸再渲染 movable-view) -->
      <view
        v-if="canvasMode === 'upload'"
        id="upload-area"
        class="uh-shadow-xs relative h-76 overflow-hidden rounded-xl"
        :class="uploadSrc ? '' : 'uh-global-card-glass border border-gray-100 border-dashed'"
      >
        <!-- 已选图:摆放区(movable-view 拖动 + 双指缩放,三端兼容) -->
        <template v-if="uploadSrc && uploadImg">
          <movable-area class="h-full w-full">
            <movable-view
              direction="all" :scale="true" :scale-min="0.5" :scale-max="3" :animation="false"
              :x="uploadTransform.x" :y="uploadTransform.y"
              :style="{ width: `${uploadImg.fitW}px`, height: `${uploadImg.fitH}px` }"
              class="overflow-hidden"
              @change="handleUploadMove" @scale="handleUploadScale"
            >
              <image :src="uploadSrc" mode="scaleToFill" class="h-full w-full" />
            </movable-view>
          </movable-area>
          <view class="absolute inset-x-0 top-2 z-10 text-center">
            <text class="rounded-full bg-black/50 px-3 py-1 text-xs text-white">单指拖动 · 双指缩放</text>
          </view>
          <view class="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-3">
            <view
              class="box-border flex items-center gap-1 rounded-full bg-black/60 px-3 py-1.5 active:opacity-70"
              @click.stop="handleChooseUpload"
            >
              <wd-icon name="refresh" size="26rpx" class="text-white" />
              <text class="text-xs text-white">换一张</text>
            </view>
            <view
              class="box-border flex items-center gap-1 rounded-full bg-black/60 px-3 py-1.5 active:opacity-70"
              @click.stop="handleRemoveUpload"
            >
              <wd-icon name="delete" size="26rpx" class="text-white" />
              <text class="text-xs text-white">移除</text>
            </view>
          </view>
        </template>
        <!-- 空态:点击选图 -->
        <template v-else>
          <view class="h-full w-full flex items-center justify-center" @click="handleChooseUpload">
            <view class="box-border flex flex-col items-center justify-center gap-y-2 border border-gray-300 rounded-xl border-dashed px-6 py-12">
              <wd-icon name="image" size="60rpx" class="text-gray-400" />
              <text class="text-3xs text-gray-500">点击从相册选择 / 拍照</text>
              <text class="text-xs text-gray-400">选好的图片可拖动缩放摆放后发布</text>
            </view>
          </view>
        </template>
      </view>

      <!-- 工具面板(仅手绘模式展示) -->
      <view v-show="canvasMode === 'draw'" class="box-border">
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
                class="uh-global-card-glass box-border flex items-center gap-1 border border-gray-100 rounded-full border-solid px-3 py-1.5 active:opacity-70 !shadow-none"
                :class="{ 'opacity-40': !canUndo }" @click="undo"
              >
                <wd-icon name="undo" size="28rpx" />
                <text class="text-xs">撤销</text>
              </view>
              <view
                class="uh-global-card-glass box-border flex items-center gap-1 border border-gray-100 rounded-full border-solid px-3 py-1.5 active:opacity-70 !shadow-none"
                :class="{ 'opacity-40': !canRedo }" @click="redo"
              >
                <wd-icon name="redo" size="28rpx" />
                <text class="text-xs">重做</text>
              </view>
              <view
                class="uh-global-card-glass box-border flex items-center gap-1 border border-gray-100 rounded-full border-solid px-3 py-1.5 active:opacity-70 !shadow-none"
                :class="{ 'opacity-40': isEmpty }" @click="clear"
              >
                <wd-icon name="delete" size="28rpx" />
                <text class="text-xs">清空</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 发布区(两种模式共用;上传模式在按钮上方展示介绍与说明) -->
      <view class="box-border flex flex-col gap-y-3">
        <view v-if="canvasMode === 'upload'" class="uh-global-card-glass flex flex-col gap-y-1.5 rounded-xl p-4 !border !shadow-none">
          <text class="text-sm text-gray-900 font-medium">上传图片作品</text>
          <text class="text-xs text-gray-500 leading-relaxed">
            从相册选择或拍一张照片，直接作为绘画作品发布。发布后与其他手绘作品一样参与展示、点赞与画谜竞猜；若站点开启发布审核，需审核通过后才公开展示。
          </text>
          <text class="text-xs text-gray-400 leading-relaxed">
            建议：图片请为自己原创或有权发布的内容，请勿上传违规图片。
          </text>
        </view>
        <view class="box-border w-full">
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
            v-model="title" placeholder="给画作起个标题（必填）"
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

    <!-- 上传作品合成画布(隐藏,发布时按摆放变换绘制并导出) -->
    <canvas
      id="upload-compose" canvas-id="upload-compose" type="2d"
      class="pointer-events-none fixed left-0 top-0 z--1 h-1 w-1 opacity-0"
    />
  </view>
</template>
