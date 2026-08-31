/**
 * 网络状态工具(源自旧项目 utils/network.js,按需命名导出)
 * 网络可用性检查、断网提示、错误文案处理
 */

/**
 * 检查网络是否可用(返回 Promise<boolean>)
 */
export function CheckNetWork(): Promise<boolean> {
  return new Promise((resolve) => {
    uni.getNetworkType({
      success: (res) => {
        if (res.networkType === 'none') {
          uni.showToast({ icon: 'none', title: '当前网络不可用,请检查您的网络设置' })
          resolve(false)
        }
        else {
          resolve(true)
        }
      },
      fail: () => {
        uni.showToast({ icon: 'none', title: '当前网络不可用,请检查您的网络设置' })
        resolve(false)
      },
    })
  })
}

/**
 * 处理请求错误文案
 * @param error 错误对象或字符串
 * @param defaultText 默认文案
 */
export function handleErrorMessage(error: unknown, defaultText = '请求失败,请重试!'): string {
  if (typeof error === 'string')
    return error
  if (error instanceof Error)
    return error.message || defaultText
  return defaultText
}
