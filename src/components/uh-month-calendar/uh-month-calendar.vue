<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'

defineOptions({
  options: {
    styleIsolation: 'apply-shared',
  },
})

const props = withDefaults(defineProps<IProps>(), {
  showYear: true,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
}>()

interface IProps {
  /** 当前选中月份 YYYY-MM */
  modelValue?: string
  /** 是否显示年份副行 */
  showYear?: boolean
}

/** 一屏展示的月份数量 */
const PAGE_MONTH_COUNT = 6

/** 当前展示页锚点（该页第一个月，用于推算 6 个月） */
const anchorMonth = ref(getPageAnchor(props.modelValue || undefined))

const selectedMonth = computed(() => props.modelValue || dayjs().format('YYYY-MM'))

/** 以选中/当前月份所在半年为基准页（1月/7月起始） */
function getPageAnchor(val?: string) {
  const d = dayjs(val || undefined)
  return d.month() < PAGE_MONTH_COUNT
    ? d.month(0).startOf('month')
    : d.month(PAGE_MONTH_COUNT).startOf('month')
}

watch(() => props.modelValue, (val) => {
  if (val) {
    anchorMonth.value = getPageAnchor(val)
  }
})

/** 当前页的 6 个月 */
const months = computed(() => {
  const thisMonth = dayjs().format('YYYY-MM')
  return Array.from({ length: PAGE_MONTH_COUNT }, (_, i) => {
    const d = anchorMonth.value.add(i, 'month')
    const month = d.format('YYYY-MM')
    return {
      month,
      text: `${d.month() + 1}月`,
      isThisMonth: month === thisMonth,
      isSelected: month === selectedMonth.value,
    }
  })
})

function handleSelect(month: string) {
  emit('update:modelValue', month)
  emit('change', month)
}

function handlePrevPage() {
  anchorMonth.value = anchorMonth.value.subtract(PAGE_MONTH_COUNT, 'month')
}

function handleNextPage() {
  anchorMonth.value = anchorMonth.value.add(PAGE_MONTH_COUNT, 'month')
}

/** 跳转到指定月份所在页（不改变选中月） */
function setPage(month?: string) {
  anchorMonth.value = getPageAnchor(month)
}

defineExpose({ setPage })
</script>

<template>
  <view
    class="uh-global-card-glass uh-shadow-xs box-border box-border w-full flex items-center border rounded-2xl p-2"
  >
    <!-- 上一页（6 个月） -->
    <view class="box-border flex shrink-0 items-center justify-center p-1 text-gray-500" @click="handlePrevPage">
      <wd-icon name="left" size="32rpx" />
    </view>

    <!-- 月份主体 -->
    <view class="box-border flex flex-1 flex-row items-center justify-between px-1">
      <view
        v-for="item in months" :key="item.month"
        class="box-border flex flex-1 flex-col items-center justify-center rounded-lg p-1"
        :class="item.isSelected ? 'bg-primary' : ''" @click="handleSelect(item.month)"
      >
        <text class="text-3xs font-semibold" :class="item.isSelected ? 'text-gray-900' : 'text-gray-600'">{{ item.text }}</text>
        <text v-if="props.showYear" class="text-10px" :class="item.isSelected ? 'text-gray-900' : 'text-gray-500'">{{ item.month.split('-')[0] }}</text>
      </view>
    </view>

    <!-- 下一页（6 个月） -->
    <view class="flex shrink-0 items-center justify-center p-1 text-gray-500" @click="handleNextPage">
      <wd-icon name="right" size="32rpx" />
    </view>
  </view>
</template>
