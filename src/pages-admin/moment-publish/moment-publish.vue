<script lang="ts" setup>
/**
 * 发布瞬间宿主页：弹窗抽离为 moment-edit-popup 组件（内聚编辑器/图片/提交逻辑）
 * 支持编辑模式：?name=xxx 时打开弹窗并回填
 */
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { usePageScroll } from '@/hooks/usePageScroll'
import { getMomentByName } from '@/api/halo'
import MomentEditPopup from './components/moment-edit-popup.vue'

const { scrollY, updatePageScrollValue } = usePageScroll()

definePage({
  style: {
    navigationBarTitleText: '发布瞬间',
    navigationStyle: 'custom',
  },
})

const popupVisible = ref(false)
const popupRef = ref<InstanceType<typeof MomentEditPopup> | null>(null)

onLoad(async (query) => {
  const name = query?.name
  if (!name) {
    popupVisible.value = true
    return
  }
  // 编辑模式：拉详情回填
  uni.setNavigationBarTitle({ title: '编辑瞬间' })
  try {
    const res = await getMomentByName(name)
    const target = res.data as any
    if (!target?.spec) {
      uni.showToast({ title: '瞬间不存在或无权编辑', icon: 'none' })
      return
    }
    popupRef.value?.openEdit(target)
  }
  catch (err: any) {
    uni.showToast({ title: err?.message || '加载瞬间失败', icon: 'none' })
  }
})

function handleEditClose(data: { isSubmit: boolean, refresh: boolean }) {
  popupVisible.value = false
  if (data.refresh)
    setTimeout(() => uni.navigateBack(), 600)
}
</script>

<template>
  <view class="min-h-screen bg-light-100 dark:bg-dark-800">
    <uh-navbar :scroll-y="scrollY" :use-back="true" default-title="发布瞬间" title-color="text-gray-900" />

    <!-- 发布/编辑弹窗（抽离组件，可复用） -->
    <MomentEditPopup ref="popupRef" :show="popupVisible" @on-close="handleEditClose" />
  </view>
</template>
