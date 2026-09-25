<script lang="ts" setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { onLoad, onPageScroll } from '@dcloudio/uni-app'
import { useAppConfigStore } from '@/store/appConfig'
import { useSettingStore } from '@/store/setting'
import { usePageScroll } from '@/hooks/usePageScroll'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useDialog } from '@wot-ui/ui'
import { DIALOG_CANCEL_BUTTON_PROPS, DIALOG_CONFIRM_BUTTON_PROPS } from '@/config/dialog'
import { collectSiteDefaults } from '@/utils/preference'
import { usePreferenceRows } from '@/hooks/usePreferenceRows'
import type { PrefDef } from '@/hooks/usePreferenceRows'

const dialog = useDialog()

definePage({
  style: {
    navigationBarTitleText: '偏好设置',
    navigationStyle: 'custom',
  },
})

const { scrollY, updatePageScrollValue } = usePageScroll()
/** 页面标题（插件端可配置，留空回退内置默认） */
const pageTitle = usePageTitle('setting', '偏好设置')
const settingStore = useSettingStore()
const appConfigStore = useAppConfigStore()
const { siteDefaults } = storeToRefs(settingStore)
const { configs } = storeToRefs(appConfigStore)
const { applySiteDefaults, resetPreferences } = settingStore

/** 公共:字段定义/三态/行构建/选值(与全局弹窗 uh-settings-popup 共用 usePreferenceRows) */
const {
  SETTING_TABS,
  layoutGroups,
  featureGroups,
  prefValueOf,
  isFollowing,
  handleRevert,
  handleChoose,
  isCardTypeOptionDisabled,
} = usePreferenceRows()

/** 确保启动合并已执行(入口页未跑或 H5 直达时兜底) */
onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})

onLoad(() => {
  if (!siteDefaults.value) {
    applySiteDefaults(collectSiteDefaults(configs.value))
  }
  uni.setNavigationBarTitle({ title: '偏好设置' })
})

/* ---------------- 顶部分段器(布局 / 功能) ---------------- */
const activeTab = ref<'layout' | 'feature'>('layout')

/* ---------------- 交互 ---------------- */
/* ---------------- 枚举底部弹层(uh-glass-popup + wd-picker-view) ---------------- */
const enumSheet = ref<{ show: boolean, def: PrefDef | null }>({ show: false, def: null })
/** 弹层内滚动中的临时选中值(单列;确认时才落库,取消不生效) */
const pickerValue = ref<(string | number)[]>([''])

function handleOpenEnum(def: PrefDef) {
  enumSheet.value = { show: true, def }
  // 打开时同步当前值(跟随站点默认 → 空串哨兵)
  pickerValue.value = [isFollowing(def.path) ? '' : String(prefValueOf(def.path) ?? '')]
}

function handleCloseEnum() {
  enumSheet.value.show = false
}

function handleChooseEnum(value: string | null) {
  const def = enumSheet.value.def
  if (def) {
    handleChoose(def.path, value)
  }
  handleCloseEnum()
}

/* ---------------- wd-picker-view 弹层数据 ---------------- */
/** 枚举弹层列(首项「跟随站点默认」,空串哨兵映射 null;双列约束下卡片样式仅保留 image_top) */
const enumColumns = computed(() => {
  const def = enumSheet.value.def
  if (!def) { return [] }
  const options = (def.options || []).filter(opt => !isCardTypeOptionDisabled(def.path, opt.value))
  return [
    { label: '跟随站点默认', value: '' },
    ...options.map(opt => ({ label: opt.label, value: opt.value })),
  ]
})

/** wd-picker-view 滚动变化:更新临时选中值(未确认不落库) */
function handlePickerChange(payload: { selectedValues: (string | number)[] }) {
  pickerValue.value = payload.selectedValues
}

/** 确认:空串哨兵还原为「跟随站点默认」 */
function handlePickerConfirm() {
  const picked = String(pickerValue.value[0] ?? '')
  handleChooseEnum(picked === '' ? null : picked)
}

/** 取消:不落库,直接关闭 */
function handlePickerCancel() {
  handleCloseEnum()
}

/* ---------------- 重置全部 ---------------- */
async function handleResetAll() {
  try {
    await dialog.confirm({
      title: '提示',
      msg: '确定将所有偏好恢复为站点默认吗？',
      zIndex: 9999,
      confirmButtonProps: DIALOG_CONFIRM_BUTTON_PROPS,
      cancelButtonProps: DIALOG_CANCEL_BUTTON_PROPS,
    })
  }
  catch {
    return
  }
  resetPreferences()
  enumSheet.value.show = false
  uni.showToast({ icon: 'none', title: '已恢复为站点默认' })
}
</script>

<template>
  <wd-dialog />
  <view class="box-border min-h-screen bg-page">
    <!-- 自定义标题 -->
    <uh-navbar
      :scroll-y="scrollY" :default-title="pageTitle" title-color="text-gray-900"
      :need-placeholder="true"
    />

    <!-- 内容区域 -->
    <view class="box-border flex flex-col gap-y-6 p-3">
      <!-- 顶部分段器:布局 / 功能 -->
      <view class="uh-global-card-glass uh-shadow-xs flex rounded-xl p-1">
        <view
          v-for="tab in SETTING_TABS" :key="tab.key" class="flex-1 rounded-lg py-2 text-center text-2xs"
          :class="activeTab === tab.key ? 'bg-primary font-medium' : 'text-gray-500'"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </view>
      </view>

      <!-- 布局 -->
      <template v-if="activeTab === 'layout'">
        <view v-for="group in layoutGroups" :key="group.key" class="flex flex-col gap-y-3">
          <uh-section-title>{{ group.label }}</uh-section-title>
          <view class="uh-global-card-glass uh-shadow-xs overflow-hidden rounded-2xl">
            <view
              v-for="(row) in group.rows" :key="row.key"
              class="box-border flex items-center justify-between p-3"
              @click="handleOpenEnum(row)"
            >
              <view class="row-left flex flex-col gap-1">
                <text class="text-3xs text-gray-900 font-semibold">{{ row.label }}</text>
                <view v-if="false" class="flex items-center gap-2">
                  <text v-if="row.following" class="row-sub text-xs text-gray-400">跟随站点默认</text>
                  <view
                    v-else
                    class="rounded-full bg-secondary px-2 py-0.5 text-xs text-[#4d7c0f] leading-none"
                  >
                    已自定义
                  </view>
                </view>
              </view>
              <view class="flex items-center gap-2 text-gray-400">
                <text class="text-xs">{{ row.displayValue }}</text>
                <wd-icon name="arrow-right" size="24rpx" />
              </view>
            </view>
          </view>
        </view>
      </template>

      <!-- 功能设置:按功能分组(通用功能/友链功能) -->
      <template v-else>
        <view v-for="group in featureGroups" :key="group.key" class="flex flex-col gap-y-3">
          <uh-section-title>{{ group.label }}</uh-section-title>
          <view class="uh-global-card-glass uh-shadow-xs overflow-hidden rounded-2xl">
            <view
              v-for="(row) in group.rows" :key="row.key"
              class="box-border flex items-center justify-between p-3"
              @click="handleOpenEnum(row)"
            >
              <view class="row-left flex flex-col gap-1">
                <text class="text-3xs text-gray-900 font-semibold">{{ row.label }}</text>
                <view v-if="false" class="flex items-center gap-2">
                  <text v-if="row.following" class="row-sub text-xs text-gray-400">跟随站点默认</text>
                  <template v-else>
                    <view
                      class="rounded-full bg-secondary px-2 py-0.5 text-xs text-[#4d7c0f] leading-none"
                    >
                      已自定义
                    </view>
                    <text
                      class="revert-text text-xs text-gray-400 underline"
                      @click.stop="handleRevert(row.path)"
                    >
                      恢复默认
                    </text>
                  </template>
                </view>
              </view>
              <view class="flex items-center gap-2 text-gray-400">
                <text class="text-xs">{{ row.displayValue }}</text>
                <wd-icon name="arrow-right" size="24rpx" />
              </view>
            </view>
          </view>
        </view>
      </template>
      <!-- 底部操作栏 -->
      <view class="box-border w-full">
        <uh-button class="flex-1" custom-class="uh-global-card-glass !py-2.5 !rounded-full !text-3xs !bg-primary" @click="handleResetAll">
          恢复默认
        </uh-button>
      </view>
    </view>

    <!-- 枚举选择弹层 -->
    <uh-glass-popup v-model="enumSheet.show" :hide-when-close="true" :z-index="999" position="bottom" custom-class="rounded-xl">
      <!-- 弹窗容器 -->
      <view class="box-border w-full flex flex-col gap-y-3 p-3">
        <!-- 顶部 -->
        <view class="flex items-center justify-between">
          <text class="text-md font-bold">{{ enumSheet.def?.label || '请选择' }}</text>
        </view>
        <!-- 选择器 -->
        <wd-picker-view
          v-model="pickerValue" :columns="enumColumns"
          custom-class="uh-picker-view !p-0 !bg-transparent !rounded-xl overflow-hidden"
          @change="handlePickerChange"
        />
        <!-- 底部固定操作区域 -->
        <view class="box-border w-full flex items-center justify-center gap-x-3">
          <uh-button
            class="flex-1"
            custom-class="flex-1 uh-global-card-glass uh-shadow-xs border !py-2.5 !rounded-xl !text-3xs !bg-white/90"
            @click="handlePickerCancel"
          >
            取消
          </uh-button>
          <uh-button
            class="flex-1"
            custom-class="flex-1 uh-global-card-glass uh-shadow-xs border !py-2.5 !rounded-xl !text-3xs !bg-primary text-gray-900"
            @click="handlePickerConfirm"
          >
            确定
          </uh-button>
        </view>
      </view>
    </uh-glass-popup>
  </view>
</template>

<style scoped lang="scss">
:deep(.uh-picker-view) {
  .wd-picker-view__mask {
    background: transparent !important;
  }

  .wd-picker-view__roller {
    border-radius: 16rpx !important;
  }
}
</style>
