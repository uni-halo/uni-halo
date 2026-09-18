<script setup lang="ts">
	import { computed, ref, watch } from 'vue'
	import dayjs from 'dayjs'
	import isoWeek from 'dayjs/plugin/isoWeek'

	dayjs.extend(isoWeek)

	defineOptions({
		options: {
			styleIsolation: 'apply-shared',
		},
	})

	interface IProps {
		modelValue ?: string
	}

	const props = defineProps<IProps>()

	const emit = defineEmits<{
		(e : 'update:modelValue', value : string) : void
		(e : 'change', value : string) : void
	}>()

	const WEEKDAY_TEXT = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

	/** 当前周锚点（所在周的任意一天，用于推算整周） */
	const anchorDate = ref(dayjs(props.modelValue || undefined))

	watch(() => props.modelValue, (val) => {
		if (val && val !== selectedDate.value) {
			anchorDate.value = dayjs(val)
		}
	})

	const selectedDate = computed(() => props.modelValue || dayjs().format('YYYY-MM-DD'))

	/** 当前周的 7 天（周一起始） */
	const weekDays = computed(() => {
		const monday = anchorDate.value.startOf('isoWeek')
		const today = dayjs().format('YYYY-MM-DD')
		return Array.from({ length: 7 }, (_, i) => {
			const d = monday.add(i, 'day')
			const date = d.format('YYYY-MM-DD')
			return {
				date,
				day: d.date(),
				weekday: WEEKDAY_TEXT[i],
				isToday: date === today,
				isSelected: date === selectedDate.value,
			}
		})
	})

	function handleSelect(date : string) {
		emit('update:modelValue', date)
		emit('change', date)
	}

	function handlePrevWeek() {
		anchorDate.value = anchorDate.value.subtract(7, 'day')
	}

	function handleNextWeek() {
		anchorDate.value = anchorDate.value.add(7, 'day')
	}
</script>

<template>
	<view
		class="box-border uh-global-card-glass w-full uh-shadow-xs box-border flex items-center border rounded-2xl p-2">
		<!-- 上一周 -->
		<view class="box-border shrink-0 flex items-center justify-center p-1 text-gray-500" @click="handlePrevWeek">
			<wd-icon name="left" size="32rpx" />
		</view>

		<!-- 周历主体 -->
		<view class="box-border flex flex-1 flex-row items-center justify-between px-1">
			<view v-for="item in weekDays" :key="item.date"
				class="flex-1 box-border flex flex-col items-center justify-center rounded-lg p-1"
				:class="item.isSelected ? 'bg-primary' : ''" @click="handleSelect(item.date)">
				<text class="text-sm text-gray-900 font-semibold">{{ item.day }}</text>
				<text class="text-10px text-gray-500" :class="item.isSelected ? 'text-gray-900' :''">{{ item.weekday }}</text>
			</view>
		</view>

		<!-- 下一周 -->
		<view class="shrink-0 flex items-center justify-center p-1 text-gray-500" @click="handleNextWeek">
			<wd-icon name="right" size="32rpx" />
		</view>
	</view>
</template>