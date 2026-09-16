<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useHaloUpload } from '@/hooks/useHaloUpload'
import { createMoment } from '@/api/uni-admin'
import type { IMomentContent } from '@/api/types/uni-admin'

definePage({
  style: {
    navigationBarTitleText: '发布瞬间',
    navigationStyle: 'custom',
  },
})

const content = ref('')
const tags = ref<string[]>([])
const tagInput = ref('')
const submitting = ref(false)

const MAX_CONTENT_LENGTH = 5000

const { list: images, uploading, choose, retry, remove, allSuccess, urls, reset } = useHaloUpload({
  maxCount: 9,
  maxSize: 10 * 1024 * 1024,
})

const canSubmit = computed(() => {
  return (content.value.trim().length > 0 || images.value.some(i => i.status === 'success')) && !submitting.value && !uploading.value
})

function addTag() {
  const t = tagInput.value.trim()
  if (!t)
    return
  if (tags.value.includes(t)) {
    tagInput.value = ''
    return
  }
  if (tags.value.length >= 5) {
    uni.showToast({ title: '最多 5 个标签', icon: 'none' })
    return
  }
  tags.value.push(t)
  tagInput.value = ''
}

function removeTag(tag: string) {
  tags.value = tags.value.filter(t => t !== tag)
}

async function submit() {
  if (!canSubmit.value)
    return
  if (content.value.trim().length > MAX_CONTENT_LENGTH) {
    uni.showToast({ title: `内容不能超过 ${MAX_CONTENT_LENGTH} 字`, icon: 'none' })
    return
  }
  // 图片还有未上传完成的，先触发上传
  if (images.value.some(i => i.status === 'pending' || i.status === 'error')) {
    uni.showToast({ title: '图片尚未上传完成', icon: 'none' })
    return
  }

  const imageUrls = urls()
  const hasImages = imageUrls.length > 0
  const momentContent: IMomentContent = {
    type: hasImages ? 'PHOTO' : 'TEXT',
    content: content.value.trim(),
    ...(hasImages
      ? {
          medium: imageUrls.map(url => ({ type: 'PHOTO' as const, url })),
        }
      : {}),
  }

  submitting.value = true
  try {
    await createMoment({
      content: [momentContent] as IMomentContent[] as any,
      visible: 'PUBLIC',
      ...(tags.value.length > 0 ? { tags: tags.value } : {}),
    })
    uni.showToast({ title: '发布成功', icon: 'success' })
    reset()
    content.value = ''
    tags.value = []
    setTimeout(() => uni.navigateBack(), 800)
  }
  catch (err: any) {
    uni.showToast({ title: err?.message || '发布失败', icon: 'none' })
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="pb-safe-bottom min-h-screen bg-light-100 dark:bg-dark-800">
    <!-- 正文输入 -->
    <view class="mx-3 mt-3 rounded-2xl bg-white/80 p-4 shadow-sm dark:bg-dark-900/80">
      <textarea
        v-model="content"
        class="min-h-40 w-full text-base leading-relaxed"
        placeholder="说点什么吧…"
        :maxlength="MAX_CONTENT_LENGTH"
        auto-height
      />
      <view class="mt-2 text-right text-xs text-gray-400">
        {{ content.length }}/{{ MAX_CONTENT_LENGTH }}
      </view>
    </view>

    <!-- 图片九宫格 -->
    <view class="mx-3 mt-3">
      <view class="mb-2 text-sm text-gray-500">
        已选图片 ({{ images.length }}/9)
      </view>
      <view class="grid grid-cols-4 gap-2">
        <view v-for="img in images" :key="img.tempPath" class="relative aspect-square overflow-hidden rounded-xl">
          <image :src="img.tempPath" mode="aspectFill" class="h-full w-full" />
          <!-- 删除 -->
          <view
            v-if="img.status !== 'uploading'"
            class="absolute right-1 top-1 h-5 w-5 flex items-center justify-center rounded-full bg-black/50 text-xs text-white"
            @click="remove(img.tempPath)"
          >
            ✕
          </view>
          <!-- 状态角标 -->
          <view v-if="img.status === 'uploading'" class="absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-white">
            {{ img.progress }}%
          </view>
          <view
            v-else-if="img.status === 'error'"
            class="absolute inset-0 flex flex-col items-center justify-center bg-red-500/60 text-xs text-white"
            @click="retry(img.tempPath)"
          >
            <text>失败</text>
            <text>点击重试</text>
          </view>
          <view v-else-if="img.status === 'success'" class="absolute bottom-1 right-1 h-5 w-5 flex items-center justify-center rounded-full bg-green-500 text-xs text-white">
            ✓
          </view>
        </view>
        <!-- 添加按钮 -->
        <view
          v-if="images.length < 9"
          class="aspect-square flex items-center justify-center border-2 border-gray-300 rounded-xl border-dashed text-3xl text-gray-400"
          @click="choose"
        >
          ＋
        </view>
      </view>
    </view>

    <!-- 标签 -->
    <view class="mx-3 mt-3 rounded-2xl bg-white/80 p-4 shadow-sm dark:bg-dark-900/80">
      <view class="flex items-center gap-2">
        <input
          v-model="tagInput"
          class="flex-1 text-base"
          placeholder="# 添加标签（回车确认，最多 5 个）"
          confirm-type="done"
          @confirm="addTag"
        >
        <view class="text-xl text-gray-400" @click="addTag">
          ＋
        </view>
      </view>
      <view v-if="tags.length" class="mt-3 flex flex-wrap gap-2">
        <view v-for="tag in tags" :key="tag" class="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
          {{ tag }}
          <text class="ml-1 text-gray-400" @click="removeTag(tag)">✕</text>
        </view>
      </view>
    </view>

    <!-- 底部固定发布按钮 -->
    <view class="fixed inset-x-0 bottom-0 border-t border-gray-100 bg-white/90 p-3 pb-safe dark:border-dark-600 dark:bg-dark-900/90">
      <button
        class="w-full rounded-full text-white"
        :class="canSubmit ? 'bg-primary' : 'bg-gray-300'"
        :disabled="!canSubmit"
        @click="submit"
      >
        {{ submitting ? '发布中…' : uploading ? `图片上传中 ${images.filter(i => i.status === 'success').length}/${images.length}` : '发布' }}
      </button>
    </view>
  </view>
</template>
