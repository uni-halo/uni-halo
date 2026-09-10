<script lang="ts" setup>
	import { useAppConfigStore } from '@/store/appConfig'

	const appConfigStore = useAppConfigStore()

	const haloConfigs = computed(() => appConfigStore.configs)

	const calcAuditModeEnabled = computed(() => appConfigStore.auditModeEnabled)
	const calcIsShowQuickNavigationEnabled = computed(() => haloConfigs.value.pageConfig?.homeConfig?.useQuickNavigation)

	interface QuickNavItem {
		key : string
		title ?: string
		subTitle ?: string
		color ?: string
		bgColor ?: string
		iconPrefix ?: string
		icon ?: string
		path ?: string
		visible ?: boolean
	}

	const useLocalNav = false
	const DEFAULT_NAV_LIST : QuickNavItem[] = [
		{
			key: 'archives',
			title: '文章归档',
			subTitle: '全部文章',
			color: '#03A9F4',
			bgColor: '#03A9F424',
			iconPrefix: 'uhemoji2-icon',
			icon: '-mask',
			path: '/pages-blog/archives/archives',
			visible: true,
		},
		{
			key: 'vote',
			title: '投票中心',
			color: '#00BCD4',
			bgColor: '#00BCD424',
			iconPrefix: 'uhemoji2-icon',
			icon: '-confused',
			path: '/pages-blog/votes/votes',
			visible: true,
		},
		{
			key: 'disclaimers',
			title: '友情链接',
			color: '#009688',
			bgColor: '#00968824',
			iconPrefix: 'uhemoji2-icon',
			icon: '-wink',
			path: '/pages-blog/friend-links/friend-links',
			visible: true,
		},
		{
			key: 'love',
			title: '恋爱日记',
			color: '#FF4C67',
			bgColor: '#FF4C6724',
			iconPrefix: 'uhemoji2-icon',
			icon: '-in-love',
			path: '/pages-blog/love/love',
			visible: true,
		},
		{
			key: 'contact-blogger',
			title: '联系博主',
			color: '#FF9800',
			bgColor: '#FF980024',
			iconPrefix: 'uhemoji2-icon',
			icon: '-cool',
			path: '/pages-blog/contact/contact',
			visible: true,
		},
	]

	const navList = computed(() => {
		const configured = haloConfigs.value.pageConfig?.homeConfig?.quickNavigation
		let list : QuickNavItem[]
		if (!useLocalNav && configured && configured.length) {
			list = configured.map(item => {
				const fallback = DEFAULT_NAV_LIST.find(d => d.key === item.key) || DEFAULT_NAV_LIST[0]
				return { ...fallback, ...item }
			})
		} else {
			list = DEFAULT_NAV_LIST;
		}
		return list.filter(item => item.visible !== false)
	})


	function handleClickNav(item : { path ?: string }) {
		if (!item.path)
			return
		uni.navigateTo({ url: item.path })
	}
</script>

<template>
	<view v-if="calcIsShowQuickNavigationEnabled && navList.length"
		class="box-border overflow-hidden rounded-xl p-3 px-4 mb-3">
		<uh-section-title class="mb-4">
			快捷导航
		</uh-section-title>
		<view class="grid grid-cols-5 gap-4">
			<view v-for="item in navList" :key="item.key" class="flex flex-col items-center gap-2"
				@click="handleClickNav(item)">
				<view
					class="uh-global-card-glass uh-shadow-xs h-13 w-13 flex items-center justify-center rounded-2xl border transition-transform active:scale-90"
					:style="{
						backgroundColor: item.bgColor
					}">
					<wd-icon :class-prefix="item.iconPrefix" :name="item.icon" size="64rpx" />
				</view>
				<view class="flex flex-col items-center gap-0.5">
					<text class="max-w-16 truncate text-xs text-gray-900" :style="{color:item.color}">
						{{ item.title }}
					</text>
				</view>
			</view>
		</view>
	</view>
</template>