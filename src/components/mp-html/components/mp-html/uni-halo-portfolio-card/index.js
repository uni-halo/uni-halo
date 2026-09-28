/**
 * @fileoverview 项目集卡片插件入口
 */
import utils  from './utils'

/**
 * @description 组件被创建时将实例化插件
 * @param {Component} vm 组件实例
 */
function HaloPortfolioCard (vm) {
  this.vm = vm // 保存实例在其他周期使用
  this.compData = {} // 仅在单个组件中使用的数据
}

/**
 * @description html 数据更新时触发
 * @param {string} content 要更新的 html 字符串
 * @param {object} config 解析配置
 * @returns {string|void} 处理后的 html 字符串
 */
HaloPortfolioCard.prototype.onUpdate = function (content, config) {
  // 解析器会丢弃非 a/img 标签的 data-* 属性，这里把 data-slug 改写为 slug
  return content.replace(/(<portfolio-project-card\b[^>]*?)\sdata-slug=/gi, '$1 slug=')
}

/**
 * @description 解析到一个标签时触发
 * @param {object} node 标签
 * @param {object} parser 解析器实例
 * @returns {boolean|void} 如果返回 false 将移除该标签
 */
HaloPortfolioCard.prototype.onParse = function (node, parser) {
  if (node.type === 'text') return

  if (node.name === 'portfolio-project-card') {
    // 无 slug 的标签直接移除，避免渲染空壳
    if (!node.attrs.slug) return false

    // 透传根组件解析配置（domain 等）给卡片组件
    node.attrs.options = utils.pickObjectKeys(parser.options, ['copyLink', 'domain', 'errorImg', 'lazyLoad', 'loadingImg', 'showImgMenu'])

    // 自定义标签不能被 rich-text 包含，须暴露出来解决嵌套无法解析问题
    parser.expose()
  }
}

/**
 * @description dom 树加载完毕时触发（load 事件）
 */
HaloPortfolioCard.prototype.onLoad = function () {}

/**
 * @description 组件被移除时触发
 */
HaloPortfolioCard.prototype.onDetached = function () {}

export default HaloPortfolioCard
