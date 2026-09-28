<template>
  <view class="uh-douban-card" :class="[loading]">
    <!-- 三态（加载中 / 失败 / 无数据）：虚线状态卡 -->
    <view v-if="loading !== 'success'" class="card-error" @click.stop="fnGetData()">
      {{ loadingText }}
    </view>
    <template v-else-if="detail">
      <!-- 角标 -->
      <view class="corner-badge">豆瓣</view>
      <view class="card-main">
        <view v-if="posterEmpty || !poster" class="poster poster-empty">无封面</view>
        <image v-else class="poster" :src="poster" mode="aspectFill" @error="onPosterError" />
        <view class="box">
          <view class="title text-overflow">{{ detail.name }}</view>
          <view v-if="detail.score" class="score-row">
            <text class="score-label">评分</text>
            <text class="star">★</text>
            <text class="score">{{ detail.score }}</text>
          </view>
          <view v-if="detail.cardSubtitle" class="subtitle text-overflow-2">{{ detail.cardSubtitle }}</view>
          <view class="tag-list">
            <text v-if="typeLabel" class="tag-type">{{ typeLabel }}</text>
            <text
              v-for="(gen, genIndex) in (detail.genres || []).slice(0, 3)"
              :key="genIndex"
              class="tag-genre"
            >{{ gen }}</text>
          </view>
        </view>
      </view>
      <!-- 操作按钮 -->
      <view class="btn-group">
        <view class="btn" @click.stop="copy('douban')">豆瓣地址</view>
        <view class="btn" @click.stop="copy('info')">资源信息</view>
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
    typeLabel () {
      const type = this.detail && this.detail.type
      return type ? (this.types[type] || type) : ''
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
    // 自包含请求：Halo 标准接口直接返回豆瓣数据对象（无 { code, data } 包裹）
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
          if (body && body.name) {
            this.detail = body
            this.poster = body.poster || ''
            this.posterEmpty = false
            setTimeout(() => {
              this.loading = 'success'
            }, 200)
          } else {
            this.loading = 'empty'
            this.loadingText = '数据不存在'
          }
        },
        fail: () => {
          this.loading = 'error'
          this.loadingText = '加载失败，点击重试'
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
        this.copyText(this.detail ? this.detail.link : '', '豆瓣地址复制成功')
        return
      }
      if (type === 'info') {
        const d = this.detail || {}
        const parts = [
          `名称：${d.name || ''}`,
          d.cardSubtitle ? `其他：${d.cardSubtitle}` : '',
          d.genres && d.genres.length ? `标签：${d.genres.join('/')}` : '',
          d.pubdate ? `时间：${d.pubdate}` : '',
          d.score ? `评分：${d.score}分` : '',
          d.link ? `链接：${d.link}` : ''
        ].filter(Boolean)
        this.copyText(parts.join('\n'), '资源信息复制成功')
      }
    }
  }
}
</script>

<style scoped>
/* ===== 卡片容器（对齐文章卡片：黄色边框 + 角标） ===== */
.uh-douban-card {
  width: 100%;
  box-sizing: border-box;
  position: relative;
  margin: 12rpx 0;
  padding: 24rpx;
  border-radius: 16rpx;
  border: 2rpx solid #f5c618;
  background-color: #ffffff;
  overflow: hidden;
  line-height: 1.5;
}

/* ===== 三态（保留虚线状态卡设计） ===== */
.uh-douban-card.error {
  border-style: dashed;
  border-color: #e88080;
  color: #e88080;
  background-color: rgba(232, 128, 128, 0.075);
}

.uh-douban-card.loading {
  border-style: dashed;
  border-color: rgba(3, 174, 252, 1);
  color: rgba(3, 174, 252, 1);
  background-color: rgba(3, 174, 252, 0.075);
}

.uh-douban-card.empty {
  border-style: dashed;
  border-color: #d1d5db;
  color: #9ca3af;
  background-color: rgba(243, 244, 246, 0.75);
}

.card-error {
  width: 100%;
  text-align: center;
  font-size: 24rpx;
}

/* ===== 角标 ===== */
.corner-badge {
  position: absolute;
  right: 0;
  top: 0;
  border-radius: 0 0 0 12rpx;
  background-color: #f5c618;
  padding: 4rpx 16rpx;
  font-size: 20rpx;
  color: #111827;
}

/* ===== 主体 ===== */
.card-main {
  display: flex;
  gap: 24rpx;
}

.poster {
  width: 176rpx;
  height: 230rpx;
  flex-shrink: 0;
  border-radius: 12rpx;
  overflow: hidden;
  display: block;
}

.poster-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f3f4f6;
  font-size: 20rpx;
  color: #9ca3af;
}

.box {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.title {
  padding-right: 80rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: #111827;
}

.score-row {
  display: flex;
  align-items: center;
  gap: 4rpx;
}
.score-label{
  font-size: 24rpx;
  color: #6b7280;
}
.star {
  font-size: 28rpx;
  color: #fb923c;
}

.score {
  font-size: 24rpx;
  color: #fb923c;
}

.subtitle {
  font-size: 24rpx;
  color: #6b7280;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.tag-type {
  border-radius: 8rpx;
  background-color: #ffedd5;
  padding: 4rpx 12rpx;
  font-size: 20rpx;
  color: #f97316;
}

.tag-genre {
  border-radius: 8rpx;
  background-color: #f3f4f6;
  padding: 4rpx 12rpx;
  font-size: 20rpx;
  color: #6b7280;
}

/* ===== 操作按钮（胶囊，豆瓣黄底） ===== */
.btn-group {
  margin-top: 16rpx;
  padding-top: 16rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.btn {
  flex: 1;
  box-sizing: border-box;
  text-align: center;
  padding: 12rpx 24rpx;
  border-radius: 999rpx;
  background-color: #f5c618;
  border: 2rpx solid rgba(255, 255, 255, 0.80);
  font-size: 24rpx;
  color: #111827;
}

/* ===== 通用 ===== */
.text-overflow {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.text-overflow-2 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
</style>
