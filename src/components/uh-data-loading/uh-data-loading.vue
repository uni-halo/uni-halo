<script setup lang="ts">
import { DataLoadingStatusEnum } from '@/hooks/useDataLoadingStatus'

interface IProps {
  loadingStatus?: DataLoadingStatusEnum
}
const props = withDefaults(defineProps<IProps>(), {
  loadingStatus: DataLoadingStatusEnum.Loading,
})

const emit = defineEmits(['refresh'])

function handleRefresh() {
  emit('refresh')
}
</script>

<template>
  <view class="min-h-screen w-full flex items-center justify-center">
    <!-- 加载中 -->
    <wd-loading v-if="props.loadingStatus === DataLoadingStatusEnum.Loading" :size="60">
      <view>加载中...</view>
    </wd-loading>

    <!-- 加载错误 -->
    <wd-empty v-else-if="props.loadingStatus === DataLoadingStatusEnum.Error" :icon-size="60" icon="no-result">
      <view>加载失败</view>
      <wd-button @click="handleRefresh">
        刷新试试
      </wd-button>
    </wd-empty>

    <!-- 加载成功 -->
    <wd-empty v-else-if="props.loadingStatus === DataLoadingStatusEnum.Empty" :icon-size="60" icon="success">
      <view>无数据</view>
      <wd-button @click="handleRefresh">
        刷新试试
      </wd-button>
    </wd-empty>
  </view>
</template>
