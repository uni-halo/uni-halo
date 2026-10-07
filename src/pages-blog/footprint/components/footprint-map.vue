<script setup lang="ts">
import { computed, getCurrentInstance, ref } from 'vue'
import { checkImageUrl } from '@/utils/url'
import { formatTime } from '@/utils/formatTime'
import type { IFootprint } from '@/api/types/halo-plugin-third/footprint'

/** 全屏地图：足迹 marker(数据图片/本地 pin) + callout + 全局/点视角 + 缩放 */

const props = withDefaults(defineProps<{
  /** 足迹列表 */
  footprints?: IFootprint[]
}>(), {
  footprints: () => [],
})

const emit = defineEmits<{
  (e: 'marker-tap', footprint: IFootprint): void
}>()

const instance = getCurrentInstance()
const MAP_ID = 'footprint-map'

/** 兜底视野(中国大致中心，最小层级) */
const DEFAULT_VIEW = { latitude: 35, longitude: 105, scale: 4 }

/** 兜底 pin(本地资源，160×160 正方形画布，pin 尖端位于底边中点锚定坐标点；正方形画布避免地图非等比压缩) */
const PIN_ICON = '/static/images/footprint/footprint-pin.png'

/** 中国范围粗校验(纬度 3~54 / 经度 73~136)：过滤脏数据(互换/境外/异常值)，避免视野适配拉到海面 */
function isValidCoord(latitude: unknown, longitude: unknown): boolean {
  return typeof latitude === 'number'
    && typeof longitude === 'number'
    && latitude >= 3 && latitude <= 54
    && longitude >= 73 && longitude <= 136
}

/** callout 文本：名称 + 日期两行(callout 支持换行符) */
function calloutText(item: IFootprint): string {
  const name = item.spec?.name || ''
  const date = item.spec?.createTime ? formatTime({ d: item.spec.createTime, f: 'yyyy/MM/dd' }) : ''
  return name && date ? `${name}\n${date}` : (name || date)
}

/** marker 列表(id = 列表下标，点击回调反查足迹) */
const markers = computed(() => {
  const result: {
    id: number
    latitude: number
    longitude: number
    iconPath: string
    width: number
    height: number
    anchor: { x: number, y: number }
    callout: { content: string, display: 'BYCLICK', color: string, fontSize: number, bgColor: string, borderRadius: number, borderWidth: number, borderColor: string, textAlign: 'left' | 'right' | 'center', padding: number }
  }[] = []
  props.footprints.forEach((item, index) => {
    const { longitude, latitude } = item.spec || {}
    if (!isValidCoord(latitude, longitude)) {
      return
    }
    // 优先用数据图片(微信/H5 官方支持网络图片；App 需真机验证)，无图回退本地 pin
    const image = checkImageUrl(item.spec?.image)
    result.push({
      id: index,
      latitude,
      longitude,
      iconPath: image || PIN_ICON,
      // 两种图片均为正方形(数据图 40×40 / 本地 pin 正方形画布)，避免非等比压缩
      width: image ? 40 : 45,
      height: 45,
      anchor: { x: 0.5, y: 1 },
      callout: {
        content: calloutText(item),
        display: 'BYCLICK',
        color: '#111827',
        fontSize: 13,
        bgColor: '#FFFFFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#FFFFFF',
        textAlign: 'center',
        padding: 8,
      },
    })
  })
  return result
})

/** 全局视角基准(初始渲染)：第一个有效点 / 兜底视野 */
const baseView = computed(() => {
  const first = markers.value[0]
  if (first) {
    return { latitude: first.latitude, longitude: first.longitude, scale: 12 }
  }
  return DEFAULT_VIEW
})

/** 地图视野(单一事实源：绑定值与地图实际状态持续同步，属性重下发时不会回跳旧视野) */
const region = ref({ ...DEFAULT_VIEW })
/** 用户是否已操作过视野(未操作时跟随 baseView 初始化) */
let touched = false

watch(baseView, (v) => {
  if (!touched) {
    region.value = { ...v }
  }
}, { immediate: true })

/** 地图上下文(模板渲染后可用) */
let ctx: ReturnType<typeof uni.createMapContext> | null = null
function mapCtx() {
  if (!ctx) {
    ctx = uni.createMapContext(MAP_ID, instance)
  }
  return ctx
}

/** 地图尺寸：视口宽高的 px 直接量 */
const mapStyle = computed(() => {
  const { windowWidth, windowHeight } = uni.getWindowInfo()
  return { width: `${windowWidth}px`, height: `${windowHeight}px` }
})

/** 所有有效足迹点 */
function allPoints() {
  return markers.value.map(m => ({ latitude: m.latitude, longitude: m.longitude }))
}

/** 读取地图实际中心与级别 */
function readRegion(): Promise<{ latitude: number, longitude: number, scale: number }> {
  return new Promise((resolve, reject) => {
    try {
      mapCtx().getCenterLocation({
        success: (center: any) => {
          mapCtx().getScale({
            success: (s: any) => resolve({ latitude: center.latitude, longitude: center.longitude, scale: s.scale }),
            fail: reject,
          })
        },
        fail: reject,
      })
    }
    catch (err) {
      reject(err)
    }
  })
}

/** 把地图实际视野写回 region(使命令式结果与绑定值一致，避免后续属性更新回跳) */
function syncRegion() {
  readRegion().then((r) => {
    region.value = r
  }).catch(() => {})
}

/** 命令式视野动画结束后再同步(includePoints 动画约 300-500ms) */
function scheduleSync() {
  setTimeout(syncRegion, 500)
}

/** 由点集估算缩放级别(H5 端 includePoints 有缺陷，自行适配时用)：实测校准，5 级可容约 17° 跨度(北上广深全览) */
function estimateScale(points: { latitude: number, longitude: number }[]): number {
  const lats = points.map(p => p.latitude)
  const lngs = points.map(p => p.longitude)
  const span = Math.max(Math.max(...lats) - Math.min(...lats), (Math.max(...lngs) - Math.min(...lngs)) * Math.cos((lats[0] * Math.PI) / 180))
  if (span <= 0.02) { return 15 }
  if (span <= 0.1) { return 13 }
  if (span <= 0.5) { return 11 }
  if (span <= 2) { return 10 }
  if (span <= 5) { return 9 }
  if (span <= 12) { return 7 }
  if (span <= 20) { return 5 }
  return 4
}

/** 适配视野：H5/App 端 includePoints 视野计算有缺陷(中心落到 0,180)，自行算中心+级别走绑定下发；微信小程序走命令式 */
function fitPoints(points: { latitude: number, longitude: number }[]) {
  // #ifndef MP-WEIXIN
  const lats = points.map(p => p.latitude)
  const lngs = points.map(p => p.longitude)
  touched = true
  region.value = {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    scale: estimateScale(points),
  }
  // #endif

  // #ifdef MP-WEIXIN
  mapCtx().includePoints({ points, padding: [80, 80, 80, 80] })
  scheduleSync()
  // #endif
}

/** 视野变化：用户拖动/缩放结束后同步实际视野到 region */
function handleRegionChange(e: any) {
  const detail = e?.detail || {}
  if (detail.type === 'end' && detail.causedBy !== 'update') {
    syncRegion()
  }
}

/** 聚焦：直接改绑定视野(中心与级别一起下发，不会带上过期中心) */
function focusOn(item: IFootprint) {
  const sp = item?.spec
  if (!isValidCoord(sp?.latitude, sp?.longitude)) {
    return
  }
  const target = { latitude: sp.latitude, longitude: sp.longitude, scale: 14 }
  const r = region.value
  // 绑定值与地图状态一致(如拖动后未及同步)：走命令式适配兜底
  if (r.latitude === target.latitude && r.longitude === target.longitude && r.scale === target.scale) {
    fitPoints([{ latitude: target.latitude, longitude: target.longitude }])
    return
  }
  touched = true
  region.value = target
}

/** 还原：适配所有足迹点，动画结束后把实际视野写回 region */
function resetView() {
  const points = allPoints()
  if (!points.length) {
    return
  }
  fitPoints(points)
}

/** marker 点击：markerId 反查足迹(各端兼容顶层 markerId 与微信小程序的 e.detail 结构) */
function handleMarkerTap(e: object) {
  const evt = e as { markerId?: number, detail?: { markerId?: number } }
  const markerId = evt.markerId ?? evt.detail?.markerId
  const footprint = typeof markerId === 'number' ? props.footprints[markerId] : undefined
  if (footprint) {
    emit('marker-tap', footprint)
  }
}

/** 缩放：读取地图实际视野后增减级别，回写 region */
async function zoomIn() {
  const current = await readRegion().catch(() => region.value)
  touched = true
  region.value = { ...current, scale: Math.min(20, Math.round(current.scale) + 1) }
}

async function zoomOut() {
  const current = await readRegion().catch(() => region.value)
  touched = true
  region.value = { ...current, scale: Math.max(3, Math.round(current.scale) - 1) }
}

defineExpose({ zoomIn, zoomOut, focusOn, resetView })
</script>

<template>
  <map
    :id="MAP_ID"
    :style="mapStyle"
    :latitude="region.latitude"
    :longitude="region.longitude"
    :scale="region.scale"
    :markers="markers"
    @regionchange="handleRegionChange"
    @markertap="handleMarkerTap"
  />
</template>
