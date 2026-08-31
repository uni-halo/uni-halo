/**
 * 统一弹窗工具(源自旧项目 js_sdk/fy-showModal,改 utils 按需导出)
 * 新架构简单场景直接用 uni.showModal + Promise 包装;需要统一视觉时用 wot-ui wd-dialog/wd-message-box
 * 替代旧项目的 uni.$eShowModal 全局挂载
 */
import { isWechat } from './platform'

export interface IShowModalOptions {
  title?: string
  content?: string
  showCancel?: boolean
  cancelText?: string
  cancelColor?: string
  confirmText?: string
  confirmColor?: string
  editable?: boolean
  placeholderText?: string
}

export interface IShowModalResult {
  confirm: boolean
  cancel: boolean
  content?: string
}

/**
 * 统一弹窗(Promise 化 uni.showModal)
 * @param options 弹窗配置
 * @returns Promise<IShowModalResult>
 */
export function eShowModal(options: IShowModalOptions): Promise<IShowModalResult> {
  return new Promise((resolve) => {
    const {
      title = '提示',
      content = '',
      showCancel = false,
      cancelText = '取消',
      cancelColor = '#999999',
      confirmText = '确定',
      confirmColor = '#03a9f4',
      editable = false,
      placeholderText = '',
    } = options

    uni.showModal({
      title,
      content,
      showCancel,
      cancelText,
      cancelColor,
      confirmText,
      confirmColor,
      editable,
      placeholderText,
      success: (res) => {
        resolve({
          confirm: res.confirm,
          cancel: res.cancel,
          content: res.content || '',
        })
      },
      fail: () => {
        resolve({ confirm: false, cancel: true })
      },
    })
  })
}

/**
 * 确认弹窗(快捷方法)
 * @param content 提示内容
 * @param title 标题
 */
export async function confirmModal(content: string, title = '提示'): Promise<boolean> {
  const res = await eShowModal({
    title,
    content,
    showCancel: true,
    cancelText: '取消',
    confirmText: '确定',
  })
  return res.confirm
}

/**
 * 复制文本到剪贴板
 * @param content 待复制内容
 * @param tips 复制成功提示
 */
export function copyText(content: string, tips = '内容已复制成功！') {
  uni.setClipboardData({
    data: content,
    showToast: false,
    success: () => {
      uni.showToast({ icon: 'none', title: tips })
    },
  })
}

/** 平台判断(微信小程序导出,供条件编译使用) */
export { isWechat }
