/**
 * @fileoverview 项目集卡片工具函数
 */
const utils = {
  /**
   * 保留对象中指定的 key
   * @param {Object} obj - 源对象
   * @param {string[]} keys - 要保留的 key 数组
   * @returns {Object} 仅包含指定 key 的新对象
   */
  pickObjectKeys (obj, keys) {
    const result = {}
    for (const key of keys) {
      // Vue3 实例代理生产模式下 hasOwnProperty 恒为 false，须用 in 判断
      if (obj && key in obj) {
        result[key] = obj[key]
      }
    }
    return result
  },

  /**
   * 补全相对路径的资源地址（封面等）
   * @param {String} url - 原始地址
   * @param {String} domain - 站点域名（来自 mp-html 解析配置）
   * @returns {String} 补全后的地址
   */
  fixUrl (url, domain) {
    if (!url) return ''
    if (/^(https?:)?\/\//i.test(url) || !domain) return url
    return url[0] === '/' ? domain + url : domain + '/' + url
  },

  /**
   * 取枚举中文映射标签，无匹配回退原值
   * @param {Object} map - 枚举映射表
   * @param {String} value - 枚举值
   * @returns {String} 中文标签
   */
  portfolioLabelOf (map, value) {
    if (!value) return ''
    return map[value] || value
  }
}

export default utils
