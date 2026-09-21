<script lang="ts" setup>
	/**
 * 恋爱信息管理页（纪念日 + 恋人信息，单例）
 * 读取走公开接口 getLoveInfo，保存走 console API updateLoveInfo（需 LOVE_INFO_MANAGE 权限）
 */
	import { computed, ref } from 'vue'
	import { onPageScroll, onShow } from '@dcloudio/uni-app'
	import dayjs from 'dayjs'
	import { getLoveInfo } from '@/api/uni-halo'
	import { updateLoveInfo } from '@/api/uni-admin'
	import { usePageScroll } from '@/hooks/usePageScroll'
	import { useHaloUpload } from '@/hooks/useHaloUpload'
	import { checkAvatarUrl } from '@/utils/url'
	import type { ILoveInfo } from '@/api/types/uni-halo'

	definePage({
		style: {
			navigationBarTitleText: '恋爱信息管理',
			navigationStyle: 'custom',
		},
	})

	const { scrollY, updatePageScrollValue } = usePageScroll()

	const loading = ref(false)
	const saving = ref(false)
	const form = ref<Partial<ILoveInfo>>({})

	/* ---------------- 数据加载 ---------------- */
	async function fetchLoveInfo() {
		loading.value = true
		try {
			const res = await getLoveInfo()
			form.value = res.data || {}
		}
		catch (err : any) {
			console.error('获取恋爱信息失败:', err)
			uni.showToast({ title : err?.message || '获取恋爱信息失败', icon : 'none' })
		}
		finally {
			loading.value = false
		}
	}

	onShow(() => {
		fetchLoveInfo()
	})

	/* ---------------- 恋爱纪念日选择 ---------------- */
	const dateShow = ref(false)
	const dateTs = ref(Date.now())

	function openDatePicker() {
		dateTs.value = form.value.loveDate ? dayjs(form.value.loveDate).valueOf() : Date.now()
		dateShow.value = true
	}

	function handleDateConfirm({ value } : any) {
		form.value.loveDate = dayjs(value).format('YYYY-MM-DD')
	}

	/* ---------------- 恋人头像（单图上传） ---------------- */
	const boyUpload = useHaloUpload({ maxCount : 1, onSuccess : item => (form.value.boyAvatar = item.url) })
	const girlUpload = useHaloUpload({ maxCount : 1, onSuccess : item => (form.value.girlAvatar = item.url) })

	function pickBoyAvatar() {
		boyUpload.reset()
		boyUpload.choose()
	}

	function pickGirlAvatar() {
		girlUpload.reset()
		girlUpload.choose()
	}

	/** 头像展示源：上传中显示本地预览，成功后显示远程地址，否则回退已保存值 */
	function avatarSrc(item : { tempPath : string, url : string, status : string } | undefined, saved ?: string) {
		if (item) {
			return item.status === 'success' ? checkAvatarUrl(item.url) : item.tempPath
		}
		return saved ? checkAvatarUrl(saved) : ''
	}

	const boyAvatarSrc = computed(() => avatarSrc(boyUpload.list.value[0], form.value.boyAvatar))
	const girlAvatarSrc = computed(() => avatarSrc(girlUpload.list.value[0], form.value.girlAvatar))

	const boyUploading = computed(() => boyUpload.list.value.some(i => i.status === 'pending' || i.status === 'uploading'))
	const girlUploading = computed(() => girlUpload.list.value.some(i => i.status === 'pending' || i.status === 'uploading'))
	const boyUploadFailed = computed(() => boyUpload.list.value.some(i => i.status === 'error'))
	const girlUploadFailed = computed(() => girlUpload.list.value.some(i => i.status === 'error'))

	/* ---------------- 保存 ---------------- */
	async function handleSave() {
		if (boyUploading.value || girlUploading.value) {
			uni.showToast({ title : '头像尚未上传完成', icon : 'none' })
			return
		}
		if (boyUploadFailed.value || girlUploadFailed.value) {
			uni.showToast({ title : '头像上传失败，请重新选择', icon : 'none' })
			return
		}
		saving.value = true
		try {
			await updateLoveInfo({ ...form.value })
			uni.showToast({ title : '已保存', icon : 'success' })
			// 清空上传队列，展示源回落到已保存的远程地址
			boyUpload.reset()
			girlUpload.reset()
		}
		catch (err : any) {
			uni.showToast({ title : err?.message || '保存失败', icon : 'none' })
		}
		finally {
			saving.value = false
		}
	}

	onPageScroll((option : Page.PageScrollOption) => {
		updatePageScrollValue(option.scrollTop)
	})
</script>

<template>
	<view class="box-border min-h-screen w-screen flex flex-col bg-page">
		<uh-navbar :scroll-y="scrollY" :use-back="true" default-title="恋爱信息管理" title-color="text-gray-900" />

		<view v-if="loading" class="flex flex-1 items-center justify-center">
			<wd-loading size="60rpx" class="text-love" />
		</view>

		<uh-permission v-else permission="LOVE_INFO_MANAGE">
			<view class="box-border flex flex-col gap-y-4 px-4 pb-28 pt-3">
				<!-- 纪念日 -->
				<view class="flex flex-col">
					<uh-section-title>纪念日</uh-section-title>
					<view class="uh-global-card-glass uh-shadow-xs mt-3 flex flex-col gap-y-3 rounded-2xl p-4">
						<view class="flex items-center gap-x-3">
							<text class="w-[140rpx] shrink-0 text-3xs text-gray-600">纪念日标题</text>
							<input v-model="form.loveDateTitle"
								class="uh-global-card-glass h-9 flex-1 border rounded-xl px-4 text-3xs shadow-none"
								placeholder="如：我们在一起的那天(留空用默认文案)" :maxlength="30">
						</view>
						<view class="flex items-center gap-x-3">
							<text class="w-[140rpx] shrink-0 text-3xs text-gray-600">恋爱纪念日</text>
							<view
								class="uh-global-card-glass h-9 flex flex-1 items-center justify-between border rounded-xl px-4 text-3xs shadow-none"
								@click="openDatePicker">
								<text :class="form.loveDate ? 'text-gray-900' : 'text-gray-400'">
									{{ form.loveDate || '选择日期(用于计算恋爱天数)' }}
								</text>
								<wd-icon name="calendar" size="28rpx" class="text-gray-400" />
							</view>
							<wd-datetime-picker v-model="dateTs" :z-index="999" root-portal type="date" title="选择恋爱纪念日"
								v-model:visible="dateShow" @confirm="handleDateConfirm" />
						</view>
					</view>
				</view>

				<!-- 恋人信息 -->
				<view class="flex flex-col">
					<uh-section-title>恋人信息</uh-section-title>
					<view class="uh-global-card-glass uh-shadow-xs mt-3 flex flex-col gap-y-4 rounded-2xl p-4">
						<!-- 男生 -->
						<view class="flex items-center gap-x-3">
							<view class="relative h-18 w-18 shrink-0" @click="pickBoyAvatar">
								<image :src="boyAvatarSrc" class="uh-global-card-glass h-full w-full rounded-full" mode="aspectFill" />
								<view
									class="uh-global-card-glass absolute bottom-0 right-0 h-6 w-6 flex items-center justify-center border rounded-full">
									<wd-icon name="camera" size="24rpx" custom-class="text-gray-500" />
								</view>
								<view v-if="boyUploading"
									class="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
									<wd-loading size="40rpx" class="text-white" />
								</view>
								<view v-else-if="boyUploadFailed"
									class="absolute inset-0 flex items-center justify-center rounded-full bg-red-500/70 text-2xs text-white">
									点击重选
								</view>
							</view>
							<view class="flex min-w-0 flex-1 flex-col gap-y-1">
								<text class="text-3xs text-gray-600">男生昵称</text>
								<input v-model="form.boyNickname"
									class="uh-global-card-glass h-9 border rounded-xl px-4 text-3xs shadow-none"
									placeholder="男生的昵称" :maxlength="20">
							</view>
						</view>
						<!-- 女生 -->
						<view class="flex items-center gap-x-3">
							<view class="relative h-18 w-18 shrink-0" @click="pickGirlAvatar">
								<image :src="girlAvatarSrc" class="uh-global-card-glass h-full w-full rounded-full" mode="aspectFill" />
								<view
									class="uh-global-card-glass absolute bottom-0 right-0 h-6 w-6 flex items-center justify-center border rounded-full">
									<wd-icon name="camera" size="24rpx" custom-class="text-gray-500" />
								</view>
								<view v-if="girlUploading"
									class="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
									<wd-loading size="40rpx" class="text-white" />
								</view>
								<view v-else-if="girlUploadFailed"
									class="absolute inset-0 flex items-center justify-center rounded-full bg-red-500/70 text-2xs text-white">
									点击重选
								</view>
							</view>
							<view class="flex min-w-0 flex-1 flex-col gap-y-1">
								<text class="text-3xs text-gray-600">女生昵称</text>
								<input v-model="form.girlNickname"
									class="uh-global-card-glass h-9 border rounded-xl px-4 text-3xs shadow-none"
									placeholder="女生的昵称" :maxlength="20">
							</view>
						</view>
					</view>
					<text class="mt-2 text-2xs text-gray-400">头像点击更换，保存后展示在恋爱页顶部与主题模板</text>
				</view>
			</view>

			<!-- 底部悬浮：保存 -->
			<view class="uh-translate-x-center fixed bottom-0 left-1/2 z-10 flex items-center justify-center pb-safe">
				<uh-button
					class="box-border w-[80vw] items-center justify-center"
					custom-class="uh-global-card-glass box-border flex items-center justify-center gap-x-1 border rounded-full py-2.5 text-love shadow-none"
					:class="saving ? 'opacity-60' : ''" @click="handleSave">
					{{ saving ? '保存中' : '保存' }}
				</uh-button>
			</view>
		</uh-permission>
	</view>
</template>
