<script lang="ts" setup>
/**
 * 瞬间编辑弹窗
 */
import { nextTick, ref, watch } from 'vue'
import { useHaloUpload } from '@/hooks/useHaloUpload'
import { createMoment, getMyMoment, updateMoment } from '@/api/uni-admin'
import { extractMomentContent } from '@/utils/moment'
import { checkThumbnailUrl } from '@/utils/url'

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
/** 编辑模式的原 Moment 资源 */
const editMoment = ref<any>(null)
const saving = ref(false)
const loading = ref(false)

const { list: images, uploading, choose, retry, remove, urls, reset } = useHaloUpload({
  maxCount: 9,
  maxSize: 10 * 1024 * 1024,
})

/* ---------------- 富文本编辑器（官方 editor，经 uh-rich-editor 封装，带工具条） ---------------- */
const editorRef = ref<{ setHtml: (html: string) => void, getHtml: () => Promise<string>, insertImage: (src: string) => void, clear: () => void } | null>(null)
/** 内容快照（编辑器 @input 同步；回填时手动写入，供 canSubmit 判断） */
const editorContent = ref('')

const canSubmit = ref(false)

watch([editorContent, images, uploading, saving], () => {
  canSubmit.value = (editorContent.value.trim().length > 0 || images.value.some(i => i.status === 'success'))
    && !saving.value && !uploading.value
}, { deep: true })

function handleEditorInput(html: string) {
  editorContent.value = html
}

/** 获取编辑器 HTML（editor 的 getContent 即为最新内容，无需 mp-html 的延时 hack） */
async function getEditorHtml(): Promise<string> {
  const html = await editorRef.value?.getHtml()
  return html || editorContent.value || ''
}

/* ---------------- 打开 / 回填 ---------------- */
function handleResetForm() {
  formMode.value = 'create'
  editName.value = ''
  editMoment.value = null
  editorContent.value = ''
  // 清空编辑器（编辑器未挂载时为 no-op，首开本就是空内容）
  editorRef.value?.setHtml('')
  reset()
}

/**
 * 编辑模式：仅传瞬间 metadata.name，内部查询详情并回填
 * @returns 是否成功打开（查询失败/无权限时返回 false，由调用方决定后续）
 */
async function openEdit(name: string): Promise<boolean> {
  if (!name || loading.value)
    return false
  loading.value = true
  uni.showLoading({ title: '加载中', mask: true })
  try {
    const res = await getMyMoment(name)
    // UC 接口返回可能是 { moment, owner, stats } 包装，也可能是 Moment 本体，两者兼容
    const moment: any = (res.data as any)?.moment || res.data
    if (!moment?.spec) {
      uni.showToast({ title: '瞬间不存在或无权编辑', icon: 'none' })
      return false
    }
    formMode.value = 'edit'
    editName.value = moment.metadata?.name || name
    editMoment.value = moment
    // 兼容对象格式 { raw, html, medium } 与数组格式 [{ content, medium }]
    const content = extractMomentContent(moment.spec.content)
    editorContent.value = content.raw || content.html || ''
    images.value = content.photos.map(url => ({
      // tempPath 用于显示（相对路径需拼站点域名）；url 保留原始相对路径用于提交
      tempPath: checkThumbnailUrl(url),
      url,
      status: 'success' as const,
      progress: 100,
    }))
    isShow.value = true
    // 弹窗渲染后回填编辑器；编辑器未 ready 时 uh-rich-editor 内部会挂起待 ready 后自动回填
    nextTick(() => {
      editorRef.value?.setHtml(editorContent.value)
    })
    return true
  }
  catch (err: any) {
    uni.showToast({ title: err?.message || '加载瞬间失败', icon: 'none' })
    return false
  }
  finally {
    uni.hideLoading()
    loading.value = false
  }
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

  // 取编辑器内容
  const html = await getEditorHtml()
  const imageUrls = urls()
  if (!html.trim() && imageUrls.length === 0) {
    uni.showToast({ title: '请输入内容', icon: 'none' })
    return
  }

  const hasImages = imageUrls.length > 0
  // 瞬间插件 Moment.MomentContent 为单对象 { raw, html, medium }，raw/html 均为字符串
  const momentContent: IMomentContent = {
    raw: html.trim(),
    html: html.trim(),
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
        content: momentContent,
        visible: 'PUBLIC',
      }, editMoment.value?.metadata)
      uni.showToast({ title: '已保存', icon: 'none' })
    }
    else {
      await createMoment({
        content: momentContent,
        visible: 'PUBLIC',
      })
      uni.showToast({ title: '发布成功', icon: 'none' })
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
  <uh-glass-popup v-model="isShow" :z-index="999" position="bottom" :close-on-click-modal="false" custom-class="!border rounded-xl" @close="handleClose(false)">
    <!-- 弹窗容器 -->
    <view class="box-border w-full flex flex-col gap-y-3 p-3">
      <!-- 顶部 -->
      <view class="relative box-border w-full flex items-center justify-around">
        <view class="w-full flex flex-col gap-y-1">
          <text class="text-md font-bold">{{ formMode === 'create' ? '发布瞬间' : '编辑瞬间' }}</text>
          <text class="text-xs text-gray-500">{{ formMode === 'create' ? '记录此刻的想法与生活' : '修改这条瞬间' }}</text>
        </view>
        <view class="uh-global-card-glass absolute right-0 top-0 h-6 w-6 flex items-center justify-center border rounded-lg shadow-none" @click="handleClose(false)">
          <wd-icon name="close" size="28rpx" class="text-gray-500" />
        </view>
      </view>
      <!-- 滚动区域 -->
      <scroll-view :scroll-y="true" :show-scrollbar="false" class="box-border max-h-[60vh]">
        <!-- 滚动内部容器 -->
        <view class="w-full flex flex-col gap-y-3">
          <view class="uh-global-card-glass overflow-hidden rounded-xl shadow-none">
            <uh-rich-editor
              ref="editorRef"
              toolbar
              placeholder="说点什么吧…"
              @input="handleEditorInput"
            />
          </view>

          <!-- 图片九宫格 -->
          <view>
            <text class="mb-2 block text-3xs text-gray-500">图片</text>
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
        </view>
      </scroll-view>
      <!-- 底部固定操作区域 -->
      <view class="box-border w-full flex items-center">
        <uh-button class="flex-1" custom-class="flex-1 uh-global-card-glass uh-shadow-xs border !py-2.5 !rounded-xl !text-3xs !bg-primary" :loading="saving" :disabled="!canSubmit" @click="handleSubmit">
          {{ formMode === 'create' ? '发布瞬间' : '保存瞬间' }}
        </uh-button>
      </view>
    </view>
  </uh-glass-popup>
</template>
