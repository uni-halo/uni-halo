<script lang="ts" setup>
/**
 * 贡献热度图(源自旧项目 components/heatmap,新建复刻,精简版)
 * 按日期统计文章发布数量,以年度格子图展示
 */
import { computed, ref } from 'vue'
import dayjs from 'dayjs'

export interface IHeatmapDay {
  date: string
  count: number
}

const props = withDefaults(defineProps<{
  chartData?: IHeatmapDay[]
}>(), {
  chartData: () => [],
})

const weeks = ['一', '二', '三', '四', '五', '六', '日']
const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth() + 1)

const intensityColors = ['#ebedf0', '#dbeafe', '#93c5fd', '#3b82f6', '#1e40af']

const yearOptions = computed(() => {
  const years = new Set<number>()
  props.chartData.forEach((item) => {
    years.add(dayjs(item.date).year())
  })
  years.add(new Date().getFullYear())
  return [...years].sort((a, b) => b - a)
})

/** 当前年份数据 key(date -> count) */
const yearDataMap = computed(() => {
  const map: Record<string, number> = {}
  props.chartData.forEach((item) => {
    if (dayjs(item.date).year() === currentYear.value) {
      map[item.date] = item.count
    }
  })
  return map
})

/** 本年第一天是周几(用于前置空位) */
const firstDayOffset = computed(() => {
  const firstDay = new Date(currentYear.value, 0, 1)
  const weekday = firstDay.getDay() // 0=周日
  return weekday === 0 ? 6 : weekday - 1
})

/** 一年天数(闰年处理) */
const daysInYear = computed(() => {
  return (new Date(currentYear.value, 11, 31).getDate() === 31
    && new Date(currentYear.value, 11, 31).getMonth() === 11)
    ? 365
    : 366
})

/** 单元格列表:前置空位 + 全年每日 */
const displayCells = computed(() => {
  const cells: { date: string, count: number, isEmpty: boolean }[] = []
  for (let i = 0; i < firstDayOffset.value; i++) {
    cells.push({ date: '', count: 0, isEmpty: true })
  }
  for (let day = 1; day <= daysInYear.value; day++) {
    const date = dayjs(`${currentYear.value}-01-01`).add(day - 1, 'day').format('YYYY-MM-DD')
    cells.push({ date, count: yearDataMap.value[date] || 0, isEmpty: false })
  }
  return cells
})

/** 颜色分级 */
function getDayColor(day: { count: number, isEmpty: boolean }): string {
  if (day.isEmpty)
    return 'transparent'
  if (day.count === 0)
    return intensityColors[0]
  if (day.count <= 2)
    return intensityColors[1]
  if (day.count <= 4)
    return intensityColors[2]
  if (day.count <= 6)
    return intensityColors[3]
  return intensityColors[4]
}

function getDayTip(day: { date: string, count: number, isEmpty: boolean }): string {
  if (day.isEmpty)
    return ''
  return `${day.date}：${day.count} 篇`
}

/** 累计总数 */
const totalCount = computed(() => props.chartData.reduce((sum, item) => sum + item.count, 0))

/** 本年总数 */
const currentYearCount = computed(() => Object.values(yearDataMap.value).reduce((sum, n) => sum + n, 0))

/** 月份标签(按 5 周跨度取整月位置,简化:每两月一个标签) */
const monthLabels = computed(() => {
  const labels: { index: number, name: string }[] = []
  for (let m = 0; m < 12; m++) {
    labels.push({ index: m * 5, name: `${m + 1}月` })
  }
  return labels
})

function changeYear(value: number) {
  currentYear.value = value
}
</script>

<template>
  <view class="uh-heatmap box-border w-full rounded-xl bg-white p-3">
    <view class="header mb-6 flex items-center justify-between">
      <view class="title text-[28rpx] text-[#303133] font-bold">
        {{ currentYear }}年 文章发布趋势
      </view>
      <view class="controls flex gap-3">
        <view
          v-for="year in yearOptions"
          :key="year"
          class="year-btn rounded-lg px-4 py-0.5 text-[24rpx] text-[#999]"
          :class="{ active: year === currentYear }"
          @click="changeYear(year)"
        >
          {{ year }}
        </view>
      </view>
    </view>

    <view class="heatmap-container flex gap-2">
      <view class="weeks flex flex-col gap-1 pt-8">
        <view v-for="(week, index) in weeks" :key="index" class="week-label h-5 text-[16rpx] text-[#999] leading-5">
          {{ week }}
        </view>
      </view>
      <view class="heatmap-content flex-1 overflow-x-auto">
        <view class="months mb-1 flex">
          <view v-for="month in monthLabels" :key="month.index" class="month-label w-[100rpx] shrink-0 text-[16rpx] text-[#999]">
            {{ month.name }}
          </view>
        </view>
        <view class="days-container h-[220rpx] flex flex-wrap gap-1">
          <view
            v-for="(day, index) in displayCells"
            :key="index"
            class="day-cell box-border h-6 w-6 rounded"
            :style="{ backgroundColor: getDayColor(day) }"
            @click="getDayTip(day)"
          />
        </view>
      </view>
    </view>

    <view class="footer mt-6 flex items-center justify-between">
      <view class="releases-count text-[24rpx] text-[#666]">
        <text>累计 {{ totalCount }} 篇</text>
        <text class="divider mx-2">丨</text>
        <text>本年 {{ currentYearCount }} 篇</text>
      </view>
      <view class="legend flex items-center gap-1">
        <text class="legend-text text-[20rpx] text-[#999]">少</text>
        <view
          v-for="(color, index) in intensityColors"
          :key="index"
          class="day-cell legend-day-cell h-5 w-5"
          :style="{ backgroundColor: color }"
        />
        <text class="legend-text text-[20rpx] text-[#999]">多</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.uh-heatmap {
  .year-btn {
    background-color: #f5f5f5;

    &.active {
      color: #fff;
      background-color: #03a9f4;
    }
  }
}
</style>
