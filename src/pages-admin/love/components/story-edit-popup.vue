<script lang="ts" setup>
/**
 * 恋爱故事编辑弹窗：标题/日期/地点/内容/图片 上传与保存逻辑内聚
 * 内容编辑为 textarea + mp-html 实时预览
 */
import { ref, watch } from 'vue'
import { createLoveStory, getAttachmentPermalink, updateLoveStory, uploadAttachment } from '@/api/uni-admin'
import { useHaloUpload } from '@/hooks/useHaloUpload'
import type { ILoveStory, ILoveStorySpec } from '@/api/types/uni-halo'

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
const form = ref<ILoveStorySpec>({})
const saving = ref(false)
const { list: imageList, choose: chooseImages, remove: removeImage, retry: imageRetry } = useHaloUpload({ maxCount: 9 })

/* ---------------- 富文本编辑器（mp-html editable 模式） ---------------- */
const editorRef = ref()
/** 传给编辑器的初始内容（editable 开启时不允许中途 setContent） */
const storyEditorContent = ref('')

/** 获取编辑后的 html（延时规避 tap 早于 blur 的时序问题，见 mp-html editable 文档） */
function getEditorHtml(): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(editorRef.value?.getContent?.() || form.value.content || '')
    }, 100)
  })
}

/** editable 插件插入图片时回调：选图 → 上传 Halo 附件 → resolve 线上地址（文档要求返回 Promise） */
function getEditorSrc(type: string, value: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (type === 'img') {
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

function handleResetForm() {
  formMode.value = 'create'
  editName.value = ''
  form.value = { title: '', content: '', date: '', location: '' }
  storyEditorContent.value = ''
  imageList.value = []
}

/** 外部打开编辑模式时回填 */
function openEdit(story: ILoveStory) {
  formMode.value = 'edit'
  editName.value = story.metadata?.name || ''
  form.value = { ...(story.spec || {}) }
  storyEditorContent.value = form.value.content || ''
  imageList.value = (form.value.images || []).map(url => ({
    tempPath: url,
    url,
    status: 'success' as const,
    progress: 100,
  }))
  isShow.value = true
}

async function handleSave() {
  const spec = { ...form.value }
  if (!spec.title?.trim()) {
    uni.showToast({ title: '请填写标题', icon: 'none' })
    return
  }
  // 若有新选的本地图，先等上传完成
  if (imageList.value.some(i => i.status === 'pending' || i.status === 'uploading' || i.status === 'error')) {
    uni.showToast({ title: '图片尚未上传完成', icon: 'none' })
    return
  }
  spec.images = imageList.value.filter(i => i.status === 'success').map(i => i.url)
  // 取编辑器内容（延时规避 tap 早于 blur 的时序问题）
  spec.content = await getEditorHtml()
  saving.value = true
  try {
    if (formMode.value === 'create') {
      await createLoveStory(spec)
    }
    else {
      await updateLoveStory(editName.value, spec)
    }
    isShow.value = false
    emit('on-close', { isSubmit: true, refresh: true })
  }
  catch (err: any) {
    uni.showToast({ title: err?.message || '保存失败', icon: 'none' })
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
        <text class="text-md font-bold">{{ formMode === 'create' ? '新增故事' : '编辑故事' }}</text>
        <text class="text-xs text-gray-500">{{ formMode === 'create' ? '记录一段属于你们的回忆' : '修改故事信息' }}</text>
      </view>
      <view class="uh-global-card-glass absolute right-4 top-4 h-6 w-6 border rounded-lg text-center shadow-none" @click="handleClose(false)">
        <wd-icon name="close" size="32rpx" class="text-gray-500" />
      </view>
    </view>
    <scroll-view :scroll-y="true" :show-scrollbar="false" class="box-border max-h-[60vh] p-4 pt-0">
      <view class="mb-5 flex items-center">
        <text class="w-[140rpx] shrink-0 text-sm text-[#666]">标题 *</text>
        <input v-model="form.title" class="uh-global-card-glass h-9 flex-1 border rounded-xl px-4 text-sm shadow-none" placeholder="请输入故事标题">
      </view>
      <view class="mb-5 flex items-center">
        <text class="w-[140rpx] shrink-0 text-sm text-[#666]">日期</text>
        <input v-model="form.date" class="uh-global-card-glass h-9 flex-1 border rounded-xl px-4 text-sm shadow-none" placeholder="如 2024-06-01(选填)">
      </view>
      <view class="mb-5 flex items-center">
        <text class="w-[140rpx] shrink-0 text-sm text-[#666]">地点</text>
        <input v-model="form.location" class="uh-global-card-glass h-9 flex-1 border rounded-xl px-4 text-sm shadow-none" placeholder="请输入地点(选填)">
      </view>
      <view class="mb-5">
        <text class="mb-2 block text-sm text-[#666]">故事内容</text>
        <mp-html
          ref="editorRef"
          class="uh-global-card-glass box-border w-full rounded-xl shadow-none"
          :content="storyEditorContent"
          :editable="true"
          placeholder="记录这段故事…"
          :get-src="getEditorSrc"
        />
      </view>
      <view class="mb-5">
        <text class="mb-2 block text-sm text-[#666]">图片</text>
        <view class="grid grid-cols-4 gap-2">
          <view v-for="img in imageList" :key="img.tempPath" class="relative aspect-square overflow-hidden rounded-lg">
            <image :src="img.tempPath" class="h-full w-full" mode="aspectFill" />
            <view class="absolute right-1 top-1 h-5 w-5 flex items-center justify-center rounded-full bg-black/50 text-white" @click="removeImage(img.tempPath)">
              <wd-icon name="close" size="22rpx" />
            </view>
            <view v-if="img.status === 'uploading'" class="absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-white">
              {{ img.progress }}%
            </view>
            <view v-else-if="img.status === 'error'" class="absolute inset-0 flex flex-col items-center justify-center bg-red-500/60 text-xs text-white" @click="imageRetry(img.tempPath)">
              <text>失败</text>
              <text>点击重试</text>
            </view>
            <view v-else-if="img.status === 'success'" class="absolute bottom-1 right-1 h-5 w-5 flex items-center justify-center rounded-full bg-green-500 text-white">
              <wd-icon name="check" size="22rpx" />
            </view>
          </view>
          <view v-if="imageList.length < 9" class="aspect-square flex items-center justify-center border-2 border-gray-300 rounded-lg border-dashed text-gray-400" @click="chooseImages">
            <wd-icon name="camera" size="36rpx" />
          </view>
        </view>
      </view>
      <view class="my-6">
        <uh-button custom-class="py-2 !rounded-xl" :loading="saving" @click="handleSave">
          保存
        </uh-button>
      </view>
    </scroll-view>
  </uh-glass-popup>
</template>
