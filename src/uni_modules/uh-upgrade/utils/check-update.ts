import callCheckVersion, { UniUpgradeCenterResult } from "./call-check-version"
import { compare, platform_iOS } from './index'

// 推荐在App.vue中使用
const PACKAGE_INFO_KEY = '__package_info__'

export type CheckUpdateOptions = {
  /** Halo 站点地址（域名后不带斜杠） */
  baseUrl: string
  /** HarmonyOS Next 平台弹窗组件 */
  component?: any
  /** 使用 uni.showModal 提示升级（默认 false，走升级弹窗页面） */
  useModal?: boolean
}

/**
 * 升级检测实现(提取为内部函数:条件编译双函数声明共享函数体时 TS 无法解析,统一走这里)
 * @param options 升级检测参数
 */
function checkUpdateImpl(options: CheckUpdateOptions): Promise<UniUpgradeCenterResult> {
  const { baseUrl, component, useModal } = options
  return new Promise<UniUpgradeCenterResult>((resolve, reject) => {
    callCheckVersion(baseUrl).then((uniUpgradeCenterResult) => {
      // NOTE uni-app x 3.96 解构有问题
      const code = uniUpgradeCenterResult.code
      const message = uniUpgradeCenterResult.message
      // 客户端兜底：服务端判定有更新时，本地复核版本号确实大于当前版本才弹窗
      if (code > 0 && !verifyUpgrade(uniUpgradeCenterResult)) {
        return resolve({ ...uniUpgradeCenterResult, code: 0, message: '当前版本已经是最新的，不需要更新' })
      }
      if (code > 0) {

        /**
         * 提示升级一
         * 使用 uni.showModal
         */
        if (useModal) {
          return updateUseModal(uniUpgradeCenterResult)
        }

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
          url: `/uni_modules/uh-upgrade/pages/upgrade-popup?local_storage_key=${PACKAGE_INFO_KEY}`,
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

// 客户端复核服务端的升级判定：wgt 需满足 min_uni_version，且库版本须大于当前版本
function verifyUpgrade(result: UniUpgradeCenterResult): boolean {
  const systemInfo = uni.getSystemInfoSync()
  const appVersion = typeof systemInfo.appVersion === 'string' ? systemInfo.appVersion : '0'
  if (result.type === 'wgt' && result.min_uni_version && compare(result.min_uni_version, appVersion) === 1) {
    return false
  }
  return compare(result.version, appVersion) === 1
}

// 平台差异仅在参数传法上:Harmony 由 options.component 传组件,其余仅用 options.baseUrl
export default function (options: CheckUpdateOptions): Promise<UniUpgradeCenterResult> {
  // #ifdef APP-HARMONY
  if (!options.component) {
    return Promise.reject({
      code: -1,
      message: '在 HarmonyOS Next 平台请传递组件使用'
    })
  }
  // #endif
  return checkUpdateImpl(options)
}

/**
 * 使用 uni.showModal 升级
 */
function updateUseModal(packageInfo: UniUpgradeCenterResult): void {
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
