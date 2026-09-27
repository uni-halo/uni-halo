import checkAppUpdate from '@/uni_modules/uh-upgrade/utils/check-update'

/**
 * 检查微信小程序更新
 */
export function checkWxUpdate() {
  if (uni.canIUse('getUpdateManager')) {
    const updateManager = wx.getUpdateManager()
    updateManager && updateManager.onCheckForUpdate((res) => {
      if (res.hasUpdate) {
        updateManager.onUpdateReady(() => {
          uni.showModal({
            title: '更新提示',
            content: '新版本已经准备就绪，是否需要重新启动应用？',
            success: (res) => {
              if (res.confirm) {
                // 清除所有数据，需要重新登录
                uni.clearStorageSync()
                updateManager.applyUpdate()
              }
            },
          })
        })

        updateManager.onUpdateFailed(() => {
          uni.showModal({
            title: '已有新版本上线',
            content: '小程序自动更新失败，请删除该小程序后重新搜索打开哟~~~',
            showCancel: false,
          })
        })
      }
    })
  }
  else {
    uni.showModal({
      title: '提示',
      content: '当前微信版本过低，无法使用该功能，请更新到最新的微信后再重试。',
      showCancel: false,
    })
  }
}

/** 升级门闩:APP 端有升级弹窗时挂起,关闭后放行;天然规避"事件先于监听"的时序问题 */
let pendingUpgrade: Promise<void> | null = null

/** 检查应用更新(手动检查时对无更新/失败给出反馈) */
export function checkUpdates(manual = false) {
  // #ifdef MP
  checkWxUpdate()
  // #endif
  // #ifdef APP-PLUS
  pendingUpgrade = checkAppUpdate({ baseUrl: import.meta.env.VITE_SERVER_BASEURL })
    .then((res) => {
      if (manual && res && res.code === 0) {
        uni.showToast({ title: '当前已是最新版本', icon: 'none' })
      }
      return undefined
    })
    .catch((err) => {
      console.error('升级检测失败', err)
      if (manual) {
        uni.showToast({ title: '检查更新失败，请稍后重试', icon: 'none' })
      }
    })
  // #endif
}

/** 等待启动时的升级检查结束(无升级/检查失败时立即放行) */
export function waitForUpgradeCheck(): Promise<void> {
  // #ifdef APP-PLUS
  return pendingUpgrade ?? Promise.resolve()
  // #endif
  // #ifndef APP-PLUS
  return Promise.resolve()
  // #endif
}
