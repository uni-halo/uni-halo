<script lang="ts" setup>
	import { computed } from 'vue'
	import { storeToRefs } from 'pinia'
	import { onPageScroll, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
	import { useAppConfigStore } from '@/store/appConfig'
	import { usePageScroll } from '@/hooks/usePageScroll'
	import { usePageTitle } from '@/hooks/usePageTitle'
	import { markdownConfig } from '@/config/markdown'
	import { DataLoadingStatusEnum } from '@/hooks/useDataLoadingStatus'

	definePage({
		style: {
			navigationBarTitleText: '免责声明',
			navigationStyle: 'custom',
		},
	})

	const pageTitle = usePageTitle('disclaimer', '免责声明')
	const { scrollY, updatePageScrollValue } = usePageScroll()
	const { configs } = storeToRefs(useAppConfigStore())

	const disclaimerContent = computed(() => {
		return configs.value.featureConfig?.pages?.disclaimer?.content || ''
	})

	const bloggerInfo = computed(() => {
		const blogger = configs.value.featureConfig?.profile?.blogger
		return {
			nickname: blogger?.nickname || '',
			email: blogger?.email || '',
		}
	})

	/* ---------------- 分享 ---------------- */
	onShareAppMessage(() => ({
		title: pageTitle.value,
		path: '/pages-blog/disclaimer/disclaimer',
	}))

	onShareTimeline(() => ({
		title: pageTitle.value,
		query: '',
	}))

	onPageScroll((option : Page.PageScrollOption) => {
		updatePageScrollValue(option.scrollTop)
	})
</script>

<template>
	<view class="box-border min-h-screen bg-page p-3 pt-2">
		<uh-navbar :scroll-y="scrollY" :default-title="pageTitle" title-color="text-gray-900" />

		<uh-data-loading v-if="!disclaimerContent" :loading-status="DataLoadingStatusEnum.Empty" min-height="80vh"
			:use-refresh-button="false" empty-text="暂时还没有免责声明" empty-sub-text="也许，可能是博主忘记啦~" />

		<view v-else class="w-full h-full uh-global-card-glass uh-shadow-xs rounded-xl text-3xs text-gray-900">
			<mp-html :content="disclaimerContent" lazy-load :domain="markdownConfig.domain"
				:loading-img="markdownConfig.loadingGif" scroll-table selectable :tag-style="markdownConfig.tagStyle"
				:container-style="markdownConfig.containStyle" :markdown="true" :show-line-number="true"
				:show-language-name="true" copy-by-long-press />
		</view>
	</view>
</template>