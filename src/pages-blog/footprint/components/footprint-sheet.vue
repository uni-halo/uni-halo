<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { checkImageUrl } from '@/utils/url'
import { formatTime } from '@/utils/formatTime'
import { copyToClipboard } from '@/utils/clipboard'
import type { IFootprint } from '@/api/types/halo-plugin-third/footprint'
import FootprintItem from './footprint-item.vue'

/** 底部弹层：list(统计+时间线) / detail(详情) 双模式 */

const props = withDefaults(defineProps<{
  /** 是否显示 */
  visible: boolean
  /** 弹层模式 */
  mode: 'list' | 'detail'
  /** 统计(list 模式) */
  stats?: { count: number, cityCount: number, yearSpan: number }
  /** 年份分组(list 模式) */
  groups?: { year: string, items: IFootprint[] }[]
  /** 选中的足迹(detail 模式) */
  selected?: IFootprint | null
}>(), {
  stats: () => ({ count: 0, cityCount: 0, yearSpan: 0 }),
  groups: () => [],
  selected: null,
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'item-tap', footprint: IFootprint): void
  (e: 'back-to-list'): void
  (e: 'locate', footprint: IFootprint): void
}>()

/* ---------- detail 状态 ---------- */
const spec = computed(() => props.selected?.spec)
const detailImage = computed(() => checkImageUrl(spec.value?.image))
const detailImageError = ref(false)
const detailDate = computed(() => (spec.value?.createTime ? formatTime({ d: spec.value.createTime, f: 'yyyy/MM/dd' }) : ''))
const descExpanded = ref(false)

watch(() => props.selected, () => {
  detailImageError.value = false
  descExpanded.value = false
})

function handleItemTap(footprint: IFootprint) {
  emit('item-tap', footprint)
}

/** 列表卡片定位：聚焦地图，App 端由父组件关闭弹层 */
function handleLocate(footprint: IFootprint) {
  emit('locate', footprint)
}

/** 详情[定位到地图]：聚焦地图，App 端由父组件关闭弹层 */
function handleLocateMap() {
  if (props.selected) {
    emit('locate', props.selected)
  }
}

/** 相关笔记：v1 仅复制链接(article 为文章 URL，非端内跳转所需的 metadata.name) */
function handleCopyArticle() {
  const url = spec.value?.article
  if (url) {
    copyToClipboard(url, '笔记链接已复制成功！')
  }
}
</script>

<template>
  <uh-glass-popup
    :model-value="props.visible"
    position="bottom"
    round
    :z-index="200"
    custom-class="!rounded-2xl"
    @close="emit('close')"
  >
    <view class="box-border h-[70vh] flex flex-col gap-y-3 overflow-hidden p-3">
      <!-- 顶部 -->
      <view class="relative mb-2 box-border w-full flex items-center justify-around">
        <view class="w-full flex flex-col gap-y-1">
          <text class="text-md font-bold">{{ props.mode === 'list' ? '足迹' : '足迹详情' }}</text>
        </view>
        <view class="absolute right-0 top-0 flex items-center gap-2">
          <view v-if="props.mode !== 'list'">
            <view
              class="uh-global-card-glass h-6 flex items-center justify-center gap-x-1 border rounded-lg px-2 shadow-none"
              @click="emit('back-to-list')"
            >
              <wd-icon name="arrow-left" size="28rpx" class="text-gray-500" />
              <text class="text-xs text-gray-500">返回列表</text>
            </view>
          </view>
          <view
            class="uh-global-card-glass h-6 w-6 flex items-center justify-center border rounded-lg shadow-none"
            @click="emit('close')"
          >
            <wd-icon name="close" size="28rpx" class="text-gray-500" />
          </view>
        </view>
      </view>

      <!-- list 模式 -->
      <template v-if="props.mode === 'list'">
        <!-- 统计条 -->
        <view class="uh-global-card-glass mt-1 flex flex-shrink-0 border rounded-2xl !shadow-none">
          <view class="flex-1 py-2.5 text-center">
            <text class="text-base text-gray-900 font-bold">{{ props.stats.count }}</text>
            <view class="mt-0.5 text-3xs text-gray-500">
              足迹
            </view>
          </view>
          <view class="flex-1 py-2.5 text-center">
            <text class="text-base text-gray-900 font-bold">{{ props.stats.cityCount }}</text>
            <view class="mt-0.5 text-3xs text-gray-500">
              城市
            </view>
          </view>
          <view class="flex-1 py-2.5 text-center">
            <text class="text-base text-gray-900 font-bold">{{ props.stats.yearSpan }}</text>
            <view class="mt-0.5 text-3xs text-gray-500">
              年
            </view>
          </view>
        </view>
        <!-- 时间线 -->
        <scroll-view class="box-border min-h-0 flex-1 pt-3" scroll-y :show-scrollbar="false">
          <view class="w-full flex flex-col gap-y-4">
            <view v-for="group in props.groups" :key="group.year">
              <view class="mb-2 flex items-center gap-2">
                <view class="h-2 w-2 rounded-full bg-primary" />
                <text class="text-3xs text-gray-600 font-bold">{{ group.year }}</text>
                <view class="h-px flex-1 bg-black/5" />
              </view>
              <view class="flex flex-col gap-3">
                <footprint-item
                  v-for="(item, index) in group.items"
                  :key="item.metadata?.name || index"
                  :footprint="item"
                  @open="handleItemTap(item)"
                  @locate="handleLocate"
                />
              </view>
            </view>
          </view>
        </scroll-view>
      </template>

      <!-- detail 模式 -->
      <template v-else-if="props.selected">
        <scroll-view class="min-h-0 flex-1" scroll-y :show-scrollbar="false">
          <view class="pb-4">
            <image
              v-if="detailImage && !detailImageError"
              :src="detailImage"
              class="h-[150px] w-full rounded-xl"
              mode="aspectFill"
              @error="detailImageError = true"
            />
            <view class="mt-3 flex items-start justify-between gap-2">
              <text class="min-w-0 flex-1 text-sm text-gray-900 font-semibold">{{ spec?.name }}</text>
              <text
                v-if="spec?.footprintType"
                class="flex-shrink-0 rounded-xl bg-primary px-2 py-0.5 text-xs text-gray-700"
              >
                {{ spec.footprintType }}
              </text>
            </view>
            <view v-if="spec?.address" class="mt-2 flex items-center gap-1">
              <wd-icon name="location" size="28rpx" class="flex-shrink-0 text-gray-400" />
              <text class="min-w-0 flex-1 truncate text-3xs text-gray-600">{{ spec.address }}</text>
            </view>
            <view v-if="detailDate" class="mt-1.5 flex items-center gap-1">
              <wd-icon name="clock-circle" size="28rpx" class="flex-shrink-0 text-gray-400" />
              <text class="block text-3xs text-gray-400">{{ detailDate }}</text>
            </view>
            <view v-if="spec?.description" class="mt-3">
              <rich-text
                class="whitespace-pre-wrap text-3xs text-gray-700 leading-5 leading-relaxed"
                :nodes="spec.description"
              />
            </view>
          </view>
        </scroll-view>
        <view class="w-full flex items-center gap-x-3 pt-2">
          <uh-button class="w-full flex-1" custom-class="uh-global-card-glass !bg-primary !text-gray-900 !border !rounded-full !py-2.5 !text-3xs" @click="handleLocateMap">
            定位到地图
          </uh-button>
          <uh-button v-if="spec?.article" class="w-full flex-1" custom-class="uh-global-card-glass !bg-primary !text-gray-900 !border !rounded-full !py-2.5 !text-3xs" @click="handleCopyArticle">
            复制笔记链接
          </uh-button>
        </view>
      </template>
    </view>
  </uh-glass-popup>
</template>
