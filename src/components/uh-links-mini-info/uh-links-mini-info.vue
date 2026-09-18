<script lang="ts" setup>
	import { computed, ref, watch } from 'vue'
	import { storeToRefs } from 'pinia'
	import { useAppConfigStore } from '@/store/appConfig'
	import { checkAvatarUrl, checkImageUrl } from '@/utils/url'

	defineOptions({
		options: {
			styleIsolation: 'apply-shared'
		}
	})

	const props = withDefaults(defineProps<{
		show ?: boolean
	}>(), {
		show: false,
	})

	const emit = defineEmits<{
		(e : 'on-close') : void
	}>()

	const isShow = ref(false)
	const { configs } = storeToRefs(useAppConfigStore())

	const miniInfo = computed(() => {
		const miniCfg = configs.value.featureConfig?.linkInfo?.miniInfo
		const blogger = configs.value.featureConfig?.profile?.blogger
		return {
			displayName: miniCfg?.displayName || '',
			miniProgramCode: miniCfg?.miniProgramCode || '',
			appId: miniCfg?.appId || '',
			path: miniCfg?.path || '',
			link: miniCfg?.link || '',
			// 作者信息：博主资料 nickname/avatar/website
			authorName: blogger?.nickname || '',
			avatar: blogger?.avatar || '',
			website: blogger?.website || '',
			description: miniCfg?.description || '',
			applyRemark: miniCfg?.applyRemark || '',
		}
	})

	const hasInfo = computed(() => !!(miniInfo.value.displayName || miniInfo.value.miniProgramCode))

	/** 复制任意文本 */
	function handleCopyText(text ?: string) {
		if (!text) {
			return
		}
		uni.setClipboardData({
			data: text,
			showToast: false,
			success: () => {
				uni.showToast({ icon: 'none', title: '复制成功！' })
			},
			fail: () => {
				uni.showToast({ icon: 'none', title: '复制失败！' })
			},
		})
	}

	/** 复制跳转地址 */
	function handleCopyLink() {
		if (!miniInfo.value.link) {
			uni.showToast({ icon: 'none', title: '暂未填写跳转地址' })
			return
		}
		uni.setClipboardData({
			data: miniInfo.value.link,
			showToast: false,
			success: () => {
				uni.showToast({ icon: 'none', title: '地址复制成功！' })
			},
			fail: () => {
				uni.showToast({ icon: 'none', title: '复制失败！' })
			},
		})
	}

	/** 复制小程序申请信息(拼接文案) */
	function handleCopyInfo() {
		const info = miniInfo.value
		const text = [
			info.miniProgramCode ? `小程序太阳码：${checkImageUrl(info.miniProgramCode)}` : '',
			info.displayName ? `小程序名称：${info.displayName}` : '',
			info.appId ? `小程序 AppID：${info.appId}` : '',
			info.path ? `跳转页面路径：${info.path}` : '',
			info.link ? `小程序地址：${info.link}` : '',
			info.description ? `小程序描述：${info.description}` : '',
			info.avatar ? `作者头像：${checkAvatarUrl(info.avatar)}` : '',
			info.authorName ? `作者昵称：${info.authorName}` : '',
			info.website ? `作者网站：${info.website}` : '',
			info.applyRemark ? `申请说明：${info.applyRemark}` : '',
		].filter(Boolean).join('\n')
		uni.setClipboardData({
			data: text,
			showToast: false,
			success: () => {
				uni.showToast({ icon: 'none', title: '复制成功！' })
			},
			fail: () => {
				uni.showToast({ icon: 'none', title: '复制失败！' })
			},
		})
	}

	/** 预览太阳码 */
	function handlePreviewCode() {
		if (!miniInfo.value.miniProgramCode)
			return
		uni.previewImage({
			urls: [checkImageUrl(miniInfo.value.miniProgramCode)],
			current: checkImageUrl(miniInfo.value.miniProgramCode),
		})
	}

	function handleClose() {
		isShow.value = false
		emit('on-close')
	}

	watch(() => props.show, (val) => {
		isShow.value = val
	})
</script>

<template>
	<uh-glass-popup v-model="isShow" :z-index="100" position="bottom" custom-class="!border rounded-xl"
		@close="handleClose">
		<view class="relative box-border w-full flex items-center justify-around px-4 pt-4">
			<view class="w-full flex flex-col gap-y-1">
				<text class="text-md font-bold">小程序友链信息</text>
				<text class="text-xs text-gray-500">本站小程序申请提交的信息,欢迎互换</text>
			</view>
			<view class="uh-global-card-glass absolute right-4 top-4 h-6 w-6 border rounded-lg text-center shadow-none"
				@click="handleClose">
				<wd-icon name="close" size="32rpx" class="text-gray-500" />
			</view>
		</view>

		<scroll-view :scroll-y="true" :show-scrollbar="false" class="box-border max-h-[60vh] p-4">
			<!-- 未配置信息占位 -->
			<view v-if="!hasInfo" class="py-10 text-center text-xs text-gray-400">
				暂未配置小程序申请信息
			</view>

			<template v-else>
				<view class="w-full flex items-center gap-x-3">
					<!-- 太阳码大图(点击预览) -->
					<view v-if="miniInfo.miniProgramCode" class="code-area flex flex-col items-center">
						<image class="code-img h-16 w-16 rounded-full" :src="checkImageUrl(miniInfo.miniProgramCode)"
							mode="aspectFill" @click="handlePreviewCode" />
					</view>

					<view class="flex-1 flex flex-col gap-y-1">
						<!-- 名称 -->
						<view v-if="miniInfo.displayName" class="flex items-center">
							<text class="mini-name text-lg text-gray-900 font-bold">{{ miniInfo.displayName }}</text>
						</view>

						<!-- 描述 -->
						<view v-if="miniInfo.description" class="text-2xs text-gray-600 leading-[1.6]">
							{{ miniInfo.description }}
						</view>
					</view>
				</view>
				<view class="mt-2 flex items-center ">
					<text class="text-xs text-gray-400">温馨提示：点击图片可以预览太阳码</text>
				</view>

				<!-- AppID / 页面路径 -->
				<view v-if="miniInfo.appId || miniInfo.path"
					class="uh-global-card-glass shadow-none border mt-2 flex flex-col gap-2 rounded-xl bg-[#f6f3ee] p-4 text-xs text-gray-500">
					<view v-if="miniInfo.appId" class="flex items-center justify-between">
						<view>
							<text class="text-gray-400">小程序 AppID：</text>{{ miniInfo.appId }}
						</view>
						<text class="shrink-0 text-[26rpx] text-[#4d7c0f] font-bold" @click="handleCopyText(miniInfo.appId)">复制</text>
					</view>
					<view v-if="miniInfo.path" class="flex items-center justify-between">
						<view class="min-w-0 flex-1 overflow-hidden truncate whitespace-nowrap">
							<text class="text-gray-400">跳转页面路径：</text>{{ miniInfo.path }}
						</view>
						<text class="ml-3 shrink-0 text-[26rpx] text-[#4d7c0f] font-bold" @click="handleCopyText(miniInfo.path)">复制</text>
					</view>
				</view>

				<!-- 跳转地址 -->
				<view v-if="miniInfo.link"
					class="mini-link mt-2 flex items-center justify-between rounded-xl bg-secondary p-4">
					<view
						class="link-text flex-1 overflow-hidden truncate whitespace-nowrap text-[26rpx] text-[#4d7c0f]">
						{{ miniInfo.link }}
					</view>
					<text class="ml-3 shrink-0 text-[26rpx] text-[#4d7c0f] font-bold" @click="handleCopyLink">复制</text>
				</view>

				<!-- 申请说明 -->
				<view v-if="miniInfo.applyRemark"
					class="uh-global-card-glass shadow-none border mt-2 flex flex-col gap-2 rounded-xl bg-[#f6f3ee] p-4 text-xs text-gray-500">
					<view v-if="miniInfo.applyRemark">
						<text class="text-gray-400">申请说明：</text>{{ miniInfo.applyRemark }}
					</view>
				</view>

				<!-- 作者信息 -->
				<view v-if="miniInfo.authorName || miniInfo.avatar || miniInfo.website"
					class="uh-global-card-glass shadow-none border mt-5 flex items-center rounded-xl p-4">
					<image v-if="miniInfo.avatar" class="author-avatar h-[72rpx] w-[72rpx] shrink-0 rounded-full"
						:src="checkAvatarUrl(miniInfo.avatar)" mode="aspectFill" />
					<view class="author-detail ml-4 flex flex-1 flex-col">
						<text v-if="miniInfo.authorName" class="author-name text-[28rpx] text-gray-900 font-medium">
							{{ miniInfo.authorName }}
						</text>
						<text v-if="miniInfo.website"
							class="author-website mt-1 overflow-hidden truncate whitespace-nowrap text-xs text-gray-400">
							网站：{{ miniInfo.website }}
						</text>
					</view>
				</view>

				<view class="mt-6">
					<uh-button custom-class="flex-1 uh-global-card-glass uh-shadow-xs border py-2 !rounded-xl" @click="handleCopyInfo">
						复制小程序申请信息
					</uh-button>
				</view>
			</template>
		</scroll-view>
	</uh-glass-popup>
</template>