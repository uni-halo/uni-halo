<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { NeedPluginIds, usePluginAvailable } from '@/hooks/usePluginAvailable'

const props = defineProps<{
  slugs: string[]
}>()

const { available: pluginAvailable, check: checkPluginAvailable } = usePluginAvailable({
  pluginId: NeedPluginIds.PluginPortfolio,
  tips: '啊偶，功能正在维护中...',
})

const isOpen = ref(true)

onMounted(() => {
  checkPluginAvailable()
})
</script>

<template>
  <view v-if="pluginAvailable && slugs.length > 0" class="mb-3 box-border px-3">
    <view class="uh-global-card-glass box-border rounded-xl p-3">
      <uh-section-title>
        相关项目
        <template #right>
          <text class="text-xs text-gray-400" @click="isOpen = !isOpen">
            <wd-icon :name="isOpen ? 'up' : 'down'" /> {{ isOpen ? '收起' : '展开' }}
          </text>
        </template>
      </uh-section-title>

      <template v-if="isOpen">
        <view class="mt-3 flex flex-col gap-3">
          <uh-article-portfolio-item
            v-for="(slug, slugIndex) in slugs" :key="slug" :slug="slug"
            :index="slugIndex"
          />
        </view>
      </template>

      <view
        v-if="!isOpen" class="mt-3 rounded-xl bg-gray-100 py-3 text-center text-xs text-gray-400"
        @click="isOpen = !isOpen"
      >
        项目已收起，点击展开 {{ slugs.length }} 个项目
      </view>
    </view>
  </view>
</template>
