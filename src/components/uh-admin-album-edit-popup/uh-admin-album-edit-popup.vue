<script lang="ts" setup>
/**
 * 恋爱相册新增/编辑弹窗：名称/描述/排序/封面(单图)/查看密码（状态徽章+重设+清除勾选）
 *
 * 用法：
 * - 新增模式：<uh-admin-album-edit-popup :show="visible" @on-close="..." />
 * - 编辑模式：通过 ref.openEdit(album) 传入列表相册项回填（内部走 console 详情拉全量）
 */
import { ref, watch } from 'vue'
import { getLoveAlbumAdmin, createLoveAlbum, updateLoveAlbum } from '@/api/uni-admin'
import { useHaloUpload } from '@/hooks/useHaloUpload'
import { checkThumbnailUrl } from '@/utils/url'
import type { ILoveAlbum } from '@/api/types/uni-halo'

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
/** 表单（对齐插件端 LoveAlbumSpec + 密码操作语义） */
const form = ref({
  displayName: '',
  description: '',
  priority: 0,
  cover: '',
  /** 明文密码：创建=设置；编辑=留空保持原密码 */
  password: '',
  /** 编辑模式：true=清除密码（提交后复位） */
  passwordRemoved: false,
  /** 当前是否已启用密码（服务端回显） */
  passwordEnabled: false,
})
const saving = ref(false)

/** 封面单图上传 */
const { list: coverList, choose: chooseCover, remove: removeCover, uploading: coverUploading, urls: coverUrls } = useHaloUpload({ maxCount: 1 })

function handleCoverChange() {
  form.value.cover = coverUrls()[0] || form.value.cover
}

function handleResetForm() {
  formMode.value = 'create'
  editName.value = ''
  form.value = { displayName: '', description: '', priority: 0, cover: '', password: '', passwordRemoved: false, passwordEnabled: false }
  coverList.value = []
}

/** 外部打开编辑模式时回填（用 console 详情，含 passwordEnabled/priority 及原始 spec 字段） */
async function openEdit(album: ILoveAlbum) {
  formMode.value = 'edit'
  editName.value = album.metadata?.name || album.name || ''
  isShow.value = true
  try {
    const res = await getLoveAlbumAdmin(editName.value)
    const spec = (res.data?.spec || {}) as Record<string, any>
    form.value.displayName = spec.displayName || album.displayName || ''
    form.value.description = spec.description || ''
    form.value.priority = Number(spec.priority ?? 0)
    form.value.cover = spec.cover || ''
    form.value.password = ''
    form.value.passwordRemoved = false
    form.value.passwordEnabled = spec.passwordEnabled === true
    coverList.value = form.value.cover
      ? [{ tempPath: checkThumbnailUrl(form.value.cover), url: form.value.cover, status: 'success' as const, progress: 100 }]
      : []
  }
  catch {
    // 详情拉取失败时退回列表项数据
    form.value.displayName = album.displayName || album.title || ''
    uni.showToast({ title: '相册详情加载失败，仅回填基础信息', icon: 'none' })
  }
}

async function handleSave() {
  if (!form.value.displayName.trim()) {
    uni.showToast({ title: '请填写相册名称', icon: 'none' })
    return
  }
  if (coverList.value.some(i => i.status === 'pending' || i.status === 'uploading' || i.status === 'error')) {
    uni.showToast({ title: '封面上传中，请稍候', icon: 'none' })
    return
  }
  handleCoverChange()
  const spec = {
    displayName: form.value.displayName.trim(),
    description: form.value.description,
    cover: form.value.cover,
    priority: Number(form.value.priority) || 0,
  }
  saving.value = true
  try {
    if (formMode.value === 'create') {
      await createLoveAlbum({ album: { spec }, password: form.value.password || undefined })
    }
    else {
      await updateLoveAlbum(editName.value, {
        album: { spec },
        password: form.value.password || undefined,
        passwordRemoved: form.value.passwordRemoved || undefined,
      })
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
        <text class="text-md font-bold">{{ formMode === 'create' ? '新建相册' : '编辑相册' }}</text>
        <text class="text-xs text-gray-500">{{ formMode === 'create' ? '创建一个新相册来存放回忆' : '修改相册信息' }}</text>
      </view>
      <view class="uh-global-card-glass absolute right-4 top-4 h-6 w-6 border rounded-lg text-center shadow-none" @click="handleClose(false)">
        <wd-icon name="close" size="28rpx" class="text-gray-500" />
      </view>
    </view>
    <scroll-view :scroll-y="true" :show-scrollbar="false" class="box-border max-h-[60vh] p-4 pt-0">
      <view class="mb-5 flex items-center">
        <text class="w-[140rpx] shrink-0 text-sm text-[#666]">名称 *</text>
        <input v-model="form.displayName" class="uh-global-card-glass h-9 flex-1 border rounded-xl px-4 text-sm shadow-none" placeholder="请输入相册名称">
      </view>
      <view class="mb-5 flex items-start">
        <text class="w-[140rpx] shrink-0 pt-2.5 text-sm text-[#666]">描述</text>
        <textarea v-model="form.description" class="uh-global-card-glass box-border h-24 flex-1 border rounded-xl p-3 text-sm shadow-none" placeholder="请输入相册描述(选填)" :maxlength="200" />
      </view>
      <view class="mb-5 flex items-center">
        <text class="w-[140rpx] shrink-0 text-sm text-[#666]">排序</text>
        <input v-model="form.priority" type="number" class="uh-global-card-glass h-9 flex-1 border rounded-xl px-4 text-sm shadow-none" placeholder="数字越大越靠前，默认 0">
      </view>
      <view class="mb-5 flex items-start">
        <text class="w-[140rpx] shrink-0 pt-1 text-sm text-[#666]">封面</text>
        <view class="grid flex-1 grid-cols-4 gap-2">
          <view v-for="img in coverList" :key="img.tempPath" class="relative aspect-square overflow-hidden rounded-lg">
            <image :src="img.tempPath" mode="aspectFill" class="h-full w-full" />
            <view class="absolute right-1 top-1 h-5 w-5 flex items-center justify-center rounded-full bg-black/50 text-white" @click="removeCover(img.tempPath); handleCoverChange()">
              <wd-icon name="close" size="22rpx" />
            </view>
          </view>
          <view v-if="!coverList.length" class="aspect-square flex items-center justify-center border-2 border-gray-300 rounded-lg border-dashed text-gray-400" @click="chooseCover">
            <wd-icon name="camera" size="36rpx" />
          </view>
        </view>
      </view>
      <text v-if="coverUploading" class="mb-4 block pl-[140rpx] text-3xs text-gray-400">封面上传中…</text>
      <view class="mb-5">
        <view class="flex items-center">
          <text class="w-[140rpx] shrink-0 text-sm text-[#666]">查看密码</text>
          <input
            v-model="form.password"
            class="uh-global-card-glass h-9 flex-1 border rounded-xl px-4 text-sm shadow-none"
            :placeholder="formMode === 'create' ? '设置查看密码(选填)' : '输入新密码重设，留空保持不变'"
            password
          >
        </view>
        <!-- 密码状态与操作：单独一行在输入框下方 -->
        <view v-if="formMode === 'edit'" class="mt-2 flex items-center gap-4 pl-[140rpx]">
          <text class="text-3xs" :class="form.passwordRemoved ? 'text-orange-500' : form.passwordEnabled ? 'text-green-600' : 'text-gray-400'">
            {{ form.passwordRemoved ? '保存后清除' : form.passwordEnabled ? '已启用' : '未设置' }}
          </text>
          <view v-if="form.passwordEnabled" class="flex items-center gap-1.5" @click="form.passwordRemoved = !form.passwordRemoved">
            <view class="h-4 w-4 flex items-center justify-center rounded border" :class="form.passwordRemoved ? 'border-orange-400 bg-orange-400 text-white' : 'border-gray-300'">
              <wd-icon v-if="form.passwordRemoved" name="check" size="20rpx" />
            </view>
            <text class="text-3xs text-gray-500">清除查看密码</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 底部固定操作栏（滚动区外） -->
    <view class="border-t border-black/5 px-4 pb-safe pt-3">
      <uh-button custom-class="flex-1 uh-global-card-glass uh-shadow-xs border py-2 !rounded-xl !bg-love text-white" :loading="saving" @click="handleSave">
        保存
      </uh-button>
    </view>
  </uh-glass-popup>
</template>
