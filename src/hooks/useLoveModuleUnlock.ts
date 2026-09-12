/**
 * 恋爱模块解锁流程(供 love 页 / 首页快捷导航 / 我的页 / 三模块页共用):
 * - path → moduleKey 判定(插件端下发 path 前缀匹配,兼容带 query)
 * - 锁定判定(passwordEnabled && 本地无有效 token)
 * - 解锁弹窗状态 + 解锁请求 + 成功回调(存 token,可配置跳转)
 */
import { computed, ref } from 'vue'
import { unlockLoveModule, type ICaptchaQuery } from '@/api/uni-halo'
import { getLoveModuleToken, setLoveModuleToken, type LoveModuleKey } from '@/utils/loveModuleToken'
import { useAppConfigStore } from '@/store/appConfig'
import type { ILoveModuleConfig } from '@/api/types/uni-halo'

/** 恋爱模块 path 前缀 → moduleKey(与插件端下发 path 约定一致) */
const LOVE_MODULE_PATH_MAP: Array<{ key: LoveModuleKey; pathPrefix: string }> = [
	{ key: 'loveDiary', pathPrefix: '/pages-blog/love/love' },
	{ key: 'ourStory', pathPrefix: '/pages-blog/love/stories' },
	{ key: 'lovePhoto', pathPrefix: '/pages-blog/love/album' },
	{ key: 'loveDaily', pathPrefix: '/pages-blog/love/list' },
]

/** 由跳转 path 反查恋爱模块 key(非恋爱模块路径返回 undefined) */
export function getLoveModuleKeyByPath(path: string): LoveModuleKey | undefined {
	return LOVE_MODULE_PATH_MAP.find(item => path.startsWith(item.pathPrefix))?.key
}

export function useLoveModuleUnlock(options?: {
	/** 解锁成功(已存 token)后的回调,如刷新配置/恢复数据加载 */
	onUnlocked?: (moduleKey: LoveModuleKey) => void
}) {
	const appConfigStore = useAppConfigStore()
	const loveConfig = computed(() => appConfigStore.configs.loveConfig)

	/* ---------------- 弹窗状态 ---------------- */
	const unlockModalVisible = ref(false)
	/** 待解锁模块 */
	const pendingModule = ref<LoveModuleKey>('loveDiary')
	/** 解锁成功后跳转路径(空则不跳转) */
	const pendingPath = ref('')

	const unlockTip = computed(() => {
		const moduleCfg = getModuleConfig(pendingModule.value)
		const tip = moduleCfg?.title || ''
		return `${tip}已设置访问密码，输入后进入`
	})

	/** 恋爱模块配置读取(入口与三模块共用字段;loveDiary 仅密码状态) */
	function getModuleConfig(moduleKey: LoveModuleKey): ILoveModuleConfig | undefined {
		return (loveConfig.value as unknown as Record<string, ILoveModuleConfig | undefined>)[moduleKey]
	}

	/** 模块是否锁定:设了密码且本地无有效 token */
	function isModuleLocked(moduleKey: LoveModuleKey): boolean {
		return !!getModuleConfig(moduleKey)?.passwordEnabled && !getLoveModuleToken(moduleKey)
	}

	/** 打开解锁弹窗(path 用于解锁成功后跳转,空则不跳) */
	function openUnlock(moduleKey: LoveModuleKey, path = '') {
		pendingModule.value = moduleKey
		pendingPath.value = path
		unlockModalVisible.value = true
	}

	/** 通用解锁请求:unlock 签发 token(插件端要求验证码,403 附新码由弹窗展示重试) */
	async function handleUnlockRequest(password: string, captcha?: ICaptchaQuery | null) {
		const res = await unlockLoveModule(pendingModule.value, password, captcha)
		return res.data as { token?: string, [key: string]: unknown } | null | undefined
	}

	/** 解锁成功:存 token → 回调 → 按配置跳转 */
	function handleUnlockSuccess(data: { token?: string }) {
		if (!data.token) {
			uni.showToast({ icon: 'none', title: '解锁失败，请重试' })
			return
		}
		setLoveModuleToken(pendingModule.value, data.token)
		options?.onUnlocked?.(pendingModule.value)
		if (pendingPath.value) {
			uni.navigateTo({ url: pendingPath.value })
		}
	}

	/** 跳转拦截:命中恋爱模块且锁定 → 弹窗并返回 true(调用方不再跳转) */
	function interceptNavigateByPath(path: string): boolean {
		const moduleKey = getLoveModuleKeyByPath(path)
		if (moduleKey && isModuleLocked(moduleKey)) {
			openUnlock(moduleKey, path)
			return true
		}
		return false
	}

	return {
		unlockModalVisible,
		pendingModule,
		unlockTip,
		isModuleLocked,
		openUnlock,
		handleUnlockRequest,
		handleUnlockSuccess,
		interceptNavigateByPath,
	}
}
