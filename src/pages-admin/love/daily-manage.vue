<script lang="ts" setup>
/**
 * 恋爱清单管理页
 */
import { ref } from 'vue'
import { onLoad, onPageScroll, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import dayjs from 'dayjs'
import { getLoveDailyItems } from '@/api/uni-halo'
import { createLoveDailyItem, deleteLoveDailyItem, updateLoveDailyItem } from '@/api/uni-admin'
import { usePageScroll } from '@/hooks/usePageScroll'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { useHaloUpload } from '@/hooks/useHaloUpload'
import { checkThumbnailUrl } from '@/utils/url'
import type { ILoveDailyItem, ILoveDailyItemSpec } from '@/api/types/uni-halo'

definePage({
  style: {
    navigationBarTitleText: '恋爱清单管理',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
  },
})

const { scrollY, updatePageScrollValue } = usePageScroll()

const status = reactive([
  { name: '未开始', value: 'wait', color: 'text-gray-500' },
  { name: '进行中', value: 'doing', color: 'text-blue-500' },
  { name: '已完成', value: 'complete', color: 'text-love' },
])

/* ---------------- 数据加载 ---------------- */
const { loadingStatus, loadMoreStatus, updateLoadingStatus, updateLoadMoreStatus, resetLoadMoreStatus } = useDataLoadingStatus()
const queryParams = ref({ size: 10, page: 1 })
const dataList = ref<ILoveDailyItem[]>([])

async function handleGetData() {
  if (!loadMoreStatus.value.active) {
    updateLoadingStatus(DataLoadingStatusEnum.Loading)
  }
  try {
    const res = await getLoveDailyItems({ ...queryParams.value })
    const items = (res.data?.items || []).map((item) => {
      const _status = status.find(s => s.value === item.spec.status)
      item.spec._status = _status?.name ?? '未命名'
      item.spec._statusClass = _status.color
      return item
    })
    dataList.value = loadMoreStatus.value.active
      ? dataList.value.concat(items)
      : items
    if (!loadMoreStatus.value.active) {
      updateLoadingStatus(dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
    }
    updateLoadMoreStatus({
      active: false,
      status: res.data?.hasNext ? 'loadMore' : 'noMore',
      hasNext: !!res.data?.hasNext,
    })
  }
  catch (err) {
    console.error(err)
    if (loadMoreStatus.value.active) {
      updateLoadMoreStatus({ active: false, status: 'error' })
    }
    else {
      updateLoadingStatus(DataLoadingStatusEnum.Error)
    }
  }
  finally {
    uni.stopPullDownRefresh()
  }
}

function handleRetry() {
  queryParams.value.page = 1
  handleGetData()
}

onLoad(() => {
  handleGetData()
})

onPullDownRefresh(() => {
  resetLoadMoreStatus()
  queryParams.value.page = 1
  handleGetData()
})

onReachBottom(() => {
  if (loadMoreStatus.value.active) { return }
  if (loadMoreStatus.value.hasNext) {
    queryParams.value.page += 1
    updateLoadMoreStatus({ active: true, status: 'loading' })
    handleGetData()
  }
})

/* ---------------- 新增/编辑弹层 ---------------- */
const formVisible = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editName = ref('')
const form = ref<ILoveDailyItemSpec>({})
/** 回忆照片（多图，spec.images） */
const { list: imageList, choose: chooseImages, remove: removeImage, retry: imageRetry } = useHaloUpload({ maxCount: 9 })

/* ---------------- 完成感想富文本（官方 editor，经 uh-rich-editor 封装） ---------------- */
const editorRef = ref<{ setHtml(html: string): void, getHtml(): Promise<string>, clear(): void } | null>(null)

/** 完成日期选择（wd-datetime-picker 受控模式） */
const datePickerVisible = ref(false)
const dateTs = ref(Date.now())

function openDatePicker() {
  dateTs.value = form.value.completeDate ? dayjs(form.value.completeDate).valueOf() : Date.now()
  datePickerVisible.value = true
}

function handleDateConfirm({ value }: any) {
  form.value.completeDate = dayjs(value).format('YYYY-MM-DD')
  datePickerVisible.value = false
}

function openCreate() {
  formMode.value = 'create'
  editName.value = ''
  form.value = { title: '', content: '', status: 'wait', planDate: '' }
  imageList.value = []
  editorRef.value?.clear()
  formVisible.value = true
}

function openEdit(item: ILoveDailyItem) {
  formMode.value = 'edit'
  editName.value = item.metadata?.name || ''
  form.value = { ...(item.spec || {}) }
  // tempPath 用于显示（相对路径补域名），url 保留原始相对路径用于提交
  imageList.value = (form.value.images || []).map(url => ({
    tempPath: checkThumbnailUrl(url),
    url,
    status: 'success' as const,
    progress: 100,
  }))
  formVisible.value = true
  // 编辑器未 ready 时组件内部会挂起，ready 后自动回填
  setTimeout(() => {
    editorRef.value?.setHtml(form.value.completeRemark || '')
  }, 0)
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
    uni.showToast({ title: '已完成的心愿需填写完成日期', icon: 'none' })
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
    formVisible.value = false
    uni.showToast({ title: formMode.value === 'create' ? '已新增' : '已保存', icon: 'success' })
    handleRetry()
  }
  catch (err: any) {
    uni.showToast({ title: err?.message || '保存失败', icon: 'none' })
  }
  finally {
    saving.value = false
  }
}

/* ---------------- 状态切换 / 删除 ---------------- */
async function handleToggleStatus(item: ILoveDailyItem) {
  const spec = { ...(item.spec || {}) }
  const done = spec.status === 'complete'
  spec.status = done ? 'wait' : 'complete'
  // 插件端要求 yyyy-MM-dd 格式
  spec.completeDate = done ? '' : dayjs().format('YYYY-MM-DD')
  try {
    await updateLoveDailyItem(item.metadata?.name || '', spec)
    item.spec = { ...item.spec, ...spec }
  }
  catch (err: any) {
    uni.showToast({ title: err?.message || '更新失败', icon: 'none' })
  }
}

function handleDelete(item: ILoveDailyItem) {
  uni.showModal({
    title: '删除清单项',
    content: `确定删除「${item.spec?.title || '未命名'}」吗？`,
    confirmColor: '#ef4444',
    success: async (res) => {
      if (!res.confirm)
        return
      try {
        await deleteLoveDailyItem(item.metadata?.name || '')
        dataList.value = dataList.value.filter(x => (x.metadata?.name || '') !== (item.metadata?.name || ''))
        if (dataList.value.length === 0)
          updateLoadingStatus(DataLoadingStatusEnum.Empty)
        uni.showToast({ title: '已删除', icon: 'success' })
      }
      catch (err: any) {
        uni.showToast({ title: err?.message || '删除失败', icon: 'none' })
      }
    },
  })
}

onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})
</script>

<template>
  <view class="box-border min-h-screen w-screen flex flex-col bg-page">
    <uh-navbar :scroll-y="scrollY" :use-back="true" default-title="恋爱清单管理" title-color="text-gray-900" />

    <uh-data-loading
      v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus"
      min-height="70vh" @refresh="handleRetry"
    />

    <view v-else class="box-border flex flex-col gap-3 px-3 pb-24 pt-3">
      <view
        v-for="(item, index) in dataList" :key="item.metadata?.name || item.id"
        class="uh-global-card-glass uh-shadow-xs overflow-hidden rounded-xl"
      >
        <view class="flex items-start gap-3 p-4">
          <!-- 勾选完成状态 -->
          <view
            class="uh-global-card-glass mt-1 h-6 w-6 flex shrink-0 items-center justify-center rounded-full bg-love text-xs text-white"
            @click="handleToggleStatus(item)"
          >
            {{ index + 1 }}
          </view>
          <view class="min-w-0 flex-1">
            <view class="text-sm text-gray-900 font-bold">
              {{ item.spec?.title || '未命名' }}
            </view>
            <view class="line-clamp-2 mt-1 text-xs text-gray-500 leading-relaxed">
              {{ item.spec?.content || '' }}
            </view>
            <view v-if="item.spec?.planDate" class="mt-1 flex items-center gap-1 text-xs text-gray-500">
              <text>计划日期：{{ item.spec.planDate }}</text>
            </view>
          </view>
          <image
            v-if="item.spec?.images?.[0]" :src="checkThumbnailUrl(item.spec.images[0], true)"
            mode="aspectFill" class="h-16 w-16 shrink-0 rounded-lg"
          />
        </view>
        <view
          class="flex items-center justify-end gap-6 border-t border-gray-100 border-t-solid px-4 py-2.5 text-xs"
        >
          <view class="flex-1 font-bold" :class="[item.spec._statusClass]">
            {{ item.spec._status }}
          </view>
          <view class="flex shrink-0 items-center justify-end gap-x-6">
            <view class="flex items-center gap-1 text-gray-500" @click="openEdit(item)">
              <wd-icon name="edit" size="26rpx" />
              <text>编辑</text>
            </view>
            <view class="flex items-center gap-1 text-red-500" @click="handleDelete(item)">
              <wd-icon name="delete" size="26rpx" />
              <text>删除</text>
            </view>
          </view>
        </view>
      </view>
      <uh-data-loadmore :status="loadMoreStatus.status" :text="loadMoreStatus.text" />
    </view>

    <!-- 底部悬浮：新增（参考文章详情悬浮设计） -->
    <uh-permission permission="LOVE_DAILY_MANAGE">
      <view class="uh-translate-x-center fixed bottom-0 left-1/2 z-10 flex items-center justify-center pb-safe">
        <view
          class="uh-global-card-glass box-border flex items-center justify-center gap-x-1 border rounded-full px-6 py-2.5 text-love shadow-none"
          @click="openCreate"
        >
          <wd-icon name="plus" size="32rpx" />
          <text class="shrink-0 text-2xs font-semibold">新增心愿</text>
        </view>
      </view>
    </uh-permission>

    <!-- 新增/编辑弹层 -->
    <uh-glass-popup v-model="formVisible" :z-index="100" position="bottom" custom-class="!border rounded-xl">
      <view class="relative mb-4 box-border w-full flex items-center justify-around px-4 pt-4">
        <view class="w-full flex flex-col gap-y-1">
          <text class="text-md font-bold">{{ formMode === 'create' ? '新增心愿' : '编辑心愿' }}</text>
          <text class="text-xs text-gray-500">{{ formMode === 'create' ? '记录一个想一起完成的心愿' : '修改心愿信息' }}</text>
        </view>
        <view
          class="uh-global-card-glass absolute right-4 top-4 h-6 w-6 border rounded-lg text-center shadow-none"
          @click="formVisible = false"
        >
          <wd-icon name="close" size="32rpx" class="text-gray-500" />
        </view>
      </view>
      <scroll-view :scroll-y="true" :show-scrollbar="false" class="box-border max-h-[60vh] p-4 pt-0">
        <view class="mb-5 flex items-center">
          <text class="w-[140rpx] shrink-0 text-sm text-[#666]">标题 *</text>
          <input
            v-model="form.title"
            class="uh-global-card-glass h-9 flex-1 border rounded-xl px-4 text-sm shadow-none"
            placeholder="请输入心愿标题"
          >
        </view>
        <view class="mb-5">
          <text class="mb-2 block text-sm text-[#666]">描述</text>
          <textarea
            v-model="form.content"
            class="uh-global-card-glass box-border h-24 w-full border rounded-xl p-3 text-sm shadow-none"
            placeholder="请输入描述(选填)" :maxlength="500"
          />
        </view>
        <view class="mb-5 flex items-center">
          <text class="w-[140rpx] shrink-0 text-sm text-[#666]">计划时间</text>
          <input
            v-model="form.planDate"
            class="uh-global-card-glass h-9 flex-1 border rounded-xl px-4 text-sm shadow-none"
            placeholder="如 2024-06-01(选填)"
          >
        </view>
        <view class="mb-5 flex items-center">
          <text class="w-[140rpx] shrink-0 text-sm text-[#666]">状态</text>
          <view class="flex flex-1 gap-2">
            <text
              v-for="s in [{ v: 'wait', t: '未开始' }, { v: 'doing', t: '进行中' }, { v: 'complete', t: '已完成' }]"
              :key="s.v" class="rounded-full px-3 py-1 text-xs"
              :class="form.status === s.v ? 'bg-love text-white' : 'bg-page text-gray-500'"
              @click="form.status = s.v as ILoveDailyItemSpec['status']"
            >
              {{ s.t }}
            </text>
          </view>
        </view>
        <!-- 已完成：完成日期 + 完成感想 -->
        <template v-if="form.status === 'complete'">
          <view class="mb-5 flex items-center gap-2">
            <text class="w-[140rpx] shrink-0 text-sm text-[#666]">完成日期 *</text>
            <input v-model="form.completeDate" class="uh-global-card-glass h-9 flex-1 border rounded-xl px-4 text-sm shadow-none" placeholder="如 2024-06-01(必填)">
            <wd-datetime-picker
              v-model="dateTs"
              type="date"
              :visible="datePickerVisible"
              title="选择完成日期"
              @update:visible="datePickerVisible = $event"
              @confirm="handleDateConfirm"
            >
              <view class="uh-global-card-glass h-9 w-9 shrink-0 flex items-center justify-center border rounded-xl text-gray-500 shadow-none" @click="openDatePicker">
                <wd-icon name="calendar" size="32rpx" />
              </view>
            </wd-datetime-picker>
          </view>
          <view class="mb-5">
            <text class="mb-2 block text-sm text-[#666]">完成感想</text>
            <view class="uh-global-card-glass box-border w-full rounded-xl p-2 shadow-none">
              <uh-rich-editor
                ref="editorRef"
                toolbar
                placeholder="记录完成这一刻的感受…"
              />
            </view>
          </view>
        </template>
        <view class="mb-5">
          <text class="mb-2 block text-sm text-[#666]">回忆照片</text>
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
          <text class="mt-1 block text-3xs text-gray-400">记录这个心愿的回忆(选填，最多 9 张)</text>
        </view>
      </scroll-view>

      <!-- 底部固定操作栏（滚动区外） -->
      <view class="border-t border-black/5 px-4 pb-safe pt-3">
        <uh-button custom-class="py-2 !rounded-xl !bg-love text-white" :loading="saving" @click="handleSave">
          保存
        </uh-button>
      </view>
    </uh-glass-popup>
  </view>
</template>

<style scoped lang="scss">
	.uh-translate-x-center {
  transform: translateX(-50%);
}
</style>
