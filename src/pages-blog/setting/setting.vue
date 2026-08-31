<script lang="ts" setup>
/**
 * 应用设置页(源自旧项目 pagesA/setting,新建复刻)
 * 布局设置(首页布局/文章卡片样式)+ 功能设置(瀑布流/友链简洁/圆头像/轮播指示器)+ 保存/恢复默认
 */
import { reactive, ref, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { DefaultAppSettings } from '@/config/appSettings'
import { useSettingStore } from '@/store/setting'
import type { IAppSettings } from '@/config/appSettings'

definePage({
  style: {
    navigationBarTitleText: '应用设置',
  },
})

const settingStore = useSettingStore()

/* ---------------- 状态 ---------------- */
const loading = ref(true)
const isSaved = ref(true)
const firstLoad = ref(true)

/** 本地编辑副本(不与 store 直接双向绑定,保存时提交) */
const appSettings = reactive<IAppSettings>(JSON.parse(JSON.stringify(DefaultAppSettings)))

/* ---------------- 选择器配置 ---------------- */
const homeLayout = reactive({
  list: [
    { name: '一行一列', value: 'h_row_col1' },
    { name: '一行两列', value: 'h_row_col2' },
  ],
  selectLabel: '一行一列',
  selectValue: 'h_row_col1',
})

const articleCardStyle = reactive({
  list: [
    { name: '左图右文', value: 'lr_image_text' },
    { name: '左文右图', value: 'lr_text_image' },
    { name: '上图下文', value: 'tb_image_text' },
    { name: '上文下图', value: 'tb_text_image' },
    { name: '只有文字', value: 'only_text' },
  ],
  selectLabel: '左图右文',
  selectValue: 'lr_image_text',
})

const dotPositionList = reactive([
  { name: '右边', value: 'right', checked: true },
  { name: '下边', value: 'bottom', checked: false },
])

/* ---------------- 工具 ---------------- */
function handleFindObjInList<T extends Record<string, unknown>>(list: T[], key: string, value: unknown): T {
  return list.find(x => x[key] === value) || list[0]
}

/** 统一处理选择框回显 */
function handleHandleFormatSelect() {
  const _homeLayout = handleFindObjInList(homeLayout.list, 'value', appSettings.layout.home)
  homeLayout.selectLabel = _homeLayout.name
  homeLayout.selectValue = _homeLayout.value

  const _cardStyle = handleFindObjInList(articleCardStyle.list, 'value', appSettings.layout.cardType)
  articleCardStyle.selectLabel = _cardStyle.name
  articleCardStyle.selectValue = _cardStyle.value

  const _dot = handleFindObjInList(dotPositionList, 'value', appSettings.banner.dotPosition)
  dotPositionList.forEach((item) => {
    item.checked = item.value === _dot.value
  })
}

/* ---------------- 交互 ---------------- */
function handleOnHomeLayoutConfirm() {
  const _select = handleFindObjInList(homeLayout.list, 'value', appSettings.layout.home)
  homeLayout.selectLabel = _select.name
  homeLayout.selectValue = _select.value
}

function handleOnArticleCardStyleConfirm() {
  const _select = handleFindObjInList(articleCardStyle.list, 'value', appSettings.layout.cardType)
  articleCardStyle.selectLabel = _select.name
  articleCardStyle.selectValue = _select.value
}

function handleOnBannerDotChange(e: { value?: string }) {
  const value = e.value || 'right'
  appSettings.banner.dotPosition = value
}

/** 保存设置 */
function handleOnSave() {
  isSaved.value = true
  settingStore.settings = JSON.parse(JSON.stringify(appSettings))
  uni.showToast({ icon: 'none', title: '保存成功，部分设置在重启后生效！' })
}

/** 恢复默认设置 */
function handleOnSaveDefault() {
  uni.showModal({
    title: '提示',
    content: '您确定要恢复为默认的设置吗？',
    showCancel: true,
    cancelText: '否',
    cancelColor: '#999999',
    confirmText: '是',
    confirmColor: '#03a9f4',
    success: (res) => {
      if (res.confirm) {
        isSaved.value = true
        settingStore.updateDefaultAppSettings()
        Object.assign(appSettings, JSON.parse(JSON.stringify(DefaultAppSettings)))
        handleHandleFormatSelect()
        uni.showToast({ icon: 'none', title: '系统设置已恢复为默认配置，部分设置在重启后生效！' })
      }
    },
  })
}

function handleOnBack() {
  if (isSaved.value) {
    uni.navigateBack()
    return
  }
  uni.showModal({
    title: '提示',
    content: '您当前可能有未保存的数据，确定返回吗？',
    showCancel: true,
    cancelText: '否',
    cancelColor: '#999999',
    confirmText: '是',
    confirmColor: '#03a9f4',
    success: (res) => {
      if (res.confirm) {
        uni.navigateBack()
        isSaved.value = true
      }
    },
  })
}

/* ---------------- 监听 ---------------- */
watch(appSettings, () => {
  if (firstLoad.value) {
    firstLoad.value = false
  }
  else {
    isSaved.value = false
  }
}, { deep: true })

onLoad(() => {
  uni.setNavigationBarTitle({ title: '应用设置' })
  Object.assign(appSettings, JSON.parse(JSON.stringify(settingStore.settings)))
  handleHandleFormatSelect()
  uni.showLoading({ title: '加载中...', mask: true })
  setTimeout(() => {
    loading.value = false
    uni.hideLoading()
  }, 500)
})
</script>

<template>
  <view class="app-page box-border min-h-screen pb-[140rpx]" style="background-color: #fafafd;">
    <view v-if="!loading">
      <!-- 布局设置 -->
      <view class="setting-sheet mx-6 mt-6 overflow-hidden rounded-xl bg-white shadow-sm">
        <view class="sheet-title border-b-2 border-[#f5f5f5] px-6 py-1.5">
          <text class="title-text text-[30rpx] text-[#303133] font-bold">布局</text>
          <text class="title-desc ml-3 text-[22rpx] text-[#999]">应用以及文章列表布局设置</text>
        </view>
        <view class="sheet-content">
          <!-- 首页布局 -->
          <view class="pick-row flex items-center justify-between border-b-2 border-[#f5f5f5] px-8 py-7" @click="handleOnHomeLayoutConfirm">
            <text class="row-label text-[28rpx] text-[#333]">首页文章布局</text>
            <view class="row-value flex items-center gap-2">
              <text class="value-text text-[26rpx] text-[#999]">{{ homeLayout.selectLabel }}</text>
              <wd-icon name="arrow-right" size="12px" color="#999" />
            </view>
          </view>
          <!-- 文章卡片样式 -->
          <view class="pick-row flex items-center justify-between px-8 py-7" @click="handleOnArticleCardStyleConfirm">
            <text class="row-label text-[28rpx] text-[#333]">文章卡片样式</text>
            <view class="row-value flex items-center gap-2">
              <text class="value-text text-[26rpx] text-[#999]">{{ articleCardStyle.selectLabel }}</text>
              <wd-icon name="arrow-right" size="12px" color="#999" />
            </view>
          </view>
        </view>
      </view>

      <!-- 功能设置 -->
      <view class="setting-sheet mx-6 mt-6 overflow-hidden rounded-xl bg-white shadow-sm">
        <view class="sheet-title border-b-2 border-[#f5f5f5] px-6 py-1.5">
          <text class="title-text text-[30rpx] text-[#303133] font-bold">功能</text>
          <text class="title-desc ml-3 text-[22rpx] text-[#999]">一些常用的功能性设置</text>
        </view>
        <view class="sheet-content">
          <view class="switch-row flex items-center justify-between border-b-2 border-[#f5f5f5] px-8 py-7">
            <text class="row-label text-[28rpx] text-[#333]">图库瀑布流模式</text>
            <wd-switch v-model="appSettings.gallery.useWaterfull" />
          </view>
          <view class="switch-row flex items-center justify-between border-b-2 border-[#f5f5f5] px-8 py-7">
            <text class="row-label text-[28rpx] text-[#333]">友链简洁模式</text>
            <wd-switch v-model="appSettings.links.useSimple" />
          </view>
          <view class="switch-row flex items-center justify-between border-b-2 border-[#f5f5f5] px-8 py-7">
            <text class="row-label text-[28rpx] text-[#333]">是否圆形头像</text>
            <wd-switch v-model="appSettings.isAvatarRadius" />
          </view>
          <view class="switch-row flex items-center justify-between border-b-2 border-[#f5f5f5] px-8 py-7">
            <text class="row-label text-[28rpx] text-[#333]">轮播图指示器</text>
            <wd-switch v-model="appSettings.banner.useDot" />
          </view>
          <!-- 指示器位置 -->
          <view v-if="appSettings.banner.useDot" class="switch-row flex items-center justify-between px-8 py-7">
            <text class="row-label text-[28rpx] text-[#333]">指示器位置</text>
            <view class="radio-group flex gap-4">
              <view
                v-for="item in dotPositionList"
                :key="item.value"
                class="radio-item rounded-3xl px-6 py-1 text-[24rpx] text-[#999]"
                :class="item.checked ? 'bg-[#03a9f4] text-white' : 'bg-[#f5f5f5]'"
                @click="item.checked = true; handleOnBannerDotChange({ value: item.value })"
              >
                {{ item.name }}
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 操作区域 -->
    <view v-if="!loading" class="btn-bar fixed bottom-0 left-0 box-border w-screen flex gap-6 bg-white p-6 shadow-sm">
      <wd-button type="primary" size="medium" @click="handleOnSave">
        保存设置
      </wd-button>
      <wd-button type="danger" size="medium" @click="handleOnSaveDefault">
        恢复默认设置
      </wd-button>
      <wd-button plain size="medium" @click="handleOnBack">
        返回
      </wd-button>
    </view>
  </view>
</template>

<style scoped>
.app-page {
  /* 布局全部由 UnoCSS 原子类实现 */
}

.btn-bar {
  :deep(wd-button) {
    flex: 1;
  }
}
</style>
