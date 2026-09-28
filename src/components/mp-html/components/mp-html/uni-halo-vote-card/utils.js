import constants  from './constant'

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
  },
  /**
   * 计算投票状态
   * @param {Object} vote 投票数据
   * */
  calcVoteState (vote) {
    if (vote.spec.timeLimit !== 'custom') {
      return vote.spec.hasEnded ? constants.VOTE_STATES['已结束'] : constants.VOTE_STATES['进行中']
    }

    const nowTime = new Date().getTime()
    const startTime = new Date(vote.spec.startDate).getTime()
    const endTime = new Date(vote.spec.endDate).getTime()

    if (nowTime < startTime) {
      return constants.VOTE_STATES['未开始']
    }
    if (nowTime < endTime) {
      return constants.VOTE_STATES['进行中']
    }
    return vote.spec.hasEnded ? constants.VOTE_STATES['已结束'] : constants.VOTE_STATES['进行中']
  },
  /**
   * 计算投票百分比
   * @param {Object} vote 投票数据
   * @param {Object} voteOption 投票配置
   * */
  calcVotePercent (vote, voteOption) {
    if (!vote || !voteOption) return 0
    const votedDataList = vote?.stats?.voteDataList || []
    if (votedDataList.length === 0) return 0
    const voteCount = vote?.stats?.voteCount || 0
    if (voteCount === 0) return 0

    const _voteOption = votedDataList.find(x => x.id === voteOption.id)
    if (!_voteOption) return 0
    const percent = (_voteOption.voteCount / voteCount) * 100
    return Math.round(percent)
  },
  /**
   * 功能描述：时间格式化，将指定的时间戳（或正常的日期）转换为带格式的日期
   *
   * 参数说明：
   *    1.支持格式化 yyyy年MM月dd日 HH点mm分ss秒 星期w q季
   *    2.对象形式传入 { d:'2021-06-04',f:'yyyy年' }  d是必传项，f可不传（默认yyyy-MM-dd HH:mm:ss）
   * 使用示例：
   *    1：<view>{{ dateTimeParamName | formatTime }}</view>
   *    2：<view>{{ { d: '2021-06-04', f: 'yyyy' } | formatTime }}</view>
   *    3：<view>{{ { d: dateTimeParamName, f: 'yyyy年MM月dd日 HH点mm分ss秒 星期w q季' } | formatTime }}</view>
   * 特别说明： 由于uniapp中的filter 不支持多参数，但是允许传入对象的形式，故以此方式实现！
   */
  formatTime (data) {
    let _dateTime = new Date(data)
    let _fmt = 'yyyy-MM-dd HH:mm:ss'
    if (_dateTime == 'Invalid Date') {
      if (data.d === undefined || data.d == null || data.d === '') {
        return ''
      }

      _dateTime = new Date(data.d)
      if (_dateTime == 'Invalid Date') {
        return ''
      }
      if (Object.prototype.hasOwnProperty.call(data, 'f')) {
        _fmt = data.f
      }
    }
    const _weekDays = ['日', '一', '二', '三', '四', '五', '六']
    const _seasons = ['冬', '春', '夏', '秋']
    const o = {
      'M+': _dateTime.getMonth() + 1, // 月份
      'd+': _dateTime.getDate(), // 日
      'H+': _dateTime.getHours(), // 小时
      'm+': _dateTime.getMinutes(), // 分
      's+': _dateTime.getSeconds(), // 秒
      'w+': _weekDays[_dateTime.getDay()], // 星期几
      'q+': _seasons[Math.floor((_dateTime.getMonth() + 3) / 3)], // 季度
      S: _dateTime.getMilliseconds() // 毫秒
    }
    if (/(y+)/.test(_fmt)) {
      _fmt = _fmt.replace(
        RegExp.$1,
        (_dateTime.getFullYear() + '').substr(4 - RegExp.$1.length)
      )
    }
    for (const k in o) {
      if (new RegExp('(' + k + ')').test(_fmt)) {
        _fmt = _fmt.replace(
          RegExp.$1,
          RegExp.$1.length === 1
            ? o[k]
            : ('00' + o[k]).substr(('' + o[k]).length)
        )
      }
    }
    return _fmt
  }
}

export default utils
