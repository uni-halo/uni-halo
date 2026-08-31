<script lang="ts" setup>
/**
 * 相册密码解锁弹窗(源自旧项目 components/album-unlock-modal,新建复刻)
 * 输入密码解锁加密相册
 */
import { ref, watch } from 'vue'
import { unlockAlbum } from '@/api/uni-halo'

const props = withDefaults(defineProps<{
  show: boolean
  albumName?: string
  albumKey?: string
}>(), {
  albumName: '',
  albumKey: '',
})

const emit = defineEmits<{
  (e: 'update:show', show: boolean): void
  (e: 'success', data: { albumKey: string, token: string, photos: unknown[] }): void
}>()

const isShow = ref(false)
const password = ref('')
const loading = ref(false)

watch(() => props.show, (val) => {
  isShow.value = val
})

function handleOnCancel() {
  password.value = ''
  isShow.value = false
  emit('update:show', false)
}

async function handleOnConfirm() {
  if (!password.value.trim()) {
    uni.showToast({ title: '请输入密码', icon: 'none' })
    return
  }

  loading.value = true
  try {
    const res = await unlockAlbum(props.albumKey, password.value)
    if (res.data && (res.data as { token?: string }).token) {
      password.value = ''
      isShow.value = false
      emit('update:show', false)
      emit('success', {
        albumKey: props.albumKey,
        token: (res.data as { token: string }).token,
        photos: (res.data as { photos?: unknown[] }).photos || [],
      })
      uni.showToast({ title: '解锁成功', icon: 'success' })
    }
  }
  catch (e) {
    console.error('解锁失败', e)
    password.value = ''
    uni.showToast({ title: '密码错误，请重试', icon: 'none' })
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <wd-dialog
    v-model="isShow"
    title="相册密码"
    :show-cancel="true"
    confirm-text="解锁"
    confirm-button-color="#f88ca2"
    @cancel="handleOnCancel"
    @confirm="handleOnConfirm"
  >
    <view class="unlock-modal-content py-5">
      <view class="album-info flex flex-col items-center">
        <view class="lock-icon mb-5 text-[80rpx]">
          🔒
        </view>
        <view class="album-name mb-3 text-[32rpx] text-[#333] font-bold">
          {{ albumName }}
        </view>
        <view class="tip-text text-[26rpx] text-[#999]">
          此相册已加密，请输入密码查看
        </view>
      </view>
      <wd-input
        v-model="password"
        :password="true"
        placeholder="请输入相册密码"
        align="center"
        clearable
        class="password-input mt-9"
      />
    </view>
  </wd-dialog>
</template>

<style scoped>
.unlock-modal-content {
  /* 布局全部由 UnoCSS 原子类实现 */
}
</style>
