import { computed, getCurrentInstance, ref } from 'vue'

/** 画笔样式 */
export type BrushStyle = 'round' | 'square' | 'crayon'

/** 绘制工具 */
export type DrawTool = 'brush' | 'eraser' | 'line' | 'rect' | 'circle' | 'fill'

/** 单条笔画(自由绘制/橡皮/形状共用,shape 区分几何类型) */
export interface IStroke {
  /** 笔画种类:free=自由绘制 eraser=橡皮 fill=油漆桶,其余按 shape 几何绘制 */
  kind: 'free' | 'eraser' | 'fill'
  /** 几何形状(kind=free 且无 shape 时为普通笔画) */
  shape?: 'line' | 'rect' | 'circle'
  /** 颜色(完整 css color,含透明度) */
  color: string
  /** 线宽 */
  width: number
  /** 画笔样式 */
  style: BrushStyle
  /** 是否填充形状(矩形/圆形) */
  filled?: boolean
  /** 触点列表(canvas 逻辑坐标) */
  points: { x: number, y: number }[]
}

/** useCanvasDraw 配置 */
export interface IUseCanvasDrawOptions {
  /** canvas id(页面内唯一) */
  canvasId?: string
  /** 初始默认颜色 */
  color?: string
  /** 初始默认线宽 */
  lineWidth?: number
  /** 初始画笔样式 */
  brushStyle?: BrushStyle
  /** 初始背景色 */
  bgColor?: string
}

/**
 * 画布绘制 hook:笔画管理、平滑绘制、形状/填充/橡皮、撤销重做、背景色、导出
 * 兼容 H5 / 微信小程序 / APP(Canvas 2D 接口)
 */
export function useCanvasDraw(options: IUseCanvasDrawOptions = {}) {
  const {
    canvasId = 'draw-canvas',
    color = '#1E293B',
    lineWidth = 14,
    brushStyle = 'round',
    bgColor: initialBg = '#FFFFFF',
  } = options

  /** 当前颜色 */
  const currentColor = ref(color)
  /** 当前线宽 */
  const currentLineWidth = ref(lineWidth)
  /** 当前画笔样式 */
  const currentBrushStyle = ref<BrushStyle>(brushStyle)
  /** 当前工具 */
  const currentTool = ref<DrawTool>('brush')
  /** 形状是否填充(矩形/圆形) */
  const shapeFilled = ref(false)
  /** 背景色 */
  const bgColor = ref(initialBg)
  /** 笔画历史(撤销/重绘依据) */
  const strokes = ref<IStroke[]>([])
  /** 重做栈(撤销时压入,新笔画时清空) */
  const redoStack = ref<IStroke[]>([])
  /** 是否可以撤销 */
  const canUndo = computed(() => strokes.value.length > 0)
  /** 是否可以重做 */
  const canRedo = computed(() => redoStack.value.length > 0)
  /** 是否为空画布 */
  const isEmpty = computed(() => strokes.value.length === 0)

  /** canvas 节点 */
  let canvasNode: any = null
  /** 绘制上下文 */
  let ctx: any = null
  /** 画布逻辑尺寸(css 像素) */
  let canvasWidth = 0
  let canvasHeight = 0
  /** 画布相对视口偏移(H5 触摸坐标为 clientX/Y,需扣除) */
  let canvasOffsetX = 0
  let canvasOffsetY = 0
  /** 当前正在绘制的笔画 */
  let activeStroke: IStroke | null = null

  /** 获取 2d 上下文并初始化画布尺寸(统一走 uni-app createSelectorQuery,各端通用) */
  function init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const instance = getCurrentInstance()
      const query = instance ? uni.createSelectorQuery().in(instance.proxy) : uni.createSelectorQuery()
      query
        .select(`#${canvasId}`)
        .fields({ node: true, size: true, rect: true }, () => {})
        .exec((res: any[]) => {
          const info = res?.[0]
          if (!info?.node) {
            reject(new Error('canvas not found'))
            return
          }
          canvasNode = info.node
          canvasWidth = info.width
          canvasHeight = info.height
          // 记录视口偏移(H5 触摸坐标为 clientX/Y,需扣除)
          canvasOffsetX = info.left || 0
          canvasOffsetY = info.top || 0
          // 物理分辨率放大,避免导出模糊
          const dpr = uni.getSystemInfoSync().pixelRatio || 2
          canvasNode.width = info.width * dpr
          canvasNode.height = info.height * dpr
          // 锁定 css 尺寸,防止属性变化带动布局尺寸跳变
          if (canvasNode.style) {
            canvasNode.style.width = `${info.width}px`
            canvasNode.style.height = `${info.height}px`
          }
          ctx = canvasNode.getContext('2d')
          ctx.scale(dpr, dpr)
          resolve()
        })
    })
  }

  /** 触摸事件坐标转画布逻辑坐标(小程序 touch.x 已相对画布;H5 clientX/Y 需扣视口偏移),并收敛到画布范围内 */
  function getPoint(e: any): { x: number, y: number } {
    const touch = e.touches?.[0] || e.changedTouches?.[0] || e
    let rx = 0
    let ry = 0
    // #ifdef H5
    rx = (touch.clientX ?? 0) - canvasOffsetX
    ry = (touch.clientY ?? 0) - canvasOffsetY
    // #endif
    // #ifndef H5
    rx = touch.x ?? 0
    ry = touch.y ?? 0
    // #endif
    return {
      x: Math.min(Math.max(rx, 0), canvasWidth),
      y: Math.min(Math.max(ry, 0), canvasHeight),
    }
  }

  /** 按样式应用描边参数(eraser 使用 destination-out 实现真擦除) */
  function applyStrokeStyle(stroke: IStroke) {
    ctx.globalCompositeOperation = stroke.kind === 'eraser' ? 'destination-out' : 'source-over'
    ctx.strokeStyle = stroke.color
    ctx.fillStyle = stroke.color
    ctx.lineWidth = stroke.width
    ctx.lineJoin = 'round'
    if (stroke.style === 'square') {
      ctx.lineCap = 'square'
    }
    else {
      // round / crayon 均用圆头,蜡笔质感靠多次抖动叠加
      ctx.lineCap = 'round'
    }
  }

  /** 蜡笔纹理:沿主线多次低透明度抖动重绘,叠加出颗粒质感 */
  function drawCrayonSegment(from: { x: number, y: number }, to: { x: number, y: number }, stroke: IStroke) {
    const w = stroke.width
    ctx.save()
    ctx.globalAlpha = 0.28
    for (let i = 0; i < 4; i++) {
      const jx = (Math.random() - 0.5) * w * 0.36
      const jy = (Math.random() - 0.5) * w * 0.36
      ctx.beginPath()
      ctx.moveTo(from.x + jx, from.y + jy)
      ctx.lineTo(to.x + jx, to.y + jy)
      ctx.lineWidth = w * (i === 0 ? 1 : 0.5)
      ctx.stroke()
    }
    ctx.restore()
  }

  /** 绘制几何形状 */
  function drawShape(stroke: IStroke) {
    const [a, b] = [stroke.points[0], stroke.points[stroke.points.length - 1]]
    ctx.beginPath()
    if (stroke.shape === 'line') {
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
    else if (stroke.shape === 'rect') {
      const x = Math.min(a.x, b.x)
      const y = Math.min(a.y, b.y)
      const w = Math.abs(b.x - a.x)
      const h = Math.abs(b.y - a.y)
      if (stroke.filled)
        ctx.fillRect(x, y, w, h)
      else
        ctx.strokeRect(x, y, w, h)
    }
    else if (stroke.shape === 'circle') {
      const cx = (a.x + b.x) / 2
      const cy = (a.y + b.y) / 2
      const r = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / 2
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      if (stroke.filled)
        ctx.fill()
      else
        ctx.stroke()
    }
  }

  /** 油漆桶:从触点开始泛洪填充(基于像素扫描) */
  function floodFill(point: { x: number, y: number }, color: string) {
    if (!ctx || !canvasNode)
      return
    const dpr = uni.getSystemInfoSync().pixelRatio || 2
    const px = Math.round(point.x * dpr)
    const py = Math.round(point.y * dpr)
    const W = canvasNode.width
    const H = canvasNode.height
    const img = ctx.getImageData(0, 0, W, H)
    const data = img.data
    const idx = (py * W + px) * 4
    const target = [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]]
    // 解析填充色为 rgba
    const rgba = hexToRgba(color)
    if (!rgba)
      return
    if (Math.abs(target[0] - rgba[0]) < 8 && Math.abs(target[1] - rgba[1]) < 8 && Math.abs(target[2] - rgba[2]) < 8 && Math.abs(target[3] - rgba[3]) < 8)
      return
    const stack: number[] = [py * W + px]
    const match = (i: number) =>
      Math.abs(data[i] - target[0]) < 8
      && Math.abs(data[i + 1] - target[1]) < 8
      && Math.abs(data[i + 2] - target[2]) < 8
      && Math.abs(data[i + 3] - target[3]) < 8
    while (stack.length) {
      const cur = stack.pop()!
      const i = cur * 4
      if (!match(i))
        continue
      data[i] = rgba[0]
      data[i + 1] = rgba[1]
      data[i + 2] = rgba[2]
      data[i + 3] = rgba[3]
      const cx = cur % W
      if (cx > 0) stack.push(cur - 1)
      if (cx < W - 1) stack.push(cur + 1)
      if (cur >= W) stack.push(cur - W)
      if (cur < W * (H - 1)) stack.push(cur + W)
    }
    ctx.putImageData(img, 0, 0)
  }

  /** css color 转 rgba 数组(支持 #rgb/#rrggbb/#rrggbbaa/rgba()) */
  function hexToRgba(color: string): number[] | null {
    const c = color.trim()
    const rgbaMatch = c.match(/rgba?\(([^)]+)\)/)
    if (rgbaMatch) {
      const parts = rgbaMatch[1].split(',').map(s => Number.parseFloat(s))
      return [parts[0], parts[1], parts[2], Math.round((parts[3] ?? 1) * 255)]
    }
    let hex = c.replace('#', '')
    if (hex.length === 3) hex = hex.split('').map(s => s + s).join('')
    if (hex.length !== 6 && hex.length !== 8) return null
    const r = Number.parseInt(hex.slice(0, 2), 16)
    const g = Number.parseInt(hex.slice(2, 4), 16)
    const b = Number.parseInt(hex.slice(4, 6), 16)
    const a = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) : 255
    return [r, g, b, a]
  }

  /** 用中点二次贝塞尔平滑绘制一条完整笔画(重绘/撤销用) */
  function drawStroke(stroke: IStroke) {
    const pts = stroke.points
    if (!ctx || pts.length === 0)
      return
    if (stroke.kind === 'fill') {
      floodFill(pts[0], stroke.color)
      return
    }
    if (stroke.shape) {
      applyStrokeStyle(stroke)
      drawShape(stroke)
      return
    }
    // 橡皮经 applyStrokeStyle 走 destination-out 真擦除,颜色无关
    applyStrokeStyle(stroke)
    if (pts.length === 1) {
      ctx.beginPath()
      ctx.arc(pts[0].x, pts[0].y, stroke.width / 2, 0, Math.PI * 2)
      ctx.fill()
      return
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      const midX = (a.x + b.x) / 2
      const midY = (a.y + b.y) / 2
      if (i === 0) {
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
      }
      ctx.quadraticCurveTo(a.x, a.y, midX, midY)
      ctx.stroke()
      if (stroke.style === 'crayon')
        drawCrayonSegment({ x: midX, y: midY }, b, stroke)
    }
  }

  /** 清空画布并重放全部笔画(橡皮 destination-out 擦除笔画后,背景用 destination-over 垫底) */
  function redrawAll() {
    if (!ctx)
      return
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)
    strokes.value.forEach(drawStroke)
    ctx.save()
    ctx.globalCompositeOperation = 'destination-over'
    ctx.globalAlpha = 1
    ctx.fillStyle = bgColor.value
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)
    ctx.restore()
    ctx.globalCompositeOperation = 'source-over'
  }

  /** 记录一笔并清空重做栈 */
  function commitStroke(stroke: IStroke) {
    strokes.value.push(stroke)
    redoStack.value = []
  }

  /** 触摸开始:创建笔画或执行填充/文字拾点 */
  function onTouchStart(e: any) {
    if (!ctx)
      return
    const p = getPoint(e)
    const tool = currentTool.value
    if (tool === 'fill') {
      const fillStroke: IStroke = { kind: 'fill', color: currentColor.value, width: 0, style: 'round', points: [p] }
      floodFill(p, fillStroke.color)
      commitStroke(fillStroke)
      return
    }
    const base = { color: currentColor.value, width: currentLineWidth.value, style: currentBrushStyle.value, points: [p] }
    if (tool === 'eraser') {
      activeStroke = { ...base, kind: 'eraser', style: 'round', width: currentLineWidth.value * 2 }
    }
    else if (tool === 'line' || tool === 'rect' || tool === 'circle') {
      activeStroke = { ...base, kind: 'free', shape: tool, filled: shapeFilled.value }
    }
    else {
      activeStroke = { ...base, kind: 'free' }
    }
    redrawAll()
    drawStroke(activeStroke)
  }

  /** 触摸进行中:自由绘制增量画段,形状工具整笔预览 */
  function onTouchMove(e: any) {
    if (!activeStroke || !ctx)
      return
    const c = getPoint(e)
    const pts = activeStroke.points
    if (activeStroke.shape) {
      pts.splice(1, pts.length - 1, c)
      redrawAll()
      drawStroke(activeStroke)
      return
    }
    const b = pts[pts.length - 1]
    pts.push(c)
    applyStrokeStyle(activeStroke)
    ctx.beginPath()
    ctx.moveTo(b.x, b.y)
    ctx.quadraticCurveTo(c.x, c.y, (b.x + c.x) / 2, (b.y + c.y) / 2)
    ctx.stroke()
    if (activeStroke.style === 'crayon')
      drawCrayonSegment(b, c, activeStroke)
  }

  /** 结束笔画 */
  function onTouchEnd() {
    if (activeStroke && activeStroke.points.length > 0)
      commitStroke(activeStroke)
    activeStroke = null
  }

  /** 撤销上一笔 */
  function undo() {
    if (!canUndo.value)
      return
    const stroke = strokes.value.pop()!
    redoStack.value.push(stroke)
    redrawAll()
  }

  /** 重做上一笔 */
  function redo() {
    if (!canRedo.value)
      return
    const stroke = redoStack.value.pop()!
    strokes.value.push(stroke)
    redrawAll()
  }

  /** 清空画布 */
  function clear() {
    strokes.value = []
    redoStack.value = []
    redrawAll()
  }

  /** 切换背景色并重绘(保留笔画) */
  function setBg(color: string) {
    bgColor.value = color
    redrawAll()
  }

  /** 导出为临时图片路径(先重放规范化位图,确保橡皮擦除区域垫底背景色) */
  function exportImage(): Promise<string> {
    redrawAll()
    return new Promise((resolve, reject) => {
      uni.canvasToTempFilePath({
        canvas: canvasNode,
        canvasId,
        fileType: 'png',
        success: res => resolve(res.tempFilePath),
        fail: reject,
      } as any)
    })
  }

  return {
    currentColor,
    currentLineWidth,
    currentBrushStyle,
    currentTool,
    shapeFilled,
    bgColor,
    strokes,
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
  }
}
