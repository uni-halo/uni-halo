<script lang="ts" setup>
/**
 * 恋爱清单新增/编辑弹窗
 */
import { ref, watch } from 'vue'
import dayjs from 'dayjs'
import { createLoveDailyItem, updateLoveDailyItem } from '@/api/uni-admin'
import { useHaloUpload } from '@/hooks/useHaloUpload'
import { checkThumbnailUrl } from '@/utils/url'
import type { ILoveDailyItem, ILoveDailyItemSpec } from '@/api/types/uni-halo'

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
const form = ref<ILoveDailyItemSpec>({})
/** 回忆照片（多图，spec.images，不限数量） */
const { list: imageList, choose: chooseImages, remove: removeImage, retry: imageRetry } = useHaloUpload({ maxCount: 99 })

/* ---------------- 完成感想富文本（官方 editor，经 uh-rich-editor 封装，带工具条） ---------------- */
const editorRef = ref<{ setHtml(html: string): void, getHtml(): Promise<string>, clear(): void } | null>(null)

/** 计划日期选择（wd-datetime-picker 是纯弹层，需自建触发区 + 受控 visible） */
const planDateShow = ref(false)
const planDateTs = ref(Date.now())

function openPlanDatePicker() {
  planDateTs.value = form.value.planDate ? dayjs(form.value.planDate).valueOf() : Date.now()
  planDateShow.value = true
}

function handlePlanDateConfirm({ value }: any) {
  form.value.planDate = dayjs(value).format('YYYY-MM-DD')
}

/** 完成日期选择 */
const dateShow = ref(false)
const dateTs = ref(Date.now())

function openDatePicker() {
  dateTs.value = form.value.completeDate ? dayjs(form.value.completeDate).valueOf() : Date.now()
  dateShow.value = true
}

function handleDateConfirm({ value }: any) {
  form.value.completeDate = dayjs(value).format('YYYY-MM-DD')
}

function handleResetForm() {
  formMode.value = 'create'
  editName.value = ''
  form.value = { title: '', content: '', status: 'wait', planDate: '' }
  dateTs.value = Date.now()
  planDateTs.value = Date.now()
  imageList.value = []
  editorRef.value?.setHtml('')
}

/** 外部打开编辑模式时回填 */
function openEdit(item: ILoveDailyItem) {
  formMode.value = 'edit'
  editName.value = item.metadata?.name || ''
  form.value = { ...(item.spec || {}) }
  // 日期选择器回显
  planDateTs.value = form.value.planDate ? dayjs(form.value.planDate).valueOf() : Date.now()
  dateTs.value = form.value.completeDate ? dayjs(form.value.completeDate).valueOf() : Date.now()
  // tempPath 用于显示（相对路径补域名），url 保留原始相对路径用于提交
  imageList.value = (form.value.images || []).map(url => ({
    tempPath: checkThumbnailUrl(url),
    url,
    status: 'success' as const,
    progress: 100,
  }))
  isShow.value = true
  // 编辑器未 ready 时组件内部会挂起，ready 后自动回填
  setTimeout(() => {
    editorRef.value?.setHtml(form.value.completeRemark || '')
  }, 0)
}

/** 切换状态：切到已完成时预填今天为完成日期（与选择器显示一致） */
function handleStatusChange(v: ILoveDailyItemSpec['status']) {
  form.value.status = v
  if (v === 'complete' && !form.value.completeDate) {
    form.value.completeDate = dayjs().format('YYYY-MM-DD')
    dateTs.value = Date.now()
  }
}

const saving = ref(false)

async function handleSave() {
  const spec = { ...form.value }
  if (!spec.title?.trim()) {
    uni.showToast({ title: '请填写标题', icon: 'none' })
    return
  }
  if (imageList.value.some(i => i.status === 'pending' || i.status === 'uploading' || i.status === 'error')) {
    uni.showToast({ title: '回忆照片尚未上传完成', icon: 'none' })
    return
  }
  if (spec.status === 'complete' && !spec.completeDate) {
    uni.showToast({ title: '已完成的清单需填写完成日期', icon: 'none' })
    return
  }
  // 回忆照片（已上传成功的远程地址）
  spec.images = imageList.value.filter(i => i.status === 'success').map(i => i.url)
  // 完成感想（富文本）
  spec.completeRemark = spec.status === 'complete' ? await editorRef.value?.getHtml() || '' : ''
  // 非完成状态清空完成字段
  if (spec.status !== 'complete') {
    spec.completeDate = ''
  }
  saving.value = true
  try {
    if (formMode.value === 'create') {
      await createLoveDailyItem(spec)
    }
    else {
      await updateLoveDailyItem(editName.value, spec)
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
  <uh-glass-popup v-model="isShow" :z-index="999" position="bottom" :close-on-click-modal="false" custom-class="!border rounded-xl" @close="handleClose(false)">
    <!-- 弹窗容器 -->
    <view class="w-full box-border flex flex-col gap-y-3 p-3">
      <!-- 顶部 -->
      <view class="relative box-border w-full flex items-center justify-around">
        <view class="w-full flex flex-col gap-y-1">
          <text class="text-md font-bold">{{ formMode === 'create' ? '新增清单' : '编辑清单' }}</text>
          <text class="text-xs text-gray-500">{{ formMode === 'create' ? '记录一件想一起完成的事' : '修改清单信息' }}</text>
        </view>
        <view class="uh-global-card-glass absolute right-0 top-0 h-6 w-6 border rounded-lg flex items-center justify-center shadow-none" @click="handleClose(false)">
          <wd-icon name="close" size="28rpx" class="text-gray-500" />
        </view>
      </view>
      <!-- 滚动区域 -->
      <scroll-view :scroll-y="true" :show-scrollbar="false" class="box-border max-h-[60vh]">
        <!-- 滚动内部容器 -->
        <view class="w-full flex flex-col gap-y-3">
          <view class="flex items-center">
            <text class="w-[140rpx] shrink-0 text-3xs text-gray-600">标题 *</text>
            <input v-model="form.title"
              class="uh-global-card-glass h-9 flex-1 border rounded-xl px-4 text-3xs shadow-none"
              placeholder="请输入清单标题">
          </view>
          <view class="flex items-start">
            <text class="w-[140rpx] shrink-0 pt-2.5 text-3xs text-gray-600">描述</text>
            <textarea v-model="form.content"
              class="uh-global-card-glass box-border h-24 flex-1 border rounded-xl p-3 text-3xs shadow-none"
              placeholder="请输入描述(选填)" :maxlength="500" />
          </view>
          <view class="flex items-center">
            <text class="w-[140rpx] shrink-0 text-3xs text-gray-600">计划时间</text>
            <view
              class="uh-global-card-glass h-9 flex flex-1 items-center justify-between border rounded-xl px-4 text-3xs shadow-none"
              @click="openPlanDatePicker"
            >
              <text
                :class="form.planDate ? 'text-gray-900' : 'text-gray-400'">{{ form.planDate || '如 2024-06-01(选填)' }}</text>
              <wd-icon name="calendar" size="28rpx" class="text-gray-400" />
            </view>
          </view>
          <wd-datetime-picker :z-index="999" v-model="planDateTs" root-portal type="date" title="选择计划日期"
            v-model:visible="planDateShow" @confirm="handlePlanDateConfirm" />
          <view class="flex items-center">
            <text class="w-[140rpx] shrink-0 text-3xs text-gray-600">完成状态</text>
            <view class="flex flex-1 gap-2">
              <text
                v-for="s in [{ v: 'wait', t: '未开始' }, { v: 'doing', t: '进行中' }, { v: 'complete', t: '已完成' }]"
                :key="s.v" class="rounded-full px-3 py-1 text-xs"
                :class="form.status === s.v ? 'bg-love text-white' : 'bg-page text-gray-500'"
                @click="handleStatusChange(s.v as ILoveDailyItemSpec['status'])">
                {{ s.t }}
              </text>
            </view>
          </view>
          <!-- 已完成：完成日期 + 完成感想 -->
          <template v-if="form.status === 'complete'">
            <view class="flex items-center">
              <text class="w-[140rpx] shrink-0 text-3xs text-gray-600">完成日期 *</text>
              <view
                class="uh-global-card-glass h-9 flex flex-1 items-center justify-between border rounded-xl px-4 text-3xs shadow-none"
                @click="openDatePicker"
              >
                <text
                  :class="form.completeDate ? 'text-gray-900' : 'text-gray-400'">{{ form.completeDate || '如 2024-06-01(必填)' }}</text>
                <wd-icon name="calendar" size="28rpx" class="text-gray-400" />
              </view>
            </view>
            <wd-datetime-picker v-model="dateTs" :z-index="999" root-portal type="date" title="选择完成日期"
              v-model:visible="dateShow" @confirm="handleDateConfirm" />
            <view>
              <text class="mb-2 block text-3xs text-gray-600">完成感想</text>
              <view class="uh-global-card-glass box-border w-full rounded-xl shadow-none">
                <uh-rich-editor ref="editorRef" toolbar placeholder="记录完成这一刻的感受…" />
              </view>
            </view>
          </template>
          <view>
            <text class="mb-2 block text-3xs text-gray-600">回忆照片</text>
            <view class="grid grid-cols-4 gap-2">
              <view v-for="img in imageList" :key="img.tempPath"
                class="relative aspect-square overflow-hidden rounded-lg">
                <image :src="img.tempPath" class="h-full w-full" mode="aspectFill" />
                <view
                  class="absolute right-1 top-1 h-5 w-5 flex items-center justify-center rounded-full bg-black/50 text-white"
                  @click="removeImage(img.tempPath)">
                  <wd-icon name="close" size="22rpx" />
                </view>
                <view v-if="img.status === 'uploading'"
                  class="absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-white">
                  {{ img.progress }}%
                </view>
                <view v-else-if="img.status === 'error'"
                  class="absolute inset-0 flex flex-col items-center justify-center bg-red-500/60 text-xs text-white"
                  @click="imageRetry(img.tempPath)">
                  <text>失败</text>
                  <text>点击重试</text>
                </view>
                <view v-else-if="img.status === 'success'"
                  class="absolute bottom-1 right-1 h-5 w-5 flex items-center justify-center rounded-full bg-green-500 text-white">
                  <wd-icon name="check" size="22rpx" />
                </view>
              </view>
              <view
                class="aspect-square flex items-center justify-center border-2 border-gray-300 rounded-lg border-dashed text-gray-400"
                @click="chooseImages">
                <wd-icon name="camera" size="36rpx" />
              </view>
            </view>
            <text class="mt-2 block text-xs text-gray-400">记录这个清单的回忆(选填，不限数量)</text>
          </view>
        </view>
      </scroll-view>
      <!-- 底部固定操作区域 -->
      <view class="box-border w-full flex items-center">
        <uh-button class="flex-1" custom-class="flex-1 uh-global-card-glass uh-shadow-xs border py-2 !rounded-xl !bg-love text-white" :loading="saving" @click="handleSave">
          保存
        </uh-button>
      </view>
    </view>
  </uh-glass-popup>
</template>
