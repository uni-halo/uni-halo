<script lang="ts" setup>
	import { computed, ref, watch } from 'vue'
	import { getLoveAlbumByName } from '@/api/uni-halo'
	import { checkImageUrl } from '@/utils/url'
	import { sleep } from '@/utils/common'
	import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
	import type { ILoveAlbum } from '@/api/types/uni-halo'

	const props = withDefaults(defineProps<{
		show : boolean
		albumName ?: string
		/** 相册 key(详情请求参数) */
		albumKey ?: string
		/** 解锁 token(加密相册已解锁时传入) */
		token ?: string
	}>(), {
		albumName: '',
		albumKey: '',
		token: '',
	})

	const emit = defineEmits<{
		(e : 'update:show', show : boolean) : void
	}>()

	export interface IAlbumPhoto {
		name ?: string
		url ?: string
		title ?: string
		takenDate ?: string
		location ?: string
		description ?: string
		[key : string] : unknown
	}

	const isShow = ref(false)
	const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()
	const photos = ref<IAlbumPhoto[]>([])

	/** 预处理图片路径(相对路径拼接 BASE_API) */
	const photoList = computed<IAlbumPhoto[]>(() =>
		photos.value.map(photo => ({
			...photo,
			url: checkImageUrl(photo.url || ''),
		})),
	)

	/** 内部自请求:获取相册详情并填充照片 */
	async function handleLoadPhotos() {
		updateLoadingStatus(DataLoadingStatusEnum.Loading)
		try {
			const detail = await getLoveAlbumByName(props.albumKey, { token: props.token })
			photos.value = (detail.data as unknown as ILoveAlbum)?.photos || []
			await sleep(600)
			updateLoadingStatus(photos.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
		}
		catch (e) {
			console.error('获取相册照片失败', e)
			updateLoadingStatus(DataLoadingStatusEnum.Error)
		}
	}

	watch(() => props.show, (val) => {
		isShow.value = val
		if (val) {
			photos.value = []
			handleLoadPhotos()
		}
	}, { immediate: true })

	function handleClose() {
		isShow.value = false
		emit('update:show', false)
	}

	/** 预览大图 */
	function handlePreview(url ?: string) {
		const urls = photoList.value.map(photo => photo.url || '')
		if (urls.length === 0) {
			uni.showToast({ title: '相册暂无照片', icon: 'none' })
			return
		}
		uni.previewImage({
			current: url || urls[0],
			urls,
		})
	}
</script>

<template>
	<uh-glass-popup v-model="isShow" position="bottom" :z-index="100" custom-class="!border rounded-2xl"
		 @close="handleClose">
		<!-- 弹窗容器 -->
		<view class="w-full box-border flex flex-col gap-y-3 p-3">
			<!-- 顶部 -->
			<view class="w-full flex shrink-0 items-center justify-between">
				<view class="flex items-center gap-x-1 font-bold">
					{{ albumName }}
				</view>
				<view
					class="uh-global-card-glass uh-shadow-xs h-6 w-6 flex items-center justify-center border rounded-lg"
					@click="handleClose">
					<wd-icon name="close" size="28rpx" />
				</view>
			</view>

			<!-- 滚动区域 -->
			<scroll-view class="w-full box-border max-h-[50vh] flex-1" scroll-y :show-scrollbar="false">
				<!-- 滚动内部容器 -->
				<view class="w-full flex flex-col gap-y-3">
				<!-- 加载/错误/空占位(状态机) -->
				<uh-data-loading v-if="loadingStatus !== DataLoadingStatusEnum.Success" :use-refresh-button="false"
					:loading-status="loadingStatus" error-text="照片加载失败，请点击刷新重试" empty-text="这个相册暂时还没有照片~"
					min-height="40vh" @refresh="handleLoadPhotos" />
				<view v-else class="box-border grid grid-cols-2 gap-2">
					<view v-for="photo in photoList" :key="photo.name"
						class="relative box-border overflow-hidden uh-global-card-glass rounded-xl">
						<image class="w-full h-46 block" :src="photo.url" mode="aspectFill" lazy-load
							@click="handlePreview(photo.url)" />
						<view
							class="absolute bottom-0 w-full box-border p-3 pt-4 z-2 bg-gradient-to-b from-white/0 to-white/60">
							<view v-if="photo.title" class="mb-1 text-xs text-love font-bold">
								{{ photo.title }}
							</view>
							<view v-if="photo.description" class="mb-1 text-xs text-white leading-5">
								{{ photo.description }}
							</view>
							<view v-if="photo.takenDate || photo.location" class="flex flex-col gap-y-1">
								<text v-if="photo.takenDate" class="text-xs text-white">
									<wd-icon name="time-line"></wd-icon> {{ photo.takenDate }}
								</text>
								<text v-if="photo.location" class="text-xs text-white">
									<wd-icon name="location"></wd-icon> {{ photo.location }}
								</text>
							</view>

						</view>
					</view>
				</view>
				</view>
			</scroll-view>

			<!-- 底部固定操作区域 -->
			<view class="box-border w-full shrink-0 flex items-center gap-x-2">
				<uh-button class="flex-1" custom-class="flex-1 uh-global-card-glass uh-shadow-xs text-xs border py-2 !rounded-xl bg-white/90"
					@click="handleClose">
					关闭
				</uh-button>
				<uh-button class="flex-1" custom-class="flex-1 uh-global-card-glass uh-shadow-xs text-xs border py-2 !rounded-xl !bg-love/90 text-white"
					@click="handleLoadPhotos">
					刷新
				</uh-button>
			</view>
		</view>
	</uh-glass-popup>
</template>