/**
 * 记住密码存储
 * 密码经 XOR 混淆 + Base64 编码后落盘(本地明文 storage 的轻量防护,防直接肉眼读取)
 */
import { delCache, getCache, setCache } from './storage'

/** storage key(登录账号密码记忆) */
const REMEMBER_KEY = 'uh:remember-login'

/** 混淆密钥(仅防直接明文,非安全加密) */
const OBFUSCATE_KEY = 'uni-halo-remember'

/** 记住的登录凭据 */
export interface IRememberedLogin {
  username: string
  password: string
}

/** XOR 混淆 + Base64 编码 */
function encode(raw: string): string {
  let xored = ''
  for (let i = 0; i < raw.length; i++) {
    xored += String.fromCharCode(raw.charCodeAt(i) ^ OBFUSCATE_KEY.charCodeAt(i % OBFUSCATE_KEY.length))
  }
  // btoa 不支持非 Latin1,先转 UTF-8 字节序列
  const bytes = new Uint8Array([...xored].map(ch => ch.charCodeAt(0) & 0xFF))
  let binary = ''
  bytes.forEach(b => binary += String.fromCharCode(b))
  // #ifdef H5
  return btoa(binary)
  // #endif
  // #ifndef H5
  return uni.arrayBufferToBase64(bytes.buffer)
  // #endif
}

/** Base64 解码 + XOR 还原 */
function decode(encoded: string): string {
  let binary = ''
  // #ifdef H5
  binary = atob(encoded)
  // #endif
  // #ifndef H5
  const buffer = uni.base64ToArrayBuffer(encoded)
  new Uint8Array(buffer).forEach(b => binary += String.fromCharCode(b))
  // #endif
  const bytes = new Uint8Array([...binary].map(ch => ch.charCodeAt(0)))
  let xored = ''
  bytes.forEach(b => xored += String.fromCharCode(b))
  let raw = ''
  for (let i = 0; i < xored.length; i++) {
    raw += String.fromCharCode(xored.charCodeAt(i) ^ OBFUSCATE_KEY.charCodeAt(i % OBFUSCATE_KEY.length))
  }
  return raw
}

/** 读取记住的登录凭据(无/解析失败返回 null) */
export function getRememberedLogin(): IRememberedLogin | null {
  const cached = getCache<{ u: string, p: string }>(REMEMBER_KEY)
  if (!cached?.u || !cached?.p) {
    return null
  }
  try {
    return { username: decode(cached.u), password: decode(cached.p) }
  }
  catch {
    delCache(REMEMBER_KEY)
    return null
  }
}

/** 保存记住的登录凭据 */
export function saveRememberedLogin(username: string, password: string) {
  setCache(REMEMBER_KEY, { u: encode(username), p: encode(password) })
}

/** 清除记住的登录凭据 */
export function clearRememberedLogin() {
  delCache(REMEMBER_KEY)
}
