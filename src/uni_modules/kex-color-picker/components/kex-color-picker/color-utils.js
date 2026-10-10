/**
 * kex-color-picker 颜色工具（自包含，不依赖业务工程 libs）
 */

export const DEFAULT_PRESETS = [
	'#E11D48',
	'#EA580C',
	'#CA8A04',
	'#16A34A',
	'#0D9488',
	'#0284C7',
	'#4F46E5',
	'#9333EA',
	'#DB2777',
	'#1C1917',
	'#57534E',
	'#A8A29E',
	'#FFFFFF',
	'#00000000'
]

function clamp(n, min, max) {
	return Math.min(max, Math.max(min, n))
}

function toNum(v, fallback = 0) {
	const n = parseFloat(String(v).replace('%', ''))
	return Number.isFinite(n) ? n : fallback
}

function pad2(n) {
	const s = clamp(Math.round(n), 0, 255).toString(16)
	return s.length === 1 ? '0' + s : s
}

export function rgbToHex(r, g, b, a) {
	const hex = '#' + pad2(r) + pad2(g) + pad2(b)
	if (a === undefined || a === null || a >= 1) return hex.toUpperCase()
	const alpha = pad2(Math.round(clamp(a, 0, 1) * 255))
	return (hex + alpha).toUpperCase()
}

export function hexToRgba(hex) {
	if (!hex || typeof hex !== 'string') return null
	let s = hex.trim().replace(/^#/, '')
	if (s.length === 3) {
		s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2]
	}
	if (s.length === 4) {
		s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]
	}
	if (s.length !== 6 && s.length !== 8) return null
	if (!/^[0-9a-fA-F]+$/.test(s)) return null
	const r = parseInt(s.slice(0, 2), 16)
	const g = parseInt(s.slice(2, 4), 16)
	const b = parseInt(s.slice(4, 6), 16)
	const a = s.length === 8 ? parseInt(s.slice(6, 8), 16) / 255 : 1
	return { r, g, b, a: Math.round(a * 100) / 100 }
}

export function rgbToHsv(r, g, b) {
	r /= 255
	g /= 255
	b /= 255
	const max = Math.max(r, g, b)
	const min = Math.min(r, g, b)
	const d = max - min
	let h = 0
	const s = max === 0 ? 0 : d / max
	const v = max
	if (d !== 0) {
		switch (max) {
			case r:
				h = ((g - b) / d + (g < b ? 6 : 0)) / 6
				break
			case g:
				h = ((b - r) / d + 2) / 6
				break
			default:
				h = ((r - g) / d + 4) / 6
		}
	}
	return {
		h: Math.round(h * 360),
		s: Math.round(s * 100),
		v: Math.round(v * 100)
	}
}

export function hsvToRgb(h, s, v) {
	h = clamp(toNum(h), 0, 360)
	s = clamp(toNum(s), 0, 100) / 100
	v = clamp(toNum(v), 0, 100) / 100
	const hi = Math.floor(h / 60) % 6
	const f = h / 60 - Math.floor(h / 60)
	const p = v * (1 - s)
	const q = v * (1 - f * s)
	const t = v * (1 - (1 - f) * s)
	const map = [
		[v, t, p],
		[q, v, p],
		[p, v, t],
		[p, q, v],
		[t, p, v],
		[v, p, q]
	][hi]
	return {
		r: Math.round(map[0] * 255),
		g: Math.round(map[1] * 255),
		b: Math.round(map[2] * 255)
	}
}

export function rgbToHsl(r, g, b) {
	r /= 255
	g /= 255
	b /= 255
	const max = Math.max(r, g, b)
	const min = Math.min(r, g, b)
	const l = (max + min) / 2
	let h = 0
	let s = 0
	if (max !== min) {
		const d = max - min
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0)
				break
			case g:
				h = (b - r) / d + 2
				break
			default:
				h = (r - g) / d + 4
		}
		h /= 6
	}
	return {
		h: Math.round(h * 360),
		s: Math.round(s * 100),
		l: Math.round(l * 100)
	}
}

function hue2rgb(p, q, t) {
	let tt = t
	if (tt < 0) tt += 1
	if (tt > 1) tt -= 1
	if (tt < 1 / 6) return p + (q - p) * 6 * tt
	if (tt < 1 / 2) return q
	if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
	return p
}

export function hslToRgb(h, s, l) {
	h = clamp(toNum(h), 0, 360) / 360
	s = clamp(toNum(s), 0, 100) / 100
	l = clamp(toNum(l), 0, 100) / 100
	if (s === 0) {
		const v = Math.round(l * 255)
		return { r: v, g: v, b: v }
	}
	const q = l < 0.5 ? l * (1 + s) : l + s - l * s
	const p = 2 * l - q
	return {
		r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
		g: Math.round(hue2rgb(p, q, h) * 255),
		b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
	}
}

function parseFunc(str) {
	const m = String(str).trim().match(/^([a-zA-Z]+)\((.+)\)$/)
	if (!m) return null
	const name = m[1].toLowerCase()
	const parts = m[2].split(/[\s,\/]+/).filter(Boolean)
	return { name, parts }
}

/**
 * 解析任意常见颜色字符串 → { r,g,b,a }
 */
export function parseColor(input) {
	if (input == null || input === '') {
		return { r: 13, g: 148, b: 136, a: 1 }
	}
	if (typeof input === 'object' && input.r != null) {
		return {
			r: clamp(Math.round(toNum(input.r)), 0, 255),
			g: clamp(Math.round(toNum(input.g)), 0, 255),
			b: clamp(Math.round(toNum(input.b)), 0, 255),
			a: clamp(toNum(input.a, 1), 0, 1)
		}
	}
	const raw = String(input).trim()
	if (raw.startsWith('#')) {
		return hexToRgba(raw) || { r: 13, g: 148, b: 136, a: 1 }
	}
	const fn = parseFunc(raw)
	if (!fn) {
		return hexToRgba('#' + raw) || { r: 13, g: 148, b: 136, a: 1 }
	}
	const { name, parts } = fn
	if (name === 'rgb' || name === 'rgba') {
		return {
			r: clamp(Math.round(toNum(parts[0])), 0, 255),
			g: clamp(Math.round(toNum(parts[1])), 0, 255),
			b: clamp(Math.round(toNum(parts[2])), 0, 255),
			a: parts[3] != null ? clamp(toNum(parts[3]), 0, 1) : 1
		}
	}
	if (name === 'hsl' || name === 'hsla') {
		const rgb = hslToRgb(parts[0], parts[1], parts[2])
		return {
			...rgb,
			a: parts[3] != null ? clamp(toNum(parts[3]), 0, 1) : 1
		}
	}
	if (name === 'hsv' || name === 'hsb') {
		const rgb = hsvToRgb(parts[0], parts[1], parts[2])
		return {
			...rgb,
			a: parts[3] != null ? clamp(toNum(parts[3]), 0, 1) : 1
		}
	}
	return { r: 13, g: 148, b: 136, a: 1 }
}

/**
 * 按 format 输出颜色字符串
 */
export function formatColor(rgba, format = 'hex', withAlpha = true) {
	const r = clamp(Math.round(rgba.r), 0, 255)
	const g = clamp(Math.round(rgba.g), 0, 255)
	const b = clamp(Math.round(rgba.b), 0, 255)
	const a = clamp(Number(rgba.a == null ? 1 : rgba.a), 0, 1)
	const aStr = String(Math.round(a * 100) / 100)
	const fmt = String(format || 'hex').toLowerCase()

	if (fmt === 'rgb') {
		return withAlpha && a < 1
			? `rgba(${r}, ${g}, ${b}, ${aStr})`
			: `rgb(${r}, ${g}, ${b})`
	}
	if (fmt === 'rgba') {
		return `rgba(${r}, ${g}, ${b}, ${aStr})`
	}
	if (fmt === 'hsl' || fmt === 'hsla') {
		const hsl = rgbToHsl(r, g, b)
		if ((fmt === 'hsla' || withAlpha) && a < 1) {
			return `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${aStr})`
		}
		return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`
	}
	if (fmt === 'hsv' || fmt === 'hsb') {
		const hsv = rgbToHsv(r, g, b)
		return `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)`
	}
	// hex
	return rgbToHex(r, g, b, withAlpha ? a : 1)
}

export function rgbaCss(rgba) {
	const a = rgba.a == null ? 1 : rgba.a
	return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${a})`
}

export function hueCss(h) {
	const rgb = hsvToRgb(h, 100, 100)
	return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
}
