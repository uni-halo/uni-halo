
const UniHaloVoteUID = 'OKAY_HALO_VOTE_UID'

const CacheUtils = {
  getAll () {
    const data = wx.getStorageSync(UniHaloVoteUID)
    if (!data) {
      return null
    }
    return JSON.parse(data)
  },
  get (name) {
    const data = this.getAll()
    if (!data) {
      return null
    }
    return data[name]
  },
  has (name) {
    const data = this.getAll()
    if (!data) return false
    return data[name] !== undefined
  },
  set (name, value) {
    let data = this.getAll()
    if (!data) {
      data = {
        [name]: value
      }
    } else {
      data[name] = value
    }
    wx.setStorageSync(UniHaloVoteUID, JSON.stringify(data))
  }
}

export default CacheUtils
