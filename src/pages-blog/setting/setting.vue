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
			navigationStyle: 'custom',
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

	/** 布局设置按页面分组(每组:列表布局 + 卡片样式) */
	const PAGE_GROUPS = [
		{ key: 'home', label: '首页' },
		{ key: 'articles', label: '文章列表' },
		{ key: 'archives', label: '文章归档' },
	]

	const layoutPrefs : PrefDef[] = PAGE_GROUPS.flatMap(group => [
		{
			key: `${group.key}ListLayout`,
			label: '列表布局',
			kind: 'enum',
			path: ['layout', group.key, 'listLayout'],
			options: [
				{ label: '单列', value: 'single' },
				{ label: '双列', value: 'double' },
			],
		},
		{
			key: `${group.key}CardType`,
			label: '卡片样式',
			kind: 'enum',
			path: ['layout', group.key, 'cardType'],
			options: [
				{ label: '上图下文', value: 'image_top' },
				{ label: '左文右图', value: 'image_right' },
				{ label: '上文下图', value: 'image_bottom' },
				{ label: '左图右文', value: 'image_left' },
			],
		},
	])

	const featurePrefs : PrefDef[] = [
		{ key: 'isAvatarRadius', label: '是否圆形头像', kind: 'bool', path: ['isAvatarRadius'] },
	]

	/* ---------------- 顶部分段器(布局 / 功能) ---------------- */
	const settingTabs : { key : 'layout' | 'feature', label : string }[] = [
		{ key: 'layout', label: '布局' },
		{ key: 'feature', label: '功能' },
	]
	const activeTab = ref<'layout' | 'feature'>('layout')

	/* ---------------- 状态读取 ---------------- */
	function prefValueOf(path : Path) : unknown {
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

	/* ---------------- 枚举底部弹层(uh-glass-popup + wd-picker-view) ---------------- */
	const enumSheet = ref<{ show : boolean, def : PrefDef | null }>({ show: false, def: null })
	/** 弹层内滚动中的临时选中值(单列;确认时才落库,取消不生效) */
	const pickerValue = ref<(string | number)[]>([''])

	function handleOpenEnum(def : PrefDef) {
		console.log('handleOpenEnum', def)
		enumSheet.value = { show: true, def }
		// 打开时同步当前值(跟随站点默认 → 空串哨兵)
		pickerValue.value = [isFollowing(def) ? '' : String(prefValueOf(def.path) ?? '')]
		console.log('pickerValue', pickerValue.value)
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

	/* ---------------- wd-picker-view 弹层数据 ---------------- */
	/** 枚举弹层列(首项「跟随站点默认」,空串哨兵映射 null) */
	const enumColumns = computed(() => {
		const def = enumSheet.value.def
		if (!def) { return [] }
		return [
			{ label: '跟随站点默认', value: '' },
			...(def.options || []).map(opt => ({ label: opt.label, value: opt.value })),
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

	/** 当前枚举项是否处于「跟随站点默认」 */
	function isFollowing(def : PrefDef) : boolean {
		return !isOverridden(def.path)
	}

	/* ---------------- 展示行(预计算,避免模板渲染期函数调用) ---------------- */
	/** 偏好展示行:展示文本/跟随态/开关值在数据层算好,模板只做属性访问 */
	interface PrefRow extends PrefDef {
		displayValue : string
		following : boolean
		/** 仅 kind==='bool' 使用 */
		boolValue : boolean
	}

	function buildRows(defs : PrefDef[]) : PrefRow[] {
		return defs.map(def => ({
			...def,
			displayValue: enumLabelOf(def, prefValueOf(def.path)),
			following: isFollowing(def),
			boolValue: def.kind === 'bool' ? prefValueOf(def.path) === true : false,
		}))
	}

	const layoutRows = computed(() => buildRows(layoutPrefs))
	const featureRows = computed(() => buildRows(featurePrefs))

	/** 布局设置按页面分组的展示行 */
	const layoutGroups = computed(() => PAGE_GROUPS.map(group => ({
		key: group.key,
		label: group.label,
		rows: layoutRows.value.filter(row => row.path[1] === group.key),
	})))

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
		<uh-navbar default-title="偏好设置" title-color="text-gray-900" :need-placeholder="true" />

		<!-- 内容区域 -->
		<view class="box-border flex flex-col gap-y-6 p-3">
			<!-- 顶部分段器:布局 / 功能 -->
			<view class="uh-global-card-glass flex rounded-full p-1">
				<view v-for="tab in settingTabs" :key="tab.key"
					class="flex-1 rounded-full py-1.5 text-center text-sm"
					:class="activeTab === tab.key ? 'bg-primary font-bold' : 'text-gray-500'"
					@click="activeTab = tab.key">
					{{ tab.label }}
				</view>
			</view>

			<!-- 布局:按页面分组(首页/文章列表/文章归档 × 列表布局/卡片样式) -->
			<template v-if="activeTab === 'layout'">
				<view v-for="group in layoutGroups" :key="group.key" class="flex flex-col gap-y-3">
					<uh-section-title>{{ group.label }}</uh-section-title>
					<view class="uh-global-card-glass overflow-hidden rounded-2xl">
						<view v-for="(row, index) in group.rows" :key="row.key"
							class="pick-row flex items-center justify-between px-4 py-4"
							:class="index < group.rows.length - 1 ? 'border-b border-black/5' : ''"
							@click="handleOpenEnum(row)">
							<view class="row-left flex flex-col gap-1">
								<text class="row-label text-[28rpx] text-gray-900 font-bold">{{ row.label }}</text>
								<view class="flex items-center gap-2">
									<text v-if="row.following" class="row-sub text-2xs text-gray-400">跟随站点默认</text>
									<view v-else
										class="rounded-full bg-secondary px-2 py-0.5 text-[20rpx] text-[#4d7c0f] leading-none">
										已自定义
									</view>
								</view>
							</view>
							<view class="row-value flex items-center gap-2">
								<text class="value-text text-[26rpx] text-gray-400">{{ row.displayValue }}</text>
								<wd-icon name="arrow-right" size="12px" color="#c8c2b4" />
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
					<view class="setting-sheet uh-global-card-glass overflow-hidden rounded-2xl">
					<template v-for="(row, index) in featureRows" :key="row.key">
						<!-- 布尔开关 -->
						<view v-if="row.kind === 'bool'" class="switch-row flex items-center justify-between px-4 py-4"
							:class="index < featureRows.length - 1 ? 'border-b border-black/5' : ''">
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
							<wd-switch :model-value="row.boolValue" @change="handleSwitchChange(row, $event)" />
						</view>
						<!-- 枚举选择(指示器位置) -->
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
							<view class="row-value flex items-center gap-2">
								<text class="value-text text-[26rpx] text-gray-400">{{ row.displayValue }}</text>
								<wd-icon name="arrow-right" size="12px" color="#c8c2b4" />
							</view>
						</view>
					</template>
				</view>
			</view>
		</template>
		<!-- 底部操作栏-->
			<view class="box-border w-full">
				<uh-button custom-class="uh-global-card-glass py-2 !rounded-xl" @click="handleResetAll">
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
					custom-class="!p-0 !bg-transparent !rounded-xl overflow-hidden" @change="handlePickerChange" />
				<!-- 底部操作:取消 / 确认 -->
				<view class="mt-4 flex items-center justify-center gap-x-3">
					<uh-button custom-class="flex-1 py-2 uh-global-card-glass border !rounded-xl bg-white/90"
						@click="handlePickerCancel">
						取消
					</uh-button>
					<uh-button
						custom-class="flex-1 py-2 uh-global-card-glass !rounded-xl border bg-primary text-gray-900"
						@click="handlePickerConfirm">
						确定
					</uh-button>
				</view>
			</view>
		</uh-glass-popup>
	</view>
</template>