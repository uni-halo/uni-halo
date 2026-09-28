<template>
  <view class="card" :class="[loading]">
    <view v-if="loading !== 'success'" class="card-error" @click="fnGetData()">
      {{ loadingText }}
    </view>
    <template v-else>
      <view class="tag">豆瓣</view>
      <view class="flex w-full">
        <view v-if="posterEmpty" class="poster round-2">无封面</view>
        <image v-else class="poster round-2" :src="poster" mode="aspectFill" @error="onPosterError"></image>
        <view class="box">
          <view class="title text-overflow">{{ detail.spec.name }}</view>
          <view class="flex" style="align-items: center; margin-top: 12rpx">
            <text class="text-size-s">评分：</text>
            <text class="stars">{{ stars }}</text>
            <text class="text-size-s" style="margin-left: 4rpx">{{ detail.spec.score }}</text>
          </view>

          <view class="content text-overflow-2">{{ detail.spec.cardSubtitle }}</view>
          <view class="flex flex-wrap" style="margin-left: -10rpx">
            <view>{{ types[detail.spec.type] }}</view>
            <view v-for="(gen, genIndex) in detail.spec.genres" :key="genIndex">{{ gen }}
            </view>
          </view>
        </view>
      </view>
      <!-- 扩展内容 -->
      <view class="btn-group">
        <button @click="copy('douban')">豆瓣地址</button>
        <button @click="copy('info')">资源信息</button>
      </view>
    </template>
  </view>
</template>

<script>

export default {
  name: 'UniHaloDouBanCard',
  emits: ['actions'],
  props: {
    mode: {
      type: Boolean,
      default: false
    },
    // 豆瓣资源地址（由 <douban src="xxx"> 解析而来）
    url: String,
    // mp-html 传入的标签结构体，attrs.options 含 domain 等解析配置
    n: {
      type: Object,
      default () {
        return {}
      }
    }
  },
  data () {
    return {
      loading: 'loading',
      loadingText: '加载中，请稍等...',
      detail: null,
      types: {
        movie: '电影',
        book: '图书',
        music: '音乐',
        game: '游戏',
        drama: '舞台剧'
      },
      poster: '',
      posterEmpty: false
    }
  },
  computed: {
    // mp-html 解析配置（domain 等），通过标签结构体 n.attrs.options 透传
    options () {
      return (this.n && this.n.attrs && this.n.attrs.options) || {}
    },
    // 评分星级（5 星制，score 为 10 分制，与小程序端逻辑一致）
    stars () {
      const score = (this.detail && this.detail.spec && Number(this.detail.spec.score)) || 0
      const count = Math.min(Math.round(score / 2), 5)
      return '★'.repeat(count) + '☆'.repeat(5 - count)
    }
  },
  created () {
    this.fnGetData()
  },
  methods: {
    onPosterError () {
      this.poster = ''
      this.posterEmpty = true
    },
    // 跨端请求：uni-app 环境用 uni.request（原生小程序端为独立组件实现）
    fnGetData () {
      const domain = this.options.domain
      if (!domain) {
        this.loading = 'error'
        this.loadingText = '未配置基础域名'
        return
      }
      if (!this.url) {
        this.loading = 'error'
        this.loadingText = '组件不存在 [src] 参数'
        return
      }
      this.loadingText = '加载中，请稍等...'
      this.loading = 'loading'
      uni.request({
        url: domain + '/apis/api.douban.moony.la/v1alpha1/doubanmovies/-/getDoubanDetail',
        method: 'GET',
        header: { 'content-type': 'application/json' },
        data: { url: this.url },
        success: (res) => {
          const body = res.data
          if (body && body.spec) {
            this.detail = body
            this.poster = body.spec.poster || ''
            setTimeout(() => {
              this.loading = 'success'
            }, 200)
          } else {
            this.loading = 'error'
            this.loadingText = '豆瓣内容加载失败，点击重试'
          }
        },
        fail: () => {
          this.loading = 'error'
          this.loadingText = '豆瓣内容加载失败，点击重试'
        }
      })
    },

    showToast (content) {
      uni.showToast({
        icon: 'none',
        title: content,
        mask: true
      })
    },
    copyText (data, tipText) {
      uni.setClipboardData({
        data: data,
        success: () => {
          if (tipText) this.showToast(tipText)
        }
      })
    },
    copy (type) {
      // 抛给宿主：动作 + 原始数据（src 为正文标记的原始地址）
      this.$emit('actions', { action: 'copy-' + type, data: { src: this.url } })
      if (type === 'douban') {
        this.copyText(this.detail && this.detail.spec ? this.detail.spec.link : '', '豆瓣资源地址复制成功')
        return
      }
      if (type === 'info') {
        const spec = (this.detail && this.detail.spec) || {}
        const content = `名称:${spec.name}丨其他:${spec.cardSubtitle}丨标签:${(spec.genres || []).join('/')}丨时间:${spec.pubdate}丨评分:${spec.score}分丨链接:${spec.link}`
        this.copyText(content, '资源信息复制成功')
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.w-full {
  width: 100%;
}

.wp-50 {
  width: 50%;
}

.card {
  position: relative;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 24rpx;
  border-radius: 12rpx;
  background-color: #ffff;
  overflow: hidden;
  margin-bottom: 12rpx;
  border: 1px solid #eee;

  &.error {
    padding: 0;
    border-style: dashed;
    border-color: #e88080;
    color: #e88080;
    background-color: rgba(232, 128, 128, 0.075);
  }

  &.loading {
    padding: 0;
    border-style: dashed;
    border-color: rgba(3, 174, 252, 1);
    color: rgba(3, 174, 252, 1);
    background-color: rgba(3, 174, 252, 0.075);
  }
}

.card-error {
  box-sizing: border-box;
  padding: 50rpx 24rpx;
  font-size: 24rpx;
  border-radius: 12rpx;
  text-align: center;
}

.poster {
  box-sizing: border-box;
  width: 180rpx;
  height: 220rpx;
  flex-shrink: 0;
  background-color: #eee;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
}

.box {
  flex-grow: 1;
  box-sizing: border-box;
  font-size: 26rpx;
  padding-left: 24rpx;
  overflow: hidden;
}

.stars {
  font-size: 32rpx;
  color: rgb(255, 110, 0);
}

.title {
  box-sizing: border-box;
  font-size: 32rpx;
  font-weight: bold;
}

.content {
  box-sizing: border-box;
  margin-top: 12rpx;
  line-height: 36rpx;
  color: rgba(0, 0, 0, 0.85);
}

.tag {
  box-sizing: border-box;
  position: absolute;
  right: 0;
  top: 0;
  font-size: 24rpx;
  padding: 2rpx 12rpx;
  background-color: #f5c618;
  border-radius: 0 6rpx 0 12rpx;
}

.btn-group {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 22rpx;
  gap: 0 22rpx;
}
</style>
