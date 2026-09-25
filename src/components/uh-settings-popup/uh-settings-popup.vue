<script lang="ts" setup>
import { ref } from 'vue'
import { useDialog } from '@wot-ui/ui'
import { DIALOG_CANCEL_BUTTON_PROPS, DIALOG_CONFIRM_BUTTON_PROPS } from '@/config/dialog'
import { useSettingStore } from '@/store/setting'
import { usePreferenceRows } from '@/hooks/usePreferenceRows'
import { DataLoadingStatusEnum } from '@/hooks/useDataLoadingStatus'
import { isWechat } from '@/utils/platform'

defineOptions({
  options: {
    styleIsolation: 'apply-shared',
  },
})

const props = defineProps<IProps>()

const emits = defineEmits<IEmits>()

const settingStore = useSettingStore()

interface IProps {
  /** v-model:是否显示 */
  modelValue: boolean
}

const {
  SETTING_TABS,
  layoutGroups,
  featureGroups,
  prefValueOf,
  isFollowing,
  handleChoose,
  isCardTypeOptionDisabled,
} = usePreferenceRows()

interface IEmits {
  (e: 'update:modelValue', value: boolean): void
}

/** v-model 代理:将 uh-glass-popup 的 modelValue 转发给父组件,避免直接写 readonly props */
const popupVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emits('update:modelValue', value),
})

const activeTab = ref<'layout' | 'feature'>('layout')

/**
 * 布局分组按当前页面过滤。
 * 弹窗在 App.ku.vue 全局只挂载一次,getCurrentPages 必须在每次打开时重新读取,
 * 否则 currentPage 永远是启动入口页(通常是 home),其他页面的布局设置将错位。
 */
const routeKey = ref('')
watch(() => props.modelValue, (visible) => {
  if (visible) {
    const pages = getCurrentPages()
    const current = pages[pages.length - 1]
    routeKey.value = current?.route?.split('/').pop() || ''
  }
})
/** 路由末段 → 布局分组 key(user-profile 笔记 tab 消费文章卡片配置,归入 articles 组) */
const ROUTE_GROUP_ALIAS: Record<string, string> = { 'user-profile': 'articles' }
const filterLayoutGroups = computed(() => {
  const key = ROUTE_GROUP_ALIAS[routeKey.value] || routeKey.value
  return layoutGroups.value.filter(group => group.key === key)
})
/** 功能分组:全局性偏好(通用功能/友链功能),不做页面过滤 */
const filterFeatureGroups = computed(() => featureGroups.value)

/* ---------------- 交互 ---------------- */
function currentValueOf(path: string[]): string | null {
  return isFollowing(path) ? null : String(prefValueOf(path) ?? '')
}

function handleInlineChoose(path: string[], value: string | null): void {
  handleChoose(path, value)
}

/* ---------------- 重置全部 ---------------- */
const dialog = useDialog('settings-popup')

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
  settingStore.resetPreferences()
  uni.showToast({ icon: 'none', title: '已恢复为站点默认' })
}

function handleClose() {
  emits('update:modelValue', false)
}
</script>

<template>
  <uh-glass-popup
    v-model="popupVisible" position="bottom" custom-class="rounded-xl !border"
    :z-index="110" hide-when-close
  >
    <!-- 弹窗容器 -->
    <view class="box-border w-full flex flex-col gap-y-3 p-3">
      <!-- 顶部 -->
      <view class="flex items-center justify-between">
        <text class="text-md font-bold">偏好设置</text>
        <view
          class="uh-global-card-glass h-6 w-6 flex items-center justify-center border rounded-lg text-gray-500 shadow-none !bg-white/5"
          @click="handleClose()"
        >
          <wd-icon name="close" size="28rpx" />
        </view>
      </view>

      <!-- 分段器:布局 / 功能 -->
      <view class="uh-global-card-glass flex rounded-xl p-1 shadow-none">
        <view
          v-for="tab in SETTING_TABS" :key="tab.key"
          class="box-border flex-1 rounded-lg py-2 text-center text-3xs"
          :class="activeTab === tab.key ? 'bg-primary font-semibold' : 'text-gray-500'"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </view>
      </view>

      <!-- 滚动区域 -->
      <scroll-view scroll-y :show-scrollbar="false" class="max-h-[60vh]">
        <!-- 滚动内部容器 -->
        <view class="box-border w-full flex flex-col gap-y-3">
          <!-- 布局 -->
          <template v-if="activeTab === 'layout'">
            <!-- 路由过滤后无匹配分组:空态提示 -->
            <uh-data-loading
              v-if="filterLayoutGroups.length === 0"
              :loading-status="DataLoadingStatusEnum.Empty" size="mini" empty-text="无匹配的设置"
              empty-sub-text="当前页面没有可配置的布局项" min-height="30vh" :use-refresh-button="false"
            />
            <template v-else>
              <view v-for="group in filterLayoutGroups" :key="group.key" class="flex flex-col gap-y-3">
                <uh-section-title>{{ group.label }}</uh-section-title>
                <view class="uh-global-card-glass overflow-hidden rounded-xl shadow-none">
                  <view v-for="(row) in group.rows" :key="row.key" class="box-border p-3">
                    <!-- 左 label / 右 说明 -->
                    <view class="flex items-center justify-between">
                      <text class="text-3xs text-gray-900 font-semibold">{{ row.label }}</text>
                      <view class="flex items-center gap-2">
                        <text v-if="row.following" class="row-sub text-xs text-gray-400">默认</text>
                        <view
                          v-else
                          class="rounded-full bg-secondary px-2 py-1 text-xs text-gray-900 leading-none"
                        >
                          已自定义
                        </view>
                      </view>
                    </view>
                    <!-- 下方横向选项(分段器风格:默认 + options) -->
                    <view class="mt-3 flex flex-wrap gap-2">
                      <view
                        class="uh-global-card-glass uh-shadow-xs border rounded-full px-3 py-1 text-xs"
                        :class="currentValueOf(row.path) === null ? 'bg-secondary' : 'border-gray-100 text-gray-500'"
                        @click="handleInlineChoose(row.path, null)"
                      >
                        默认
                      </view>
                      <view
                        v-for="opt in row.options" :key="opt.value"
                        class="uh-global-card-glass uh-shadow-xs border rounded-full px-3 py-1 text-xs"
                        :class="[
                          currentValueOf(row.path) === opt.value ? 'bg-secondary' : 'border-gray-100 text-gray-500',
                          isCardTypeOptionDisabled(row.path, opt.value) ? 'opacity-40' : '',
                        ]" @click="isCardTypeOptionDisabled(row.path, opt.value) ? null : handleInlineChoose(row.path, opt.value)"
                      >
                        {{ opt.label }}
                      </view>
                    </view>
                  </view>
                </view>
              </view>
            </template>
          </template>

          <!-- 功能:按功能分组(通用功能/友链功能) -->
          <template v-else>
            <!-- 空态兜底(当前功能分组不过滤页面,防御性提示) -->
            <uh-data-loading
              v-if="filterFeatureGroups.length === 0"
              :loading-status="DataLoadingStatusEnum.Empty" size="mini" empty-text="无匹配的设置"
              empty-sub-text="当前没有可配置的功能项" min-height="30vh" :use-refresh-button="false"
            />
            <template v-else>
              <view v-for="group in filterFeatureGroups" :key="group.key" class="flex flex-col gap-y-3">
                <uh-section-title>{{ group.label }}</uh-section-title>
                <view class="uh-global-card-glass overflow-hidden rounded-2xl shadow-none">
                  <view
                    v-for="(row, index) in group.rows" :key="row.key" class="px-4 py-4"
                    :class="index < group.rows.length - 1 ? 'border-b border-black/5' : ''"
                  >
                    <view class="flex items-center justify-between">
                      <text
                        class="row-label text-3xs text-gray-900 font-semibold"
                      >
                        {{ row.label }}
                      </text>
                      <view class="flex items-center gap-2">
                        <text
                          v-if="row.following"
                          class="row-sub text-xs text-gray-400"
                        >
                          跟随站点默认
                        </text>
                        <view
                          v-else
                          class="rounded-full bg-secondary px-2 py-0.5 text-xs text-gray-900 leading-none"
                        >
                          已自定义
                        </view>
                      </view>
                    </view>
                    <view class="mt-3 flex flex-wrap gap-2">
                      <view
                        class="uh-global-card-glass uh-shadow-xs border rounded-full px-3 py-1 text-xs"
                        :class="currentValueOf(row.path) === null ? 'bg-secondary' : 'border-gray-100 text-gray-500'"
                        @click="handleInlineChoose(row.path, null)"
                      >
                        默认
                      </view>
                      <view
                        v-for="opt in row.options" :key="opt.value"
                        class="uh-global-card-glass uh-shadow-xs border rounded-full px-3 py-1 text-xs"
                        :class="currentValueOf(row.path) === opt.value ? 'bg-secondary' : 'border-gray-100 text-gray-500'"
                        @click="handleInlineChoose(row.path, opt.value)"
                      >
                        {{ opt.label }}
                      </view>
                    </view>
                  </view>
                </view>
              </view>
            </template>
          </template>
        </view>
      </scroll-view>

      <!-- 底部固定操作区域 -->
      <view class="box-border w-full flex items-center gap-x-2">
        <uh-button
          class="flex-1" custom-class="flex-1 uh-global-card-glass uh-shadow-xs bg-white/90 border !py-2.5 !rounded-xl !text-3xs"
          @click="handleClose()"
        >
          关闭
        </uh-button>
        <uh-button
          class="flex-1" custom-class="flex-1 uh-global-card-glass uh-shadow-xs border !py-2.5 !rounded-xl !text-3xs"
          @click="handleResetAll"
        >
          恢复默认
        </uh-button>
      </view>
    </view>
  </uh-glass-popup>
  <wd-dialog selector="settings-popup" />
</template>
