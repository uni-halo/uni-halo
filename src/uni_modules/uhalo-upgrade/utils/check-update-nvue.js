function callCheckVersion(baseUrl) {
	// #ifdef APP-PLUS
	return new Promise((resolve, reject) => {
		if (!baseUrl) {
			reject('【uhalo-upgrade】未传入 baseUrl，无法检测升级。请调用 checkUpdate(baseUrl) 时传入 Halo 站点地址')
			return
		}
		const checkUrl = baseUrl.replace(/\/+$/, '') + '/apis/api.unihalo.ialley.cn/v1alpha1/upgrade/checkVersion'
		plus.runtime.getProperty(plus.runtime.appid, function(widgetInfo) {
			uni.request({
				url: checkUrl,
				method: 'GET',
				data: {
					appid: plus.runtime.appid,
					appVersion: plus.runtime.version,
					wgtVersion: widgetInfo.version
				},
				success: (e) => {
					resolve(e.data)
				},
				fail: (error) => {
					reject(error)
				}
			})
		})
	})
	// #endif
	// #ifndef APP-PLUS
	return new Promise((resolve, reject) => {})
	// #endif
}

// 推荐再App.vue中使用
const PACKAGE_INFO_KEY = '__package_info__'

export default function(baseUrl) {
	// #ifdef APP-PLUS
	return new Promise((resolve, reject) => {
		callCheckVersion(baseUrl).then((result) => {
			if (!result) return;
			const {
				code,
				message,
				is_silently, // 是否静默更新
				url, // 安装包下载地址
				platform, // 安装包平台
				type // 安装包类型
			} = result;

			// uhalo 版：url 为 Halo 附件直链，无需获取临时链接
			// 此处逻辑仅为实例，可自行编写
			if (code > 0) {
				resolve(result)

				// 静默更新，只有wgt有
				if (is_silently) {
					uni.downloadFile({
						url: result.url,
						success: res => {
							if (res.statusCode == 200) {
								// 下载好直接安装，下次启动生效
								plus.runtime.install(res.tempFilePath, {
									force: false
								});
							}
						}
					});
					return;
				}

				/**
				 * 提示升级一
				 * 使用 uni.showModal
				 */
				// return updateUseModal(result)

				/**
				 * 提示升级二
				 * 官方适配的升级弹窗，可自行替换资源适配UI风格
				 */
				uni.setStorageSync(PACKAGE_INFO_KEY, result)
				uni.navigateTo({
					url: `/uni_modules/uhalo-upgrade/pages/upgrade-popup?local_storage_key=${PACKAGE_INFO_KEY}`,
					fail: (err) => {
						console.error('更新弹框跳转失败', err)
						uni.removeStorageSync(PACKAGE_INFO_KEY)
					}
				})
				
				return
			} else if (code < 0) {
				// TODO 接口报错处理
				console.error(message)
				return reject(result)
			}
			return resolve(result)
		}).catch(err => {
			// TODO 接口报错处理
			console.error(err.message)
			reject(err)
		})
	});
	// #endif
}

/**
 * 使用 uni.showModal 升级
 */
function updateUseModal(packageInfo) {
	const {
		title, // 标题
		contents, // 升级内容
		is_mandatory, // 是否强制更新
		url, // 安装包下载地址
		platform, // 安装包平台
		type // 安装包类型
	} = packageInfo;

	let isWGT = type === 'wgt'
	let isiOS = !isWGT ? platform.includes('iOS') : false;
	let confirmText = isiOS ? '立即跳转更新' : '立即下载更新'

	return uni.showModal({
		title,
		content: contents,
		showCancel: !is_mandatory,
		confirmText,
		success: res => {
			if (res.cancel) return;

			// 安装包下载
			if (isiOS) {
				plus.runtime.openURL(url);
				return;
			}

			uni.showToast({
				title: '后台下载中……',
				duration: 1000
			});

			// wgt 和 安卓下载更新
			downloadTask = uni.downloadFile({
				url,
				success: res => {
					if (res.statusCode !== 200) {
						console.error('下载安装包失败', err);
						return;
					}
					// 下载好直接安装，下次启动生效
					plus.runtime.install(res.tempFilePath, {
						force: false
					}, () => {
						if (is_mandatory) {
							//更新完重启app
							plus.runtime.restart();
							return;
						}
						uni.showModal({
							title: '安装成功是否重启？',
							success: res => {
								if (res.confirm) {
									//更新完重启app
									plus.runtime.restart();
								}
							}
						});
					}, err => {
						uni.showModal({
							title: '更新失败',
							content: err
								.message,
							showCancel: false
						});
					});
				}
			});
		}
	});
}
