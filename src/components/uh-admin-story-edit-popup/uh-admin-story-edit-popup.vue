<script lang="ts" setup>
/**
 * 恋爱故事新增/编辑弹窗：标题/日期(wd-datetime-picker)/地点/内容(官方 editor)/图片
 * 内容编辑使用全局 uh-rich-editor（带基础格式工具条）
 *
 * 用法：
 * - 新增模式：<uh-admin-story-edit-popup :show="visible" @on-close="..." />
 * - 编辑模式：通过 ref.openEdit(story) 传入完整故事资源回填
 */
import { ref, watch } from 'vue'
import dayjs from 'dayjs'
import { createLoveStory, updateLoveStory } from '@/api/uni-admin'
import { useHaloUpload } from '@/hooks/useHaloUpload'
import { checkThumbnailUrl } from '@/utils/url'
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

/* ---------------- 富文本编辑器（官方 editor，经 uh-rich-editor 封装，带工具条） ---------------- */
const editorRef = ref<{ setHtml(html: string): void, getHtml(): Promise<string>, clear(): void } | null>(null)

/** 获取编辑器 HTML */
async function getEditorHtml(): Promise<string> {
  const html = await editorRef.value?.getHtml()
  return html || form.value.content || ''
}

/* ---------------- 日期选择（wd-datetime-picker 是纯弹层，需自建触发区 + 受控 visible） ---------------- */
const dateShow = ref(false)
const dateTs = ref(Date.now())

function openDatePicker() {
  dateTs.value = form.value.date ? dayjs(form.value.date).valueOf() : Date.now()
  dateShow.value = true
}

function handleDateConfirm({ value }: any) {
  form.value.date = dayjs(value).format('YYYY-MM-DD')
}

function handleResetForm() {
  formMode.value = 'create'
  editName.value = ''
  form.value = { title: '', content: '', date: '', location: '' }
  editorRef.value?.setHtml('')
  imageList.value = []
}

/** 外部打开编辑模式时回填 */
function openEdit(story: ILoveStory) {
  formMode.value = 'edit'
  editName.value = story.metadata?.name || ''
  form.value = { ...(story.spec || {}) }
  // 日期选择器回显已有日期
  dateTs.value = form.value.date ? dayjs(form.value.date).valueOf() : Date.now()
  imageList.value = (form.value.images || []).map(url => ({
    // tempPath 用于显示（相对路径补域名），url 保留原始相对路径用于提交
    tempPath: checkThumbnailUrl(url),
    url,
    status: 'success' as const,
    progress: 100,
  }))
  isShow.value = true
  // 编辑器未 ready 时组件内部会挂起，ready 后自动回填
  setTimeout(() => {
    editorRef.value?.setHtml(form.value.content || '')
  }, 0)
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
  <uh-glass-popup v-model="isShow" :z-index="999" position="bottom" custom-class="!border rounded-xl" @close="handleClose(false)">
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
        <view
          class="uh-global-card-glass h-9 flex flex-1 items-center justify-between border rounded-xl px-4 text-sm shadow-none"
          @click="openDatePicker"
        >
          <text :class="form.date ? 'text-gray-900' : 'text-gray-400'">{{ form.date || '如 2024-06-01(选填)' }}</text>
          <wd-icon name="calendar" size="28rpx" class="text-gray-400" />
        </view>
      </view>
      <wd-datetime-picker v-model="dateTs" :z-index="999" type="date" title="选择日期" root-portal v-model:visible="dateShow" @confirm="handleDateConfirm" />
      <view class="mb-5 flex items-center">
        <text class="w-[140rpx] shrink-0 text-sm text-[#666]">地点</text>
        <input v-model="form.location" class="uh-global-card-glass h-9 flex-1 border rounded-xl px-4 text-sm shadow-none" placeholder="请输入地点(选填)">
      </view>
      <view class="mb-5">
        <text class="mb-2 block text-sm text-[#666]">故事内容</text>
        <view class="uh-global-card-glass box-border w-full rounded-xl p-2 shadow-none">
          <uh-rich-editor
            ref="editorRef"
            toolbar
            placeholder="记录这段故事…"
          />
        </view>
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
    </scroll-view>

    <!-- 底部固定操作栏（滚动区外） -->
    <view class="border-t border-black/5 px-4 pb-safe pt-3">
      <uh-button custom-class="flex-1 uh-global-card-glass uh-shadow-xs border py-2 !rounded-xl !bg-love !text-white" :loading="saving" @click="handleSave">
        保存
      </uh-button>
    </view>
  </uh-glass-popup>
</template>
