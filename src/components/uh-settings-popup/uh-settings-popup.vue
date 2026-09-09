<script lang="ts" setup>
	import { ref } from 'vue'
	import { useSettingStore } from '@/store/setting'
	import { usePreferenceRows } from '@/hooks/usePreferenceRows'
	import { useSettingsPopup } from '@/hooks/useSettingsPopup'

	const settingStore = useSettingStore()

	const {
		SETTING_TABS,
		layoutGroups,
		featureRows,
		prefValueOf,
		isFollowing,
		handleRevert,
		handleBoolChange,
		handleChoose,
	} = usePreferenceRows()

	const { settingsPopupVisible } = useSettingsPopup()

	const emits = defineEmits(['close', 'open'])

	const activeTab = ref<'layout' | 'feature'>('layout')

	// 进行过滤，只保留当前页面的布局和功能
	const pages = getCurrentPages()
	const currentPage = pages[pages.length - 1]
	const filterLayoutGroups = computed(() => {
		return layoutGroups.value.filter((group) => {
			return currentPage.route.split('/').pop() === group.key
		})
	})

	/* ---------------- 交互 ---------------- */
	function handleSwitchChange(def : { path : string[] }, detail : { value ?: unknown }) {
		handleBoolChange(def.path, detail.value === true)
	}

	function currentValueOf(path : string[]) : string | null {
		return isFollowing(path) ? null : String(prefValueOf(path) ?? '')
	}

	function handleInlineChoose(path : string[], value : string | null) : void {
		handleChoose(path, value)
	}

	/* ---------------- 重置全部 ---------------- */
	function handleResetAll() {
		uni.showModal({
			title: '提示',
			content: '确定将所有偏好恢复为站点默认吗？本地自定义的偏好将被清除，未配置站点默认的项将恢复为内置默认。',
			showCancel: true,
			cancelText: '取消',
			confirmText: '确定',
			confirmColor: '#03a9f4',
			success: (res) => {
				if (res.confirm) {
					settingStore.resetPreferences()
					uni.showToast({ icon: 'none', title: '已恢复为站点默认' })
				}
			},
		})
	}

	function onClose() {
		emits('close')
	}
	function onOpen() {
		emits('open')
	}
	
</script>

<template>
	<uh-glass-popup v-model="settingsPopupVisible" position="bottom" custom-class="rounded-xl !border"
		safe-area-inset-bottom :z-index="99999" hide-when-close @close="onClose" @open="onOpen">
		<view class="box-border px-3 pt-3">
			<view class="mb-3 flex items-center justify-between">
				<text class="text-md font-bold">偏好设置</text>
				<view
					class="uh-global-card-glass shadow-none !bg-white/5 border flex h-6 w-6 items-center justify-center rounded-lg text-gray-500"
					@click="onClose()">
					<wd-icon name="close" size="16px" />
				</view>
			</view>

			<!-- 分段器:布局 / 功能 -->
			<view class="uh-global-card-glass shadow-none flex rounded-xl p-1">
				<view v-for="tab in SETTING_TABS" :key="tab.key"
					class="box-border flex-1 rounded-lg py-1.5 text-center text-sm"
					:class="activeTab === tab.key ? 'bg-primary font-bold' : 'text-gray-500'"
					@click="activeTab = tab.key">
					{{ tab.label }}
				</view>
			</view>

			<!-- 内容区(弹层内滚动) -->
			<scroll-view scroll-y :show-scrollbar="false" class="mt-4 max-h-[60vh]">
				<view class="box-border flex flex-col gap-y-6 pb-1">
					<!-- 布局:按页面分组(枚举项内联分段器) -->
					<template v-if="activeTab === 'layout'">
						<view v-for="group in filterLayoutGroups" :key="group.key" class="flex flex-col gap-y-3">
							<uh-section-title>{{ group.label }}</uh-section-title>
							<view class="uh-global-card-glass shadow-none overflow-hidden rounded-xl">
								<view v-for="(row) in group.rows" :key="row.key" class="box-border p-3">
									<!-- 左 label / 右 说明 -->
									<view class="flex items-center justify-between">
										<text class="row-label text-sm text-gray-900 font-bold">{{ row.label }}</text>
										<view class="flex items-center gap-2">
											<text v-if="row.following" class="row-sub text-2xs text-gray-400">默认</text>
											<view v-else
												class="rounded-full bg-secondary px-2 py-1 text-xs text-gray-900 leading-none">
												已自定义
											</view>
										</view>
									</view>
									<!-- 下方横向选项(分段器风格:默认 + options) -->
									<view class="mt-3 flex flex-wrap gap-2">
										<view
											class="rounded-full px-3 py-1 text-xs uh-global-card-glass shadow-none border"
											:class="currentValueOf(row.path) === null ? 'bg-secondary font-bold' : 'text-gray-500'"
											@click="handleInlineChoose(row.path, null)">
											默认
										</view>
										<view v-for="opt in row.options" :key="opt.value"
											class="rounded-full px-3 py-1 text-xs uh-global-card-glass shadow-none border"
											:class="currentValueOf(row.path) === opt.value ? 'bg-secondary font-bold' : ' border-gray-100 text-gray-500'"
											@click="handleInlineChoose(row.path, opt.value)">
											{{ opt.label }}
										</view>
									</view>
								</view>
							</view>
						</view>
					</template>

					<!-- 功能 -->
					<template v-else>
						<view class="flex flex-col gap-y-3">
							<uh-section-title>
								功能
								<template #right>
									<text class="text-2xs text-gray-400">一些常用的功能性设置</text>
								</template>
							</uh-section-title>
							<view class="setting-sheet uh-global-card-glass overflow-hidden rounded-2xl">
								<template v-for="(row, index) in featureRows" :key="row.key">
									<!-- 布尔开关 -->
									<view v-if="row.kind === 'bool'"
										class="switch-row flex items-center justify-between px-4 py-4"
										:class="index < featureRows.length - 1 ? 'border-b border-black/5' : ''">
										<view class="row-left flex flex-col gap-1">
											<text
												class="row-label text-[28rpx] text-gray-900 font-bold">{{ row.label }}</text>
											<view class="flex items-center gap-2">
												<text v-if="row.following"
													class="row-sub text-2xs text-gray-400">跟随站点默认</text>
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
										<wd-switch :model-value="row.boolValue"
											@change="handleSwitchChange(row, $event)" />
									</view>
									<!-- 枚举项:内联分段器(与布局项一致) -->
									<view v-else class="px-4 py-4"
										:class="index < featureRows.length - 1 ? 'border-b border-black/5' : ''">
										<view class="flex items-center justify-between">
											<text
												class="row-label text-[28rpx] text-gray-900 font-bold">{{ row.label }}</text>
											<view class="flex items-center gap-2">
												<text v-if="row.following"
													class="row-sub text-2xs text-gray-400">跟随站点默认</text>
												<view v-else
													class="rounded-full bg-secondary px-2 py-0.5 text-[20rpx] text-[#4d7c0f] leading-none">
													已自定义
												</view>
											</view>
										</view>
										<view class="mt-3 flex flex-wrap gap-2">
											<view class="rounded-full px-3 py-1 text-xs"
												:class="currentValueOf(row.path) === null ? 'bg-primary font-bold' : 'uh-global-card-glass !bg-white/60 text-gray-500'"
												@click="handleInlineChoose(row.path, null)">
												默认
											</view>
											<view v-for="opt in row.options" :key="opt.value"
												class="rounded-full px-3 py-1 text-xs"
												:class="currentValueOf(row.path) === opt.value ? 'bg-primary font-bold' : 'uh-global-card-glass !bg-white/60 text-gray-500'"
												@click="handleInlineChoose(row.path, opt.value)">
												{{ opt.label }}
											</view>
										</view>
									</view>
								</template>
							</view>
						</view>
					</template>
				</view>
			</scroll-view>

			<!-- 底部操作栏 -->
			<view class="box-border w-full pb-4 pt-3 flex items-center gap-x-2">
				<uh-button custom-class="flex-1 uh-global-card-glass bg-white/90 border py-2 !rounded-xl"
					@click="onClose()">
					关闭
				</uh-button>
				<uh-button custom-class="flex-1 uh-global-card-glass border py-2 !rounded-xl" @click="handleResetAll">
					恢复默认
				</uh-button>
			</view>
		</view>
	</uh-glass-popup>
</template>