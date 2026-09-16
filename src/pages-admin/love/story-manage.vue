<script lang="ts" setup>
	/**
 * 恋爱故事管理页
 */
	import { ref } from 'vue'
	import { onLoad, onPageScroll, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
	import { getLoveStories } from '@/api/uni-halo'
	import { createLoveStory, deleteLoveStory, updateLoveStory } from '@/api/uni-admin'
	import { usePageScroll } from '@/hooks/usePageScroll'
	import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
	import { useHaloUpload } from '@/hooks/useHaloUpload'
	import { checkThumbnailUrl } from '@/utils/url'
	import type { ILoveStory, ILoveStorySpec } from '@/api/types/uni-halo'
import { formatTime } from '@/utils/formatTime'

	definePage({
		style: {
			navigationBarTitleText: '恋爱故事管理',
			navigationStyle: 'custom',
			enablePullDownRefresh: true,
		},
	})

	const { scrollY, updatePageScrollValue } = usePageScroll()

	/* ---------------- 数据加载 ---------------- */
	const { loadingStatus, loadMoreStatus, updateLoadingStatus, updateLoadMoreStatus, resetLoadMoreStatus } = useDataLoadingStatus()
	const queryParams = ref({ size: 10, page: 1 })
	const dataList = ref<ILoveStory[]>([])

	async function handleGetData() {
		if (!loadMoreStatus.value.active) {
			updateLoadingStatus(DataLoadingStatusEnum.Loading)
		}
		try {
			const res = await getLoveStories({ ...queryParams.value })
			const items = (res.data?.items || []).map(item=>{
				item.spec.date = formatTime({
					d:item.spec.date,
					f:'yyyy/MM/dd HH:mm 星期w'
				})
				return item;
			})
			dataList.value = loadMoreStatus.value.active
				? dataList.value.concat(items)
				: items
			if (!loadMoreStatus.value.active) {
				updateLoadingStatus(dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
			}
			updateLoadMoreStatus({
				active: false,
				status: res.data?.hasNext ? 'loadMore' : 'noMore',
				hasNext: !!res.data?.hasNext,
			})
		}
		catch (err) {
			console.error(err)
			if (loadMoreStatus.value.active) {
				updateLoadMoreStatus({ active: false, status: 'error' })
			}
			else {
				updateLoadingStatus(DataLoadingStatusEnum.Error)
			}
		}
		finally {
			uni.stopPullDownRefresh()
		}
	}

	function handleRetry() {
		queryParams.value.page = 1
		handleGetData()
	}

	onLoad(() => {
		handleGetData()
	})

	onPullDownRefresh(() => {
		resetLoadMoreStatus()
		queryParams.value.page = 1
		handleGetData()
	})

	onReachBottom(() => {
		if (loadMoreStatus.value.active)
			return
		if (loadMoreStatus.value.hasNext) {
			queryParams.value.page += 1
			updateLoadMoreStatus({ active: true, status: 'loading' })
			handleGetData()
		}
	})

	/* ---------------- 新增/编辑弹层 ---------------- */
	const formVisible = ref(false)
	const formMode = ref<'create' | 'edit'>('create')
	const editName = ref('')
	const form = ref<ILoveStorySpec>({})
	const { list: imageList, choose: chooseImages, remove: removeImage, retry: imageRetry } = useHaloUpload({ maxCount: 9 })
	const saving = ref(false)

	function openCreate() {
		formMode.value = 'create'
		editName.value = ''
		form.value = { title: '', content: '', date: '', location: '' }
		imageList.value = []
		formVisible.value = true
	}

	function openEdit(item : ILoveStory) {
		formMode.value = 'edit'
		editName.value = item.metadata?.name || ''
		form.value = { ...(item.spec || {}) }
		imageList.value = (form.value.images || []).map(url => ({
			tempPath: url,
			url,
			status: 'success' as const,
			progress: 100,
		}))
		formVisible.value = true
	}

	async function handleSave() {
		const spec = { ...form.value }
		if (!spec.title?.trim()) {
			uni.showToast({ title: '请填写标题', icon: 'none' })
			return
		}
		// 若有新选的本地图，先等上传完成
		if (imageList.value.some(i => i.status === 'pending' || i.status === 'uploading' || i.status === 'error')) {
			uni.showToast({ title: '图片尚未上传完成', icon: 'none' })
			return
		}
		spec.images = imageList.value.filter(i => i.status === 'success').map(i => i.url)
		saving.value = true
		try {
			if (formMode.value === 'create') {
				await createLoveStory(spec)
			}
			else {
				await updateLoveStory(editName.value, spec)
			}
			formVisible.value = false
			uni.showToast({ title: formMode.value === 'create' ? '已新增' : '已保存', icon: 'success' })
			handleRetry()
		}
		catch (err : any) {
			uni.showToast({ title: err?.message || '保存失败', icon: 'none' })
		}
		finally {
			saving.value = false
		}
	}

	/* ---------------- 删除 ---------------- */
	function handleDelete(item : ILoveStory) {
		uni.showModal({
			title: '删除故事',
			content: `确定删除「${item.spec?.title || '未命名'}」吗？删除后不可恢复。`,
			confirmColor: '#ef4444',
			success: async (res) => {
				if (!res.confirm)
					return
				try {
					await deleteLoveStory(item.metadata?.name || '')
					dataList.value = dataList.value.filter(x => (x.metadata?.name || '') !== (item.metadata?.name || ''))
					if (dataList.value.length === 0)
						updateLoadingStatus(DataLoadingStatusEnum.Empty)
					uni.showToast({ title: '已删除', icon: 'success' })
				}
				catch (err : any) {
					uni.showToast({ title: err?.message || '删除失败', icon: 'none' })
				}
			},
		})
	}

	onPageScroll((option : Page.PageScrollOption) => {
		updatePageScrollValue(option.scrollTop)
	})
</script>

<template>
	<view class="box-border min-h-screen w-screen flex flex-col bg-page">
		<uh-navbar :scroll-y="scrollY" :use-back="true" default-title="恋爱故事管理" title-color="text-gray-900" />

		<uh-data-loading v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus"
			min-height="70vh" @refresh="handleRetry" />

		<view v-else class="box-border flex flex-col gap-3 px-3 pb-24 pt-3">
			<view v-for="(item,index) in dataList" :key="item.metadata?.name || item.id"
				class="uh-global-card-glass uh-shadow-xs overflow-hidden rounded-xl">
				<view class="flex items-start gap-3 p-4">
					<image v-if="item.spec?.images?.[0]" :src="checkThumbnailUrl(item.spec.images[0], true)"
						mode="aspectFill" class="h-20 w-20 shrink-0 rounded-lg" />
					<view class="min-w-0 flex-1">
						<view class="text-sm text-gray-900 font-bold">
							{{ item.spec?.title || '未命名' }}
						</view>
						<view class="mt-1 flex items-center gap-2 text-3xs text-gray-500">
							<view v-if="item.spec?.location" class="flex items-center gap-0.5">
								<wd-icon name="location" size="22rpx" />
								<text>{{ item.spec.location }}</text>
							</view>
						</view>
						<view class="line-clamp-2 mt-1 text-xs text-gray-500 leading-relaxed">
							{{ (item.spec?.content || '').replace(/<[^>]+>/g, '') || '' }}
						</view>
					</view>
				</view>
				<view
					class="box-border flex items-center justify-end gap-4 border-t border-t-solid border-gray-100 px-4 py-2.5 text-xs">
					<view class="flex-1 flex items-center gap-x-2">
						<view
							class="uh-global-card-glass border flex items-center justify-center bg-love text-white rounded-full py-0.5 px-1.5 text-10px">
							{{index+1}}
						</view>
						<view v-if="item.spec?.date" class="flex items-center gap-x-1 text-xs text-love font-bold">
							<text>{{ item.spec.date }}</text>
						</view>
					</view>
					<view class="shrink-0 flex items-center justify-end gap-x-4">
						<view class="flex items-center gap-1 text-gray-500" @click="openEdit(item)">
							<wd-icon name="edit" size="26rpx" />
							<text>编辑</text>
						</view>
						<view class="flex items-center gap-1 text-red-500" @click="handleDelete(item)">
							<wd-icon name="delete" size="26rpx" />
							<text>删除</text>
						</view>
					</view>
				</view>
			</view>
			<uh-data-loadmore :status="loadMoreStatus.status" :text="loadMoreStatus.text" />
		</view>

		<!-- 底部悬浮 -->
		<uh-permission permission="LOVE_STORY_MANAGE">
			<view class="uh-translate-x-center fixed bottom-0 left-1/2 z-10 flex items-center justify-center pb-safe">
				<view
					class="uh-global-card-glass box-border py-2.5 flex items-center justify-center gap-x-1 border rounded-full px-6 text-love shadow-none"
					@click="openCreate">
					<wd-icon name="plus" size="32rpx" />
					<text class="shrink-0 text-2xs font-semibold">新增故事</text>
				</view>
			</view>
		</uh-permission>

		<!-- 新增/编辑弹层 -->
		<uh-glass-popup v-model="formVisible" :z-index="100" position="bottom" custom-class="!border rounded-xl">
			<view class="relative mb-4 box-border w-full flex items-center justify-around px-4 pt-4">
				<view class="w-full flex flex-col gap-y-1">
					<text class="text-md font-bold">{{ formMode === 'create' ? '新增故事' : '编辑故事' }}</text>
					<text class="text-xs text-gray-500">{{ formMode === 'create' ? '记录一段属于你们的回忆' : '修改故事信息' }}</text>
				</view>
				<view
					class="uh-global-card-glass absolute right-4 top-4 h-6 w-6 border rounded-lg text-center shadow-none"
					@click="formVisible = false">
					<wd-icon name="close" size="32rpx" class="text-gray-500" />
				</view>
			</view>
			<scroll-view :scroll-y="true" :show-scrollbar="false" class="box-border max-h-[60vh] p-4 pt-0">
				<view class="mb-5 flex items-center">
					<text class="w-[140rpx] shrink-0 text-sm text-[#666]">标题 *</text>
					<input v-model="form.title"
						class="uh-global-card-glass h-9 flex-1 border rounded-xl px-4 text-sm shadow-none"
						placeholder="请输入故事标题">
				</view>
				<view class="mb-5 flex items-center">
					<text class="w-[140rpx] shrink-0 text-sm text-[#666]">日期</text>
					<input v-model="form.date"
						class="uh-global-card-glass h-9 flex-1 border rounded-xl px-4 text-sm shadow-none"
						placeholder="如 2024-06-01(选填)">
				</view>
				<view class="mb-5 flex items-center">
					<text class="w-[140rpx] shrink-0 text-sm text-[#666]">地点</text>
					<input v-model="form.location"
						class="uh-global-card-glass h-9 flex-1 border rounded-xl px-4 text-sm shadow-none"
						placeholder="请输入地点(选填)">
				</view>
				<view class="mb-5">
					<text class="mb-2 block text-sm text-[#666]">故事内容</text>
					<textarea v-model="form.content"
						class="uh-global-card-glass box-border h-32 w-full border rounded-xl p-3 text-sm shadow-none"
						placeholder="记录这段故事…" :maxlength="10000" />
				</view>
				<view class="mb-5">
					<text class="mb-2 block text-sm text-[#666]">图片</text>
					<view class="grid grid-cols-4 gap-2">
						<view v-for="img in imageList" :key="img.tempPath"
							class="relative aspect-square overflow-hidden rounded-lg">
							<image :src="img.tempPath" class="h-full w-full" mode="aspectFill" />
							<view
								class="absolute right-1 top-1 h-5 w-5 flex items-center justify-center rounded-full bg-red-400 text-white"
								@click="removeImage(img.tempPath)">
								<wd-icon name="close" size="22rpx" />
							</view>
							<view v-if="img.status === 'uploading'"
								class="absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-white">
								{{ img.progress }}%
							</view>
							<view v-else-if="img.status === 'error'"
								class="absolute inset-0 flex flex-col items-center justify-center bg-red-500/60 text-xs text-white"
								@click="imageRetry(img.tempPath)">
								<text>失败</text>
								<text>点击重试</text>
							</view>
							<view v-else-if="img.status === 'success'"
								class="absolute bottom-1 right-1 h-5 w-5 flex items-center justify-center rounded-full bg-love text-white">
								<wd-icon name="check" size="22rpx" />
							</view>
						</view>
						<view v-if="imageList.length < 9"
							class="aspect-square flex items-center justify-center border-2 border-gray-300 rounded-lg border-dashed text-gray-400"
							@click="chooseImages">
							<wd-icon name="camera" size="36rpx" />
						</view>
					</view>
				</view>
			</scroll-view>

			<view class="box-border my-6 px-4">
				<uh-button custom-class="py-2 !rounded-xl !bg-love text-white" :loading="saving" @click="handleSave">
					保存
				</uh-button>
			</view>
		</uh-glass-popup>
	</view>
</template>

<style scoped lang="scss">
	.uh-translate-x-center {
		transform: translateX(-50%);
	}
</style>