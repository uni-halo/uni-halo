<script lang="ts" setup>
/**
 * 我的装扮面板(装扮 Tab 主体)
 * 槽位宫格 + 选择弹层 + 装扮墙公开开关 + 保存佩戴
 */
import { ref } from 'vue'
import { DECORATION_SLOTS } from '../../composables/use-my-decorations'
import type { DecorationSlotKey, IDecorationSlotDef, UseMyDecorations } from '../../composables/use-my-decorations'
import DecorationPicker from '../decoration-picker/decoration-picker.vue'
import DecorationSlot from '../decoration-slot/decoration-slot.vue'

interface IProps {
  /** 装扮组合式状态(页面持有,与头部预览共享) */
  deco: UseMyDecorations
}

const props = defineProps<IProps>()

const deco = props.deco

/* ---------------- 选择弹层 ---------------- */
const pickerVisible = ref(false)
const activeSlot = ref<IDecorationSlotDef | null>(null)

function openPicker(slot: typeof DECORATION_SLOTS[number]) {
  activeSlot.value = slot
  pickerVisible.value = true
}

/** 弹层确认:写回草稿 */
function onPickerConfirm(names: string[]) {
  if (!activeSlot.value) {
    return
  }
  deco.draft.value = { ...deco.draft.value, [activeSlot.value.key]: names }
}

/** 槽位草稿值(传给弹层) */
function slotValue(key: DecorationSlotKey) {
  return deco.draft.value[key]
}
</script>

<template>
  <view class="box-border flex flex-col gap-y-4">
    <uh-data-loading
      v-if="deco.loading.value && !deco.loaded.value" loading-status="loading"
      min-height="40vh"
    />
    <template v-else>
      <!-- 失效提示 -->
      <view
        v-if="deco.invalidCount.value > 0"
        class="flex items-center gap-x-1.5 rounded-xl bg-orange-400/10 px-3 py-2"
      >
        <wd-icon name="warn-bold" size="28rpx" custom-class="text-orange-500" />
        <text class="flex-1 text-3xs text-orange-500">
          有 {{ deco.invalidCount.value }} 件已佩戴装扮失效了，点击对应槽位重新选择
        </text>
      </view>

      <!-- 佩戴槽位 -->
      <view class="flex flex-col">
        <uh-section-title>佩戴槽位</uh-section-title>
        <view class="uh-global-card-glass uh-shadow-xs grid grid-cols-3 mt-3 gap-2 rounded-2xl p-3">
          <DecorationSlot
            v-for="slot in DECORATION_SLOTS" :key="slot.key"
            :label="slot.label"
            :item="slot.multiple ? null : deco.itemByName(deco.draft.value[slot.key][0])"
            :worn="deco.draft.value[slot.key].length > 0"
            :count="slot.multiple ? deco.draft.value[slot.key].length : 0"
            :rarity="deco.rarityOf(deco.itemByName(deco.draft.value[slot.key][0])?.rarityName)"
            @on-tap="openPicker(slot)"
          />
        </view>
      </view>

      <!-- 公开装扮墙 -->
      <view class="flex flex-col">
        <uh-section-title>装扮墙</uh-section-title>
        <view class="uh-global-card-glass uh-shadow-xs mt-3 flex items-center gap-x-3 rounded-2xl px-4 py-3.5">
          <view class="flex flex-1 flex-col gap-y-1">
            <text class="text-sm text-gray-900">公开装扮墙</text>
            <text class="text-xs text-gray-400">关闭后主页不再显示装扮墙</text>
          </view>
          <wd-switch
            :model-value="deco.visibility.value" size="40rpx"
            @change="(v: { value: boolean }) => deco.toggleVisibility(v.value)"
          />
        </view>
      </view>
    </template>

    <!-- 底部保存条(草稿有改动时出现) -->
    <view v-if="deco.dirty.value" class="box-border w-full pb-safe">
      <view class="uh-global-card-glass uh-shadow-xs box-border flex items-center gap-x-3 border rounded-xl p-2 pl-4">
        <text class="flex-1 text-xs text-gray-600">已修改 {{ deco.dirtyCount.value }} 项佩戴</text>
        <uh-button
          custom-class="!rounded-full !bg-primary !px-5 !py-2 !text-xs text-gray-900"
          :class="deco.saving.value ? 'opacity-60' : ''" @action-click="deco.save()"
        >
          {{ deco.saving.value ? '保存中' : '保存佩戴' }}
        </uh-button>
      </view>
    </view>

    <!-- 选择弹层 -->
    <DecorationPicker
      v-if="activeSlot" v-model="pickerVisible"
      :label="activeSlot.label" :multiple="activeSlot.multiple"
      :items="deco.availableByType.value[activeSlot.type] || []"
      :current="slotValue(activeSlot.key)"
      :rarities="deco.rarities.value"
      @on-confirm="onPickerConfirm"
    />
  </view>
</template>
