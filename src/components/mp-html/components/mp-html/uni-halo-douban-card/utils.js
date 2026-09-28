const utils = {
  /**
   * 保留对象中指定的 key
   * @param {Object} obj - 源对象
   * @param {string[]} keys - 要保留的 key 数组
   * @returns {Object} 仅包含指定 key 的新对象
   */
  pickObjectKeys (obj, keys) {
    const result = {}
    // 遍历要保留的 key
    for (const key of keys) {
      // 仅当源对象包含该 key 时才添加（避免 undefined）；attrs 为无原型对象，不能直接调 hasOwnProperty
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = obj[key]
      }
    }
    return result
  },
  /**
   * 检查数据是否可被序列化为合法 JSON（无非法值）
   * @param {any} data - 待检查的任意数据
   * @returns {boolean} 是否可序列化
   */
  isSerializableToJSON (data) {
    if (data === null || data === undefined) return false

    if (typeof data === 'string') {
      const trimStr = data.trim()
      if (trimStr === '') return false
      try {
        JSON.parse(trimStr)
        return true
      } catch (e) {
        return false
      }
    }

    if (typeof data === 'object') {
      try {
        const jsonStr = JSON.stringify(data)
        JSON.parse(jsonStr)
        return true
      } catch (e) {
        return false
      }
    }

    return false
  }
}

export default utils
