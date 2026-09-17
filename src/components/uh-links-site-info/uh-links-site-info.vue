<script lang="ts" setup>
	import { storeToRefs } from 'pinia'
	import { computed, ref, watch } from 'vue'
	import { useAppConfigStore } from '@/store/appConfig'
	import { checkAvatarUrl } from '@/utils/url'

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


	const blogDetail = computed(() => (configs.value.featureConfig?.linkInfo?.siteInfo as {
		displayName ?: string
		url ?: string
		logo ?: string
		description ?: string
		backlink ?: string
		feedUrls ?: string[]
	} | undefined) || {})

	/** 友链交换信息文案(复制用) */
	const calcBlogContent = computed(() => {
		const blogger = configs.value.featureConfig?.profile?.blogger || {}
		return [
			`博客名称：${blogDetail.value.displayName || ''}`,
			`博客地址：${blogDetail.value.url || ''}`,
			`博客logo：${checkAvatarUrl(blogDetail.value.logo)}`,
			`博客简介：${blogDetail.value.description || ''}`,
			blogger.avatar ? `作者头像：${checkAvatarUrl(blogger.avatar as string)}` : '',
			blogger.authorName ? `作者昵称：${blogger.nickname}` : '',
			blogger.website ? `作者网站：${blogger.website}` : '',
			blogger.email ? `通知邮箱：${blogger.email}` : '',
		].join('\n')

	})

	function handleCopyLink() {
		uni.setClipboardData({
			data: calcBlogContent.value,
			showToast: false,
			success: () => {
				uni.showToast({ icon: 'none', title: '复制成功！' })
			},
			fail: () => {
				uni.showToast({ icon: 'none', title: '复制失败！' })
			},
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
				<text class="text-md font-bold">友链信息</text>
				<text class="text-xs text-gray-500">本站友链交换信息,欢迎申请互换友链</text>
			</view>
			<view class="uh-global-card-glass absolute right-4 top-4 h-6 w-6 border rounded-lg text-center shadow-none"
				@click="handleClose">
				<wd-icon name="close" size="32rpx" class="text-gray-500" />
			</view>
		</view>
		<scroll-view :scroll-y="true" :show-scrollbar="false" class="box-border max-h-[60vh] p-4">
			<!-- 博客名片 -->
			<view class="flex items-center">
				<image class="uh-global-card-glass h-14 w-14 shrink-0 rounded-2xl"
					:src="checkAvatarUrl(blogDetail.logo)" mode="aspectFill" />
				<view class="ml-4 flex flex-1 flex-col justify-center gap-y-1">
					<text class="text-md text-gray-900 font-bold">
						{{ blogDetail.displayName || '未命名博客' }}
					</text>
					<text class="text-xs text-gray-500">
						{{ blogDetail.description || '这个博主很懒，没写简介~' }}
					</text>
				</view>
			</view>

			<!-- 交换信息文案 -->
			<view class="mt-4 whitespace-pre-wrap text-xs text-gray-600 leading-5">
				<text>{{ calcBlogContent }}</text>
			</view>

			<view class="mt-6">
				<uh-button custom-class="py-2 !rounded-xl" @click="handleCopyLink">
					复制友链交换信息
				</uh-button>
			</view>
		</scroll-view>
	</uh-glass-popup>
</template>