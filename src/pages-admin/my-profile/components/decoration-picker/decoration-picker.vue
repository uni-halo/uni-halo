<script lang="ts" setup>
/**
 * 装扮选择弹层
 * 展示某槽位的可佩戴库存,本地暂存选择,确认后回传草稿
 * 布局遵循玻璃弹窗规范:左侧标题 + 右侧关闭按钮 + 中间滚动内容 + 底部操作按钮
 */
import { ref, watch } from 'vue'
import type { IDecorationInventoryItem } from '@/api/types/halo-plugin-third/interaction-plus-uc'
import type { IDecorationRarity } from '@/api/halo-plugin-third/interaction-plus-uc'
import { SHOWCASE_LIMIT } from '../../composables/use-my-decorations'
import DecorationSlot from '../decoration-slot/decoration-slot.vue'

interface IProps {
  /** 类别名(头像框/称号…) */
  label: string
  /** 是否多选 */
  multiple?: boolean
  /** 可佩戴库存 */
  items?: IDecorationInventoryItem[]
  /** 当前草稿值(资产名列表) */
  current?: string[]
  /** 稀有度列表 */
  rarities?: IDecorationRarity[]
}

const props = withDefaults(defineProps<IProps>(), {
  multiple: false,
  items: () => [],
  current: () => [],
  rarities: () => [],
})

const emit = defineEmits<{
  (e: 'on-confirm', names: string[]): void
}>()

const visible = defineModel<boolean>({ default: false })

/* ---------------- 本地暂存选择 ---------------- */
const temp = ref<string[]>([])

watch(() => visible.value, (open) => {
  if (open) {
    temp.value = [...(props.current || [])]
  }
})

/** 关闭弹层(不保留暂存选择) */
function handleClose() {
  visible.value = false
}

function rarityOf(item: IDecorationInventoryItem) {
  if (!item.rarityName) {
    return null
  }
  const hit = props.rarities.find(r => r.metadata?.name === item.rarityName)
  return hit ? { displayName: hit.spec?.displayName || '', color: hit.spec?.color || '' } : null
}

/** 点选:单选替换/同项取下,多选切换(上限 8) */
function handleToggle(item: IDecorationInventoryItem) {
  if (!item.assetName) {
    return
  }
  const name = item.assetName
  if (props.multiple) {
    if (temp.value.includes(name)) {
      temp.value = temp.value.filter(n => n !== name)
    }
    else if (temp.value.length >= SHOWCASE_LIMIT) {
      uni.showToast({ icon: 'none', title: `最多展示 ${SHOWCASE_LIMIT} 个勋章` })
    }
    else {
      temp.value = [...temp.value, name]
    }
    return
  }
  temp.value = temp.value[0] === name ? [] : [name]
}

function handleClear() {
  temp.value = []
  handleConfirm()
}

function handleConfirm() {
  emit('on-confirm', [...temp.value])
  handleClose()
}
</script>

<template>
  <uh-glass-popup
    v-model="visible" :hide-when-close="true" position="bottom" :z-index="200"
    :close-on-click-modal="false" custom-class="!rounded-2xl"
  >
    <view class="box-border w-full flex flex-col gap-y-3 p-3">
      <!-- 顶部:左标题 + 右关闭 -->
      <view class="relative box-border w-full flex items-center justify-around">
        <view class="w-full flex flex-col gap-y-1">
          <text class="text-md font-bold">选择{{ label }}</text>
          <text class="text-xs text-gray-500">
            {{ multiple ? `可展示最多 ${SHOWCASE_LIMIT} 个勋章,当前已选 ${temp.length} 个` : '点选佩戴,再点一次取下' }}
          </text>
        </view>
        <view
          class="uh-global-card-glass absolute right-0 top-0 h-6 w-6 flex items-center justify-center border rounded-lg shadow-none"
          @click="handleClose"
        >
          <wd-icon name="close" size="28rpx" class="text-gray-500" />
        </view>
      </view>

      <!-- 中间:滚动库存宫格 -->
      <scroll-view :scroll-y="true" :show-scrollbar="false" class="box-border max-h-[52vh]">
        <view v-if="items.length > 0" class="grid grid-cols-4 gap-2">
          <DecorationSlot
            v-for="item in items" :key="item.grantName || item.assetName" mode="cell"
            :label="label" :item="item" :selected="!!item.assetName && temp.includes(item.assetName)"
            :rarity="rarityOf(item)" @on-tap="handleToggle(item)"
          />
        </view>
        <view v-else class="flex flex-col items-center gap-y-1 py-10">
          <wd-icon name="warn-bold" size="60rpx" custom-class="text-gray-300" />
          <text class="text-xs text-gray-400">还没有可佩戴的{{ label }}哦</text>
        </view>
      </scroll-view>

      <!-- 底部固定操作区域 -->
      <view class="box-border w-full flex items-center gap-x-3">
        <uh-button
          class="flex-1"
          custom-class="flex-1 uh-global-card-glass uh-shadow-xs !bg-red-400 !text-white !border !py-2.5 !rounded-xl !text-3xs"
          @click="handleClear"
        >
          取下
        </uh-button>
        <uh-button
          class="flex-1"
          custom-class="flex-1 uh-global-card-glass uh-shadow-xs !border !py-2.5 !rounded-xl !text-3xs !bg-primary text-gray-900"
          @click="handleConfirm"
        >
          完成
        </uh-button>
      </view>
    </view>
  </uh-glass-popup>
</template>
