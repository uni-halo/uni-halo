<script lang="ts" setup>
/**
 * 偏好设置页(两层:站点默认 L0 + 本地差异 L1-L,设计见 .docs/config-system-v2-redesign §3-4)
 * - 每项可「跟随站点默认」(差异为空)或覆盖为具体值;改动即写本地差异(uh_pref_local_v1)即时生效;
 * - 底部「重置为站点默认」= 清空全部本地差异,回退站长在插件后台配置的默认(未配置则为内置默认)。
 * - 风格:对齐全站设计语言(bg-page + uh-global-card-glass + uh-section-title)
 */
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { DefaultAppSettings } from '@/config/appSettings'
import { useAppConfigStore } from '@/store/appConfig'
import { useSettingStore } from '@/store/setting'
import { collectSiteDefaults, isLocalOverride, readLocalPrefs } from '@/utils/preference'
import type { LocalPrefs } from '@/utils/preference'

definePage({
  style: {
    navigationBarTitleText: '偏好设置',
  },
})

const settingStore = useSettingStore()
const appConfigStore = useAppConfigStore()

/** 确保启动合并已执行(入口页未跑或 H5 直达时兜底) */
onLoad(() => {
  if (!settingStore.siteDefaults) {
    settingStore.applySiteDefaults(collectSiteDefaults(appConfigStore.configs))
  }
  uni.setNavigationBarTitle({ title: '偏好设置' })
})

/* ---------------- 路径取值工具 ---------------- */
type Path = string[]

function getByPath(obj: unknown, path: Path): unknown {
  let cursor: unknown = obj
  for (const key of path) {
    if (cursor === null || cursor === undefined)
      return undefined
    cursor = (cursor as Record<string, unknown>)[key]
  }
  return cursor
}

/** 按路径构造差异 patch(null 表示删除该键=跟随站点默认) */
function buildPatch(path: Path, value: unknown): LocalPrefs {
  const [head, ...rest] = path
  if (rest.length === 0)
    return { [head]: value } as LocalPrefs
  return { [head]: buildPatch(rest, value) } as LocalPrefs
}

/** 偏好字段定义(现页已有项;弹幕已下线、友链分组二期再开) */
interface PrefDef {
  key: string
  label: string
  kind: 'bool' | 'enum'
  path: Path
  options?: { label: string, value: string }[]
  siteLabelOf?: (value: string) => string
}

const layoutPrefs: PrefDef[] = [
  {
    key: 'home',
    label: '首页文章布局',
    kind: 'enum',
    path: ['layout', 'home'],
    options: [
      { label: '一行一列', value: 'h_row_col1' },
      { label: '一行两列', value: 'h_row_col2' },
    ],
  },
  {
    key: 'cardType',
    label: '文章卡片样式',
    kind: 'enum',
    path: ['layout', 'cardType'],
    options: [
      { label: '左图右文', value: 'lr_image_text' },
      { label: '左文右图', value: 'lr_text_image' },
      { label: '上图下文', value: 'tb_image_text' },
      { label: '上文下图', value: 'tb_text_image' },
      { label: '只有文字', value: 'only_text' },
    ],
  },
]

const featurePrefs: PrefDef[] = [
  { key: 'useWaterfull', label: '图库瀑布流模式', kind: 'bool', path: ['gallery', 'useWaterfull'] },
  { key: 'useSimple', label: '友链简洁模式', kind: 'bool', path: ['links', 'useSimple'] },
  { key: 'isAvatarRadius', label: '是否圆形头像', kind: 'bool', path: ['isAvatarRadius'] },
  { key: 'useDot', label: '轮播图指示器', kind: 'bool', path: ['banner', 'useDot'] },
  {
    key: 'dotPosition',
    label: '指示器位置',
    kind: 'enum',
    path: ['banner', 'dotPosition'],
    options: [
      { label: '右边', value: 'right' },
      { label: '下边', value: 'bottom' },
    ],
    siteLabelOf: (value: string) => {
      const map: Record<string, string> = { right: '右边', bottom: '下边', left: '左边', top: '上边' }
      return map[value] || value
    },
  },
]

/* ---------------- 状态读取 ---------------- */
function valueOf(path: Path): unknown {
  return getByPath(settingStore.settings, path)
}

/** 站点默认值(未配置时回退内置默认) */
function siteDefaultOf(path: Path): unknown {
  const site = getByPath(settingStore.siteDefaults, path)
  if (site !== undefined && site !== null)
    return site
  return getByPath(DefaultAppSettings, path)
}

function isOverridden(path: Path): boolean {
  return isLocalOverride(readLocalPrefs(), path)
}

function enumLabelOf(def: PrefDef, value: unknown): string {
  const hit = def.options?.find(opt => opt.value === value)
  if (hit)
    return hit.label
  if (def.siteLabelOf && typeof value === 'string')
    return def.siteLabelOf(value)
  return value === undefined || value === null ? '—' : String(value)
}

/* ---------------- 交互 ---------------- */
/** 开关事件(模板透传 $event) */
function handleSwitchChange(def: PrefDef, detail: { value?: unknown }) {
  handleBoolChange(def.path, detail.value === true)
}

/** 开关类:选值等于站点默认则还原为跟随(只存差异) */
function handleBoolChange(path: Path, next: boolean) {
  if (next === siteDefaultOf(path)) {
    settingStore.savePreference(buildPatch(path, null))
  }
  else {
    settingStore.savePreference(buildPatch(path, next))
  }
}

/** 单项还原为跟随站点默认 */
function handleRevert(path: Path) {
  settingStore.savePreference(buildPatch(path, null))
}

/* ---------------- 枚举底部弹层 ---------------- */
const enumSheet = ref<{ show: boolean, def: PrefDef | null }>({ show: false, def: null })

function handleOpenEnum(def: PrefDef) {
  enumSheet.value = { show: true, def }
}

function handleCloseEnum() {
  enumSheet.value.show = false
}

function handleChooseEnum(value: string | null) {
  const def = enumSheet.value.def
  if (def) {
    if (value === null || value === siteDefaultOf(def.path)) {
      handleRevert(def.path)
    }
    else {
      settingStore.savePreference(buildPatch(def.path, value))
    }
  }
  handleCloseEnum()
}

/** 当前枚举项是否处于「跟随站点默认」 */
function isFollowing(def: PrefDef): boolean {
  return !isOverridden(def.path)
}

/* ---------------- 重置全部 ---------------- */
function handleResetAll() {
  uni.showModal({
    title: '提示',
    content: '确定将所有偏好恢复为站点默认吗？本地自定义的偏好将被清除，未配置站点默认的项将恢复为内置默认。',
    showCancel: true,
    cancelText: '取消',
    confirmText: '确定',
    confirmColor: '#03a9f4',
    success: (res) => {
      if (res.confirm) {
        settingStore.resetPreferences()
        enumSheet.value.show = false
        uni.showToast({ icon: 'none', title: '已恢复为站点默认' })
      }
    },
  })
}
</script>

<template>
  <view class="app-page box-border min-h-screen bg-page pb-[200rpx]">
    <!-- 说明 -->
    <view class="pref-tip uh-global-card-glass mx-4 mt-4 flex items-start gap-2 rounded-xl px-4 py-3">
      <wd-icon name="info" size="28rpx" color="#a8a294" class="mt-0.5 shrink-0" />
      <text class="tip-text flex-1 text-2xs text-gray-400 leading-[1.6]">
        你的偏好仅保存在本机。未自定义的项自动跟随站长在插件后台配置的「站点默认」；点击底部「重置为站点默认」可清空全部本地偏好。
      </text>
    </view>

    <!-- 布局设置 -->
    <uh-section-title class="mx-4 mb-3 mt-6 text-[30rpx]">
      布局
      <template #right>
        <text class="text-2xs text-gray-400">应用以及文章列表布局设置</text>
      </template>
    </uh-section-title>
    <view class="setting-sheet uh-global-card-glass mx-4 overflow-hidden rounded-2xl">
      <view
        v-for="(def, index) in layoutPrefs"
        :key="def.key"
        class="pick-row flex items-center justify-between px-4 py-4"
        :class="index < layoutPrefs.length - 1 ? 'border-b border-black/5' : ''"
        @click="handleOpenEnum(def)"
      >
        <view class="row-left flex flex-col gap-1">
          <text class="row-label text-[28rpx] text-gray-900 font-bold">{{ def.label }}</text>
          <view class="flex items-center gap-2">
            <text v-if="isFollowing(def)" class="row-sub text-2xs text-gray-400">跟随站点默认</text>
            <view v-else class="rounded-full bg-secondary px-2 py-0.5 text-[20rpx] text-[#4d7c0f] leading-none">
              已自定义
            </view>
          </view>
        </view>
        <view class="row-value flex items-center gap-2">
          <text class="value-text text-[26rpx] text-gray-400">{{ enumLabelOf(def, valueOf(def.path)) }}</text>
          <wd-icon name="arrow-right" size="12px" color="#c8c2b4" />
        </view>
      </view>
    </view>

    <!-- 功能设置 -->
    <uh-section-title class="mx-4 mb-3 mt-6 text-[30rpx]">
      功能
      <template #right>
        <text class="text-2xs text-gray-400">一些常用的功能性设置</text>
      </template>
    </uh-section-title>
    <view class="setting-sheet uh-global-card-glass mx-4 overflow-hidden rounded-2xl">
      <template v-for="(def, index) in featurePrefs" :key="def.key">
        <!-- 布尔开关 -->
        <view
          v-if="def.kind === 'bool'"
          class="switch-row flex items-center justify-between px-4 py-4"
          :class="index < featurePrefs.length - 1 ? 'border-b border-black/5' : ''"
        >
          <view class="row-left flex flex-col gap-1">
            <text class="row-label text-[28rpx] text-gray-900 font-bold">{{ def.label }}</text>
            <view class="flex items-center gap-2">
              <text v-if="isFollowing(def)" class="row-sub text-2xs text-gray-400">跟随站点默认</text>
              <template v-else>
                <view class="rounded-full bg-secondary px-2 py-0.5 text-[20rpx] text-[#4d7c0f] leading-none">
                  已自定义
                </view>
                <text class="revert-text text-2xs text-gray-400 underline" @click.stop="handleRevert(def.path)">恢复默认</text>
              </template>
            </view>
          </view>
          <wd-switch :model-value="!!valueOf(def.path)" @change="handleSwitchChange(def, $event)" />
        </view>
        <!-- 枚举选择(指示器位置) -->
        <view
          v-else
          class="pick-row flex items-center justify-between px-4 py-4"
          :class="index < featurePrefs.length - 1 ? 'border-b border-black/5' : ''"
          @click="handleOpenEnum(def)"
        >
          <view class="row-left flex flex-col gap-1">
            <text class="row-label text-[28rpx] text-gray-900 font-bold">{{ def.label }}</text>
            <view class="flex items-center gap-2">
              <text v-if="isFollowing(def)" class="row-sub text-2xs text-gray-400">跟随站点默认</text>
              <template v-else>
                <view class="rounded-full bg-secondary px-2 py-0.5 text-[20rpx] text-[#4d7c0f] leading-none">
                  已自定义
                </view>
                <text class="revert-text text-2xs text-gray-400 underline" @click.stop="handleRevert(def.path)">恢复默认</text>
              </template>
            </view>
          </view>
          <view class="row-value flex items-center gap-2">
            <text class="value-text text-[26rpx] text-gray-400">{{ enumLabelOf(def, valueOf(def.path)) }}</text>
            <wd-icon name="arrow-right" size="12px" color="#c8c2b4" />
          </view>
        </view>
      </template>
    </view>

    <!-- 底部操作栏(玻璃悬浮 + 底部安全区适配) -->
    <view class="btn-bar uh-global-card-glass fixed bottom-0 left-0 box-border w-screen px-4 pt-3 pb-safe">
      <view class="reset-btn h-[84rpx] w-full flex items-center justify-center rounded-full bg-gray-900 active:opacity-80" @click="handleResetAll">
        <text class="text-[28rpx] text-white font-bold">重置为站点默认</text>
      </view>
    </view>

    <!-- 枚举选择底部弹层 -->
    <wd-popup
      v-model="enumSheet.show"
      position="bottom"
      closable
      custom-style="border-radius: 24rpx 24rpx 0 0;"
      @close="handleCloseEnum"
    >
      <view v-if="enumSheet.def" class="enum-sheet box-border w-full pb-[env(safe-area-inset-bottom)]">
        <view class="enum-title py-6 text-center text-[30rpx] text-gray-900 font-bold">
          {{ enumSheet.def.label }}
        </view>
        <view
          class="enum-item flex items-center justify-between px-6 py-5"
          :class="isFollowing(enumSheet.def) ? 'bg-secondary text-[#4d7c0f]' : 'text-gray-900'"
          @click="handleChooseEnum(null)"
        >
          <text class="text-[28rpx]">跟随站点默认</text>
          <wd-icon v-if="isFollowing(enumSheet.def)" name="check" size="16px" color="#4d7c0f" />
        </view>
        <view
          v-for="opt in enumSheet.def.options"
          :key="opt.value"
          class="enum-item flex items-center justify-between border-t border-[#f0ece2] px-6 py-5"
          :class="valueOf(enumSheet.def.path) === opt.value && !isFollowing(enumSheet.def) ? 'bg-secondary text-[#4d7c0f]' : 'text-gray-900'"
          @click="handleChooseEnum(opt.value)"
        >
          <text class="text-[28rpx]">{{ opt.label }}</text>
          <wd-icon
            v-if="valueOf(enumSheet.def.path) === opt.value && !isFollowing(enumSheet.def)"
            name="check"
            size="16px"
            color="#4d7c0f"
          />
        </view>
      </view>
    </wd-popup>
  </view>
</template>
