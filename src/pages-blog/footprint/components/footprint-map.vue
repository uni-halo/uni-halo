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
    // 过滤无效坐标(缺失/0,0 会把视野适配拉到海面)
    if (typeof longitude !== 'number' || typeof latitude !== 'number' || (!latitude && !longitude)) {
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

const centerView = computed(() => baseView.value)
/** 手动缩放级别(非空时覆盖绑定 scale；读地图实际级别调整，与双指缩放不打架) */
const manualScale = ref<number | null>(null)
const scaleView = computed(() => manualScale.value ?? centerView.value.scale)

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

/** 聚焦：清手动缩放，适配到该点(moveToLocation 即使传坐标也要 scope.userLocation 授权，includePoints 单点不需要) */
function focusOn(item: IFootprint) {
  const sp = item?.spec
  if (typeof sp?.latitude !== 'number' || typeof sp?.longitude !== 'number' || (!sp.latitude && !sp.longitude)) {
    return
  }
  manualScale.value = null
  mapCtx().includePoints({
    points: [{ latitude: sp.latitude, longitude: sp.longitude }],
    padding: [80, 80, 80, 80],
  })
  manualScale.value = 14
}

/** 还原：命令式适配所有点，动画结束后把地图实际级别写回 manualScale(保持绑定值不变，避免属性重下发覆盖 includePoints) */
function resetView() {
  const points = allPoints()
  if (!points.length) {
    return
  }
  mapCtx().includePoints({ points, padding: [80, 80, 80, 80] })
  setTimeout(() => {
    readScale().then((scale) => {
      manualScale.value = scale
    }).catch(() => {})
  }, 400)
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

/** 缩放：读取地图当前级别后增减(读实际级别，与双指缩放不打架) */
function readScale(): Promise<number> {
  return new Promise((resolve, reject) => {
    try {
      mapCtx().getScale({
        success: (res: any) => resolve(res.scale),
        fail: reject,
      })
    }
    catch (err) {
      reject(err)
    }
  })
}

async function zoomIn() {
  const current = await readScale().catch(() => scaleView.value)
  manualScale.value = Math.min(20, Math.round(current) + 1)
}

async function zoomOut() {
  const current = await readScale().catch(() => scaleView.value)
  manualScale.value = Math.max(3, Math.round(current) - 1)
}

defineExpose({ zoomIn, zoomOut, focusOn, resetView })
</script>

<template>
  <map
    :id="MAP_ID"
    :style="mapStyle"
    :latitude="centerView.latitude"
    :longitude="centerView.longitude"
    :scale="scaleView"
    :markers="markers"
    @markertap="handleMarkerTap"
  />
</template>
