<template>
  <view class="uh-portfolio-card" :class="[loading]" @click.stop="onDetail">
    <!-- 三态（加载中 / 失败 / 无数据）：虚线状态卡 -->
    <view v-if="loading !== 'success'" class="card-error" @click.stop="getData()">
      {{ loadingText }}
    </view>
    <template v-else-if="project">
      <!-- 推荐角标 -->
      <view v-if="project.featured" class="corner-badge">推荐</view>
      <view class="card-main">
        <view v-if="posterEmpty || !poster" class="poster poster-empty">暂无封面</view>
        <image v-else class="poster" :src="poster" mode="aspectFill" @error.stop="onPosterError" />
        <view class="box">
          <view class="title text-overflow">{{ project.title }}</view>
          <view v-if="project.summary" class="summary text-overflow-1">{{ project.summary }}</view>
          <view v-if="typeLabel" class="type-label">{{ typeLabel }}</view>
          <view v-if="techStacks.length" class="tech-list">
            <text v-for="tech in techStacks" :key="tech" class="tech">{{ tech }}</text>
          </view>
        </view>
      </view>
      <!-- 链接按钮 -->
      <view v-if="linkButtons.length" class="btn-group">
        <view
          v-for="btn in linkButtons"
          :key="btn.label"
          class="btn"
          @click.stop="copyLink(btn.url, btn.label)"
        >
          {{ btn.label }}
        </view>
        <view class="btn" @click.stop="onDetail">详情</view>
      </view>
    </template>
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
          // Halo 标准接口直接返回数据对象，无 { code, data } 包裹
          const notOk = !res || (res.statusCode && res.statusCode !== 200)
          const data = notOk ? null : res.data
          if (!data || !data.title) {
            this.loading = 'empty'
            this.loadingText = '数据不存在'
            return
          }
          this.project = data
          this.poster = utils.fixUrl(data.cover, this.options.domain)
          this.posterEmpty = !data.cover
          this.loading = 'success'
        })
        .catch(() => {
          this.loading = 'error'
          this.loadingText = '加载失败，点击重试'
        })
    },
    onPosterError () {
      this.posterEmpty = true
    },
    copyLink (url, label) {
      // 抛给宿主：动作 + 原始数据
      this.$emit('actions', { action: 'copy', data: { slug: this.slug, label, url } })
    },
    // 详情不做内部跳转，统一抛给宿主处理：<mp-html @uhe-portfolio-actions="..." />
    onDetail () {
      this.$emit('actions', { action: 'detail', data: { slug: this.slug } })
    }
  }
}
</script>

<style scoped>
/* ===== 卡片容器（对齐文章卡片：primary 边框） ===== */
.uh-portfolio-card {
  --uh-primary: var(--wot-color-theme, #b9e424);
  width: 100%;
  box-sizing: border-box;
  position: relative;
  margin: 12rpx 0;
  padding: 24rpx;
  border-radius: 16rpx;
  border: 2rpx solid var(--uh-primary);
  background-color: #ffffff;
  overflow: hidden;
  line-height: 1.5;
}

/* ===== 三态（保留虚线状态卡设计） ===== */
.uh-portfolio-card.error {
  border-style: dashed;
  border-color: #e88080;
  color: #e88080;
  background-color: rgba(232, 128, 128, 0.075);
}

.uh-portfolio-card.loading {
  border-style: dashed;
  border-color: rgba(3, 174, 252, 1);
  color: rgba(3, 174, 252, 1);
  background-color: rgba(3, 174, 252, 0.075);
}

.uh-portfolio-card.empty {
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

/* ===== 推荐角标 ===== */
.corner-badge { 
  position: absolute;
  right: 0;
  top: 0;
  border-radius: 0 0 0 12rpx;
  background-color: var(--uh-primary, #b9e424);
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
  width: 180rpx;
  height: 180rpx;
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
  font-size: 24rpx;
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
  font-size: 28rpx;
  font-weight: 600;
  color: #111827;
}

.summary {
  font-size: 24rpx;
  color: #6b7280;
}

.type-label {
  font-size: 20rpx;
  color: #9ca3af;
}

.tech-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.tech {
  border-radius: 8rpx;
  background-color: #f3f4f6;
  padding: 4rpx 12rpx;
  font-size: 20rpx;
  color: #6b7280;
}

/* ===== 操作按钮（胶囊，primary 底） ===== */
.btn-group {
  margin-top: 16rpx;
  padding-top: 16rpx;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16rpx;
}

.btn {
  flex: 1;
  box-sizing: border-box;
  text-align: center;
  padding: 12rpx 24rpx;
  border-radius: 999rpx;
  background-color: var(--uh-primary, #b9e424);
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

.text-overflow-1 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  overflow: hidden;
}
</style>
