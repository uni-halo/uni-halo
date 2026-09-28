<template>
  <view class="halo-plugin-wrapper halo-plugin-status" :class="[loading]" @click="onCardTap">
    <view v-if="loading !== 'success'" class="halo-plugin-wrapper-error" @click.stop="getData()">
      {{ loadingText }}
    </view>
    <template v-else>
      显示插件结果，{{ loadingText }}
    </template>
  </view>
</template>

<script>

export default {
  emits: ['actions'],
  props: {
    mode: {
      type: Boolean,
      default: false
    },
    // 组件所有的参数
    n: {
      type: Object,
      default () {
        return {}
      }
    }
  },
  data () {
    return {
      options: {},
      loading: 'loading',
      loadingText: '加载中，请稍等...'
    }
  },
  created () {
    this.getData()
  },
  methods: {
    getData () {
      this.loadingText = '加载中，请稍等...'
      this.loading = 'loading'

      // todo:其他逻辑
      setTimeout(() => {
        this.loadingText = '组件数据加载成功'
        this.loading = 'success'
      }, 500)
    },
    // 整卡点击统一抛出，原始数据带投票 id
    onCardTap () {
      const id = (this.n && this.n.attrs && this.n.attrs.id) || ''
      this.$emit('actions', { action: 'tap', data: { id } })
    }
  }
}
</script>

<style lang="scss" scoped>
.halo-plugin-wrapper {
  width: 100%;
}

.halo-plugin-status.error {
  padding: 0;
  border-style: dashed;
  border-color: #e88080;
  color: #e88080;
  background-color: rgba(232, 128, 128, 0.075);
}

.halo-plugin-status.loading {
  padding: 0;
  border-style: dashed;
  border-color: rgba(3, 174, 252, 1);
  color: rgba(3, 174, 252, 1);
  background-color: rgba(3, 174, 252, 0.075);
}

.halo-plugin-wrapper-error {
  width: 100%;
}
</style>
