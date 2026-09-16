<script lang="ts" setup>
/**
 * 官方 editor 富文本编辑器封装（全局组件，uh- 前缀 easycom 自动注册）
 *
 * - 通过 ref 调用：setHtml(html) / getHtml(): Promise<string> / insertImage(src) / clear()
 * - @input 实时同步内容（e.detail.html）
 * - ready 时序已处理：ready 前调用 setHtml 会挂起，ready 后自动回填
 * - toolbar 开启时显示基础格式工具条（加粗/斜体/下划线/删除线/标题/列表/分割线/插图）
 */
import { getCurrentInstance, ref } from 'vue'
import { getAttachmentPermalink, uploadAttachment } from '@/api/uni-admin'
import { checkThumbnailUrl } from '@/utils/url'

/** 基础请求地址（与 utils/url 一致） */
const BASE_API = import.meta.env.VITE_SERVER_BASEURL || ''

/** 相对路径图片补全域名（编辑回显用，editor 内无法渲染相对地址） */
function toDisplayHtml(html: string): string {
  if (!html || !BASE_API)
    return html
  return html.replace(/src="(\/[^"]+)"/g, `src="${BASE_API}$1"`)
}

/** 保存时还原：本组件插入时补的域名前缀还原为相对路径（与系统存储约定一致） */
function toStorageHtml(html: string): string {
  if (!html || !BASE_API)
    return html
  return html.split(`${BASE_API}/`).join('/')
}

const props = withDefaults(defineProps<{
  /** 占位提示文本 */
  placeholder?: string
  /** 是否只读 */
  readOnly?: boolean
  /** 是否显示基础格式工具条 */
  toolbar?: boolean
}>(), {
  placeholder: '',
  readOnly: false,
  toolbar: false,
})

const emit = defineEmits<{
  (e: 'ready'): void
  (e: 'input', html: string): void
}>()

/** 同页面多实例时保证 selector id 唯一 */
let uid = 0

const instance = getCurrentInstance()
const editorId = `uh-rich-editor-${++uid}`
const ctx = ref<any>(null)
/** ready 前暂存的回填内容 */
let pendingHtml: string | null = null
/** 工具条插图上传中 */
const uploadingImage = ref(false)

function handleReady() {
  uni.createSelectorQuery()
    .in(instance?.proxy as any)
    .select(`#${editorId}`)
    .context((res: any) => {
      ctx.value = res?.context || null
      if (ctx.value && pendingHtml !== null) {
        setHtml(pendingHtml)
        pendingHtml = null
      }
      emit('ready')
    })
    .exec()
}

/** 回填 HTML（ready 前调用会自动挂起） */
function setHtml(html: string) {
  const editorCtx = ctx.value
  if (!editorCtx || typeof editorCtx.setContents !== 'function') {
    pendingHtml = html
    return
  }
  editorCtx.setContents({
    html: toDisplayHtml(html || ''),
    fail: (err: unknown) => {
      console.error('[uh-rich-editor] setContents failed', err)
    },
  })
}

/** 获取编辑器 HTML 内容（跨端 API 均为 getContents，注意不是 getContent）；插入图片的域名前缀会还原为相对路径存储 */
function getHtml(): Promise<string> {
  return new Promise((resolve) => {
    const editorCtx = ctx.value
    if (!editorCtx || typeof editorCtx.getContents !== 'function') {
      resolve('')
      return
    }
    editorCtx.getContents({
      success: (res: any) => resolve(toStorageHtml(res?.html || '')),
      fail: () => resolve(''),
    })
  })
}

/** 插入图片（调用方需保证 src 为线上地址） */
function insertImage(src: string) {
  ctx.value?.insertImage?.({ src })
}

/** 清空内容 */
function clear() {
  ctx.value?.clear?.()
}

function handleInput(e: any) {
  emit('input', e?.detail?.html || '')
}

/* ---------------- 工具条 ---------------- */

function handleFormat(name: string, value?: unknown) {
  ctx.value?.format?.(name, value)
}

function handleInsertDivider() {
  ctx.value?.insertDivider?.()
}

/** 工具条插图：选图 → 上传 Halo 附件 → insertImage */
function handleChooseImage() {
  if (uploadingImage.value)
    return
  uni.chooseImage({
    count: 1,
    success: (res) => {
      uploadingImage.value = true
      uni.showLoading({ title: '上传中', mask: true })
      uploadAttachment(res.tempFilePaths[0])
        .then((att) => {
          // permalink 是 /upload/... 相对路径，editor 内渲染需补全域名；保存时 getHtml 会还原
          const url = getAttachmentPermalink(att)
          if (url)
            insertImage(checkThumbnailUrl(url))
        })
        .catch(() => {
          uni.showToast({ title: '图片上传失败', icon: 'none' })
        })
        .finally(() => {
          uni.hideLoading()
          uploadingImage.value = false
        })
    },
  })
}

const toolbarItems = [
  { label: 'B', title: '加粗', action: () => handleFormat('bold'), bold: true },
  { label: 'I', title: '斜体', action: () => handleFormat('italic'), italic: true },
  { label: 'U', title: '下划线', action: () => handleFormat('underline'), underline: true },
  { label: 'S', title: '删除线', action: () => handleFormat('strike'), strike: true },
  { label: 'H2', title: '标题', action: () => handleFormat('header', 2) },
  { label: '• 列表', title: '无序列表', action: () => handleFormat('list', 'bullet') },
  { label: '1. 列表', title: '有序列表', action: () => handleFormat('list', 'ordered') },
  { label: '—', title: '分割线', action: handleInsertDivider },
  { label: '图片', title: '插入图片', action: handleChooseImage },
]

defineExpose({ setHtml, getHtml, insertImage, clear })
</script>

<template>
  <view class="w-full">
    <view v-if="props.toolbar && !props.readOnly" class="mb-1 flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-black/5 pb-1">
      <view
        v-for="item in toolbarItems"
        :key="item.title"
        class="h-7 flex items-center justify-center rounded-md px-1.5 text-xs text-gray-700 active:bg-black/5"
        :class="[
          item.bold ? 'font-bold' : '',
          item.italic ? 'italic' : '',
          item.underline ? 'underline' : '',
          item.strike ? 'line-through' : '',
        ]"
        @click.stop="item.action"
      >
        {{ item.label }}
      </view>
    </view>
    <editor
      :id="editorId"
      class="uh-rich-editor text-xs text-gray-900 p-2"
      :placeholder="props.placeholder"
      :read-only="props.readOnly"
      @ready="handleReady"
      @input="handleInput"
    />
  </view>
</template>

<style scoped lang="scss">
/* editor 在小程序端需要显式高度，H5/App 同样适用 */
.uh-rich-editor {
  width: 100%;
  height: 320rpx;
}
</style>
