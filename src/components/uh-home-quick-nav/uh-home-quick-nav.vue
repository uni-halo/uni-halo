<script lang="ts" setup>
	import { storeToRefs } from 'pinia'
	import { useAppConfigStore } from '@/store/appConfig'
	import { useLoveModuleUnlock } from '@/hooks/useLoveModuleUnlock'
	import { DefaultQuickNavigation } from '@/config/appConfig'

	const { configs } = storeToRefs(useAppConfigStore())

	const calcIsShowQuickNavigationEnabled = computed(() => configs.value.featureConfig?.pages?.homeConfig?.useQuickNavigation)

	/** 快捷导航项(插件端已配置则按配置展示,未配置/为空回退内置默认项;visible=false 隐藏) */
	const navList = computed(() => {
		const configured = configs.value.featureConfig?.pages?.homeConfig?.quickNavigation
		return (configured?.length ? configured : DefaultQuickNavigation).filter(item => item.visible !== false)
	})

	/* 恋爱模块解锁拦截(目前仅恋爱日记设密码,命中锁定则先解锁再跳转;样式不变) */
	const {
		unlockModalVisible,
		unlockTip,
		handleUnlockRequest,
		handleUnlockSuccess,
		interceptNavigateByPath,
	} = useLoveModuleUnlock()

	function handleClickNav(item : { path ?: string }) {
		if (!item.path) { return }
		// 命中恋爱模块且锁定 → 弹解锁弹窗,解锁成功后由 hook 自动跳转
		if (interceptNavigateByPath(item.path)) { return }
		uni.navigateTo({ url: item.path })
	}
</script>

<template>
	<view v-if="calcIsShowQuickNavigationEnabled && navList.length"
		class="box-border overflow-hidden rounded-xl p-3 mb-3">
		<uh-section-title> 快捷导航 </uh-section-title>
		<view class="mt-4 grid grid-cols-5 gap-4">
			<view v-for="item in navList" :key="item.key" class="flex flex-col items-center gap-2"
				@click="handleClickNav(item)">
				<view
					class="uh-global-card-glass uh-shadow-xs h-13 w-13 flex items-center justify-center rounded-2xl border"
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

	<!-- 恋爱模块解锁弹窗(解锁成功自动跳转) -->
	<uh-unlock-popup v-model:show="unlockModalVisible" title="请解锁" captcha-enabled
		:tip="unlockTip" placeholder="请输入密码" confirm-text="进入" :request="handleUnlockRequest"
		@success="handleUnlockSuccess" />
</template>
