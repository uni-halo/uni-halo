<script lang="ts" setup>
/**
 * 装扮槽位/库存项展示件
 * 对齐 user-profile 装扮展示设计:稀有度边框底色 + 状态感知徽章(左上) + 名称在框外
 * grid=槽位宫格 / cell=选择弹层内;佩戴/选中激活态由徽章变绿+对勾+边框点亮表达
 */
import { computed } from 'vue'
import { decorationTypes } from '@/api/types/halo-plugin-third/interaction-plus'
import type { IDecorationInventoryItem } from '@/api/types/halo-plugin-third/interaction-plus-uc'
import { checkImageUrl } from '@/utils/url'

interface IProps {
  /** 槽位/装饰名称 */
  label: string
  /** 库存项,空表示未佩戴 */
  item?: IDecorationInventoryItem | null
  /** 展示模式 */
  mode?: 'grid' | 'cell'
  /** 选择弹层内是否选中 */
  selected?: boolean
  /** 多选槽已选数量 */
  count?: number
  /** 稀有度信息 */
  rarity?: { displayName?: string, color?: string } | null
  /** 是否佩戴中(仅 grid 模式) */
  worn?: boolean
}

const props = withDefaults(defineProps<IProps>(), {
  item: null,
  mode: 'grid',
  selected: false,
  count: 0,
  rarity: null,
  worn: false,
})

const emit = defineEmits<{
  (e: 'on-tap'): void
}>()

/** 素材图地址(补全域名) */
const imageUrl = computed(() => checkImageUrl(props.item?.asset?.url))

/** 称号 chip 样式 */
const titleStyle = computed(() => {
  const p = props.item?.payload
  if (!p) {
    return ''
  }
  const bg = p.titleBackgroundSecondary
    ? `linear-gradient(135deg,${p.titleBackground},${p.titleBackgroundSecondary})`
    : p.titleBackground
  return `${bg ? `background-image:${bg};` : ''}${p.titleColor ? `color:${p.titleColor};` : ''}`
})

/** 昵称样式文字 */
const nameStyleCss = computed(() => {
  const ns = props.item?.payload?.nameStyle
  if (!ns) {
    return ''
  }
  if (ns.mode === 'gradient' && ns.colors?.length) {
    return `background-image:linear-gradient(135deg,${ns.colors.join(',')});-webkit-background-clip:text;background-clip:text;color:transparent`
  }
  const solid = ns.mode === 'solid' ? ns.colors?.[0] : ''
  return solid ? `color:${solid}` : ''
})

/** 稀有度边框 */
const rarityBorderStyle = computed(() =>
  props.rarity?.color ? `border-color:${props.rarity.color};` : '')

/** 稀有度底色 */
const rarityBgStyle = computed(() =>
  props.rarity?.color ? `background:${props.rarity.color}1a;` : '')

/** 稀有度文字色(名称行前缀) */
const rarityTextStyle = computed(() =>
  props.rarity?.color ? `color:${props.rarity.color};` : '')

/** 透明风格棋盘格底 */
const CHECKER_STYLE
  = 'background-image:linear-gradient(45deg,#00000012 25%,transparent 25%,transparent 75%,#00000012 75%),linear-gradient(45deg,#00000012 25%,transparent 25%,transparent 75%,#00000012 75%);background-position:0 0,10rpx 10rpx;background-size:20rpx 20rpx;'

/** 预览框底色(棋盘格 + 稀有度浅底叠加) */
const previewBgStyle = computed(() =>
  `${CHECKER_STYLE}${props.rarity?.color ? `background-color:${props.rarity.color}1a;` : ''}`)

/** 左上角类型角标文案(勋章/头像框…) */
const typeLabel = computed(() =>
  props.item ? decorationTypes[props.item.type] || props.label : props.label)

/** 类型角标底色(稀有度色,无稀有度用主题色) */
const badgeStyle = computed(() =>
  props.rarity?.color ? `background:${props.rarity.color};` : '')

/** 激活态(佩戴中/弹层选中) */
const active = computed(() =>
  (props.worn && !!props.item) || (props.mode === 'cell' && props.selected))
</script>

<template>
  <view class="flex flex-1 flex-col cursor-pointer" @click="emit('on-tap')">
    <view class="flex flex-col items-center justify-center gap-y-1">
      <!-- 预览框(user-profile 同款:稀有度边框+底色,框外名称) -->
      <view
        class="relative box-border w-full overflow-hidden border rounded-lg border-solid"
        :class="[item ? 'border-gray-100' : '!border-dashed border-gray-200']"
        :style="item ? rarityBorderStyle : ''"
      >
        <view
          class="box-border h-18 w-full flex items-center justify-center p-2"
          :style="item ? previewBgStyle : ''"
        >
          <!-- 素材图 -->
          <image
            v-if="imageUrl" :src="imageUrl" class="h-full w-full rounded-lg !block" mode="aspectFit"
          />
          <!-- 称号 chip -->
          <text
            v-else-if="item && item.type === 'title'"
            class="truncate rounded-full px-2 py-0.5 text-center text-xs"
            :style="titleStyle"
          >
            {{ item.payload?.titleText || item.displayName || label }}
          </text>
          <!-- 昵称样式 -->
          <text v-else-if="item" class="text-xs font-black" :style="nameStyleCss">
            {{ item.payload?.titleText || item.displayName || label }}
          </text>
          <!-- 空槽 -->
          <view v-else class="flex flex-col items-center gap-y-0.5">
            <wd-icon name="plus" size="32rpx" custom-class="text-gray-400" />
            <text v-if="mode === 'grid'" class="text-xs text-gray-400">
              {{ label }}
            </text>
          </view>
        </view>

        <!-- 左上:状态感知徽章(类型原色不变,激活时加对勾) -->
        <view
          v-if="item"
          class="absolute left-0 top-0 z-10 flex items-center gap-x-0.5 rounded-br-md px-1 text-[10px] text-white"
          :class="rarity?.color ? '' : 'bg-primary'"
          :style="badgeStyle"
        >
          <wd-icon v-if="active" name="check" size="20rpx" custom-class="text-white" />
          <text>{{ typeLabel }}</text>
        </view>

        <!-- 多选数量角标 -->
        <text
          v-if="item && (count || 0) > 1"
          class="absolute bottom-0 right-0 z-10 rounded-tl-md bg-black/50 px-1 text-[10px] text-white"
        >
          x{{ count }}
        </text>
      </view>

      <!-- 名称行:稀有度在前 -->
      <view v-if="item" class="w-full flex items-center justify-center gap-x-1">
        <text v-if="rarity?.displayName" class="shrink-0 text-xs font-bold" :style="rarityTextStyle">
          {{ rarity.displayName }}
        </text>
        <text class="truncate text-xs text-gray-700">
          {{ item.displayName || label }}
        </text>
      </view>
      <text v-else-if="mode === 'cell'" class="text-xs text-gray-400">
        点击取下
      </text>
    </view>
  </view>
</template>
