/** 邮箱格式正则(与服务端 @Email 校验对齐) */
export const EMAIL_RE = /^[\w.%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i

/** 邮箱格式校验(空值返回 false,必填场景先单独判空) */
export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}
