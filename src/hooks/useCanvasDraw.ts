import { computed, getCurrentInstance, ref, shallowRef } from 'vue'

/** 画笔样式 */
export type BrushStyle = 'round' | 'square' | 'crayon'

/** 绘制工具 */
export type DrawTool = 'brush' | 'eraser' | 'line' | 'rect' | 'circle' | 'fill'

/** 单条笔画(自由绘制/橡皮/形状共用,shape 区分几何类型) */
export interface IStroke {
  /** 笔画种类:free=自由绘制 eraser=橡皮 fill=油漆桶 bg=换纸张,其余按 shape 几何绘制 */
  kind: 'free' | 'eraser' | 'fill' | 'bg'
  /** 换纸张前的旧背景色(kind=bg 时有效) */
  prevColor?: string
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
  /** 主 canvas id(预览层,页面内唯一;烘焙层 id 为 `${canvasId}-base`) */
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
 *
 * 性能架构(双层 canvas,画多不卡):
 * - 烘焙层 `${canvasId}-base`(底层):背景色 + 已完成笔画。一笔结束时增量烘焙,
 *   绘制过程的成本与笔画总数无关;
 * - 预览层 `canvasId`(顶层,承载触摸事件):正在绘制的笔画/形状预览,拖动中只清除
 *   本层重画当前形状,不再全量重放历史;
 * - 撤销/重做/清空/换纸张属低频操作,退化为一次性全量重放(仅此时 O(N));
 * - 烘焙层缺失时(页面未配置双 canvas)自动降级为单画布全量重放旧模式。
 * 橡皮直接画在烘焙层(destination-out),油漆桶直接改烘焙层像素,均为终态操作。
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

  // 笔画历史为纯数据(退出 Vue 深度代理,避免上千坐标点被逐层 Proxy 拖慢重放),
  // 可撤销/可重做/是否为空用计数 ref 驱动视图
  /** 笔画历史(撤销/重绘依据,非响应式) */
  const strokes: IStroke[] = []
  /** 重做栈(撤销时压入,新笔画时清空) */
  const redoStack: IStroke[] = []
  /** 笔画计数(驱动 canUndo/canRedo/isEmpty) */
  const strokeCount = ref(0)
  const redoCount = ref(0)
  /** 是否可以撤销 */
  const canUndo = computed(() => strokeCount.value > 0)
  /** 是否可以重做 */
  const canRedo = computed(() => redoCount.value > 0)
  /** 是否为空画布 */
  const isEmpty = computed(() => strokeCount.value === 0)

  /** 预览层(顶层)canvas 节点与上下文,承载触摸事件 */
  let canvasNode: any = null
  let ctx: any = null
  /** 烘焙层(底层)canvas 节点与上下文,背景 + 已完成笔画;null = 降级单画布模式 */
  let baseNode: any = null
  let baseCtx: any = null
  /** 画布逻辑尺寸(css 像素) */
  let canvasWidth = 0
  let canvasHeight = 0
  /** 画布相对视口偏移(H5 触摸坐标为 clientX/Y 需扣视口偏移) */
  let canvasOffsetX = 0
  let canvasOffsetY = 0
  /** 当前正在绘制的笔画 */
  let activeStroke: IStroke | null = null
  /** 当前增量绘制目标(brush/形状=预览层,eraser/fill=烘焙层) */
  let activeCtx: any = null

  /** 初始化单个 canvas 节点(物理分辨率放大,锁定 css 尺寸) */
  function setupCanvas(node: any, width: number, height: number): any {
    const dpr = Math.min(uni.getSystemInfoSync().pixelRatio || 2, 2)
    node.width = width * dpr
    node.height = height * dpr
    if (node.style) {
      node.style.width = `${width}px`
      node.style.height = `${height}px`
    }
    const context = node.getContext('2d')
    context.scale(dpr, dpr)
    return context
  }

  /** 获取 2d 上下文并初始化双层画布(统一走 uni-app createSelectorQuery,各端通用) */
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
          ctx = setupCanvas(canvasNode, canvasWidth, canvasHeight)
          // 烘焙层可选:节点缺失时降级为单画布全量重放旧模式
          const sub = uni.createSelectorQuery().in(instance?.proxy)
          sub.select(`#${canvasId}-base`)
            .fields({ node: true, size: true }, () => {})
            .exec((subRes: any[]) => {
              const baseInfo = subRes?.[0]
              if (baseInfo?.node) {
                baseNode = baseInfo.node
                baseCtx = setupCanvas(baseNode, canvasWidth, canvasHeight)
              }
              redrawAll()
              resolve()
            })
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
  function applyStrokeStyle(context: any, stroke: IStroke) {
    context.globalCompositeOperation = stroke.kind === 'eraser' ? 'destination-out' : 'source-over'
    context.strokeStyle = stroke.color
    context.fillStyle = stroke.color
    context.lineWidth = stroke.width
    context.lineJoin = 'round'
    if (stroke.style === 'square') {
      context.lineCap = 'square'
    }
    else {
      // round / crayon 均用圆头,蜡笔质感靠多次抖动叠加
      context.lineCap = 'round'
    }
  }

  /** 确定性伪随机(0..1,以序号+笔画起点为种子):蜡笔抖动用,整笔重画/重放时纹理稳定不闪变 */
  function jitterAt(stroke: IStroke, index: number): number {
    const s = Math.sin(index * 127.1 + stroke.points[0].x * 0.13 + stroke.points[0].y * 0.17) * 43758.5453
    return s - Math.floor(s)
  }

  /** 蜡笔纹理:沿主线低透明度抖动重绘,叠加出颗粒质感(index 为段序号,决定确定性抖动) */
  function drawCrayonSegment(context: any, from: { x: number, y: number }, to: { x: number, y: number }, stroke: IStroke, index: number) {
    const w = stroke.width
    context.save()
    context.globalAlpha = 0.28
    for (let i = 0; i < 2; i++) {
      const jx = (jitterAt(stroke, index * 2 + i) - 0.5) * w * 0.36
      const jy = (jitterAt(stroke, index * 2 + i + 0.5) - 0.5) * w * 0.36
      context.beginPath()
      context.moveTo(from.x + jx, from.y + jy)
      context.lineTo(to.x + jx, to.y + jy)
      context.lineWidth = w * (i === 0 ? 1 : 0.5)
      context.stroke()
    }
    context.restore()
  }

  /** 绘制几何形状 */
  function drawShape(context: any, stroke: IStroke) {
    const [a, b] = [stroke.points[0], stroke.points[stroke.points.length - 1]]
    context.beginPath()
    if (stroke.shape === 'line') {
      context.moveTo(a.x, a.y)
      context.lineTo(b.x, b.y)
      context.stroke()
    }
    else if (stroke.shape === 'rect') {
      const x = Math.min(a.x, b.x)
      const y = Math.min(a.y, b.y)
      const w = Math.abs(b.x - a.x)
      const h = Math.abs(b.y - a.y)
      if (stroke.filled)
        context.fillRect(x, y, w, h)
      else
        context.strokeRect(x, y, w, h)
    }
    else if (stroke.shape === 'circle') {
      const cx = (a.x + b.x) / 2
      const cy = (a.y + b.y) / 2
      const r = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / 2
      context.arc(cx, cy, r, 0, Math.PI * 2)
      if (stroke.filled)
        context.fill()
      else
        context.stroke()
    }
  }

  /** 泛洪容差(容忍抗锯齿边缘像素,过小会导致采样到边缘时填不上) */
  const FILL_TOLERANCE = 32

  /** 油漆桶:从触点开始泛洪填充(基于像素扫描,直接改烘焙层像素;降级模式改主画布) */
  function floodFill(point: { x: number, y: number }, color: string) {
    floodFillOn(baseCtx || ctx, baseNode || canvasNode, point, color)
  }

  /** 在指定画布上泛洪填充(起点像素收敛到画布内,避免点在边缘时越界失效) */
  function floodFillOn(targetCtx: any, targetNode: any, point: { x: number, y: number }, color: string) {
    if (!targetCtx || !targetNode)
      return
    const dpr = Math.min(uni.getSystemInfoSync().pixelRatio || 2, 2)
    const px = Math.min(Math.max(Math.round(point.x * dpr), 0), targetNode.width - 1)
    const py = Math.min(Math.max(Math.round(point.y * dpr), 0), targetNode.height - 1)
    const W = targetNode.width
    const H = targetNode.height
    const img = targetCtx.getImageData(0, 0, W, H)
    const data = img.data
    const idx = (py * W + px) * 4
    const target = [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]]
    // 解析填充色为 rgba
    const rgba = hexToRgba(color)
    if (!rgba)
      return
    const near = (i: number) =>
      Math.abs(data[i] - target[0]) < FILL_TOLERANCE
      && Math.abs(data[i + 1] - target[1]) < FILL_TOLERANCE
      && Math.abs(data[i + 2] - target[2]) < FILL_TOLERANCE
      && Math.abs(data[i + 3] - target[3]) < FILL_TOLERANCE
    // 起点颜色与填充色一致时无需填充
    if (Math.abs(target[0] - rgba[0]) < FILL_TOLERANCE && Math.abs(target[1] - rgba[1]) < FILL_TOLERANCE && Math.abs(target[2] - rgba[2]) < FILL_TOLERANCE && Math.abs(target[3] - rgba[3]) < FILL_TOLERANCE)
      return
    const stack: number[] = [py * W + px]
    while (stack.length) {
      const cur = stack.pop()!
      const i = cur * 4
      if (!near(i))
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
    targetCtx.putImageData(img, 0, 0)
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

  /** 用中点二次贝塞尔平滑重放一条完整笔画(撤销/重做/清空/换纸/导出的全量重放用) */
  function drawStroke(stroke: IStroke) {
    const pts = stroke.points
    const target = baseCtx || ctx
    if (!target || pts.length === 0)
      return
    if (stroke.kind === 'fill' || stroke.kind === 'bg')
      return
    applyStrokeStyle(target, stroke)
    if (stroke.shape) {
      drawShape(target, stroke)
      return
    }
    drawSmoothStroke(target, stroke)
  }

  /** 中点二次贝塞尔平滑绘制整条笔画(单条 path,预览整笔重画与重放共用) */
  function drawSmoothStroke(context: any, stroke: IStroke) {
    const pts = stroke.points
    if (pts.length === 1) {
      context.beginPath()
      context.arc(pts[0].x, pts[0].y, stroke.width / 2, 0, Math.PI * 2)
      context.fill()
      return
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      const midX = (a.x + b.x) / 2
      const midY = (a.y + b.y) / 2
      if (i === 0) {
        context.beginPath()
        context.moveTo(a.x, a.y)
      }
      context.quadraticCurveTo(a.x, a.y, midX, midY)
      context.stroke()
      if (stroke.style === 'crayon')
        drawCrayonSegment(context, a, b, stroke, i)
    }
  }

  /** 清空烘焙层并重放全部笔画 + 垫底背景色(仅撤销/重做/清空/换纸/导出等低频操作) */
  function redrawAll() {
    const target = baseCtx || ctx
    if (!target || !canvasNode)
      return
    target.globalCompositeOperation = 'source-over'
    target.clearRect(0, 0, canvasWidth, canvasHeight)
    strokes.forEach((stroke) => {
      if (stroke.kind === 'fill')
        floodFillOn(target, baseNode || canvasNode, stroke.points[0], stroke.color)
      else if (stroke.kind !== 'bg')
        drawStroke(stroke)
    })
    target.save()
    target.globalCompositeOperation = 'destination-over'
    target.globalAlpha = 1
    target.fillStyle = bgColor.value
    target.fillRect(0, 0, canvasWidth, canvasHeight)
    target.restore()
    target.globalCompositeOperation = 'source-over'
  }

  /** 记录一笔并清空重做栈;预览层上的笔画随即增量烘焙到烘焙层 */
  function commitStroke(stroke: IStroke) {
    strokes.push(stroke)
    redoStack.length = 0
    strokeCount.value = strokes.length
    redoCount.value = 0
    if (baseCtx && (stroke.kind === 'free' || stroke.shape)) {
      // 该笔画此前画在预览层:整体合成到烘焙层后清空预览层
      baseCtx.save()
      baseCtx.globalCompositeOperation = 'source-over'
      baseCtx.drawImage(canvasNode, 0, 0, canvasWidth, canvasHeight)
      baseCtx.restore()
      ctx.clearRect(0, 0, canvasWidth, canvasHeight)
    }
  }

  /** 触摸开始:创建笔画或执行填充(橡皮直接画在烘焙层,其余画在预览层) */
  function onTouchStart(e: any) {
    if (!ctx)
      return
    // 多指保护:已有笔画未结束时忽略新按下的手指,避免轨迹串线
    if (activeStroke)
      return
    const p = getPoint(e)
    const tool = currentTool.value
    if (tool === 'fill') {
      activeCtx = baseCtx || ctx
      const fillStroke: IStroke = { kind: 'fill', color: currentColor.value, width: 0, style: 'round', points: [p] }
      floodFill(p, fillStroke.color)
      commitStroke(fillStroke)
      activeCtx = null
      return
    }
    const base = { color: currentColor.value, width: currentLineWidth.value, style: currentBrushStyle.value, points: [p] }
    if (tool === 'eraser') {
      // 橡皮为终态操作:直接作用于烘焙层(destination-out),所见即所得
      activeCtx = baseCtx || ctx
      activeStroke = { ...base, kind: 'eraser', style: 'round', width: currentLineWidth.value * 2 }
    }
    else if (tool === 'line' || tool === 'rect' || tool === 'circle') {
      activeCtx = ctx
      activeStroke = { ...base, kind: 'free', shape: tool, filled: shapeFilled.value }
    }
    else {
      activeCtx = ctx
      activeStroke = { ...base, kind: 'free' }
    }
    applyStrokeStyle(activeCtx, activeStroke)
    if (activeCtx === ctx && baseCtx) {
      // 双层模式:预览层只保留当前笔画,绘制前清一次(形状拖动也走这里逐帧重画);
      // 降级单画布模式不清屏,历史笔画保留在主画布上
      ctx.clearRect(0, 0, canvasWidth, canvasHeight)
    }
    // 形状笔画不画定位点(拖动预览从触点开始即可);自由/橡皮单点起笔需留痕
    if ((activeStroke.kind === 'free' && !activeStroke.shape) || activeStroke.kind === 'eraser')
      drawActiveDot()  }

  /** 单点起笔留痕(跟随笔头形状:方头为方形点,其余圆点) */
  function drawActiveDot() {
    const stroke = activeStroke!
    const r = stroke.width / 2
    activeCtx.beginPath()
    if (stroke.style === 'square') {
      activeCtx.rect(stroke.points[0].x - r, stroke.points[0].y - r, stroke.width, stroke.width)
    }
    else {
      activeCtx.arc(stroke.points[0].x, stroke.points[0].y, r, 0, Math.PI * 2)
    }
    activeCtx.fill()
  }

  /** 触摸进行中:自由绘制增量画段,形状工具整笔预览(只重画预览层,不碰历史) */
  function onTouchMove(e: any) {
    if (!activeStroke || !activeCtx)
      return
    const c = getPoint(e)
    const pts = activeStroke.points
    if (activeStroke.shape) {
      pts.splice(1, pts.length - 1, c)
      if (baseCtx) {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight)
      }
      else {
        // 降级模式:形状预览需重放历史(旧路径)
        redrawAll()
      }
      applyStrokeStyle(ctx, activeStroke)
      drawShape(ctx, activeStroke)
      return
    }
    const b = pts[pts.length - 1]
    // 触点采样:位移过小丢弃,控制 points 规模(降低重放与内存成本)
    if (Math.abs(c.x - b.x) + Math.abs(c.y - b.y) < 2)
      return
    pts.push(c)
    if (baseCtx && activeStroke.kind !== 'eraser') {
      // 双层模式:预览层整笔重画(单条 path 无接缝,半透明色不在段接合处叠加变深;
      // 蜡笔抖动为确定性纹理,逐帧重画不闪变;成本仅当前笔画,与历史无关)
      // 橡皮除外:终态操作必须直接增量作用在烘焙层,擦预览层无效
      ctx.clearRect(0, 0, canvasWidth, canvasHeight)
      applyStrokeStyle(ctx, activeStroke)
      drawSmoothStroke(ctx, activeStroke)
    }
    else {
      // 降级模式:增量画段(历史在主画布上,不能清屏重画)
      applyStrokeStyle(activeCtx, activeStroke)
      activeCtx.beginPath()
      activeCtx.moveTo(b.x, b.y)
      activeCtx.quadraticCurveTo(c.x, c.y, (b.x + c.x) / 2, (b.y + c.y) / 2)
      activeCtx.stroke()
      if (activeStroke.style === 'crayon')
        drawCrayonSegment(activeCtx, b, c, activeStroke, pts.length - 2)
    }
  }

  /** 结束笔画 */
  function onTouchEnd() {
    if (activeStroke && activeStroke.points.length > 0)
      commitStroke(activeStroke)
    activeStroke = null
    activeCtx = null
  }

  /** 撤销上一笔(低频:全量重放到烘焙层) */
  function undo() {
    if (!canUndo.value)
      return
    const stroke = strokes.pop()!
    if (stroke.kind === 'bg')
      bgColor.value = stroke.prevColor ?? stroke.color
    redoStack.push(stroke)
    strokeCount.value = strokes.length
    redoCount.value = redoStack.length
    redrawAll()
  }

  /** 重做上一笔(低频:全量重放到烘焙层) */
  function redo() {
    if (!canRedo.value)
      return
    const stroke = redoStack.pop()!
    if (stroke.kind === 'bg')
      bgColor.value = stroke.color
    strokes.push(stroke)
    strokeCount.value = strokes.length
    redoCount.value = redoStack.length
    redrawAll()
  }

  /** 清空画布 */
  function clear() {
    strokes.length = 0
    redoStack.length = 0
    strokeCount.value = 0
    redoCount.value = 0
    redrawAll()
  }

  /** 切换背景色并重绘(保留笔画;换纸计入撤销历史) */
  function setBg(color: string) {
    if (color === bgColor.value)
      return
    strokes.push({ kind: 'bg', color, prevColor: bgColor.value, width: 0, style: 'round', points: [] })
    redoStack.length = 0
    strokeCount.value = strokes.length
    redoCount.value = 0
    bgColor.value = color
    redrawAll()
  }

  /** 导出为临时图片路径(先重放规范化位图,确保橡皮擦除区域垫底背景色;双层模式导出烘焙层) */
  function exportImage(): Promise<string> {
    redrawAll()
    const targetNode = baseNode || canvasNode
    return new Promise((resolve, reject) => {
      uni.canvasToTempFilePath({
        canvas: targetNode,
        canvasId: targetNode === baseNode ? `${canvasId}-base` : canvasId,
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
