import { ref } from 'vue'

/** 弹层显隐(模块级共享,全局仅此一份) */
const loginPopupVisible = ref(false)

/** 当前打开时注册的登录成功回调(一次性) */
let successCallback: (() => void) | null = null

/**
 * 打开登录弹窗
 * @param onSuccess 登录成功后的回调(可选,用于登录后重试刚才的操作)
 */
function openLoginPopup(onSuccess?: () => void) {
  successCallback = onSuccess || null
  loginPopupVisible.value = true
}

/** 关闭登录弹窗(内部使用) */
function closeLoginPopup() {
  loginPopupVisible.value = false
}

export function useLoginPopup() {
  /** 弹窗打开期间暂存回调,登录成功时触发 */
  function handleLoginSuccess() {
    const callback = successCallback
    successCallback = null
    if (callback) {
      callback()
    }
  }

  return {
    loginPopupVisible,
    openLoginPopup,
    closeLoginPopup,
    handleLoginSuccess,
  }
}
