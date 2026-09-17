<script lang="ts" setup>
	import { onLoad, onPageScroll } from '@dcloudio/uni-app'
	import { useAppConfigStore } from '@/store/appConfig'
	import { checkUrl } from '@/utils/url'
	import { usePageScroll } from '@/hooks/usePageScroll'

	definePage({
		style: {
			navigationBarTitleText: '关于项目',
			navigationStyle: 'custom',
		},
	})

	const { scrollY, updatePageScrollValue } = usePageScroll()
	const appConfigStore = useAppConfigStore()

	const appInfo = computed(() => {
		return {
			name: 'UniHalo',
			logo: checkUrl('/plugins/uni-halo/assets/static/logo.png')
		}
	})

	const links = [
		{ title: '小莫唐尼', value: 'https://www.xiaoxiaomo.cn', copy: 'https://www.xiaoxiaomo.cn', tip: '作者主页地址已复制', tileColor: '#26a69a', tileLetter: '作' },
		{ title: '作者博客', value: 'https://blog.xiaoxiaomo.cn', copy: 'https://blog.xiaoxiaomo.cn', tip: '作者博客地址已复制', tileColor: '#7e57c2', tileLetter: '博' },
		{ title: '文档地址', value: 'https://uni-halo.925i.cn', copy: 'https://uni-halo.925i.cn', tip: '项目码云仓库已复制', tileColor: '#039be5', tileLetter: '文' },
		{ title: '码云仓库', value: 'https://gitee.com/ialley-workshop-open/uni-halo', copy: 'https://gitee.com/ialley-workshop-open/uni-halo', tip: '码云仓库地址已复制', tileColor: '#c71d23', tileLetter: '码' },
		{ title: 'Github', value: 'https://github.com/ialley-workshop-open/uni-halo', copy: 'https://github.com/ialley-workshop-open/uni-halo', tip: 'Github地址已复制', tileColor: '#24292f', tileLetter: 'G' },
	]

	function copyText(content : string, tips : string) {
		uni.setClipboardData({
			data: content,
			showToast: false,
			success: () => {
				uni.showToast({ icon: 'none', title: tips })
			},
		})
	}

	onPageScroll((option : Page.PageScrollOption) => {
		updatePageScrollValue(option.scrollTop)
	})

	onLoad(() => {
		uni.setNavigationBarTitle({ title: '关于项目' })
	})
</script>

<template>
	<view class="box-border min-h-screen w-screen flex flex-col overflow-hidden bg-page px-4 pb-8 pt-2">
		<!-- 自定义导航 -->
		<uh-navbar :scroll-y="scrollY" default-title="关于项目" title-color="text-gray-900" />

		<view class="fixed -right-8 top-8 h-28 w-28 rounded-full bg-[rgba(185,228,36,0.32)] uh-blur-xl" />
		<view class="fixed -left-10 top-36 h-24 w-24 rounded-full bg-[rgba(215,249,76,0.45)]  uh-blur-xl" />

		<view class="relative">
			<view class="uh-global-card-glass relative flex flex-col items-center rounded-2xl px-6 pb-7 pt-10">
				<image class="uh-global-card-glass uh-shadow-xs border h-18 w-18 rounded-2xl" :src="appInfo.logo"
					mode="aspectFill" />
				<view class="mt-4 text-xl text- font-bold">
					{{appInfo.name}}
				</view>
				<view class="mt-3 flex items-center gap-2">
					<text class="rounded-full bg-secondary px-3 py-1 text-[20rpx] text-gray-900">Apache License 2.0 开源协议</text>
					<text class="rounded-full bg-gray-100 px-3 py-1 text-[20rpx] text-gray-900">UniApp × Halo</text>
				</view>
				<view class="mt-4 text-center text-xs text-gray-500 leading-relaxed">
					基于 uni-app 打造的 Halo 博客跨端客户端
				</view>
			</view>
		</view>

		<uh-section-title class="mb-3 mt-6"> 相关链接 </uh-section-title>

		<view class="box-border uh-global-card-glass flex flex-col gap-y-6 rounded-2xl py-4">
			<view v-for="(link) in links" :key="link.title" class="flex items-center gap-3 px-4"
				@click="copyText(link.copy, link.tip)">
				<view
					class="uh-global-card-glass uh-shadow-xs border h-9 w-9 flex shrink-0 items-center justify-center rounded-xl"
					:style="{ backgroundColor: `${link.tileColor}1A` }">
					<text class="text-sm font-bold" :style="{ color: link.tileColor }">{{ link.tileLetter }}</text>
				</view>
				<view class="min-w-0 flex flex-1 flex-col justify-center">
					<text class="text-2xs text-gray-900 font-bold">{{ link.title }}</text>
					<view class="truncate text-xs text-gray-400">
						{{ link.value }}
					</view>
				</view>
				<wd-icon name="copy" size="28rpx" class="shrink-0 text-gray-500" />
			</view>
		</view>

		<uh-page-copyright />
	</view>
</template>


<style scoped lang="scss">
	.uh-blur-xl {
		filter: blur(20rpx);
	}
</style>