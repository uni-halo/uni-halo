<script lang="ts" setup>
	import { computed, onMounted, ref } from 'vue'
	import { getNotices } from '@/api/uni-halo'
	import type { INoticeListVo } from '@/api/types/uni-halo'

	/** 轮播展示条数上限(垂直循环) */
	const MAX_SHOW = 6

	const list = ref<INoticeListVo[]>([])
	const showList = computed(() => list.value.slice(0, MAX_SHOW))

	async function fetchNotices() {
		try {
			const res = await getNotices({ page: 1, size: MAX_SHOW })
			list.value = res.data?.items || []
		}
		catch (err) {
			console.error('首页公告获取失败', err)
			list.value = []
		}
	}

	/** 点击单条公告标题 → 详情页 */
	function handleTap(item : INoticeListVo) {
		if (!item.name) { return }
		uni.navigateTo({ url: `/pages-blog/notice/detail?name=${item.name}` })
	}

	/** 点击「公告/更多」→ 公告列表页 */
	function handleGoList() {
		uni.navigateTo({ url: '/pages-blog/notice/notice' })
	}

	onMounted(() => {
		fetchNotices()
	})
</script>

<template>
	<view v-if="showList.length > 0"
		class="uh-global-card-glass box-border mx-3 mt-3 mb-2 flex items-center rounded-xl px-3">
		<!-- 左侧公告入口 -->
		<view class="flex shrink-0 items-center gap-2 py-2 pr-3" @click="handleGoList">
			<wd-icon class-prefix="uhemoji2-icon" name="-happy-" size="36rpx" />
			<text class="text-sm font-bold text-red-400">
				公告
			</text>
		</view>

		<!-- 标题轮播(仅一条时静态展示) -->
		<view class="h-[60rpx] min-w-0 flex-1 overflow-hidden">
			<swiper v-if="showList.length > 1" class="h-full w-full" vertical circular autoplay :interval="3500"
				:duration="400">
				<swiper-item v-for="(item, index) in showList" :key="item.name || index" class="h-full w-full">
					<view class="flex h-full w-full items-center truncate text-xs text-gray-500"
						@click="handleTap(item)">
						{{ item.title }}
					</view>
				</swiper-item>
			</swiper>
			<view v-else class="flex h-full w-full items-center truncate text-[24rpx] text-[#555]"
				@click="handleTap(showList[0])">
				{{ showList[0]?.title }}
			</view>
		</view>

		<!-- 右侧更多入口 -->
		<view class="box-border flex shrink-0 items-center gap-0.5 py-2 pl-2 text-gray-400"  @click="handleGoList">
			<text class="text-xs"> 全部 </text>
			<wd-icon name="arrow-right" size="26rpx" />
		</view>
	</view>
</template>

<style scoped lang="scss">
	/* 布局由 UnoCSS 原子类实现 */
</style>