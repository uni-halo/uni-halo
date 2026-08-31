/**
 * UUID 生成工具(源自旧项目 utils/uuid.js,按需命名导出)
 */

/**
 * 生成 UUID(v4)
 */
export function generateUUID(): string {
  // 使用 crypto.randomUUID(部分平台支持),否则降级为时间戳+随机数
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  let uuid = ''
  const timestamp = Date.now()
  for (let i = 0; i < 32; i++) {
    const r = (timestamp + Math.random() * 16) % 16 | 0
    uuid += (i === 12 ? 4 : (i === 16 ? (r & 3) | 8 : r)).toString(16)
  }
  return uuid
}
