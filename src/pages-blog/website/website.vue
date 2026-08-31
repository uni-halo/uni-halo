<script lang="ts" setup>
/**
 * 网站浏览页(源自旧项目 pagesC/website,新建复刻)
 * 内嵌 web-view 展示外部链接
 */
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

definePage({
  style: {
    navigationBarTitleText: '加载中...',
  },
})

const webUrl = ref('')

onLoad((options) => {
  try {
    const data = JSON.parse(options?.data || '{}')
    const { title, url } = data
    webUrl.value = decodeURIComponent(url || '')
    if (title) {
      uni.setNavigationBarTitle({ title })
    }
  }
  catch (err) {
    console.error('解析网站参数失败', err)
  }
})
</script>

<template>
  <view class="app-page w-screen">
    <web-view v-if="webUrl" :src="webUrl" />
    <view v-else class="text-grey h-[60vh] flex items-center justify-center">
      <wd-empty description="链接地址为空" />
    </view>
  </view>
</template>

<style scoped>
.app-page {
  width: 100vw;
}
</style>
