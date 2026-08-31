/**
 * 检查更新工具(源自旧项目 uni_modules/uhalo-upgrade/utils/check-update.ts,新建复刻)
 * 业务侧调用 uni-halo 的 checkVersion 接口,有新版时弹窗提示并下载安装(APP 端)
 * 使用方式:App.vue onLaunch 中调用 checkUpdate(import.meta.env.VITE_SERVER_BASEURL)
 */
import { checkVersion } from '@/api/uni-halo'
import type { IUpdateCheckRes } from '@/api/types/uni-halo'

/** 升级弹窗(uni.showModal 实现,不依赖 uni_modules 弹窗页) */
function updateUseModal(packageInfo: IUpdateCheckRes): void {
  // #ifdef APP
  const {
    title = '版本更新',
    contents = '检测到新版本,是否立即更新?',
    is_mandatory = false,
    url = '',
    type,
    platform = [],
  } = packageInfo

  if (!url) {
    console.error('更新地址为空,无法更新', packageInfo)
    return
  }

  const isWGT = type === 'wgt'
  const isiOS = !isWGT && platform.includes('ios')
  const confirmText = isiOS ? '立即跳转更新' : '立即下载更新'

  uni.showModal({
    title,
    content: contents,
    showCancel: !is_mandatory,
    confirmText,
    success: (res) => {
      if (res.cancel)
        return

      if (isiOS) {
        // iOS 平台跳转 AppStore
        plus.runtime.openURL(url)
        return
      }

      uni.showToast({
        title: '后台下载中……',
        duration: 1000,
      })

      // wgt 和安卓下载更新
      uni.downloadFile({
        url,
        success: (res) => {
          if (res.statusCode !== 200) {
            console.error('下载安装包失败')
            return
          }
          // 下载好直接安装,下次启动生效
          plus.runtime.install(res.tempFilePath, {
            force: false,
          }, () => {
            if (is_mandatory) {
              // 强制更新:安装成功后重启 app
              // #ifdef APP-PLUS
              plus.runtime.restart()
              // #endif
              // #ifdef APP-HARMONY
              uni.showModal({
                title: '安装成功',
                content: '请手动重启应用',
                showCancel: false,
                success: () => {
                  plus.runtime.quit()
                },
              })
              // #endif
              return
            }
            uni.showModal({
              title: '安装成功是否重启？',
              success: (r) => {
                if (r.confirm) {
                  // #ifdef APP-PLUS
                  plus.runtime.restart()
                  // #endif
                  // #ifdef APP-HARMONY
                  plus.runtime.quit()
                  // #endif
                }
              },
            })
          }, (err) => {
            uni.showModal({
              title: '更新失败',
              content: (err as Error).message,
              showCancel: false,
            })
          })
        },
      })
    },
  })
  // #endif
}

/**
 * 检查更新并处理升级
 * @param baseUrl Halo 站点地址
 * @returns 检查结果(code > 0 有更新,code === 0 无更新,code < 0 检查失败)
 */
export async function checkUpdate(baseUrl: string): Promise<IUpdateCheckRes> {
  try {
    const res = await checkVersion(baseUrl)
    const body = res.data || (res as unknown as IUpdateCheckRes)
    const code = Number(body.code || 0)

    // 静默更新(仅 wgt 热更新,后台下载安装)
    if (code > 0 && body.is_silently) {
      // #ifdef APP
      if (body.url) {
        uni.downloadFile({
          url: body.url,
          success: (r) => {
            if (r.statusCode === 200) {
              plus.runtime.install(r.tempFilePath, {
                force: false,
              })
            }
          },
        })
      }
      // #endif
      return body
    }

    if (code > 0) {
      updateUseModal(body)
    }
    else if (code < 0) {
      console.error('检查更新失败', body.message)
    }
    return body
  }
  catch (err) {
    console.error('检查更新异常', err)
    return { code: -1, message: (err as Error).message || '检查更新失败' }
  }
}
