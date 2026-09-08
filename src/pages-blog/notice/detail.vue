<script lang="ts" setup>
	/**
 * 公告详情页(plugin-uni-halo 通知公告,2026-09-03 客户端接入)
 * 公开 GET /notices/{name} 返回完整 Notice extension(metadata+spec,spec 内嵌
 * typeDisplayName/typeColor);正文 content 为富文本 HTML,mp-html 渲染。
 * 不存在/删除中返回 404 → 空态提示。UIUX 见 .docs/notice-module-client-design.md
 */
	import { computed, ref } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import { getNoticeDetail } from '@/api/uni-halo'
	import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
	import { checkImageUrl, checkIsUrl } from '@/utils/url'
	import { markdownConfig } from '@/config/markdown'
	import type { INoticeDetail } from '@/api/types/uni-halo'

	definePage({
		style: {
			navigationBarTitleText: '公告详情',
			navigationStyle: 'custom',
		},
	})

	const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()
	const name = ref('')
	const detail = ref<INoticeDetail | null>(null)

	const spec = computed(() => detail.value?.spec)
	const content = computed(() => spec.value?.content || '')
	const title = computed(() => spec.value?.title || '')
	const typeColor = computed(() => spec.value?.typeColor || '')
	const typeDisplayName = computed(() => spec.value?.typeDisplayName || '')
	/** 封面图:相对路径(如 /upload/...)经 checkImageUrl 补全为完整地址后再渲染 */
	const cover = computed(() => {
		const raw = spec.value?.cover || ''
		return raw ? checkImageUrl(raw) : ''
	})
	const publishTime = computed(() => formatDate(spec.value?.publishTime))
	const hasLink = computed(() => !!spec.value?.link && checkIsUrl(spec.value?.link || ''))

	function formatDate(value ?: string) : string {
		if (!value) { return '' }
		const date = new Date(value)
		if (Number.isNaN(date.getTime())) { return '' }
		const pad = (n : number) => String(n).padStart(2, '0')
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
	}

	function handleCopy() {
		if (!spec.value?.link) { return }
		uni.setClipboardData({
			data: `${title.value} ${spec.value.link}`,
			success: () => {
				uni.showToast({
					title: '复制成功',
					icon: 'none',
				})
			},
			fail: () => {
				uni.showToast({
					title: '复制失败',
					icon: 'none',
				})
			}
		})
	}

	/** 加载公告详情(状态机;404/无数据 → 空态,其余错误 → error 态,可重试) */
	async function loadDetail() {
		updateLoadingStatus(DataLoadingStatusEnum.Loading)
		if (!name.value) {
			updateLoadingStatus(DataLoadingStatusEnum.Empty)
			return
		}
		try {
			const res = await getNoticeDetail(name.value)
			detail.value = res.data || null
			updateLoadingStatus(
				detail.value?.spec ? DataLoadingStatusEnum.Success : DataLoadingStatusEnum.Empty,
			)
		}
		catch (err) {
			console.error('公告详情加载失败', err)
			const code = (err as { code ?: number }).code
			updateLoadingStatus(code === 404 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Error)
		}
	}

	onLoad((options) => {
		name.value = options?.name || ''
		loadDetail()
	})
</script>

<template>
	<view class="box-border min-h-screen w-screen bg-page pb-safe">
		<!-- 自定义导航 -->
		<uh-navbar default-title="公告详情" title-color="text-gray-900" />

		<!-- 加载/错误/空态(状态机) -->
		<uh-data-loading v-if="loadingStatus !== 'success'" :loading-status="loadingStatus" min-height="55vh"
			error-text="公告加载失败" empty-text="公告不存在或已下线" empty-sub-text="" @refresh="loadDetail" />

		<!-- 正文 -->
		<view v-else class="box-border p-4">
			<image v-if="cover" class="mb-5 h-[320rpx] w-full rounded-xl" :src="cover" mode="aspectFill" />
			<view class="text-[36rpx] font-bold leading-snug text-gray-900">
				{{ title }}
			</view>

			<view class="mt-3 flex items-center gap-2">
				<view v-if="typeDisplayName" class="rounded px-2 py-0.5 text-[20rpx]" :style="{
					color: typeColor || '#f83856',
					backgroundColor: typeColor ? `${typeColor}1a` : '#fdeef1',
				  }">
					{{ typeDisplayName }}
				</view>
				<text class="text-[22rpx] text-gray-500">
					{{ publishTime }}
				</text>
			</view>

			<view class="box-border w-full mt-2 pt-4 pb-6">
				<mp-html :content="content" lazy-load :domain="markdownConfig.domain ?? ''" scroll-table selectable
					:tag-style="markdownConfig.tagStyle" :container-style="markdownConfig.containStyle"
					:show-line-number="false" copy-by-long-press />
			</view>

			<view v-if="hasLink" class="fixed left-0 right-0 bottom-0 pb-safe px-4 box-border">
				<view class="w-full h-full uh-global-card-glass border rounded-full mb-4">
					<uh-button custom-class="w-full !rounded-full py-2.5 font-medium" @click="handleCopy">
						复制原文地址
					</uh-button>
				</view>
			</view>
		</view>
	</view>
</template>