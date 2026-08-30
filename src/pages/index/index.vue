<script lang="ts" setup>
defineOptions({
  name: 'Index',
})
definePage({
  // 使用 type: "home" 属性设置首页，其他页面不需要设置，默认为page
  type: 'home',
  style: {
    // 'custom' 表示开启自定义导航栏，默认 'default'
    navigationStyle: 'custom',
    navigationBarTitleText: '初始页面',
  },
})
 
console.log('index/index 首页打印了')

function toHome() {
  uni.switchTab({
    url: '/pages/tabbar/home/home',
  })
}

onLoad(() => {
  console.log('测试 uni API 自动引入: onLoad')
})
</script>

<template>
  <view class="box-border bg-white px-4 pt-safe w-screen h-screen flex flex-col items-center justify-center">
     uni-halo 
	 <wd-button @click="toHome()">去首页</wd-button>
  </view>
</template>
