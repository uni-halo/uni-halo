/**
 * 认证信息工具(请求头来源)
 */

/** 管理员登录 token 存储 key */
const ADMIN_LOGIN_TOKEN_KEY = 'APP_ADMIN_LOGIN_TOKEN'

/**
 * 是否已管理员登录(登录功能暂缓,保留判断逻辑)
 */
export function checkHasAdminLogin(): boolean {
  return !!uni.getStorageSync(ADMIN_LOGIN_TOKEN_KEY)
}

/**
 * 获取微信 openid(登录流程写入 storage)
 */
export function getOpenid(): string {
  return uni.getStorageSync('openid') || ''
}

/**
 * 获取匿名访客邮箱(nologin-email 请求头来源)
 */
export function getNologinEmail(): string {
  const visitor = uni.getStorageSync('Visitor')
  if (!visitor)
    return ''
  try {
    const v = JSON.parse(visitor)
    return v.email || v.author || ''
  }
  catch {
    return ''
  }
}
