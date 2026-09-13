export type StoreListItem = {
	enable : boolean
	id : string
	name : string
	scheme : string
	priority : number // 优先级
}

export type UniUpgradeCenterResult = {
	_id : string
	appid : string
	name : string
	title : string
	contents : string
	url : string // 安装包下载地址
	platform : Array<string> // Array<'Android' | 'iOS' | 'Harmony'>
	version : string // 版本号 1.0.0
	uni_platform : string // "android" | "ios" | 'harmony'
	stable_publish : boolean // 是否是稳定版
	is_mandatory : boolean // 是否强制更新
	is_silently : boolean | null	// 是否静默更新
	create_env : string // "upgrade-center"
	create_date : number
	message : string
	code : number

	type : string // "native_app" | "wgt"
	store_list : StoreListItem[] | null
	min_uni_version : string | null  // 升级 wgt 的最低 uni-app 版本
}

/**
 * Halo 插件（uni-halo-plugin）公开的 checkVersion 接口路径，
 * 由调用方传入的 baseUrl（Halo 站点地址）拼接而成
 */
const CHECK_VERSION_API = '/apis/api.unihalo.ialley.cn/v1alpha1/plugins/uni-halo-plugin/upgrade/checkVersion'

/**
 * 拼接完整的 checkVersion 请求地址，自动去除 baseUrl 末尾多余的斜杠
 */
function buildCheckUrl(baseUrl : string) : string {
	let url = baseUrl
	while (url.endsWith('/')) {
		url = url.substring(0, url.length - 1)
	}
	return url + CHECK_VERSION_API
}

/**
 * 将 uni.getSystemInfoSync().platform 归一化为后端识别的平台名（Android/iOS/Harmony），
 * 无法识别时返回空字符串（后端会按 User-Agent 自行推导）
 */
function normalizePlatform(platform : string) : string {
	const p = platform.toLowerCase()
	if (p.indexOf('ios') !== -1) {
		return 'iOS'
	}
	if (p.indexOf('android') !== -1) {
		return 'Android'
	}
	if (p.indexOf('harmony') !== -1) {
		return 'Harmony'
	}
	return ''
}

/**
 * 检测升级（uhalo 版）
 * 原 uni-upgrade-center-app 通过 uniCloud.callFunction 调用云函数，
 * 本插件改为 HTTP GET 请求 Halo 插件的 checkVersion 接口。
 * uni_modules 插件无法直接读取项目配置文件，因此 baseUrl 必须由调用方传入。
 * @param baseUrl Halo 站点地址，如 HaloTokenConfig.BASE_API（域名后不能带斜杠）
 */
export default function (baseUrl : string) : Promise<UniUpgradeCenterResult> {
	// #ifdef APP
	return new Promise<UniUpgradeCenterResult>((resolve, reject) => {
		if (!baseUrl) {
			reject('【uhalo-upgrade】未传入 baseUrl，无法检测升级。请调用 checkUpdate(baseUrl) 时传入 Halo 站点地址')
			return
		}
		const systemInfo = uni.getSystemInfoSync()
		const appId = systemInfo.appId
		const appVersion = systemInfo.appVersion //systemInfo.appVersion
		const platform = typeof systemInfo.platform === 'string' ? normalizePlatform(systemInfo.platform) : ''
		const checkUrl = buildCheckUrl(baseUrl)
		if (typeof appId === 'string' && typeof appVersion === 'string' && appId.length > 0 && appVersion.length > 0) {
			plus.runtime.getProperty(appId, function (widgetInfo) {
				if (widgetInfo.version) {
					uni.request({
						url: checkUrl,
						method: 'GET',
						data: {
							appid: appId,
							appVersion: appVersion,
							wgtVersion: widgetInfo.version,
							platform: platform
						},
						success: (e) => {
							resolve(e.data as UniUpgradeCenterResult)
						},
						fail: (error) => {
							reject(error)
						}
					})
				} else {
					reject('widgetInfo.version is EMPTY')
				}
			})
		} else {
			reject('plus.runtime.appid is EMPTY')
		}
	})
	// #endif
	// #ifndef APP
	return new Promise((resolve, reject) => {
		reject({
			message: '请在App中使用'
		})
	})
	// #endif
}
