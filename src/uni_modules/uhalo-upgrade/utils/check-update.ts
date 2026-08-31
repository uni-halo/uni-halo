import callCheckVersion, { UniUpgradeCenterResult } from "./call-check-version"
import { platform_iOS } from './utils'

// 推荐再App.vue中使用
const PACKAGE_INFO_KEY = '__package_info__'

/**
 * 升级检测实现(提取为内部函数:条件编译双函数声明共享函数体时 TS 无法解析,统一走这里)
 * @param baseUrl Halo 站点地址
 * @param component HarmonyOS Next 平台组件
 */
function checkUpdateImpl(baseUrl: string, component?: any) : Promise<UniUpgradeCenterResult> {
	return new Promise<UniUpgradeCenterResult>((resolve, reject) => {
		callCheckVersion(baseUrl).then((uniUpgradeCenterResult) => {
			// NOTE uni-app x 3.96 解构有问题
			const code = uniUpgradeCenterResult.code
			const message = uniUpgradeCenterResult.message
        // uhalo 版：url 为 Halo 附件直链，无需获取临时链接，下载与安装由升级弹窗处理
        // 此处逻辑仅为示例，可自行编写
        if (code > 0) {

          /**
           * 提示升级一
           * 使用 uni.showModal
           */
          // return updateUseModal(uniUpgradeCenterResult)

          // 静默更新，只有wgt有
          if (uniUpgradeCenterResult.is_silently) {
            uni.downloadFile({
              url: uniUpgradeCenterResult.url,
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
           * 提示升级二
           * 官方适配的升级弹窗，可自行替换资源适配UI风格
           */
          // #ifdef APP-PLUS
          uni.setStorageSync(PACKAGE_INFO_KEY, uniUpgradeCenterResult)
          uni.navigateTo({
            url: `/uni_modules/uhalo-upgrade/pages/upgrade-popup?local_storage_key=${PACKAGE_INFO_KEY}`,
            fail: (err) => {
              console.error('更新弹框跳转失败', err)
              uni.removeStorageSync(PACKAGE_INFO_KEY)
            }
          })
          // #endif
          // #ifdef APP-HARMONY
          if (component) {
            component.show(true, uniUpgradeCenterResult)
          } else {
            reject({
              code: -1,
              message: '在 HarmonyOS Next 平台请传递组件使用'
            })
          }
          // #endif

          return resolve(uniUpgradeCenterResult)
        } else if (code < 0) {
          console.error(message)
          return reject(uniUpgradeCenterResult)
        }
        return resolve(uniUpgradeCenterResult)
            }).catch((err) => {
              reject(err)
            })
          });
        }

      // 平台差异仅在参数传法上:Harmony 传 (component, baseUrl),其余传 (baseUrl)
      export default function (a?: any, b?: any) : Promise<UniUpgradeCenterResult> {
        // #ifdef APP-HARMONY
        return checkUpdateImpl(b || '', a)
        // #endif
        // #ifndef APP-HARMONY
        return checkUpdateImpl(a)
        // #endif
      }

      /**
       * 使用 uni.showModal 升级
       */
function updateUseModal(packageInfo : UniUpgradeCenterResult) : void {
	// #ifdef APP
	const {
		title, // 标题
		contents, // 升级内容
		is_mandatory, // 是否强制更新
		url, // 安装包下载地址
		type,
		platform
	} = packageInfo;

	let isWGT = type === 'wgt'
	let isiOS = !isWGT ? platform.includes(platform_iOS) : false;

	let confirmText = isiOS ? '立即跳转更新' : '立即下载更新'

	uni.showModal({
      title,
      content: contents,
      showCancel: !is_mandatory,
      confirmText,
      success: res => {
        if (res.cancel) return;

			if (isiOS) {
				// iOS 平台跳转 AppStore
				plus.runtime.openURL(url);
				return;
			}

        uni.showToast({
          title: '后台下载中……',
          duration: 1000
        });

			// wgt 和 安卓下载更新
			uni.downloadFile({
				url,
				success: res => {
					if (res.statusCode !== 200) {
						console.error('下载安装包失败');
						return;
					}
					// 下载好直接安装，下次启动生效
					plus.runtime.install(res.tempFilePath, {
						force: false
					}, () => {
						if (is_mandatory) {
							//更新完重启app
							// #ifdef APP-PLUS
							plus.runtime.restart();
							// #endif
							// #ifdef APP-HARMONY
							uni.showModal({
								title: '安装成功',
								content: '请手动重启应用',
								showCancel: false,
								success: res => {
									plus.runtime.quit();
								}
							});
							// #endif
							return;
						}
						uni.showModal({
							title: '安装成功是否重启？',
							success: res => {
								if (res.confirm) {
									//更新完重启app
									// #ifdef APP-PLUS
									plus.runtime.restart();
									// #endif
									// #ifdef APP-HARMONY
									plus.runtime.quit();
									// #endif
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
	// #endif
}
