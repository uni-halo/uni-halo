<script setup lang="ts">
import { computed } from 'vue'
import type { IFootprint } from '@/api/types/halo-plugin-third/footprint'

/** 全屏地图：足迹 marker + 全局/点视角切换 */

const props = withDefaults(defineProps<{
  /** 足迹列表 */
  footprints?: IFootprint[]
  /** 当前选中的足迹(非空 = 点视角) */
  selected?: IFootprint | null
}>(), {
  footprints: () => [],
  selected: null,
})

const emit = defineEmits<{
  (e: 'marker-tap', footprint: IFootprint): void
}>()

/** 兜底视野(中国大致中心) */
const DEFAULT_VIEW = { latitude: 35, longitude: 105, scale: 4 }

/** marker 图片(本地资源，pin 尖端锚定坐标点) */
const PIN_ICON = '/static/images/footprint/footprint-pin.png'

/** marker 列表(id = 列表下标，点击回调反查足迹) */
const markers = computed(() => {
  const result: { id: number, latitude: number, longitude: number, iconPath: string, width: number, height: number, anchor: { x: number, y: number } }[] = []
  props.footprints.forEach((item, index) => {
    const { longitude, latitude } = item.spec || {}
    if (typeof longitude !== 'number' || typeof latitude !== 'number') {
      return
    }
    result.push({
      id: index,
      latitude,
      longitude,
      iconPath: PIN_ICON,
      width: 36,
      height: 45,
      anchor: { x: 0.5, y: 1 },
    })
  })
  return result
})

/** 地图中心与缩放：点视角优先选中点，否则第一个有效点 / 兜底视野 */
const centerView = computed(() => {
  const sel = props.selected?.spec
  if (typeof sel?.latitude === 'number' && typeof sel?.longitude === 'number') {
    return { latitude: sel.latitude, longitude: sel.longitude, scale: 14 }
  }
  const first = markers.value[0]
  if (first) {
    return { latitude: first.latitude, longitude: first.longitude, scale: 12 }
  }
  return DEFAULT_VIEW
})

/** 自动适配视野(全局视角)：传包围盒两角(西南/东北)，各端均支持的两点适配 */
const includePoints = computed(() => {
  if (props.selected || markers.value.length < 2) {
    return []
  }
  const lats = markers.value.map(m => m.latitude)
  const lngs = markers.value.map(m => m.longitude)
  return [
    { latitude: Math.min(...lats), longitude: Math.min(...lngs) },
    { latitude: Math.max(...lats), longitude: Math.max(...lngs) },
  ]
})

/** marker 点击：markerId 反查足迹(各端兼容顶层 markerId 与微信小程序的 e.detail 结构) */
function handleMarkerTap(e: object) {
  const evt = e as { markerId?: number, detail?: { markerId?: number } }
  const markerId = evt.markerId ?? evt.detail?.markerId
  const footprint = typeof markerId === 'number' ? props.footprints[markerId] : undefined
  if (footprint) {
    emit('marker-tap', footprint)
  }
}
</script>

<template>
  <map
    class="h-full w-full"
    :latitude="centerView.latitude"
    :longitude="centerView.longitude"
    :scale="centerView.scale"
    :markers="markers"
    :include-points="includePoints"
    @markertap="handleMarkerTap"
  />
</template>
