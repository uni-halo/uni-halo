<template>
	<view class="kex-cp">
		<!-- 触发器 -->
		<view v-if="showTrigger" class="kex-cp__trigger" :class="[
				'kex-cp__trigger--' + size,
				{ 'kex-cp__trigger--disabled': disabled }
			]" @click="onTriggerClick">
			<slot name="trigger" :color="displayColor" :rgba="triggerRgba" :disabled="disabled">
				<view class="kex-cp__swatch-wrap">
					<view class="kex-cp__swatch" :style="{ backgroundColor: displayColor }" />
					<text class="kex-cp__chevron">▾</text>
				</view>
			</slot>
		</view>

		<!-- 弹层：仅 vue 页（非 nvue） -->
		<!-- #ifndef APP-NVUE -->
		<view v-if="visible" class="kex-cp__portal">
			<!-- 遮罩拦截底层滚动；面板内可滚动 -->
			<view class="kex-cp__mask" :class="{ 'kex-cp__mask--on': animOn }" @click="onCancel"
				@touchmove.stop.prevent="noop" />
			<view class="kex-cp__sheet" :class="{ 'kex-cp__sheet--on': animOn }" @touchmove.stop="noop">
				<view class="kex-cp__head">
					<text class="kex-cp__title">{{ title }}</text>
				</view>

				<!-- SV 色域 -->
				<view class="kex-cp__sv kex-cp__box-sv" :style="{ backgroundColor: hueBg }"
					@touchstart.prevent="onPressStart($event, 'sv')" @touchmove.prevent="onPressMove($event, 'sv')"
					@touchend="onPressEnd" @touchcancel="onPressEnd" @mousedown.prevent="onPressStart($event, 'sv')"
					@mousemove="onPressMove($event, 'sv')" @mouseup="onPressEnd" @mouseleave="onPressEnd">
					<view class="kex-cp__sv-white" />
					<view class="kex-cp__sv-black" />
					<view class="kex-cp__pointer"
						:style="{ left: svLeft + 'px', top: svTop + 'px', backgroundColor: currentCss }" />
				</view>

				<!-- 色相 -->
				<view class="kex-cp__slider kex-cp__hue kex-cp__box-hue"
					@touchstart.prevent="onPressStart($event, 'hue')" @touchmove.prevent="onPressMove($event, 'hue')"
					@touchend="onPressEnd" @touchcancel="onPressEnd" @mousedown.prevent="onPressStart($event, 'hue')"
					@mousemove="onPressMove($event, 'hue')" @mouseup="onPressEnd" @mouseleave="onPressEnd">
					<view class="kex-cp__hue-bar" />
					<view class="kex-cp__knob" :style="{ left: hueLeft + 'px' }" />
				</view>

				<!-- 透明度 -->
				<view v-if="showAlpha" class="kex-cp__slider kex-cp__alpha kex-cp__box-alpha"
					@touchstart.prevent="onPressStart($event, 'alpha')"
					@touchmove.prevent="onPressMove($event, 'alpha')" @touchend="onPressEnd" @touchcancel="onPressEnd"
					@mousedown.prevent="onPressStart($event, 'alpha')" @mousemove="onPressMove($event, 'alpha')"
					@mouseup="onPressEnd" @mouseleave="onPressEnd">
					<view class="kex-cp__checker kex-cp__alpha-checker" />
					<view class="kex-cp__alpha-bar" :style="alphaBarStyle" />
					<view class="kex-cp__knob" :style="{ left: alphaLeft + 'px' }" />
				</view>

				<!-- 格式切换 + 输入 -->
				<view class="kex-cp__formats">
					<view v-for="item in formatTabs" :key="item" class="kex-cp__fmt"
						:class="{ 'kex-cp__fmt--on': activeFormat === item }" @click="switchFormat(item)">
						<text class="kex-cp__fmt-text">{{ item.toUpperCase() }}</text>
					</view>
				</view>

				<view class="kex-cp__inputs">
					<template v-if="activeFormat === 'hex'">
						<input class="kex-cp__input kex-cp__input--wide" :value="draft.hex" maxlength="9"
							@input="onHexInput" @blur="commitHex" />
					</template>
					<template v-else-if="activeFormat === 'rgb'">
						<input class="kex-cp__input" type="number" :value="draft.r" @input="onChannelInput('r', $event)"
							@blur="commitChannels" />
						<input class="kex-cp__input" type="number" :value="draft.g" @input="onChannelInput('g', $event)"
							@blur="commitChannels" />
						<input class="kex-cp__input" type="number" :value="draft.b" @input="onChannelInput('b', $event)"
							@blur="commitChannels" />
						<input v-if="showAlpha" class="kex-cp__input" type="digit" :value="draft.a"
							@input="onChannelInput('a', $event)" @blur="commitChannels" />
					</template>
					<template v-else-if="activeFormat === 'hsl'">
						<input class="kex-cp__input" type="number" :value="draft.h" @input="onHslInput('h', $event)"
							@blur="commitHsl" />
						<input class="kex-cp__input" type="number" :value="draft.s" @input="onHslInput('s', $event)"
							@blur="commitHsl" />
						<input class="kex-cp__input" type="number" :value="draft.l" @input="onHslInput('l', $event)"
							@blur="commitHsl" />
						<input v-if="showAlpha" class="kex-cp__input" type="digit" :value="draft.a"
							@input="onChannelInput('a', $event)" @blur="commitHsl" />
					</template>
					<template v-else>
						<input class="kex-cp__input" type="number" :value="draft.h" @input="onHsvDraft('h', $event)"
							@blur="commitHsvDraft" />
						<input class="kex-cp__input" type="number" :value="draft.s" @input="onHsvDraft('s', $event)"
							@blur="commitHsvDraft" />
						<input class="kex-cp__input" type="number" :value="draft.v" @input="onHsvDraft('v', $event)"
							@blur="commitHsvDraft" />
						<input v-if="showAlpha" class="kex-cp__input" type="digit" :value="draft.a"
							@input="onChannelInput('a', $event)" @blur="commitHsvDraft" />
					</template>
				</view>
				<view class="kex-cp__input-labels">
					<template v-if="activeFormat === 'hex'">
						<text class="kex-cp__input-label">HEX</text>
					</template>
					<template v-else-if="activeFormat === 'rgb'">
						<text class="kex-cp__input-label">R</text>
						<text class="kex-cp__input-label">G</text>
						<text class="kex-cp__input-label">B</text>
						<text v-if="showAlpha" class="kex-cp__input-label">A</text>
					</template>
					<template v-else-if="activeFormat === 'hsl'">
						<text class="kex-cp__input-label">H</text>
						<text class="kex-cp__input-label">S</text>
						<text class="kex-cp__input-label">L</text>
						<text v-if="showAlpha" class="kex-cp__input-label">A</text>
					</template>
					<template v-else>
						<text class="kex-cp__input-label">H</text>
						<text class="kex-cp__input-label">S</text>
						<text class="kex-cp__input-label">V</text>
						<text v-if="showAlpha" class="kex-cp__input-label">A</text>
					</template>
				</view>

				<!-- 预览：原色 / 新色 -->
				<view class="kex-cp__preview-row">
					<view class="kex-cp__preview-card">
						<view class="kex-cp__checker kex-cp__preview-board">
							<view class="kex-cp__preview-half" :style="{ backgroundColor: originCss }" />
							<view class="kex-cp__preview-half" :style="{ backgroundColor: currentCss }" />
						</view>
						<view class="kex-cp__preview-meta">
							<text class="kex-cp__preview-label">原色</text>
							<text class="kex-cp__preview-label">新色</text>
						</view>
					</view>
				</view>

				<!-- 预设色 -->
				<view v-if="showPresets && presetList.length" class="kex-cp__section">
					<text class="kex-cp__section-title">预设</text>
					<view class="kex-cp__dots">
						<view v-for="(c, i) in presetList" :key="'p' + i" class="kex-cp__dot-wrap"
							@click="applyColor(c)">
							<view class="kex-cp__checker kex-cp__dot-checker">
								<view class="kex-cp__dot" :style="{ backgroundColor: toCss(c) }" />
							</view>
						</view>
					</view>
				</view>

				<!-- 最近使用 -->
				<view v-if="showRecent && recentList.length" class="kex-cp__section">
					<text class="kex-cp__section-title">最近</text>
					<view class="kex-cp__dots">
						<view v-for="(c, i) in recentList" :key="'r' + i" class="kex-cp__dot-wrap"
							@click="applyColor(c)">
							<view class="kex-cp__checker kex-cp__dot-checker">
								<view class="kex-cp__dot" :style="{ backgroundColor: toCss(c) }" />
							</view>
						</view>
					</view>
				</view>

				<slot name="footer" :color="outputValue" :rgba="rgba" />

				<view class="kex-cp__head uh-footer-actions">
					<view class="kex-cp__chip kex-cp__chip--ghost" @click="onCancel">
						<text class="kex-cp__chip-text" @click="onCancel">{{ cancelText }}</text>
					</view>
					<view v-if="clearable" class="kex-cp__chip kex-cp__chip--ghost" @click="onClear">
						<text class="kex-cp__chip-text">清空</text>
					</view>
					<view class="kex-cp__chip" @click="copyColor">
						<text class="kex-cp__chip-text">复制</text>
					</view>
					<view class="kex-cp__chip " @click="onConfirm">
						<text class="kex-cp__chip-text">{{ confirmText }}</text>
					</view>
				</view>
				<view class="kex-cp__safe" />
			</view>

			<!-- 内置提示：避免 uni.showToast 被弹层 z-index 压住 -->
			<view v-if="tipVisible" class="kex-cp__tip">
				<text class="kex-cp__tip-text">{{ tipText }}</text>
			</view>
		</view>
		<!-- #endif -->
	</view>
</template>

<script>
	export default {
		name: 'KexColorPicker',
		options: {
			// #ifdef MP-WEIXIN
			virtualHost: true
			// #endif
		}
	}
</script>

<script setup>
	/**
	 * kex-color-picker 颜色选择器（uni-app Vue3）
	 * 兼容：App(vue) / H5 / 微信 / 支付宝 / 其它小程序 / 鸿蒙
	 * 说明：弹层依赖 css 渐变与 fixed，不支持 nvue 页面
	 */
	import {
		ref,
		reactive,
		computed,
		watch,
		getCurrentInstance,
		nextTick,
		onBeforeUnmount
	} from 'vue'
	import {
		DEFAULT_PRESETS,
		parseColor,
		formatColor,
		rgbaCss,
		hueCss,
		rgbToHsv,
		hsvToRgb,
		rgbToHsl,
		hslToRgb,
		hexToRgba
	} from './color-utils.js'

	const RECENT_KEY = 'kex-color-picker-recent'
	const FORMAT_TABS = ['hex', 'rgb', 'hsl', 'hsv']

	const props = defineProps({
		modelValue: {
			type: [String, Object],
			default: ''
		},
		format: {
			type: String,
			default: 'hex'
		},
		showAlpha: {
			type: Boolean,
			default: true
		},
		disabled: {
			type: Boolean,
			default: false
		},
		showTrigger: {
			type: Boolean,
			default: true
		},
		size: {
			type: String,
			default: 'medium'
		},
		title: {
			type: String,
			default: '选择颜色'
		},
		confirmText: {
			type: String,
			default: '确定'
		},
		cancelText: {
			type: String,
			default: '取消'
		},
		clearable: {
			type: Boolean,
			default: true
		},
		showPresets: {
			type: Boolean,
			default: true
		},
		presets: {
			type: Array,
			default: null
		},
		showRecent: {
			type: Boolean,
			default: true
		},
		recentLimit: {
			type: Number,
			default: 10
		},
		realtime: {
			type: Boolean,
			default: false
		}
	})

	const emit = defineEmits([
		'update:modelValue',
		'change',
		'confirm',
		'cancel',
		'clear',
		'open',
		'close'
	])

	const instance = getCurrentInstance()
	const visible = ref(false)
	const animOn = ref(false)
	const activeFormat = ref(normalizeFormat(props.format))
	const hsv = reactive({
		h: 174,
		s: 91,
		v: 58
	})
	const alpha = ref(1)
	const originCss = ref('rgba(185, 228, 36, 1)')
	const svLeft = ref(0)
	const svTop = ref(0)
	const hueLeft = ref(0)
	const alphaLeft = ref(0)
	const draft = reactive({
		hex: '#B9E424',
		r: 13,
		g: 148,
		b: 136,
		a: 1,
		h: 174,
		s: 91,
		v: 58,
		l: 32
	})
	const recentList = ref([])
	const rects = ref({})
	const pressedByTouch = ref(false)
	const tipVisible = ref(false)
	const tipText = ref('')
	let dragType = ''
	let measureTimer = null
	let tipTimer = null
	let mouseMoveHandler = null
	let mouseUpHandler = null
	let scrollLocked = false
	let savedBodyOverflow = ''
	let savedHtmlOverflow = ''
	let savedBodyPosition = ''
	let savedBodyTop = ''
	let savedBodyLeft = ''
	let savedBodyRight = ''
	let savedBodyWidth = ''
	let savedScrollTop = 0

	const formatTabs = FORMAT_TABS

	const presetList = computed(() => {
		if (Array.isArray(props.presets) && props.presets.length) return props.presets
		return DEFAULT_PRESETS
	})

	const rgba = computed(() => {
		const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v)
		return {
			r: rgb.r,
			g: rgb.g,
			b: rgb.b,
			a: alpha.value
		}
	})

	const currentCss = computed(() => rgbaCss(rgba.value))
	const hueBg = computed(() => hueCss(hsv.h))
	const alphaBarStyle = computed(() => {
		const rgb = rgba.value
		const grad = 'linear-gradient(to right, rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0), rgba(' + rgb.r +
			',' + rgb.g + ',' + rgb.b + ',1))'
		return {
			backgroundImage: grad,
			background: grad
		}
	})

	const outputValue = computed(() =>
		formatColor(rgba.value, props.format, props.showAlpha)
	)

	const displayColor = computed(() => {
		if (!props.modelValue && props.modelValue !== 0) return 'rgba(255,255,255,1)'
		return rgbaCss(parseColor(props.modelValue))
	})

	const triggerRgba = computed(() => parseColor(props.modelValue || '#FFFFFF'))

	watch(
		() => props.format,
		(v) => {
			activeFormat.value = normalizeFormat(v)
			syncDraft()
		}
	)

	watch(
		() => props.modelValue,
		() => {
			if (!visible.value) syncFromModel()
		}, {
			immediate: true
		}
	)

	function normalizeFormat(f) {
		const x = String(f || 'hex').toLowerCase()
		if (x === 'rgba') return 'rgb'
		if (x === 'hsla') return 'hsl'
		if (x === 'hsb') return 'hsv'
		if (FORMAT_TABS.indexOf(x) !== -1) return x
		return 'hex'
	}

	function noop() {}

	function toCss(c) {
		return rgbaCss(parseColor(c))
	}

	/** 统一各端 input 取值：小程序 detail.value / H5 target.value */
	function getEventValue(e) {
		if (e && e.detail && e.detail.value !== undefined) return e.detail.value
		if (e && e.target && e.target.value !== undefined) return e.target.value
		return ''
	}

	function getEventType(e) {
		return (e && e.type) || ''
	}

	function syncFromModel() {
		const parsed = parseColor(props.modelValue || '#B9E424')
		const next = rgbToHsv(parsed.r, parsed.g, parsed.b)
		hsv.h = next.h
		hsv.s = next.s
		hsv.v = next.v
		alpha.value = parsed.a
		originCss.value = rgbaCss(parsed)
		syncDraft()
	}

	function syncDraft() {
		const cur = rgba.value
		const hsl = rgbToHsl(cur.r, cur.g, cur.b)
		draft.hex = formatColor(cur, 'hex', props.showAlpha)
		draft.r = cur.r
		draft.g = cur.g
		draft.b = cur.b
		draft.a = Math.round(cur.a * 100) / 100
		draft.h = activeFormat.value === 'hsl' ? hsl.h : hsv.h
		draft.s = activeFormat.value === 'hsl' ? hsl.s : hsv.s
		draft.v = hsv.v
		draft.l = hsl.l
	}

	function loadRecent() {
		try {
			const raw = uni.getStorageSync(RECENT_KEY)
			recentList.value = Array.isArray(raw) ? raw : []
		} catch (e) {
			recentList.value = []
		}
	}

	function saveRecent(color) {
		if (!color) return
		const list = [color]
		for (let i = 0; i < recentList.value.length; i++) {
			if (recentList.value[i] !== color) list.push(recentList.value[i])
			if (list.length >= props.recentLimit) break
		}
		recentList.value = list
		try {
			uni.setStorageSync(RECENT_KEY, list)
		} catch (e) {}
	}

	function onTriggerClick() {
		if (props.disabled) return
		open()
	}

	function showTip(msg) {
		tipText.value = msg
		tipVisible.value = true
		if (tipTimer) clearTimeout(tipTimer)
		tipTimer = setTimeout(() => {
			tipVisible.value = false
		}, 1500)
	}

	/** H5 / App webview：锁定页面滚动；小程序靠遮罩 touchmove 拦截 */
	function lockPageScroll() {
		try {
			if (typeof document === 'undefined' || !document.body) return
			if (scrollLocked) return
			scrollLocked = true
			const docEl = document.documentElement
			savedScrollTop = window.pageYOffset || docEl.scrollTop || document.body.scrollTop || 0
			savedBodyOverflow = document.body.style.overflow
			savedHtmlOverflow = docEl.style.overflow
			savedBodyPosition = document.body.style.position
			savedBodyTop = document.body.style.top
			savedBodyLeft = document.body.style.left
			savedBodyRight = document.body.style.right
			savedBodyWidth = document.body.style.width
			docEl.style.overflow = 'hidden'
			document.body.style.overflow = 'hidden'
			document.body.style.position = 'fixed'
			document.body.style.top = '-' + savedScrollTop + 'px'
			document.body.style.left = '0'
			document.body.style.right = '0'
			document.body.style.width = '100%'
		} catch (e) {}
	}

	function unlockPageScroll() {
		try {
			if (typeof document === 'undefined' || !document.body) return
			if (!scrollLocked) return
			scrollLocked = false
			const docEl = document.documentElement
			docEl.style.overflow = savedHtmlOverflow
			document.body.style.overflow = savedBodyOverflow
			document.body.style.position = savedBodyPosition
			document.body.style.top = savedBodyTop
			document.body.style.left = savedBodyLeft
			document.body.style.right = savedBodyRight
			document.body.style.width = savedBodyWidth
			if (typeof window !== 'undefined' && window.scrollTo) {
				window.scrollTo(0, savedScrollTop)
			}
		} catch (e) {}
	}

	function open() {
		if (props.disabled) return
		// #ifdef APP-NVUE
		uni.showToast({
			title: '请在 vue 页面使用颜色选择器',
			icon: 'none'
		})
		return
		// #endif
		// #ifndef APP-NVUE
		syncFromModel()
		loadRecent()
		lockPageScroll()
		visible.value = true
		emit('open')
		nextTick(() => {
			setTimeout(() => {
				animOn.value = true
				scheduleMeasure(0)
			}, 30)
		})
		// #endif
	}

	function scheduleMeasure(retry) {
		if (measureTimer) clearTimeout(measureTimer)
		measureTimer = setTimeout(() => {
			measure().then((ok) => {
				if (ok) {
					layoutPointers()
					return
				}
				if (retry < 8) scheduleMeasure(retry + 1)
			})
		}, retry === 0 ? 320 : 80)
	}

	function close() {
		animOn.value = false
		tipVisible.value = false
		unlockPageScroll()
		setTimeout(() => {
			visible.value = false
			emit('close')
		}, 280)
	}

	function onCancel() {
		emit('cancel')
		close()
	}

	function onConfirm() {
		const val = outputValue.value
		emit('update:modelValue', val)
		emit('change', val)
		emit('confirm', {
			value: val,
			rgba: {
				r: rgba.value.r,
				g: rgba.value.g,
				b: rgba.value.b,
				a: rgba.value.a
			},
			hsv: {
				h: hsv.h,
				s: hsv.s,
				v: hsv.v
			},
			hex: formatColor(rgba.value, 'hex', props.showAlpha)
		})
		saveRecent(val)
		close()
	}

	function onClear() {
		emit('update:modelValue', '')
		emit('change', '')
		emit('clear')
		close()
	}

	function applyColor(c) {
		const parsed = parseColor(c)
		const next = rgbToHsv(parsed.r, parsed.g, parsed.b)
		hsv.h = next.h
		hsv.s = next.s
		hsv.v = next.v
		alpha.value = props.showAlpha ? parsed.a : 1
		syncDraft()
		layoutPointers()
		emitRealtime()
	}

	function emitRealtime() {
		if (!props.realtime) return
		const val = outputValue.value
		emit('update:modelValue', val)
		emit('change', val)
	}

	function switchFormat(item) {
		activeFormat.value = item
		syncDraft()
	}

	function copyColor() {
		const val = outputValue.value
		// #ifdef H5
		if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
			navigator.clipboard.writeText(val).then(() => {
				showTip('已复制')
			}).catch(() => {
				fallbackCopy(val)
			})
			return
		}
		// #endif
		fallbackCopy(val)
	}

	function fallbackCopy(val) {
		uni.setClipboardData({
			data: String(val),
			// App / 部分端默认会再弹系统「内容已复制」，关掉避免双提示
			showToast: false,
			success: () => {
				showTip('已复制')
			},
			fail: () => {
				showTip('复制失败')
			}
		})
	}

	function onHexInput(e) {
		draft.hex = getEventValue(e)
	}

	function commitHex() {
		let v = String(draft.hex || '').trim()
		if (v && v.charAt(0) !== '#') v = '#' + v
		const parsed = hexToRgba(v)
		if (!parsed) {
			syncDraft()
			return
		}
		const next = rgbToHsv(parsed.r, parsed.g, parsed.b)
		hsv.h = next.h
		hsv.s = next.s
		hsv.v = next.v
		if (props.showAlpha) alpha.value = parsed.a
		syncDraft()
		layoutPointers()
		emitRealtime()
	}

	function onChannelInput(key, e) {
		draft[key] = getEventValue(e)
	}

	function commitChannels() {
		const r = clampInt(draft.r, 0, 255)
		const g = clampInt(draft.g, 0, 255)
		const b = clampInt(draft.b, 0, 255)
		const a = props.showAlpha ? clampFloat(draft.a, 0, 1) : 1
		const next = rgbToHsv(r, g, b)
		hsv.h = next.h
		hsv.s = next.s
		hsv.v = next.v
		alpha.value = a
		syncDraft()
		layoutPointers()
		emitRealtime()
	}

	function onHslInput(key, e) {
		draft[key] = getEventValue(e)
	}

	function commitHsl() {
		const h = clampInt(draft.h, 0, 360)
		const s = clampInt(draft.s, 0, 100)
		const l = clampInt(draft.l, 0, 100)
		const a = props.showAlpha ? clampFloat(draft.a, 0, 1) : 1
		const rgb = hslToRgb(h, s, l)
		const next = rgbToHsv(rgb.r, rgb.g, rgb.b)
		hsv.h = next.h
		hsv.s = next.s
		hsv.v = next.v
		alpha.value = a
		syncDraft()
		layoutPointers()
		emitRealtime()
	}

	function onHsvDraft(key, e) {
		draft[key] = getEventValue(e)
	}

	function commitHsvDraft() {
		hsv.h = clampInt(draft.h, 0, 360)
		hsv.s = clampInt(draft.s, 0, 100)
		hsv.v = clampInt(draft.v, 0, 100)
		alpha.value = props.showAlpha ? clampFloat(draft.a, 0, 1) : 1
		syncDraft()
		layoutPointers()
		emitRealtime()
	}

	function clampInt(v, min, max) {
		const n = parseInt(v, 10)
		if (isNaN(n)) return min
		return Math.min(max, Math.max(min, n))
	}

	function clampFloat(v, min, max) {
		const n = parseFloat(v)
		if (isNaN(n)) return min
		return Math.round(Math.min(max, Math.max(min, n)) * 100) / 100
	}

	function getQuery() {
		const proxy = instance && (instance.proxy || instance)
		if (proxy) return uni.createSelectorQuery().in(proxy)
		return uni.createSelectorQuery()
	}

	function measure() {
		return new Promise((resolve) => {
			const query = getQuery()
			query.select('.kex-cp__box-sv').boundingClientRect()
			query.select('.kex-cp__box-hue').boundingClientRect()
			if (props.showAlpha) {
				query.select('.kex-cp__box-alpha').boundingClientRect()
			}
			query.exec((res) => {
				if (!res || !res[0] || !res[0].width) {
					resolve(false)
					return
				}
				const map = {
					sv: res[0],
					hue: res[1]
				}
				if (props.showAlpha && res[2]) map.alpha = res[2]
				rects.value = map
				resolve(true)
			})
		})
	}

	function layoutPointers() {
		const sv = rects.value.sv
		const hue = rects.value.hue
		const alphaRect = rects.value.alpha
		if (sv && sv.width) {
			svLeft.value = (hsv.s / 100) * sv.width
			svTop.value = ((100 - hsv.v) / 100) * sv.height
		}
		if (hue && hue.width) {
			hueLeft.value = (hsv.h / 360) * hue.width
		}
		if (alphaRect && alphaRect.width) {
			alphaLeft.value = alpha.value * alphaRect.width
		}
	}

	function clientXY(e) {
		const touches = (e && e.touches) || (e && e.changedTouches)
		const t = (touches && touches[0]) || e
		const x = t.clientX != null ? t.clientX : t.pageX
		const y = t.clientY != null ? t.clientY : t.pageY
		return {
			x: x || 0,
			y: y || 0
		}
	}

	function onPressStart(e, type) {
		const et = getEventType(e)
		// 与 number-box 一致：触摸后再触发的 mouse 事件忽略，避免双击
		if (et === 'mousedown' && pressedByTouch.value) return
		if (et === 'touchstart') pressedByTouch.value = true

		dragType = type
		const run = () => applyPointer(e, type)
		if (!rects.value.sv || !rects.value.sv.width) {
			measure().then((ok) => {
				if (ok) run()
			})
		} else {
			run()
		}

		// #ifdef H5
		if (et === 'mousedown') {
			mouseMoveHandler = (ev) => {
				if (!dragType) return
				applyPointer(ev, type)
			}
			mouseUpHandler = () => {
				dragType = ''
				if (mouseMoveHandler) document.removeEventListener('mousemove', mouseMoveHandler)
				if (mouseUpHandler) document.removeEventListener('mouseup', mouseUpHandler)
				mouseMoveHandler = null
				mouseUpHandler = null
			}
			document.addEventListener('mousemove', mouseMoveHandler)
			document.addEventListener('mouseup', mouseUpHandler)
		}
		// #endif
	}

	function onPressMove(e, type) {
		if (!dragType) return
		const et = getEventType(e)
		// H5 上 document 已接管 mousemove；元素上的 mousemove 仍可用作补充
		if (et.indexOf('mouse') === 0 && pressedByTouch.value) return
		applyPointer(e, type || dragType)
	}

	function onPressEnd(e) {
		const et = getEventType(e)
		if (et === 'touchend' || et === 'touchcancel') {
			setTimeout(() => {
				pressedByTouch.value = false
			}, 50)
		}
		dragType = ''
	}

	function applyPointer(e, type) {
		const pos = clientXY(e)
		const x = pos.x
		const y = pos.y
		if (type === 'sv') {
			const rect = rects.value.sv
			if (!rect || !rect.width) return
			const left = Math.min(rect.width, Math.max(0, x - rect.left))
			const top = Math.min(rect.height, Math.max(0, y - rect.top))
			svLeft.value = left
			svTop.value = top
			hsv.s = Math.round((left / rect.width) * 100)
			hsv.v = Math.round(100 - (top / rect.height) * 100)
		} else if (type === 'hue') {
			const rect = rects.value.hue
			if (!rect || !rect.width) return
			const left = Math.min(rect.width, Math.max(0, x - rect.left))
			hueLeft.value = left
			hsv.h = Math.round((left / rect.width) * 360)
		} else if (type === 'alpha') {
			const rect = rects.value.alpha
			if (!rect || !rect.width) return
			const left = Math.min(rect.width, Math.max(0, x - rect.left))
			alphaLeft.value = left
			alpha.value = Math.round((left / rect.width) * 100) / 100
		}
		syncDraft()
		emitRealtime()
	}

	onBeforeUnmount(() => {
		if (measureTimer) clearTimeout(measureTimer)
		if (tipTimer) clearTimeout(tipTimer)
		unlockPageScroll()
		// #ifdef H5
		if (mouseMoveHandler) document.removeEventListener('mousemove', mouseMoveHandler)
		if (mouseUpHandler) document.removeEventListener('mouseup', mouseUpHandler)
		// #endif
	})

	defineExpose({
		open,
		close
	})
</script>

<style lang="scss">
	.kex-cp {
		/* #ifndef APP-NVUE */
		display: inline-flex;
		/* #endif */
		flex-direction: row;
		align-items: center;
	}

	.kex-cp__trigger {
		/* #ifndef APP-NVUE */
		display: flex;
		/* #endif */
		flex-direction: row;
		align-items: center;
		justify-content: center;
	}

	.kex-cp__trigger--disabled {
		opacity: 0.45;
		/* #ifndef APP-NVUE */
		pointer-events: none;
		/* #endif */
	}

	.kex-cp__trigger--small .kex-cp__swatch-wrap {
		width: 52rpx;
		height: 52rpx;
	}

	.kex-cp__trigger--medium .kex-cp__swatch-wrap {
		width: 68rpx;
		height: 68rpx;
	}

	.kex-cp__trigger--large .kex-cp__swatch-wrap {
		width: 84rpx;
		height: 84rpx;
	}

	.kex-cp__swatch-wrap {
		position: relative;
		border-radius: 14rpx;
		border-width: 1px;
		border-style: solid;
		border-color: #e7e5e4;
		background-color: #ffffff;
		/* #ifndef APP-NVUE */
		display: flex;
		box-shadow: 0 2rpx 10rpx rgba(28, 25, 23, 0.06);
		overflow: hidden;
		/* #endif */
		flex-direction: row;
		align-items: center;
		justify-content: center;
	}

	.kex-cp__swatch {
		width: 70%;
		height: 70%;
		border-radius: 8rpx;
		border-width: 1px;
		border-style: solid;
		border-color: rgba(28, 25, 23, 0.12);
	}

	.kex-cp__chevron {
		position: absolute;
		right: 4rpx;
		bottom: 0;
		font-size: 16rpx;
		color: #a8a29e;
		line-height: 1;
	}

	.uh-footer-actions {
		box-sizing: border-box;
		padding-top: 28rpx;
	}

	/* #ifndef APP-NVUE */
	.kex-cp__portal {
		position: fixed;
		left: 0;
		right: 0;
		top: 0;
		bottom: 0;
		z-index: 10080;
	}

	.kex-cp__tip {
		position: absolute;
		left: 50%;
		top: 42%;
		transform: translate(-50%, -50%);
		z-index: 20;
		max-width: 70%;
		padding: 20rpx 36rpx;
		border-radius: 12rpx;
		background-color: rgba(28, 25, 23, 0.82);
		box-sizing: border-box;
		pointer-events: none;
	}

	.kex-cp__tip-text {
		font-size: 26rpx;
		color: #ffffff;
		line-height: 1.4;
		text-align: center;
	}

	.kex-cp__mask {
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		left: 0;
		background-color: rgba(28, 25, 23, 0.45);
		opacity: 0;
		transition: opacity 0.28s ease;
	}

	.kex-cp__mask--on {
		opacity: 1;
	}

	.kex-cp__sheet {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		max-height: 92vh;
		overflow-y: auto;
		background-color: #fafaf9;
		border-radius: 28rpx 28rpx 0 0;
		padding: 12rpx 28rpx 0;
		box-shadow: 0 -12rpx 40rpx rgba(28, 25, 23, 0.12);
		transform: translateY(100%);
		transition: transform 0.3s ease;
		box-sizing: border-box;
	}

	.kex-cp__sheet--on {
		transform: translateY(0);
	}

	.kex-cp__handle {
		width: 64rpx;
		height: 8rpx;
		border-radius: 8rpx;
		background-color: #d6d3d1;
		margin: 8rpx auto 12rpx;
	}

	.kex-cp__head {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 20rpx;
		gap: 16rpx;
	}

	.kex-cp__title {
		margin-top: 16rpx;
		width: 100%;
		font-size: 32rpx;
		font-weight: 650;
		color: #1c1917;
		text-align: center;
	}

	.kex-cp__preview-row {
		display: flex;
		flex-direction: row;
		align-items: center;
		margin-bottom: 24rpx;
	}

	.kex-cp__preview-card {
		flex: 1;
		margin-right: 20rpx;
	}

	.kex-cp__checker {
		background-color: #ffffff;
		background-image: linear-gradient(45deg, #e7e5e4 25%, transparent 25%),
			linear-gradient(-45deg, #e7e5e4 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, #e7e5e4 75%),
			linear-gradient(-45deg, transparent 75%, #e7e5e4 75%);
		background-size: 16rpx 16rpx;
		background-position: 0 0, 0 8rpx, 8rpx -8rpx, -8rpx 0;
		overflow: hidden;
	}

	.kex-cp__preview-board {
		height: 72rpx;
		border-radius: 16rpx;
		display: flex;
		flex-direction: row;
		border-width: 1px;
		border-style: solid;
		border-color: #e7e5e4;
	}

	.kex-cp__preview-half {
		flex: 1;
		height: 100%;
	}

	.kex-cp__preview-meta {
		height: 60rpx;
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		padding: 0 8rpx;
	}

	.kex-cp__preview-label {
		font-size: 20rpx;
		color: #a8a29e;
	}

	.kex-cp__preview-actions {
		display: flex;
		flex-direction: column;
	}

	.kex-cp__chip {
		flex: 1;
		padding: 10rpx 22rpx;
		border-radius: 16rpx;
		background-color: var(--wot-color-theme, #B9E424);
		min-width: 96rpx;
		text-align: center;
		/* #ifdef H5 */
		cursor: pointer;
		/* #endif */
	}

	.kex-cp__chip--ghost {
		background-color: #e7e5e4;
		margin-bottom: 0;
	}

	.kex-cp__chip-text {
		font-size: 28rpx;
		color: #111827;
		font-weight: 500;
	}

	.kex-cp__sv {
		position: relative;
		height: 320rpx;
		border-radius: 18rpx;
		overflow: hidden;
		margin-bottom: 28rpx;
		border-width: 1px;
		border-style: solid;
		border-color: rgba(28, 25, 23, 0.06);
	}

	.kex-cp__sv-white,
	.kex-cp__sv-black {
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		left: 0;
	}

	.kex-cp__sv-white {
		background-image: linear-gradient(to right, #ffffff, rgba(255, 255, 255, 0));
	}

	.kex-cp__sv-black {
		background-image: linear-gradient(to top, #000000, rgba(0, 0, 0, 0));
	}

	.kex-cp__pointer {
		position: absolute;
		width: 28rpx;
		height: 28rpx;
		margin-left: -14rpx;
		margin-top: -14rpx;
		border-radius: 50%;
		border-width: 3rpx;
		border-style: solid;
		border-color: #ffffff;
		box-shadow: 0 0 0 1px rgba(28, 25, 23, 0.25), 0 4rpx 12rpx rgba(28, 25, 23, 0.25);
		z-index: 2;
		box-sizing: border-box;
	}

	.kex-cp__slider {
		position: relative;
		height: 28rpx;
		border-radius: 28rpx;
		margin-bottom: 24rpx;
	}

	.kex-cp__hue-bar {
		width: 100%;
		height: 100%;
		border-radius: 28rpx;
		background-image: linear-gradient(to right,
				#ff0000 0%,
				#ffff00 17%,
				#00ff00 33%,
				#00ffff 50%,
				#0000ff 67%,
				#ff00ff 83%,
				#ff0000 100%);
	}

	.kex-cp__alpha {
		overflow: hidden;
		border-radius: 28rpx;
	}

	.kex-cp__alpha-checker {
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		left: 0;
		border-radius: 28rpx;
	}

	.kex-cp__alpha-bar {
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		left: 0;
		border-radius: 28rpx;
	}

	.kex-cp__knob {
		position: absolute;
		top: 50%;
		width: 36rpx;
		height: 36rpx;
		margin-left: -18rpx;
		margin-top: -18rpx;
		border-radius: 50%;
		background-color: #ffffff;
		border-width: 1px;
		border-style: solid;
		border-color: #e7e5e4;
		box-shadow: 0 2rpx 10rpx rgba(28, 25, 23, 0.18);
		z-index: 2;
		box-sizing: border-box;
	}

	.kex-cp__formats {
		display: flex;
		flex-direction: row;
		background-color: #e7e5e4;
		border-radius: 14rpx;
		padding: 4rpx;
		margin: 8rpx 0 16rpx;
	}

	.kex-cp__fmt {
		flex: 1;
		text-align: center;
		padding: 12rpx 0;
		border-radius: 12rpx;
		/* #ifdef H5 */
		cursor: pointer;
		/* #endif */
	}

	.kex-cp__fmt--on {
		background-color: #ffffff;
		box-shadow: 0 2rpx 8rpx rgba(28, 25, 23, 0.08);
	}

	.kex-cp__fmt-text {
		font-size: 22rpx;
		font-weight: 600;
		color: #111827;
	}

	.kex-cp__fmt--on .kex-cp__fmt-text {
		color: var(--wot-color-theme, #B9E424);
	}

	.kex-cp__inputs {
		display: flex;
		flex-direction: row;
	}

	.kex-cp__input {
		flex: 1;
		height: 68rpx;
		background-color: #ffffff;
		border-width: 1px;
		border-style: solid;
		border-color: #e7e5e4;
		border-radius: 12rpx;
		text-align: center;
		font-size: 26rpx;
		color: #1c1917;
		box-sizing: border-box;
		margin-right: 12rpx;
	}

	.kex-cp__input:last-child {
		margin-right: 0;
	}

	.kex-cp__input--wide {
		flex: 1;
		margin-right: 0;
	}

	.kex-cp__input-labels {
		display: flex;
		flex-direction: row;
		margin-top: 6rpx;
		margin-bottom: 8rpx;
	}

	.kex-cp__input-label {
		flex: 1;
		text-align: center;
		font-size: 20rpx;
		color: #a8a29e;
		margin-right: 12rpx;
	}

	.kex-cp__input-label:last-child {
		margin-right: 0;
	}

	.kex-cp__section {
		margin-top: 16rpx;
	}

	.kex-cp__section-title {
		display: block;
		font-size: 24rpx;
		font-weight: 600;
		color: #57534e;
		margin-bottom: 14rpx;
	}

	.kex-cp__dots {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
	}

	.kex-cp__dot-wrap {
		width: 52rpx;
		height: 52rpx;
		margin-right: 14rpx;
		margin-bottom: 14rpx;
		/* #ifdef H5 */
		cursor: pointer;
		/* #endif */
	}

	.kex-cp__dot-checker {
		width: 100%;
		height: 100%;
		border-radius: 12rpx;
		border-width: 1px;
		border-style: solid;
		border-color: #e7e5e4;
		overflow: hidden;
	}

	.kex-cp__dot {
		width: 100%;
		height: 100%;
	}

	.kex-cp__safe {
		height: 24rpx;
		height: calc(24rpx + constant(safe-area-inset-bottom));
		height: calc(24rpx + env(safe-area-inset-bottom));
	}

	/* #endif */
</style>