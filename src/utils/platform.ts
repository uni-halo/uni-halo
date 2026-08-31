/**
 * 平台判断工具(源自旧项目 common/mixins/index.js 的 _isWechat data,改 utils 按需导出)
 */

/** 是否微信小程序平台(条件编译,编译期确定) */
export const isWechat: boolean = (() => {
  // #ifdef MP-WEIXIN
  return true
  // #endif
  // #ifndef MP-WEIXIN
  return false
  // #endif
})()
