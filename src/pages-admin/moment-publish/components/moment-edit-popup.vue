<script lang="ts" setup>
/**
 * 瞬间编辑弹窗：mp-html editable 富文本 + 图片上传 + 发布/保存逻辑内聚
 * 供任意页面复用：<MomentEditPopup ref="ref" :show="visible" @on-close="..." />
 * 编辑模式通过 ref.openEdit(moment) 打开并回填
 */
import { ref, watch } from 'vue'
import { useHaloUpload } from '@/hooks/useHaloUpload'
import { createMoment, getAttachmentPermalink, updateMoment, uploadAttachment } from '@/api/uni-admin'
import type { IMomentContent } from '@/api/types/uni-admin'

defineOptions({
  options: {
    styleIsolation: 'apply-shared',
  },
})

const props = withDefaults(defineProps<{
  show?: boolean
}>(), {
  show: false,
})

const emit = defineEmits<{
  (e: 'on-close', data: { isSubmit: boolean, refresh: boolean }): void
}>()

const isShow = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editName = ref('')
const saving = ref(false)

const { list: images, uploading, choose, retry, remove, urls, reset } = useHaloUpload({
  maxCount: 9,
  maxSize: 10 * 1024 * 1024,
})

/* ---------------- 富文本编辑器（mp-html editable 模式） ---------------- */
const editorRef = ref()
/** 传给编辑器的初始内容（editable 开启时不允许中途 setContent） */
const editorContent = ref('')

const canSubmit = ref(false)

watch([editorContent, images, uploading, saving], () => {
  canSubmit.value = (editorContent.value.trim().length > 0 || images.value.some(i => i.status === 'success'))
    && !saving.value && !uploading.value
}, { deep: true })

/** editable 插件插入图片/链接时回调：返回线上地址（文档要求返回 Promise） */
function getEditorSrc(type: string, value: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (type === 'img') {
      // 选本地图片 → 上传 Halo 附件 → resolve 线上地址
      uni.chooseImage({
        count: 1,
        success: (res) => {
          uploadAttachment(res.tempFilePaths[0])
            .then(att => resolve(getAttachmentPermalink(att)))
            .catch(() => {
              uni.showToast({ title: '图片上传失败', icon: 'none' })
              reject(new Error('上传失败'))
            })
        },
        fail: () => reject(new Error('取消选图')),
      })
      return
    }
    resolve(value || '')
  })
}

/** 获取编辑后的 html（延时规避 tap 早于 blur 的时序问题，见 mp-html editable 文档） */
function getEditorHtml(): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(editorRef.value?.getContent?.() || editorContent.value || '')
    }, 100)
  })
}

/* ---------------- 打开 / 回填 ---------------- */
function handleResetForm() {
  formMode.value = 'create'
  editName.value = ''
  editorContent.value = ''
  reset()
}

/** 外部打开编辑模式时回填（传入瞬间对象，spec.content 结构同官方接口） */
function openEdit(moment: { metadata?: { name?: string }, spec?: any }) {
  formMode.value = 'edit'
  editName.value = moment.metadata?.name || ''
  editorContent.value = moment.spec?.content?.raw?.content || moment.spec?.content?.content || ''
  const imageUrls = (moment.spec?.content?.medium || [])
    .filter((m: any) => m.type === 'PHOTO')
    .map((m: any) => m.url)
  images.value = imageUrls.map((url: string) => ({
    tempPath: url,
    url,
    status: 'success' as const,
    progress: 100,
  }))
  isShow.value = true
}

/* ---------------- 提交 ---------------- */
async function handleSubmit() {
  if (!canSubmit.value)
    return
  // 图片还有未上传完成的，先触发上传
  if (images.value.some(i => i.status === 'pending' || i.status === 'error')) {
    uni.showToast({ title: '图片尚未上传完成', icon: 'none' })
    return
  }

  // 取编辑器内容（延时规避 tap 早于 blur 的时序问题）
  const html = await getEditorHtml()
  const imageUrls = urls()
  if (!html.trim() && imageUrls.length === 0) {
    uni.showToast({ title: '请输入内容', icon: 'none' })
    return
  }

  const hasImages = imageUrls.length > 0
  const momentContent: IMomentContent = {
    type: hasImages ? 'PHOTO' : 'TEXT',
    content: html.trim(),
    ...(hasImages
      ? {
          medium: imageUrls.map(url => ({ type: 'PHOTO' as const, url })),
        }
      : {}),
  }

  saving.value = true
  try {
    if (formMode.value === 'edit') {
      await updateMoment(editName.value, {
        content: [momentContent] as IMomentContent[] as any,
        visible: 'PUBLIC',
      })
      uni.showToast({ title: '已保存', icon: 'success' })
    }
    else {
      await createMoment({
        content: [momentContent] as IMomentContent[] as any,
        visible: 'PUBLIC',
      })
      uni.showToast({ title: '发布成功', icon: 'success' })
    }
    handleClose(true)
  }
  catch (err: any) {
    uni.showToast({ title: err?.message || '发布失败', icon: 'none' })
  }
  finally {
    saving.value = false
  }
}

function handleClose(refresh = false) {
  isShow.value = false
  emit('on-close', { isSubmit: !!refresh, refresh })
}

watch(() => props.show, (val) => {
  if (!val)
    return
  handleResetForm()
  isShow.value = true
})

defineExpose({ openEdit })
</script>

<template>
  <uh-glass-popup v-model="isShow" :z-index="100" position="bottom" custom-class="!border rounded-xl" @close="handleClose(false)">
    <view class="relative mb-4 box-border w-full flex items-center justify-around px-4 pt-4">
      <view class="w-full flex flex-col gap-y-1">
        <text class="text-md font-bold">{{ formMode === 'create' ? '发布瞬间' : '编辑瞬间' }}</text>
        <text class="text-xs text-gray-500">{{ formMode === 'create' ? '记录此刻的想法与生活' : '修改这条瞬间' }}</text>
      </view>
      <view class="uh-global-card-glass absolute right-4 top-4 h-6 w-6 border rounded-lg text-center shadow-none" @click="handleClose(false)">
        <wd-icon name="close" size="32rpx" class="text-gray-500" />
      </view>
    </view>
    <scroll-view :scroll-y="true" :show-scrollbar="false" class="box-border max-h-[60vh] p-4 pt-0">
      <!-- 正文编辑（mp-html editable 富文本） -->
      <view class="uh-global-card-glass mb-4 rounded-xl shadow-none">
        <mp-html
          ref="editorRef"
          class="min-h-40"
          :content="editorContent"
          :editable="true"
          placeholder="说点什么吧…"
          :get-src="getEditorSrc"
        />
      </view>

      <!-- 图片九宫格 -->
      <view class="mb-5">
        <text class="mb-2 block text-sm text-[#666]">图片</text>
        <view class="grid grid-cols-4 gap-2">
          <view v-for="img in images" :key="img.tempPath" class="relative aspect-square overflow-hidden rounded-lg">
            <image :src="img.tempPath" mode="aspectFill" class="h-full w-full" />
            <view v-if="img.status !== 'uploading'" class="absolute right-1 top-1 h-5 w-5 flex items-center justify-center rounded-full bg-black/50 text-white" @click="remove(img.tempPath)">
              <wd-icon name="close" size="22rpx" />
            </view>
            <view v-if="img.status === 'uploading'" class="absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-white">
              {{ img.progress }}%
            </view>
            <view v-else-if="img.status === 'error'" class="absolute inset-0 flex flex-col items-center justify-center bg-red-500/60 text-xs text-white" @click="retry(img.tempPath)">
              <text>失败</text>
              <text>点击重试</text>
            </view>
            <view v-else-if="img.status === 'success'" class="absolute bottom-1 right-1 h-5 w-5 flex items-center justify-center rounded-full bg-green-500 text-white">
              <wd-icon name="check" size="22rpx" />
            </view>
          </view>
          <view v-if="images.length < 9" class="aspect-square flex items-center justify-center border-2 border-gray-300 rounded-lg border-dashed text-gray-400" @click="choose">
            <wd-icon name="camera" size="36rpx" />
          </view>
        </view>
      </view>

      <view class="my-6">
        <uh-button custom-class="py-2 !rounded-xl" :loading="saving" :disabled="!canSubmit" @click="handleSubmit">
          {{ formMode === 'create' ? '发布瞬间' : '保存瞬间' }}
        </uh-button>
      </view>
    </scroll-view>
  </uh-glass-popup>
</template>
