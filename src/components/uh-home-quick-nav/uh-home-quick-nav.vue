<script lang="ts" setup>
	import { useAppConfigStore } from '@/store/appConfig'

	const appConfigStore = useAppConfigStore()

	const haloConfigs = computed(() => appConfigStore.configs)

	const calcAuditModeEnabled = computed(() => appConfigStore.auditModeEnabled)
	const calcIsShowQuickNavigationEnabled = computed(() => haloConfigs.value.pageConfig?.homeConfig?.useQuickNavigation)

	/** 快捷导航项（字段命名与插件端 quickNavigation 一致：key/title/subTitle/color/bgColor/iconPrefix/icon/path/visible，无 borderColor） */
	interface QuickNavItem {
		key : string
		title ?: string
		/** 副标题（对标 about 页 rightText，如「全部文章」；2026-09-10 插件端新增可空字段） */
		subTitle ?: string
		color ?: string
		bgColor ?: string
		iconPrefix ?: string
		icon ?: string
		path ?: string
		visible ?: boolean
	}

	// 是否使用本地的快捷导航数据（本地的可以任意修改图标、路径，插件端的无法修改图标）
	const useLocalNav = false
	/** 内置默认项（未配置时回退；字段命名与插件端一致，可作配置缺失字段的兜底；颜色统一 hex8） */
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

	/** 快捷导航列表：优先读插件端配置（零映射，visible 过滤）；未配置/为空回退内置默认（保留原显隐推导） */
	const navList = computed(() => {
		const configured = haloConfigs.value.pageConfig?.homeConfig?.quickNavigation
		let list : QuickNavItem[]
		if (!useLocalNav && configured && configured.length) {
			// 配置模式：以配置项为准，缺失字段（icon/iconPrefix/color/path 等）按 key 从默认项兜底
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
					<text class="max-w-16 truncate text-xs text-gray-900">
						{{ item.title }}
					</text>
					<text v-if="item.subTitle" class="max-w-16 truncate text-[10rpx] text-gray-400">
						{{ item.subTitle }}
					</text>
				</view>
			</view>
		</view>
	</view>
</template>
