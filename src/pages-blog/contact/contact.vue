<script lang="ts" setup>
	import { computed, onUnmounted, ref, watch, watchEffect } from 'vue'
	import { useAppConfigStore } from '@/store/appConfig'
	import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
	import { checkAvatarUrl } from '@/utils/url'
	import { formatTime } from '@/utils/formatTime'
	import { markdownConfig } from '@/config/markdown'

	definePage({
		style: {
			navigationBarTitleText: '联系博主',
			navigationStyle: 'custom',
		},
	})

	interface ISoical {
		name : string
		content : string
		color : string,
		bgColor : string,
		priority ?: number,
		visible ?: boolean,
	}

	const appConfigStore = useAppConfigStore()
	const authorConfig = computed(() => appConfigStore.configs.authorConfig)

	const bloggerInfo = computed(() => {
		const blogger = authorConfig.value?.blogger as { nickname ?: string, avatar ?: string, description ?: string, intro ?: string } | undefined
		return {
			nickname: blogger?.nickname || '',
			avatar: checkAvatarUrl(blogger?.avatar),
			description: blogger?.description || '',
			intro: blogger?.intro || '',
		}
	})

	const socialConfig = computed(() => (authorConfig.value?.social as { items ?: ISoical[] } | undefined) || {})

	const socialList = computed<Array<ISoical>>(() => {
		const configured = socialConfig.value.items
		if (!configured || !configured.length) {
			return []
		}
		return [...configured]
			.filter(item => item.visible && item.content.trim())
			.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
	})

	const isNotEmpty = computed(() => socialList.value.some(item => item.visible && item.content.trim()))

	const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()
	watchEffect(() => {
		updateLoadingStatus(isNotEmpty.value ? DataLoadingStatusEnum.Success : DataLoadingStatusEnum.Empty)
	})

	function handleOnClick(item : ISoical) {
		if (!item.content) { return }
		uni.setClipboardData({
			data: item.content,
			showToast: false,
			success: () => {
				uni.showToast({ icon: 'none', title: `${item.name} 已复制！` })
			},
		})
	}

	const nowText = ref('')
	let clock : ReturnType<typeof setInterval> | null = null
	function refreshNowText() {
		nowText.value = formatTime({ d: Date.now(), f: 'yyyy年MM月dd日' })
	}
	refreshNowText()
	clock = setInterval(refreshNowText, 1000)
	onUnmounted(() => {
		if (clock) {
			clearInterval(clock)
		}
	})
</script>

<template>
	<view class="box-border min-h-screen w-screen overflow-hidden bg-page px-4 pb-10 pt-2">
		<!-- 自定义导航 -->
		<uh-navbar default-title="联系博主" title-color="text-gray-900" />

		<view class="fixed -right-8 top-8 h-28 w-28 rounded-full bg-[rgba(185,228,36,0.32)] blur-xl" />
		<view class="fixed -left-10 top-36 h-24 w-24 rounded-full bg-[rgba(215,249,76,0.45)]  blur-xl" />

		<view
			class="box-border relative flex items-center justify-between uh-global-card-glass uh-shadow-xs rounded-xl p-4">
			<view class="flex-1 relative flex flex-col rounded-2xl">
				<view class="flex items-center gap-x-2 text-xs text-primary">
					TO <text class="text-sm">·</text> 收
				</view>
				<view class="mt-2 text-md text-gray-900 tracking-wider">
					素未谋面的朋友
				</view>
				<view class="mt-2 text-xs text-black/60">
					展信安，见字如面。
				</view>
				<view class="mt-3 text-xs text-black/60">
					自 · {{ bloggerInfo.nickname }}
				</view>
			</view>
			<view
				class="shrink-0 uh-global-card-glass uh-shadow-xs border relative rotate-3 box-border w-22 overflow-hidden flex flex-col gap-y-1 items-center justify-center p-2">
				<image class="h-18 w-full" :src="bloggerInfo.avatar" mode="aspectFill" />
				<text class="text-xs font-normal truncate">{{ bloggerInfo.nickname }}</text>
			</view>
		</view>

		<view class="mt-4 flex flex-col gap-y-6 box-border uh-global-card-glass uh-shadow-xs rounded-xl px-4 py-3">
			<uh-data-loading v-if="loadingStatus !== 'success'" :loading-status="loadingStatus" min-height="65vh"
				empty-text="暂无联系方式" empty-sub-text="" />
			<template v-else>
				<view class="w-full flex flex-col gap-y-3">
					<view class="text-md text-gray-900">
						展信安：
					</view>
					<view v-if="bloggerInfo.intro" class="text-gray-900 text-sm">
						<mp-html lazy-load :domain="markdownConfig.domain ?? ''"
							:loading-img="markdownConfig.loadingGif" scroll-table selectable
							:tag-style="markdownConfig.tagStyle" :container-style="markdownConfig.containStyle"
							:content="bloggerInfo.intro" :markdown="true" :show-line-number="true"
							:show-language-name="true" copy-by-long-press />
					</view>
					<view v-else class="text-gray-600 text-sm py-4">
						祝你早安，午安，晚安。每天都有好心情，生活愉快！
					</view>
					<view class="mt-2 w-full flex items-end flex-col gap-y-3">
						<text class="text-md font-semibold text-gray-900">{{ bloggerInfo.nickname }}</text>
						<text class="text-xs text-black/60">{{ nowText }}</text>
					</view>
				</view>

				<view class="box-border pt-4 w-full flex flex-col gap-y-2 border-t border-t-dashed border-gray-200">
					<view class="mb-2 text-md text-gray-900">
						若有意，可依此觅：
					</view>
					<view v-for="item in socialList" :key="item.name" class="flex items-center gap-3"
						@click="handleOnClick(item)">
						<view
							class="uh-global-card-glass uh-shadow-xs border h-11 w-11 flex shrink-0 items-center justify-center rounded-xl"
							:style="{ backgroundColor: item.bgColor ,color:item.color }">
							<text class="text-sm font-bold" :style="{ color:item.color }">
								{{ item.name ? item.name.charAt(0) : '' }}
							</text>
						</view>
						<view class="min-w-0 flex flex-1 flex-col">
							<text class="text-xs text-gray-500" >{{ item.name }}</text>
							<view class="mt-1 break-all text-xs text-gray-900">
								{{ item.content }}
							</view>
						</view>
						<wd-icon name="copy" size="28rpx" class="shrink-0 text-primary" />
					</view>
				</view>
			</template>
		</view>
	</view>
</template>