<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { storeToRefs } from 'pinia'
	import { onLoad, onPageScroll } from '@dcloudio/uni-app'
	import { useAppConfigStore } from '@/store/appConfig'
	import { useSettingStore } from '@/store/setting'
	import { usePageScroll } from '@/hooks/usePageScroll'
	import { usePageTitle } from '@/hooks/usePageTitle'
	import { useDialog } from '@wot-ui/ui'
	import { DIALOG_CONFIRM_BUTTON_PROPS, DIALOG_CANCEL_BUTTON_PROPS } from '@/config/dialog'
	import { collectSiteDefaults } from '@/utils/preference'
	import { usePreferenceRows } from '@/hooks/usePreferenceRows'
	import type { PrefDef } from '@/hooks/usePreferenceRows'

	const dialog = useDialog()

	definePage({
		style: {
			navigationBarTitleText: '偏好设置',
			navigationStyle: 'custom',
		},
	})

	const { scrollY, updatePageScrollValue } = usePageScroll()
	/** 页面标题（插件端可配置，留空回退内置默认） */
	const pageTitle = usePageTitle('setting', '偏好设置')
	const settingStore = useSettingStore()
	const appConfigStore = useAppConfigStore()
	const { siteDefaults } = storeToRefs(settingStore)
	const { configs } = storeToRefs(appConfigStore)
	const { applySiteDefaults, resetPreferences } = settingStore

	/** 公共:字段定义/三态/行构建/选值(与全局弹窗 uh-settings-popup 共用 usePreferenceRows) */
	const {
		SETTING_TABS,
		layoutGroups,
		featureRows,
		prefValueOf,
		isFollowing,
		handleRevert,
		handleBoolChange,
		handleChoose,
		isCardTypeOptionDisabled,
	} = usePreferenceRows()

	/** 确保启动合并已执行(入口页未跑或 H5 直达时兜底) */
	onPageScroll((option : Page.PageScrollOption) => {
		updatePageScrollValue(option.scrollTop)
	})

	onLoad(() => {
		if (!siteDefaults.value) {
			applySiteDefaults(collectSiteDefaults(configs.value))
		}
		uni.setNavigationBarTitle({ title: '偏好设置' })
	})

	/* ---------------- 顶部分段器(布局 / 功能) ---------------- */
	const activeTab = ref<'layout' | 'feature'>('layout')

	/* ---------------- 交互 ---------------- */
	/* ---------------- 枚举底部弹层(uh-glass-popup + wd-picker-view) ---------------- */
	const enumSheet = ref<{ show : boolean, def : PrefDef | null }>({ show: false, def: null })
	/** 弹层内滚动中的临时选中值(单列;确认时才落库,取消不生效) */
	const pickerValue = ref<(string | number)[]>([''])

	function handleOpenEnum(def : PrefDef) {
		enumSheet.value = { show: true, def }
		// 打开时同步当前值(跟随站点默认 → 空串哨兵)
		pickerValue.value = [isFollowing(def.path) ? '' : String(prefValueOf(def.path) ?? '')]
	}

	function handleCloseEnum() {
		enumSheet.value.show = false
	}

	function handleChooseEnum(value : string | null) {
		const def = enumSheet.value.def
		if (def) {
			handleChoose(def.path, value)
		}
		handleCloseEnum()
	}

	/* ---------------- wd-picker-view 弹层数据 ---------------- */
	/** 枚举弹层列(首项「跟随站点默认」,空串哨兵映射 null;双列约束下卡片样式仅保留 image_top) */
	const enumColumns = computed(() => {
		const def = enumSheet.value.def
		if (!def) { return [] }
		const options = (def.options || []).filter(opt => !isCardTypeOptionDisabled(def.path, opt.value))
		return [
			{ label: '跟随站点默认', value: '' },
			...options.map(opt => ({ label: opt.label, value: opt.value })),
		]
	})

	/** wd-picker-view 滚动变化:更新临时选中值(未确认不落库) */
	function handlePickerChange(payload : { selectedValues : (string | number)[] }) {
		pickerValue.value = payload.selectedValues
	}

	/** 确认:空串哨兵还原为「跟随站点默认」 */
	function handlePickerConfirm() {
		const picked = String(pickerValue.value[0] ?? '')
		handleChooseEnum(picked === '' ? null : picked)
	}

	/** 取消:不落库,直接关闭 */
	function handlePickerCancel() {
		handleCloseEnum()
	}

	/* ---------------- 重置全部 ---------------- */
	async function handleResetAll() {
		try {
			await dialog.confirm({
				title: '提示',
				msg: '确定将所有偏好恢复为站点默认吗？',
				zIndex: 9999,
				confirmButtonProps: DIALOG_CONFIRM_BUTTON_PROPS,
				cancelButtonProps: DIALOG_CANCEL_BUTTON_PROPS,
			})
		}
		catch {
			return
		}
		resetPreferences()
		enumSheet.value.show = false
		uni.showToast({ icon: 'none', title: '已恢复为站点默认' })
	}
</script>

<template>
	<wd-dialog />
	<view class="box-border min-h-screen bg-page">
		<!-- 自定义标题 -->
		<uh-navbar :scroll-y="scrollY" :default-title="pageTitle" title-color="text-gray-900" :need-placeholder="true" />

		<!-- 内容区域 -->
		<view class="box-border flex flex-col gap-y-6 p-3">
			<!-- 顶部分段器:布局 / 功能 -->
			<view class="uh-global-card-glass uh-shadow-xs flex rounded-xl p-1">
				<view v-for="tab in SETTING_TABS" :key="tab.key" class="flex-1 rounded-lg py-2 text-center text-2xs"
					:class="activeTab === tab.key ? 'bg-primary font-medium' : 'text-gray-500'"
					@click="activeTab = tab.key">
					{{ tab.label }}
				</view>
			</view>

			<!-- 布局:按页面分组(首页/文章列表/文章归档 × 列表布局/卡片样式) -->
			<template v-if="activeTab === 'layout'">
				<view v-for="group in layoutGroups" :key="group.key" class="flex flex-col gap-y-3">
					<uh-section-title>{{ group.label }}</uh-section-title>
					<view class="uh-global-card-glass uh-shadow-xs overflow-hidden rounded-2xl">
						<view v-for="(row, index) in group.rows" :key="row.key"
							class="pick-row flex items-center justify-between px-4 py-4"
							:class="index < group.rows.length - 1 ? 'border-b border-black/5' : ''"
							@click="handleOpenEnum(row)">
							<view class="row-left flex flex-col gap-1">
								<text class="row-label text-sm text-gray-900 font-bold">{{ row.label }}</text>
								<view class="flex items-center gap-2">
									<text v-if="row.following" class="row-sub text-xs text-gray-400">跟随站点默认</text>
									<view v-else
										class="rounded-full bg-secondary px-2 py-0.5 text-xs text-[#4d7c0f] leading-none">
										已自定义
									</view>
								</view>
							</view>
							<view class="flex items-center gap-2 text-gray-400">
								<text class="text-xs">{{ row.displayValue }}</text>
								<wd-icon name="arrow-right" size="24rpx" />
							</view>
						</view>
					</view>
				</view>
			</template>

			<!-- 功能设置 -->
			<template v-else>
				<view class="flex flex-col gap-y-3">
					<uh-section-title>
						功能
						<template #right>
							<text class="text-2xs text-gray-400">一些常用的功能性设置</text>
						</template>
					</uh-section-title>
					<view class="setting-sheet uh-global-card-glass uh-shadow-xs overflow-hidden rounded-2xl">
						<template v-for="(row, index) in featureRows" :key="row.key">
							<!-- 布尔项:内联分段器(默认 / 开 / 关) -->
							<view v-if="row.kind === 'bool' && false" class="box-border p-3"
								:class="index < featureRows.length - 1 ? 'border-b border-black/5' : ''">
								<view class="flex items-center justify-between">
									<text class="row-label text-sm text-gray-900 font-bold">{{ row.label }}</text>
									<view class="flex items-center gap-2">
										<text v-if="row.following" class="row-sub text-xs text-gray-400">默认</text>
										<view v-else
											class="rounded-full bg-secondary px-2 py-1 text-xs text-gray-900 leading-none">
											已自定义
										</view>
									</view>
								</view>
								<view class="mt-3 flex flex-wrap gap-2">
									<view class="rounded-full px-3 py-1 text-xs uh-global-card-glass shadow-none border"
										:class="row.following ? 'bg-secondary font-bold' : 'text-gray-500'"
										@click="handleRevert(row.path)">
										默认
									</view>
									<view class="rounded-full px-3 py-1 text-xs uh-global-card-glass shadow-none border"
										:class="!row.following && row.boolValue ? 'bg-secondary font-bold' : 'text-gray-500'"
										@click="handleBoolChange(row.path, true)">
										开
									</view>
									<view class="rounded-full px-3 py-1 text-xs uh-global-card-glass shadow-none border"
										:class="!row.following && !row.boolValue ? 'bg-secondary font-bold' : 'text-gray-500'"
										@click="handleBoolChange(row.path, false)">
										关
									</view>
								</view>
							</view>
							<!-- 枚举选择 -->
							<view v-else class="pick-row flex items-center justify-between px-4 py-4"
								:class="index < featureRows.length - 1 ? 'border-b border-black/5' : ''"
								@click="handleOpenEnum(row)">
								<view class="row-left flex flex-col gap-1">
									<text class="row-label text-[28rpx] text-gray-900 font-bold">{{ row.label }}</text>
									<view class="flex items-center gap-2">
										<text v-if="row.following" class="row-sub text-2xs text-gray-400">跟随站点默认</text>
										<template v-else>
											<view
												class="rounded-full bg-secondary px-2 py-0.5 text-[20rpx] text-[#4d7c0f] leading-none">
												已自定义
											</view>
											<text class="revert-text text-2xs text-gray-400 underline"
												@click.stop="handleRevert(row.path)">
												恢复默认
											</text>
										</template>
									</view>
								</view>
								<view class="flex items-center gap-2 text-gray-400">
									<text class="text-xs">{{ row.displayValue }}</text>
									<wd-icon name="arrow-right" size="24rpx" />
								</view>
							</view>
						</template>
					</view>
				</view>
			</template>
			<!-- 底部操作栏-->
			<view class="box-border w-full">
				<uh-button custom-class="uh-global-card-glass py-2.5 text-xs !rounded-xl" @click="handleResetAll">
					恢复默认
				</uh-button>
			</view>
		</view>

		<!-- 枚举选择弹层(uh-glass-popup + wd-picker-view,底部取消/确认,参考 uh-album-photo-viewer 布局) -->
		<uh-glass-popup v-model="enumSheet.show" :hide-when-close="false" position="bottom" custom-class="rounded-xl">
			<view class="box-border px-4 py-4">
				<!-- 标题 -->
				<view class="mb-3 flex items-center justify-between">
					<text class="text-md font-bold">{{ enumSheet.def?.label || '请选择' }}</text>
				</view>
				<!-- 选择器 -->
				<wd-picker-view :columns="enumColumns" v-model="pickerValue"
					custom-class="uh-picker-view !p-0 !bg-transparent !rounded-xl overflow-hidden"
					@change="handlePickerChange" />
				<!-- 底部操作:取消 / 确认 -->
				<view class="mt-4 flex items-center justify-center gap-x-3">
					<uh-button custom-class="flex-1 uh-global-card-glass uh-shadow-xs border py-2 !rounded-xl bg-white/90"
						@click="handlePickerCancel">
						取消
					</uh-button>
					<uh-button
						custom-class="flex-1 uh-global-card-glass uh-shadow-xs border py-2 !rounded-xl bg-primary text-gray-900"
						@click="handlePickerConfirm">
						确定
					</uh-button>
				</view>
			</view>
		</uh-glass-popup>
	</view>
</template>

<style scoped lang="scss">
	:deep(.uh-picker-view) {
		.wd-picker-view__mask {
			background: transparent !important;
		}

		.wd-picker-view__roller {
			border-radius: 16rpx !important;
		}
	}
</style>