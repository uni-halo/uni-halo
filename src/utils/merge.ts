/**
 * 对象合并/克隆工具
 */

/** 判断是否为普通对象(非数组、非 null) */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 深克隆
 * @param obj 数据源
 */
export function deepClone<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as unknown as T
  }
  if (obj && typeof obj === 'object') {
    const clone: Record<string, unknown> = {}
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        clone[key] = deepClone((obj as Record<string, unknown>)[key])
      }
    }
    return clone as T
  }
  return obj
}

/**
 * 深合并(数组拼接,对象递归,其他直接覆盖)
 * @param target 目标对象
 * @param source 源对象
 */
export function deepMerge<T extends Record<string, unknown>, S extends Record<string, unknown>>(target: T, source: S): T & S {
  const output: Record<string, unknown> = { ...target }

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      const targetValue = target[key]
      const sourceValue = source[key]

      if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
        output[key] = [...targetValue, ...sourceValue]
      }
      else if (isObject(targetValue) && isObject(sourceValue)) {
        output[key] = deepMerge(targetValue, sourceValue)
      }
      else {
        output[key] = sourceValue
      }
    })
  }
  return output as T & S
}
