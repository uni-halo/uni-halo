<script setup lang="ts">
	import { useAppConfigStore } from '@/store/appConfig'

	const appConfigStore = useAppConfigStore()

	const haloConfigs = computed(() => appConfigStore.configs)

	const calcAuditModeEnabled = computed(() => appConfigStore.auditModeEnabled)
	const calcIsShowQuickNavigationEnabled = computed(() => haloConfigs.value.pageConfig?.homeConfig?.useQuickNavigation)
	const calcVotePluginEnabled = computed(() => !!haloConfigs.value.pluginConfig?.votePlugin?.enabled)
	const calcLinksPluginEnabled = computed(() => !!haloConfigs.value.pluginConfig?.linksPlugin?.enabled)

	/** 快捷导航列表(由配置控制显隐) */
	const navList = computed(() => {
		const loveEnabled = !!(haloConfigs.value.loveConfig as { loveEnabled ?: boolean })?.loveEnabled
		const socialEnabled = !!(haloConfigs.value.authorConfig?.social as { enabled ?: boolean } | undefined)?.enabled
		// <wd-icon class-prefix="uhemoji-icon" name="-smile-" size="32rpx" />
		return [
			{
				key: 'archives',
				title: calcAuditModeEnabled.value ? '内容归档' : '文章归档',
				color: '#03A9F4',
				bgGlass: 'rgba(3, 169, 244, 0.14)',
				borderColor: 'rgba(3, 169, 244, 0.35)',
				iconPrefix: 'uhemoji2-icon',
				icon: '-mask',
				path: '/pages-blog/archives/archives',
				show: true,
			},
			{
				key: 'vote',
				title: '投票中心',
				color: '#00BCD4',
				bgGlass: 'rgba(0, 188, 212, 0.14)',
				borderColor: 'rgba(0, 188, 212, 0.35)',
				iconPrefix: 'uhemoji2-icon',
				icon: '-confused',
				path: '/pages-blog/votes/votes',
				// show: !calcAuditModeEnabled.value && calcVotePluginEnabled.value,
				show: true,
			},
			{
				key: 'disclaimers',
				title: '友情链接',
				color: '#009688',
				bgGlass: 'rgba(0, 150, 136, 0.14)',
				borderColor: 'rgba(0, 150, 136, 0.35)',
				iconPrefix: 'uhemoji2-icon',
				icon: '-wink',
				path: '/pages-blog/friend-links/friend-links',
				// show: calcLinksPluginEnabled.value,
				show: true,
			},
			{
				key: 'love',
				title: '恋爱日记',
				color: '#FF4C67',
				bgGlass: 'rgba(255, 76, 103, 0.14)',
				borderColor: 'rgba(255, 76, 103, 0.075)',
				iconPrefix: 'uhemoji2-icon',
				icon: '-in-love',
				path: '/pages-blog/love/love',
				// show: loveEnabled,
				show: true,
			},
			{
				key: 'contact-blogger',
				title: '联系博主',
				color: '#FF9800',
				bgGlass: 'rgba(255, 152, 0, 0.14)',
				borderColor: 'rgba(255, 152, 0, 0.35)',
				iconPrefix: 'uhemoji2-icon',
				icon: '-cool',
				path: '/pages-blog/contact/contact',
				show: socialEnabled,
			},
		].filter(item => item.show)
	})


	function handleClickNav(item : { path : string }) {
		uni.navigateTo({ url: item.path })
	}
</script>

<template>
	<view v-if="navList.length" class="box-border overflow-hidden rounded-xl p-3 px-4 mb-3">
		<uh-section-title class="mb-4">
			快捷导航
		</uh-section-title>
		<view class="grid grid-cols-5 gap-4">
			<view v-for="item in navList" :key="item.key" class="flex flex-col items-center gap-2"
				@click="handleClickNav(item)">
				<view
					class="uh-global-card-glass uh-shadow-xs h-13 w-13 flex items-center justify-center rounded-2xl border transition-transform active:scale-90"
					:style="{
						backgroundColor: item.bgGlass
					}">
					<wd-icon :class-prefix="item.iconPrefix" :name="item.icon" size="64rpx"/>
				</view>
				<view class="text-xs text-gray-900">
					{{ item.title }}
				</view>
			</view>
		</view>
	</view>
</template> 