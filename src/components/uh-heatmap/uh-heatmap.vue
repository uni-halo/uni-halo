<script lang="ts" setup>
/**
 * 贡献热度图
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

/** 颜色分级(主题色系黄绿渐变,由浅到深) */
const intensityColors = ['#ebedf0', '#f4fad8', '#e9f79f', '#d7ee52', '#b9e424']

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

/** 单元格:日粒度,isEmpty=前置空位(非本年日期) */
interface IHeatmapCell {
  date: string
  count: number
  isEmpty: boolean
}

/** 单元格列表:前置空位 + 全年每日 */
const displayCells = computed<IHeatmapCell[]>(() => {
  const cells: IHeatmapCell[] = []
  for (let i = 0; i < firstDayOffset.value; i++) {
    cells.push({ date: '', count: 0, isEmpty: true })
  }
  for (let day = 1; day <= daysInYear.value; day++) {
    const date = dayjs(`${currentYear.value}-01-01`).add(day - 1, 'day').format('YYYY-MM-DD')
    cells.push({ date, count: yearDataMap.value[date] || 0, isEmpty: false })
  }
  return cells
})

/** 按周分组为列(每列 7 天,周一~周日;跨年补足空位),列不换行,横向滚动 */
const weekColumns = computed<IHeatmapCell[][]>(() => {
  const cells = displayCells.value
  const columns: IHeatmapCell[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    columns.push(cells.slice(i, i + 7))
  }
  return columns
})

/** 每列顶部月份标签:取该列第一个非空日期所属月份,与上一列同月则空占位(保证列高一致) */
const columnMonths = computed<string[]>(() => {
  let lastMonth = -1
  return weekColumns.value.map((column) => {
    const firstReal = column.find(cell => !cell.isEmpty)
    if (!firstReal)
      return ''
    const month = dayjs(firstReal.date).month()
    if (month === lastMonth)
      return ''
    lastMonth = month
    return `${month + 1}月`
  })
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

/** 点击格子:toast 展示该日日期与发布篇数 */
function handleDayClick(day: IHeatmapCell) {
  if (day.isEmpty)
    return
  uni.showToast({
    title: `${dayjs(day.date).format('YYYY年MM月DD日')} 发布 ${day.count} 篇`,
    icon: 'none',
  })
}

/** 累计总数 */
const totalCount = computed(() => props.chartData.reduce((sum, item) => sum + item.count, 0))

/** 本年总数 */
const currentYearCount = computed(() => Object.values(yearDataMap.value).reduce((sum, n) => sum + n, 0))

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
      <!-- 周标签列(固定,不随横向滚动) -->
      <view class="weeks flex shrink-0 flex-col gap-1">
        <view class="h-6 shrink-0" />
        <view v-for="(week, index) in weeks" :key="index" class="week-label h-6 text-[16rpx] text-[#999] leading-6">
          {{ week }}
        </view>
      </view>
      <!-- 主体:每列顶部带月份标签,整列横向排列(不换行),整体横向滚动 -->
      <scroll-view scroll-x :show-scrollbar="false" class="heatmap-content flex-1">
        <view class="inline-flex flex-col">
          <view class="flex gap-1">
            <view v-for="(column, ci) in weekColumns" :key="ci" class="flex shrink-0 flex-col">
              <view class="month-label h-6 w-6 whitespace-nowrap text-center text-[16rpx] text-[#999] leading-6">
                {{ columnMonths[ci] }}
              </view>
              <view v-for="(day, di) in column" :key="di" class="day-cell mt-1 box-border h-6 w-6 rounded"
                :style="{ backgroundColor: getDayColor(day) }" @click="handleDayClick(day)" />
            </view>
          </view>
        </view>
      </scroll-view>
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
      color: #303133;
      background-color: #b9e424;
    }
  }
}
</style>
