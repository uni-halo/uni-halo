<script lang="ts" setup>
	import { ref } from 'vue'
	import { useDialog } from '@wot-ui/ui'
	import { DIALOG_CONFIRM_BUTTON_PROPS, DIALOG_CANCEL_BUTTON_PROPS } from '@/config/dialog'
	import { useSettingStore } from '@/store/setting'
	import { usePreferenceRows } from '@/hooks/usePreferenceRows'
	import { DataLoadingStatusEnum } from '@/hooks/useDataLoadingStatus'
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
		featureGroups,
		prefValueOf,
		isFollowing,
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
	/** 功能分组:全局性偏好(通用功能/友链功能),不做页面过滤 */
	const filterFeatureGroups = computed(() => featureGroups.value)

	/* ---------------- 交互 ---------------- */
	function currentValueOf(path : string[]) : string | null {
		return isFollowing(path) ? null : String(prefValueOf(path) ?? '')
	}

	function handleInlineChoose(path : string[], value : string | null) : void {
		handleChoose(path, value)
	}

	/* ---------------- 重置全部 ---------------- */
	const dialog = useDialog()

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
		settingStore.resetPreferences()
		uni.showToast({ icon: 'none', title: '已恢复为站点默认' })
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
					<wd-icon name="close" size="28rpx" />
				</view>
			</view>

			<!-- 分段器:布局 / 功能 -->
			<view class="uh-global-card-glass shadow-none flex rounded-xl p-1">
				<view v-for="tab in SETTING_TABS" :key="tab.key"
					class="box-border flex-1 rounded-lg py-2 text-center text-3xs"
					:class="activeTab === tab.key ? 'bg-primary font-semibold' : 'text-gray-500'"
					@click="activeTab = tab.key">
					{{ tab.label }}
				</view>
			</view>

			<!-- 内容区 -->
			<scroll-view scroll-y :show-scrollbar="false" class="mt-4 max-h-[60vh]">
				<view class="box-border flex flex-col gap-y-6 pb-1">
					<!-- 布局 -->
					<template v-if="activeTab === 'layout'">
						<!-- 路由过滤后无匹配分组:空态提示 -->
						<uh-data-loading v-if="filterLayoutGroups.length === 0"
							:loading-status="DataLoadingStatusEnum.Empty" size="mini" empty-text="无匹配的设置"
							empty-sub-text="当前页面没有可配置的布局项" min-height="30vh" :use-refresh-button="false" />
						<template v-else>
							<view v-for="group in filterLayoutGroups" :key="group.key" class="flex flex-col gap-y-3">
							<uh-section-title>{{ group.label }}</uh-section-title>
							<view class="uh-global-card-glass shadow-none overflow-hidden rounded-xl">
								<view v-for="(row) in group.rows" :key="row.key" class="box-border p-3">
									<!-- 左 label / 右 说明 -->
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
									<!-- 下方横向选项(分段器风格:默认 + options) -->
									<view class="mt-3 flex flex-wrap gap-2">
										<view
											class="rounded-full px-3 py-1 text-xs uh-global-card-glass uh-shadow-xs border"
											:class="currentValueOf(row.path) === null ? 'bg-secondary font-bold' : 'border-gray-100 text-gray-500'"
											@click="handleInlineChoose(row.path, null)">
											默认
										</view>
										<view v-for="opt in row.options" :key="opt.value"
											class="rounded-full px-3 py-1 text-xs uh-global-card-glass uh-shadow-xs border"
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
					</template>

					<!-- 功能:按功能分组(通用功能/友链功能) -->
					<template v-else>
						<!-- 空态兜底(当前功能分组不过滤页面,防御性提示) -->
						<uh-data-loading v-if="filterFeatureGroups.length === 0"
							:loading-status="DataLoadingStatusEnum.Empty" size="mini" empty-text="无匹配的设置"
							empty-sub-text="当前没有可配置的功能项" min-height="30vh" :use-refresh-button="false" />
						<template v-else>
							<view v-for="group in filterFeatureGroups" :key="group.key" class="flex flex-col gap-y-3">
							<uh-section-title>{{ group.label }}</uh-section-title>
							<view class="uh-global-card-glass shadow-none overflow-hidden rounded-2xl">
								<view v-for="(row, index) in group.rows" :key="row.key" class="px-4 py-4"
									:class="index < group.rows.length - 1 ? 'border-b border-black/5' : ''">
									<view class="flex items-center justify-between">
										<text
											class="row-label text-sm text-gray-900 font-bold">{{ row.label }}</text>
										<view class="flex items-center gap-2">
											<text v-if="row.following"
												class="row-sub text-xs text-gray-400">跟随站点默认</text>
											<view v-else
												class="rounded-full bg-secondary px-2 py-0.5 text-xs text-gray-900 leading-none">
												已自定义
											</view>
										</view>
									</view>
									<view class="mt-3 flex flex-wrap gap-2">
										<view class="rounded-full px-3 py-1 text-xs uh-global-card-glass border uh-shadow-xs"
											:class="currentValueOf(row.path) === null ? 'bg-secondary font-semibold' : 'border-gray-100 text-gray-500'"
											@click="handleInlineChoose(row.path, null)">
											默认
										</view>
										<view v-for="opt in row.options" :key="opt.value"
											class="rounded-full px-3 py-1 text-xs uh-global-card-glass border uh-shadow-xs"
											:class="currentValueOf(row.path) === opt.value ? 'bg-secondary font-semibold' : 'border-gray-100 text-gray-500'"
											@click="handleInlineChoose(row.path, opt.value)">
											{{ opt.label }}
										</view>
									</view>
								</view>
							</view>
						</view>
						</template>
					</template>
				</view>
			</scroll-view>

			<!-- 底部操作栏 -->
			<view class="box-border w-full pt-3 flex items-center gap-x-2" :class="[isWechat?'':'pb-3']">
				<uh-button class="flex-1" custom-class="flex-1 uh-global-card-glass uh-shadow-xs bg-white/90 border py-2 !rounded-xl"
					@click="handleClose()">
					关闭
				</uh-button>
				<uh-button class="flex-1" custom-class="flex-1 uh-global-card-glass uh-shadow-xs border py-2 !rounded-xl"
					@click="handleResetAll">
					恢复默认
				</uh-button>
			</view>
		</view>
	</uh-glass-popup>
	<wd-dialog />
</template>