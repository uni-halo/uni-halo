/**
 * @fileoverview 项目集公开接口（halo-plugin-portfolio）
 */

/** 项目集公开接口基础路径 */
const BASE_PATH = '/apis/public.portfolio.muyin.site/v1alpha1/projects'

/**
 * @description 跨端请求：原生小程序环境用 wx.request，其余（uni-app）用 uni.request
 */
function request (options) {
  if (typeof wx !== 'undefined' && wx.request) {
    wx.request(options)
  } else {
    uni.request(options)
  }
}

/**
 * @description 项目集接口封装，domain 来自 mp-html 解析配置
 * @param {Object} opts - { domain }
 */
function HaloPortfolioApis (opts) {
  this.baseURL = (opts && opts.domain) || ''
}

/**
 * @description 获取项目详情
 * @param {String} slug 项目路由标识
 * @returns {Promise} resolve { statusCode, data: { code, data: IProject } }
 */
HaloPortfolioApis.prototype.getProjectDetail = function (slug) {
  return new Promise((resolve, reject) => {
    request({
      url: this.baseURL + BASE_PATH + '/' + slug,
      method: 'GET',
      header: { 'content-type': 'application/json' },
      success: resolve,
      fail: reject
    })
  })
}

export default HaloPortfolioApis
