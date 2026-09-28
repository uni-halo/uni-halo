const HaloVoteCardConfig = {}

const requestHeader = {
  ContentType: 'application/json',
  dataType: 'json'
}

class HaloVoteCardApis {
  constructor (opts) {
    this.baseURL = opts.domain
    this.token = opts.token
  }

  /**
   * 获取投票详情
   * @param {String} name id
   */
  getVoteDetail (name) {
    return new Promise((resolve, reject) => {
      // 微信小程序
      // #ifdef MP-WEIXIN
      wx.request({
        url: this.baseURL + `/apis/api.vote.kunkunyu.com/v1alpha1/votes/${name}/detail`,
        method: 'GET',
        header: {
          ...requestHeader
        },
        success: resolve,
        fail: reject
      })
      // #endif
      // uniapp其他平台
    })
  }

  /**
   * 获取投票用户列表
   * @param {String} name id
   */
  getVoteUserList (name) {
    return new Promise((resolve, reject) => {
      // 微信小程序
      // #ifdef MP-WEIXIN
      wx.request({
        url: this.baseURL + `/apis/api.vote.kunkunyu.com/v1alpha1/votes/${name}/user-list`,
        method: 'GET',
        header: {
          ...requestHeader
        },
        success: resolve,
        fail: reject
      })
      // #endif
      // uniapp其他平台
    })
  }

  /**
   * 提交投票
   * @param {String} name id
   * @param {Object} data { voteData:["选项ID"] } 提交的数据
   * @param {Boolean} canAnonymously 是否匿名 默认匿名
   */
  submitVote (name, data, canAnonymously = true) {
    const header = {
      ...requestHeader
    }
    if (!canAnonymously && this.token) {
      header.Authorization = 'Bearer ' + this.token
    }
    return new Promise((resolve, reject) => {
      // 微信小程序
      // #ifdef MP-WEIXIN
      wx.request({
        url: this.baseURL + `/apis/api.vote.kunkunyu.com/v1alpha1/votes/${name}/submit`,
        method: 'POST',
        header: header,
        data: data,
        success: resolve,
        fail: reject
      })
      // #endif
      // uniapp其他平台
    })
  }
}

export default {
  HaloVoteCardConfig,
  HaloVoteCardApis
}
