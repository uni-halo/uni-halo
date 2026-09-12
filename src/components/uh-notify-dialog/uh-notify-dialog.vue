<script lang="ts" setup>
	import { onMounted, ref } from 'vue'
	import { getNoticeLatest } from '@/api/uni-halo'
	import { getCache, setCache } from '@/utils/storage'
	import { checkImageUrl } from '@/utils/url'
	import type { INoticeListVo } from '@/api/types/uni-halo'

	const HIDDEN_KEY_PREFIX = 'notice_latest_hidden'

	const isShow = ref(false)
	const notice = ref<INoticeListVo | null>(null)
	const checking = ref(false)

	function todayKey(name : string) : string {
		const date = new Date()
		const pad = (n : number) => String(n).padStart(2, '0')
		return `${HIDDEN_KEY_PREFIX}_${name}_${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
	}

	function formatDate(value ?: string) : string {
		if (!value)
			return ''
		const date = new Date(value)
		if (Number.isNaN(date.getTime()))
			return ''
		const pad = (n : number) => String(n).padStart(2, '0')
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
	}

	async function handleCheckLatest() {
		if (checking.value) { return }
		checking.value = true
		try {
			const res = await getNoticeLatest()
			const latest = res.data
			if (!latest?.name || !latest.title) { return }
			// 今日已看过则不再打扰
			if (getCache<string>(todayKey(latest.name))) { return }
			notice.value = latest
			isShow.value = true
		}
		catch (err) {
			console.error('获取最新公告失败', err)
		}
		finally {
			checking.value = false
		}
	}

	/** 仅关闭(不记录,下次进入可再弹) */
	function handleClose() {
		isShow.value = false
	}

	/** 今日不再提醒:记录后关闭 */
	function handleDismissForever() {
		if (notice.value?.name) {
			setCache(todayKey(notice.value.name), '1')
		}
		isShow.value = false
	}

	/** 查看全文:记录今日已看并跳公告详情页 */
	function handleViewAll() {
		if (notice.value?.name) {
			setCache(todayKey(notice.value.name), '1')
			const detailName = notice.value.name
			isShow.value = false
			uni.navigateTo({ url: `/pages-blog/notice/detail?name=${detailName}` })
		}
	}

	onMounted(() => {
		handleCheckLatest()
	})
</script>

<template>
	<uh-glass-popup v-model="isShow" position="center" :z-index="9999" custom-class="rounded-xl" @close="handleClose">
		<view v-if="notice" class="box-border w-[80vw] p-4">
			<view class="flex items-center justify-between">
				<view class="flex items-center gap-2">
					<wd-icon class-prefix="uhemoji2-icon" name="-happy-" size="36rpx" />
					<text class="text-md font-semibold text-gray-900">
						最新公告
					</text>
					<view v-if="notice.typeDisplayName" class="rounded px-1.5 py-0.5 text-xs text-primary bg-gray-100"
						:style="{
						  color: notice.typeColor,
						  backgroundColor: notice.typeColor ? `${notice.typeColor}1a` : '',
						}">
						{{ notice.typeDisplayName }}
					</view>
				</view>
				<view
					class="uh-global-card-glass !bg-white/5 border flex h-6 w-6 rounded-lg items-center justify-center text-gray-500"
					@click="handleClose">
					<wd-icon name="close" size="16px" />
				</view>
			</view>

			<!-- 内容 -->
			<view class="mt-4">
				<image v-if="notice.cover" :src="checkImageUrl(notice.cover)" class="w-full h-34 rounded-lg mb-2">
				</image>
				<view class="text-sm font-bold leading-snug text-gray-900">
					{{ notice.title }}
				</view>
				<view v-if="notice.summary" class="mt-3 text-2xs leading-relaxed text-gray-600">
					{{ notice.summary }}
				</view>
				<view v-if="notice.publishTime" class="mt-3 text-xs text-gray-600">
					日期：{{ formatDate(notice.publishTime) }}
				</view>
			</view>

			<!-- 操作 -->
			<view class="box-border mt-4 flex items-center justify-between pt-4">
				<view class="text-xs text-gray-600 " @click="handleDismissForever">
					今日不再提醒
				</view>
				<uh-button custom-class="font-semibold text-xs" @click="handleViewAll">
					查看全文 →
				</uh-button>
			</view>
		</view>
	</uh-glass-popup>
</template>