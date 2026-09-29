<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { getHitokotoRandom, likeHitokoto } from '@/api/halo-plugin-third/hitokoto'
import { usePluginAvailable } from '@/hooks/usePluginAvailable'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { useAppConfigStore } from '@/store/appConfig'
import type { IHitokotoSentence } from '@/api/types/halo-plugin-third/hitokoto'

/** 依赖插件(hitokoto-hub) */
const { available: uniHaloPluginAvailable, check: checkPluginAvailable } = usePluginAvailable({
  pluginId: 'hitokoto-hub',
})

const { configs } = storeToRefs(useAppConfigStore())

/** 是否显示一言(插件端「页面设置-首页」开关控制) */
const isShowHitokoto = computed(() => configs.value.featureConfig?.pages?.home?.useHitokoto)

const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()

const sentence = ref<IHitokotoSentence | null>(null)

/** 内容与作者展示兜底 */
const content = computed(() => sentence.value?.content || '轻拾人间辞藻,言说万千心绪')
const authorText = computed(() => {
  const parts: string[] = []
  if (sentence.value?.author) { parts.push(sentence.value.author) }
  if (sentence.value?.source) { parts.push(`《${sentence.value.source}》`) }
  return parts.join(' · ')
})
const likeCount = computed(() => (sentence.value?.likeCount ?? 0) + (sentence.value?.hasLiked ? 1 : 0))

/** 获取一条随机句子 */
async function fetchSentence() {
  if (!isShowHitokoto.value) { return }
  await checkPluginAvailable()
  if (!uniHaloPluginAvailable.value) { return }
  updateLoadingStatus(DataLoadingStatusEnum.Loading)
  try {
    const res = await getHitokotoRandom({ encode: 'json', limit: 1 })
    if (!res.data) {
      updateLoadingStatus(DataLoadingStatusEnum.Empty)
      return
    }
    const sentences = res.data.sentences || []
    if (sentences.length !== 0) {
      sentence.value = sentences[0]
      updateLoadingStatus(DataLoadingStatusEnum.Success)
    }
    else {
      updateLoadingStatus(DataLoadingStatusEnum.Empty)
    }
  }
  catch (err) {
    console.error('获取一言失败', err)
    updateLoadingStatus(DataLoadingStatusEnum.Error)
  }
}

/** 点赞 */
async function handleLike() {
  const name = sentence.value?.metaName || ''
  if (sentence.value?.hasLiked) { return }
  if (!name) { return }
  try {
    await likeHitokoto({ name, action: 'like' })
    sentence.value.hasLiked = true
  }
  catch (err) {
    console.error('点赞失败', err)
    uni.showToast({ title: '点赞失败，请充实', icon: 'none' })
  }
}

/** 换一换 */
function handleNext() {
  fetchSentence()
}

onMounted(() => {
  fetchSentence()
})

/** 开关由 false 变 true(配置晚到)时自动拉取,避免卡片显示后内容一直停在兜底文案 */
watch(isShowHitokoto, (value, oldValue) => {
  if (value && !oldValue) {
    fetchSentence()
  }
})
</script>

<template>
  <view
    v-if="isShowHitokoto && uniHaloPluginAvailable"
    class="uh-global-card-glass relative mx-3 mb-1 mt-2 box-border overflow-hidden border border-[#EFF1C9] rounded-xl border-solid p-4 pb-3.5 !shadow-none"
    @click="handleNext()"
  >
    <!-- 右上角光晕 -->
    <view class="hk-glow" />

    <!-- 标签 -->
    <view class="hk-tag relative flex items-center gap-2 text-xs text-primary font-semibold tracking-0.5 before:bg-primary">
      今日一言
    </view>

    <!-- 内容 -->
    <view
      class="relative mt-3 text-[27rpx] text-[#1F2937] font-medium leading-5 tracking-wider transition-all duration-250"
      :class="loadingStatus === DataLoadingStatusEnum.Loading ? 'opacity-35' : ''"
    >
      {{ content }}
    </view>

    <!-- 底部:作者 + 操作 -->
    <view class="relative mt-3 flex items-center justify-between">
      <text class="text-xs text-gray-400">
        {{ authorText }}
      </text>
      <view class="flex items-center gap-3">
        <text class="mr-1 text-xs text-gray-400">
          点赞 {{ likeCount }}
        </text>
        <view
          class="h-6 w-6 flex items-center justify-center border border-gray-200 rounded-full border-solid bg-white text-gray-400 transition-all duration-200"
          :class="sentence?.hasLiked ? 'hk-liked border-primary !text-primary' : ''"
          @click.stop="handleLike()"
        >
          <wd-icon name="thumb-up" size="24rpx" />
        </view>
        <view
          class="h-6 w-6 flex items-center justify-center border border-gray-200 rounded-full border-solid bg-white text-gray-400 transition-all duration-200"
          @click.stop="handleNext()"
        >
          <wd-icon name="refresh" size="24rpx" :class="{ 'animate-spin': loadingStatus === DataLoadingStatusEnum.Loading }" />
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.hk-glow {
  position: absolute;
  right: -36rpx;
  top: -44rpx;
  width: 168rpx;
  height: 168rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(185, 228, 36, 0.18), transparent 68%);
}

.hk-tag::before {
  content: '';
  width: 28rpx;
  height: 4rpx;
  border-radius: 4rpx;
}

/* 点赞弹跳动画 */
.hk-liked {
  animation: hk-pop 0.35s;
}

@keyframes hk-pop {
  40% {
    transform: scale(1.35);
  }
}
</style>
