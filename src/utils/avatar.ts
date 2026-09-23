/**
 * 头像首字回退工具
 *
 * 用于 wd-avatar 无头像 / 加载失败时显示昵称首字：
 * - 中文等非 ASCII 字符取首字符
 * - ASCII 取首个字母并大写
 * - 空值返回 fallback 占位符
 *
 * @param name 昵称或用户名
 * @param fallback 兜底占位符(如 '瞬'、'?')
 */
export function getAvatarFallbackText(name?: string, fallback = ''): string {
  const raw = (name || '').trim()
  if (!raw) { return fallback }
  const first = [...raw][0]
  if (first && first.charCodeAt(0) > 0x7F) { return first }
  const ascii = raw.match(/[A-Z]/i)?.[0]
  return (ascii || first || '').toUpperCase()
}
