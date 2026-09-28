<template>
  <view class="halo-portfolio-card" :class="[loading]">
    <view class="badge">项目</view>
    <view v-if="loading !== 'success'" class="card-error" @click="getData()">
      {{ loadingText }}
    </view>
    <block v-else>
      <view class="w-full flex">
        <view v-if="posterEmpty" class="poster">无封面</view>
        <image v-else class="poster" :src="poster" mode="aspectFill" @error="onPosterError" />
        <view class="box">
          <view class="title text-overflow">{{ project.title }}</view>
          <view v-if="project.summary" class="summary text-overflow">{{ project.summary }}</view>
          <view class="meta">
            <text v-if="project.featured" class="meta-featured">推荐</text>
            <text v-if="typeLabel" class="meta-type">{{ typeLabel }}</text>
          </view>
          <view v-if="techStacks.length" class="tech-list">
            <text v-for="tech in techStacks" :key="tech" class="tech">{{ tech }}</text>
          </view>
        </view>
      </view>
      <view class="btn-group">
        <button
          v-for="btn in linkButtons" :key="btn.label"
          class="btn" @click.stop="copyLink(btn.url, btn.label)"
        >
          {{ btn.label }}
        </button>
        <button class="btn" @click.stop="onDetail">详情</button>
      </view>
    </block>
  </view>
</template>

<script>
import HaloPortfolioApis from './api'
import constants from './constant'
import utils from './utils'

export default {
  name: 'UniHaloPortfolioCard',
  emits: ['actions'],
  props: {
    // 项目路由标识（由 <portfolio-project-card slug="xxx"> 解析而来）
    slug: String,
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
      project: null,
      poster: '',
      posterEmpty: false
    }
  },
  computed: {
    options () {
      return (this.n.attrs && this.n.attrs.options) || {}
    },
    typeLabel () {
      return utils.portfolioLabelOf(constants.TYPE_LABELS, this.project && this.project.type)
    },
    techStacks () {
      return ((this.project && this.project.techStacks) || []).slice(0, 4)
    },
    linkButtons () {
      const project = this.project || {}
      return [
        { label: '仓库', url: project.repoUrl },
        { label: '演示', url: project.demoUrl },
        { label: '文档', url: project.docsUrl }
      ].filter(item => item.url)
    }
  },
  created () {
    this.getData()
  },
  methods: {
    getData () {
      this.loadingText = '加载中，请稍等...'
      this.loading = 'loading'
      new HaloPortfolioApis(this.options).getProjectDetail(this.slug)
        .then(res => {
          const notOk = !res || (res.statusCode && res.statusCode !== 200)
          const data = notOk ? null : (res.data && res.data.data)
          if (!data || !data.title) {
            this.loading = 'empty'
            this.loadingText = '项目不存在哦~'
            return
          }
          this.project = data
          this.poster = utils.fixUrl(data.cover, this.options.domain)
          this.posterEmpty = !data.cover
          this.loading = 'success'
        })
        .catch(() => {
          this.loading = 'error'
          this.loadingText = '项目加载失败，点击重试'
        })
    },
    onPosterError () {
      this.posterEmpty = true
    },
    copyLink (url, label) {
      // 抛给宿主：动作 + 原始数据
      this.$emit('actions', { action: 'copy', data: { slug: this.slug, label, url } })
      uni.setClipboardData({
        data: url,
        success: () => {
          uni.showToast({ icon: 'none', title: `${label}链接复制成功` })
        }
      })
    },
    // 详情不做内部跳转，统一抛给宿主处理：<mp-html @uhe-portfolio-actions="..." />
    onDetail () {
      this.$emit('actions', { action: 'detail', data: { slug: this.slug } })
    }
  }
}
</script>

<style lang="scss" scoped>
.w-full {
  width: 100%;
}

.flex {
  display: flex;
}

.text-overflow {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.halo-portfolio-card {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  padding: 24rpx;
  margin-bottom: 12rpx;
  overflow: hidden;
  background-color: #fff;
  border: 1px solid #eee;
  border-radius: 12rpx;

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

  &.empty {
    padding: 0;
    border-style: dashed;
    border-color: #d4d4d4;
    color: #a3a3a3;
    background-color: #fafafa;
  }
}

.badge {
  position: absolute;
  top: 0;
  right: 0;
  box-sizing: border-box;
  padding: 2rpx 12rpx;
  font-size: 24rpx;
  color: #fff;
  background-image: linear-gradient(90deg, #03aefc, #03d8fc);
  border-radius: 0 12rpx 0 12rpx;
}

.card-error {
  box-sizing: border-box;
  padding: 50rpx 24rpx;
  font-size: 24rpx;
  text-align: center;
}

.poster {
  box-sizing: border-box;
  display: flex;
  flex-shrink: 0;
  width: 176rpx;
  height: 176rpx;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  color: #999;
  background-color: #f1f1f1;
  border-radius: 12rpx;
}

.box {
  flex-grow: 1;
  box-sizing: border-box;
  min-width: 0;
  padding-left: 24rpx;
  overflow: hidden;
}

.title {
  box-sizing: border-box;
  font-size: 30rpx;
  font-weight: bold;
}

.summary {
  box-sizing: border-box;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #777;
}

.meta {
  display: flex;
  align-items: center;
  margin-top: 8rpx;
  font-size: 20rpx;
}

.meta-featured {
  padding: 2rpx 10rpx;
  margin-right: 12rpx;
  color: #fff;
  background-color: #ff9800;
  border-radius: 8rpx;
}

.meta-type {
  color: #aaa;
}

.tech-list {
  display: flex;
  flex-wrap: wrap;
  margin-top: 10rpx;
}

.tech {
  box-sizing: border-box;
  padding: 4rpx 12rpx;
  margin: 0 10rpx 10rpx 0;
  font-size: 20rpx;
  color: #666;
  background-color: #f5f5f5;
  border-radius: 8rpx;
}

.btn-group {
  box-sizing: border-box;
  display: flex;
  margin-top: 20rpx;
  padding-top: 16rpx;
  border-top: 1px solid #f2f2f2;
}

.btn {
  flex: 1;
  box-sizing: border-box;
  margin: 0 8rpx;
  padding: 6rpx 0;
  font-size: 24rpx;
  line-height: 1.8;
  color: #fff;
  background-color: #03aefc;
  border: none;
  border-radius: 999rpx;

  &::after {
    border: none;
  }
}
</style>
