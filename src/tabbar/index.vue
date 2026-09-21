<script setup lang="ts">
// i-carbon-code
import { customTabbarEnable, needHideNativeTabbar, tabbarCacheEnable } from './config'
import { setTabbarItem } from './i18n'
import { tabbarList, tabbarStore } from './store'
import TabbarItem from './TabbarItem.vue'

// #ifdef MP-WEIXIN
// 将自定义节点设置成虚拟的（去掉自定义组件包裹层），更加接近Vue组件的表现，能更好的使用flex属性
defineOptions({
  virtualHost: true,
})
// #endif

function handleClick(index: number) {
  // 添加振动反馈
  uni.vibrateShort()

  // 点击原来的不做操作
  if (index === tabbarStore.curIdx) {
    return
  }
  const list = tabbarList.value
  if (!list[index]) {
    return
  }

  const url = list[index].pagePath
  tabbarStore.setCurIdx(index)
  if (tabbarCacheEnable) {
    uni.switchTab({ url })
  }
  else {
    uni.navigateTo({ url })
  }
}
// #ifndef MP-WEIXIN || MP-ALIPAY
// 因为有了 custom:true， 微信里面不需要多余的hide操作
onLoad(() => {
  // 解决原生 tabBar 未隐藏导致有2个 tabBar 的问题
  needHideNativeTabbar
  && uni.hideTabBar({
    fail(err) {
      console.log('hideTabBar fail: ', err)
    },
    success(res) {
      // console.log('hideTabBar success: ', res)
    },
  })
})
// #endif

// #ifdef MP-ALIPAY
onMounted(() => {
  // 解决支付宝自定义tabbar 未隐藏导致有2个 tabBar 的问题; 注意支付宝很特别，需要在 onMounted 钩子调用
  customTabbarEnable // 另外，支付宝里面，只要是 customTabbar 都需要隐藏
  && uni.hideTabBar({
    fail(err) {
      console.log('hideTabBar fail: ', err)
    },
    success(res) {
      // console.log('hideTabBar success: ', res)
    },
  })
})
// #endif
const rightButton = computed(() => {
  const index = tabbarList.value.findIndex(item => item.isRightButton)
  if (index !== -1) {
    return {
      index,
      item: tabbarList.value[index],
    }
  }
  return {
    index,
    item: null,
  }
})
const noRightTabbarList = computed(() => {
  return tabbarList.value.filter(item => !item.isRightButton)
})
const activeColor = 'var(--wot-color-theme, #1890ff)'
const inactiveColor = '#333'
function getColorByIndex(index: number) {
  return tabbarStore.curIdx === index ? activeColor : inactiveColor
}

function isActive(index: number) {
  return tabbarStore.curIdx === index
}

function handleClickRightButton() {
  if (typeof rightButton.value.item?.onClick === 'function') {
    rightButton.value.item.onClick(rightButton.value.item)
  }
}

// 注意，上面处理的是自定义tabbar，下面处理的是原生tabbar
onShow(() => {
  setTabbarItem()
})
</script>

<template>
  <view v-if="customTabbarEnable" class="h-56px overflow-hidden bg-page pb-safe">
    <view class="fixed bottom-0 z-100 box-border w-full px-12">
      <view class="box-border w-full flex items-center justify-between gap-x-2" @touchmove.stop.prevent>
        <view
          class="uh-global-card-glass box-border flex flex-1 items-center gap-x-1 border rounded-full bg-white/75 p-1"
        >
          <view
            v-for="(item, index) in noRightTabbarList" :key="index" class="flex-1 text-gray-900"
            :style="{ color: getColorByIndex(index) }" @click="handleClick(index)"
          >
            <TabbarItem
              :item="item" :index="index"
              :custom-class="isActive(index) ? 'relative uh-global-card-glass border' : ''"
            />
          </view>
        </view>
        <view
          v-if="rightButton.item"
          class="uh-global-card-glass h-50px w-50px flex shrink-0 items-center justify-center border rounded-full bg-white/65 p-1"
          @click="handleClickRightButton()"
        >
          <TabbarItem :item="rightButton.item" :index="rightButton.index" :is-bulge="true" />
        </view>
      </view>
      <view class="pb-safe" />
    </view>
  </view>
</template>
