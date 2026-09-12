<script lang="ts" setup>
	import { ref } from 'vue'
	import { useSettingStore } from '@/store/setting'
	import { usePreferenceRows } from '@/hooks/usePreferenceRows'
	import { isWechat } from '@/utils/platform'

	const settingStore = useSettingStore()

	defineOptions({
		options: {
			styleIsolation: 'apply-shared'
		}
	})

	interface IProps {
		/** v-model:是否显示 */
		modelValue : boolean
	}

	const props = defineProps<IProps>()

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

	interface IEmits {
		(e : 'update:modelValue', value : boolean) : void,
	}

	const emits = defineEmits<IEmits>()

	/** v-model 代理:将 uh-glass-popup 的 modelValue 转发给父组件,避免直接写 readonly props */
	const popupVisible = computed({
		get : () => props.modelValue,
		set : (value : boolean) => emits('update:modelValue', value),
	})

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
			content: '确定将所有偏好恢复为站点默认吗？',
			showCancel: true,
			cancelText: '取消',
			confirmText: '确定',
			confirmColor: '#B9E424',
			success: (res) => {
				if (res.confirm) {
					settingStore.resetPreferences()
					uni.showToast({ icon: 'none', title: '已恢复为站点默认' })
				}
			},
		})
	}

	function handleClose() {
		emits('update:modelValue', false)
	}
</script>

<template>
	<uh-glass-popup v-model="popupVisible" position="bottom" custom-class="rounded-xl !border"
		safe-area-inset-bottom :z-index="110" hide-when-close>
		<view class="box-border px-3 pt-3">
			<view class="mb-3 flex items-center justify-between">
				<text class="text-md font-bold">偏好设置</text>
				<view
					class="uh-global-card-glass shadow-none !bg-white/5 border flex h-6 w-6 items-center justify-center rounded-lg text-gray-500"
					@click="handleClose()">
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
											:class="currentValueOf(row.path) === null ? 'bg-secondary font-bold' : 'border-gray-100 text-gray-500'"
											@click="handleInlineChoose(row.path, null)">
											默认
										</view>
										<view v-for="opt in row.options" :key="opt.value"
											class="rounded-full px-3 py-1 text-xs uh-global-card-glass shadow-none border"
											:class="[
												currentValueOf(row.path) === opt.value ? 'bg-secondary font-bold' : 'border-gray-100 text-gray-500',
												isCardTypeOptionDisabled(row.path, opt.value) ? 'opacity-40' : ''
											]" @click="isCardTypeOptionDisabled(row.path, opt.value) ? null : handleInlineChoose(row.path, opt.value)">
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
									<!-- 布尔项:内联分段器(默认 / 开 / 关) -->
									<view v-if="row.kind === 'bool'" class="box-border p-3"
										:class="index < featureRows.length - 1 ? 'border-b border-black/5' : ''">
										<view class="flex items-center justify-between">
											<text
												class="row-label text-sm text-gray-900 font-bold">{{ row.label }}</text>
											<view class="flex items-center gap-2">
												<text v-if="row.following"
													class="row-sub text-2xs text-gray-400">默认</text>
												<view v-else
													class="rounded-full bg-secondary px-2 py-1 text-xs text-gray-900 leading-none">
													已自定义
												</view>
											</view>
										</view>
										<view class="mt-3 flex flex-wrap gap-2">
											<view
												class="rounded-full px-3 py-1 text-xs uh-global-card-glass shadow-none border"
												:class="row.following ? 'bg-secondary font-bold' : 'border-gray-100 text-gray-500'"
												@click="handleRevert(row.path)">
												默认
											</view>
											<view
												class="rounded-full px-3 py-1 text-xs uh-global-card-glass shadow-none border"
												:class="!row.following && row.boolValue ? 'bg-secondary font-bold' : 'border-gray-100 text-gray-500'"
												@click="handleBoolChange(row.path, true)">
												开
											</view>
											<view
												class="rounded-full px-3 py-1 text-xs uh-global-card-glass shadow-none border"
												:class="!row.following && !row.boolValue ? 'bg-secondary font-bold' : 'border-gray-100 text-gray-500'"
												@click="handleBoolChange(row.path, false)">
												关
											</view>
										</view>
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
			<view class="box-border w-full pt-3 flex items-center gap-x-2" :class="[isWechat?'':'pb-3']">
				<uh-button class="flex-1" custom-class="flex-1 uh-global-card-glass bg-white/90 border py-2 !rounded-xl"
					@click="handleClose()">
					关闭
				</uh-button>
				<uh-button class="flex-1" custom-class="flex-1 uh-global-card-glass border py-2 !rounded-xl"
					@click="handleResetAll">
					恢复默认
				</uh-button>
			</view>
		</view>
	</uh-glass-popup>
</template>