<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import { DefaultAppSettings } from '@/config/appSettings'
	import { useAppConfigStore } from '@/store/appConfig'
	import { useSettingStore } from '@/store/setting'
	import { collectSiteDefaults, isLocalOverride, readLocalPrefs } from '@/utils/preference'
	import type { LocalPrefs } from '@/utils/preference'

	definePage({
		style: {
			navigationBarTitleText: '偏好设置',
			navigationStyle: 'custom'
		},
	})

	const settingStore = useSettingStore()
	const appConfigStore = useAppConfigStore()

	/** 确保启动合并已执行(入口页未跑或 H5 直达时兜底) */
	onLoad(() => {
		if (!settingStore.siteDefaults) {
			settingStore.applySiteDefaults(collectSiteDefaults(appConfigStore.configs))
		}
		uni.setNavigationBarTitle({ title: '偏好设置' })
	})

	/* ---------------- 路径取值工具 ---------------- */
	type Path = string[]

	function getByPath(obj : unknown, path : Path) : unknown {
		let cursor : unknown = obj
		for (const key of path) {
			if (cursor === null || cursor === undefined)
				return undefined
			cursor = (cursor as Record<string, unknown>)[key]
		}
		return cursor
	}

	/** 按路径构造差异 patch(null 表示删除该键=跟随站点默认) */
	function buildPatch(path : Path, value : unknown) : LocalPrefs {
		const [head, ...rest] = path
		if (rest.length === 0)
			return { [head]: value } as LocalPrefs
		return { [head]: buildPatch(rest, value) } as LocalPrefs
	}

	/** 偏好字段定义(现页已有项;弹幕已下线、友链分组二期再开) */
	interface PrefDef {
		key : string
		label : string
		kind : 'bool' | 'enum'
		path : Path
		options ?: { label : string, value : string }[]
		siteLabelOf ?: (value : string) => string
	}

	const layoutPrefs : PrefDef[] = [
		{
			key: 'home',
			label: '首页文章布局',
			kind: 'enum',
			path: ['layout', 'home'],
			options: [
				{ label: '一行一列', value: 'h_row_col1' },
				{ label: '一行两列', value: 'h_row_col2' },
			],
		},
		{
			key: 'cardType',
			label: '文章卡片样式',
			kind: 'enum',
			path: ['layout', 'cardType'],
			options: [
				{ label: '左图右文', value: 'lr_image_text' },
				{ label: '左文右图', value: 'lr_text_image' },
				{ label: '上图下文', value: 'tb_image_text' },
				{ label: '上文下图', value: 'tb_text_image' },
				{ label: '只有文字', value: 'only_text' },
			],
		},
	]

	const featurePrefs : PrefDef[] = [
		{ key: 'isAvatarRadius', label: '是否圆形头像', kind: 'bool', path: ['isAvatarRadius'] },
	]

	/* ---------------- 状态读取 ---------------- */
	function valueOf(path : Path) : unknown {
		return getByPath(settingStore.settings, path)
	}

	/** 站点默认值(未配置时回退内置默认) */
	function siteDefaultOf(path : Path) : unknown {
		const site = getByPath(settingStore.siteDefaults, path)
		if (site !== undefined && site !== null)
			return site
		return getByPath(DefaultAppSettings, path)
	}

	function isOverridden(path : Path) : boolean {
		return isLocalOverride(readLocalPrefs(), path)
	}

	function enumLabelOf(def : PrefDef, value : unknown) : string {
		const hit = def.options?.find(opt => opt.value === value)
		if (hit)
			return hit.label
		if (def.siteLabelOf && typeof value === 'string')
			return def.siteLabelOf(value)
		return value === undefined || value === null ? '—' : String(value)
	}

	/* ---------------- 交互 ---------------- */
	/** 开关事件(模板透传 $event) */
	function handleSwitchChange(def : PrefDef, detail : { value ?: unknown }) {
		handleBoolChange(def.path, detail.value === true)
	}

	/** 开关类:选值等于站点默认则还原为跟随(只存差异) */
	function handleBoolChange(path : Path, next : boolean) {
		if (next === siteDefaultOf(path)) {
			settingStore.savePreference(buildPatch(path, null))
		}
		else {
			settingStore.savePreference(buildPatch(path, next))
		}
	}

	/** 单项还原为跟随站点默认 */
	function handleRevert(path : Path) {
		settingStore.savePreference(buildPatch(path, null))
	}

	/* ---------------- 枚举底部弹层 ---------------- */
	const enumSheet = ref<{ show : boolean, def : PrefDef | null }>({ show: false, def: null })

	function handleOpenEnum(def : PrefDef) {
		enumSheet.value = { show: true, def }
	}

	function handleCloseEnum() {
		enumSheet.value.show = false
	}

	function handleChooseEnum(value : string | null) {
		const def = enumSheet.value.def
		if (def) {
			if (value === null || value === siteDefaultOf(def.path)) {
				handleRevert(def.path)
			}
			else {
				settingStore.savePreference(buildPatch(def.path, value))
			}
		}
		handleCloseEnum()
	}

	/* ---------------- wd-picker 弹层数据 ---------------- */
	/** 枚举弹层列(首项「跟随站点默认」,空串哨兵映射 null) */
	const enumColumns = computed(() => {
		const def = enumSheet.value.def
		if (!def)
			return []
		return [
			{ label: '跟随站点默认', value: '' },
			...(def.options || []).map(opt => ({ label: opt.label, value: opt.value })),
		]
	})

	/** 当前选中列值(单列;跟随站点默认时为空串) */
	const enumValue = computed(() => {
		const def = enumSheet.value.def
		if (!def)
			return ['']
		return [isFollowing(def) ? '' : String(valueOf(def.path) ?? '')]
	})

	/** wd-picker 确认:空串哨兵还原为「跟随站点默认」 */
	function handlePickerConfirm(payload: { value: (string | number)[] }) {
		const picked = String(payload.value[0] ?? '')
		handleChooseEnum(picked === '' ? null : picked)
	}

	/** 当前枚举项是否处于「跟随站点默认」 */
	function isFollowing(def : PrefDef) : boolean {
		return !isOverridden(def.path)
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
					enumSheet.value.show = false
					uni.showToast({ icon: 'none', title: '已恢复为站点默认' })
				}
			},
		})
	}
</script>

<template>
	<view class="box-border min-h-screen bg-page">
		<!-- 自定义标题 -->
		<uh-navbar default-title="偏好设置" title-color="text-gray-900" :need-placeholder="true"></uh-navbar>
		
		<!-- 内容区域 -->
		<view class="box-border p-3 flex flex-col gap-y-6">
			<!-- 布局设置 -->
			<view class="flex flex-col gap-y-3">
				<uh-section-title>
					布局
					<template #right>
						<text class="text-2xs text-gray-400">应用以及文章列表布局设置</text>
					</template>
				</uh-section-title>
				<view class="uh-global-card-glass overflow-hidden rounded-2xl">
					<view v-for="(def, index) in layoutPrefs" :key="def.key"
						class="pick-row flex items-center justify-between px-4 py-4"
						:class="index < layoutPrefs.length - 1 ? 'border-b border-black/5' : ''"
						@click="handleOpenEnum(def)">
						<view class="row-left flex flex-col gap-1">
							<text class="row-label text-[28rpx] text-gray-900 font-bold">{{ def.label }}</text>
							<view class="flex items-center gap-2">
								<text v-if="isFollowing(def)" class="row-sub text-2xs text-gray-400">跟随站点默认</text>
								<view v-else
									class="rounded-full bg-secondary px-2 py-0.5 text-[20rpx] text-[#4d7c0f] leading-none">
									已自定义
								</view>
							</view>
						</view>
						<view class="row-value flex items-center gap-2">
							<text
								class="value-text text-[26rpx] text-gray-400">{{ enumLabelOf(def, valueOf(def.path)) }}</text>
							<wd-icon name="arrow-right" size="12px" color="#c8c2b4" />
						</view>
					</view>
				</view>
			</view>
			<!-- 功能设置 -->
			<view class="flex flex-col gap-y-3">
				<uh-section-title>
					功能
					<template #right>
						<text class="text-2xs text-gray-400">一些常用的功能性设置</text>
					</template>
				</uh-section-title>
				<view class="setting-sheet uh-global-card-glass overflow-hidden rounded-2xl">
					<template v-for="(def, index) in featurePrefs" :key="def.key">
						<!-- 布尔开关 -->
						<view v-if="def.kind === 'bool'" class="switch-row flex items-center justify-between px-4 py-4"
							:class="index < featurePrefs.length - 1 ? 'border-b border-black/5' : ''">
							<view class="row-left flex flex-col gap-1">
								<text class="row-label text-[28rpx] text-gray-900 font-bold">{{ def.label }}</text>
								<view class="flex items-center gap-2">
									<text v-if="isFollowing(def)" class="row-sub text-2xs text-gray-400">跟随站点默认</text>
									<template v-else>
										<view
											class="rounded-full bg-secondary px-2 py-0.5 text-[20rpx] text-[#4d7c0f] leading-none">
											已自定义
										</view>
										<text class="revert-text text-2xs text-gray-400 underline"
											@click.stop="handleRevert(def.path)">恢复默认</text>
									</template>
								</view>
							</view>
							<wd-switch :model-value="valueOf(def.path) === true" @change="handleSwitchChange(def, $event)" />
						</view>
						<!-- 枚举选择(指示器位置) -->
						<view v-else class="pick-row flex items-center justify-between px-4 py-4"
							:class="index < featurePrefs.length - 1 ? 'border-b border-black/5' : ''"
							@click="handleOpenEnum(def)">
							<view class="row-left flex flex-col gap-1">
								<text class="row-label text-[28rpx] text-gray-900 font-bold">{{ def.label }}</text>
								<view class="flex items-center gap-2">
									<text v-if="isFollowing(def)" class="row-sub text-2xs text-gray-400">跟随站点默认</text>
									<template v-else>
										<view
											class="rounded-full bg-secondary px-2 py-0.5 text-[20rpx] text-[#4d7c0f] leading-none">
											已自定义
										</view>
										<text class="revert-text text-2xs text-gray-400 underline"
											@click.stop="handleRevert(def.path)">恢复默认</text>
									</template>
								</view>
							</view>
							<view class="row-value flex items-center gap-2">
								<text
									class="value-text text-[26rpx] text-gray-400">{{ enumLabelOf(def, valueOf(def.path)) }}</text>
								<wd-icon name="arrow-right" size="12px" color="#c8c2b4" />
							</view>
						</view>
					</template>
				</view>
			</view>
			<!-- 底部操作栏(玻璃悬浮) -->
			<view class="box-border w-full px-2">
				<uh-button custom-class="uh-global-card-glass py-2 !rounded-full"
					@click="handleResetAll">恢复默认</uh-button>
			</view>
		</view>
		<!-- 枚举选择弹层(wd-picker 自带底部弹层与工具栏) -->
		<wd-picker
			v-model:visible="enumSheet.show" :title="enumSheet.def?.label || ''" :columns="enumColumns"
			:model-value="enumValue" confirm-button-text="确定" cancel-button-text="取消"
			@confirm="handlePickerConfirm"
		/>
	</view>
</template>
