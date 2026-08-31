<script lang="ts" setup>
/**
 * 通知弹窗(源自旧项目 components/notify-dialog,新建复刻)
 * wd-popup + mp-html 渲染 markdown 内容,可选跳转外链
 */
import { ref, watch } from 'vue'
import { checkIsUrl } from '@/utils/url'
import { markdownConfig } from '@/config/markdown'

const props = defineProps<{
  show: boolean
  title: string
  content: string
  url: string
}>()

const emit = defineEmits<{
  (e: 'on-change', show: boolean): void
}>()

const isShow = ref(props.show)

watch(() => props.show, (val) => {
  isShow.value = val
})

function handleOnChange(e: unknown) {
  isShow.value = false
  emit('on-change', Boolean(e))
}

function handleToWebview() {
  if (checkIsUrl(props.url)) {
    uni.navigateTo({
      url: `/pages-blog/website/website?data=${JSON.stringify({
        title: props.title,
        url: encodeURIComponent(props.url),
      })}`,
      success: () => {
        handleOnChange(false)
      },
    })
  }
}
</script>

<template>
  <wd-popup v-model="isShow" width="80vw" position="center" custom-style="border-radius:12rpx;" @close="handleOnChange(false)">
    <view class="uh-notify-dialog box-border w-[80vw] p-3">
      <view class="text-overflow-2 mb-6 text-center font-bold">
        {{ title }}
      </view>
      <view class="content-box">
        <scroll-view scroll-y :style="{ height: url ? '600rpx' : '680rpx' }">
          <mp-html
            class="evan-markdown"
            lazy-load
            :domain="markdownConfig.domain ?? ''"
            :loading-img="markdownConfig.loadingGif"
            scroll-table
            selectable
            :tag-style="markdownConfig.tagStyle"
            :container-style="markdownConfig.containStyle"
            :content="content"
            :markdown="true"
            :show-line-number="true"
            :show-language-name="true"
            copy-by-long-press
          />
        </scroll-view>
      </view>
      <view v-if="url" class="mt-6 flex justify-center">
        <wd-button size="small" type="primary" @click="handleToWebview">
          点击跳转内容链接
        </wd-button>
      </view>
    </view>
  </wd-popup>
</template>

<style scoped lang="scss">
.uh-notify-dialog {
  /* 无额外样式,布局全部由 UnoCSS 原子类实现 */
}
</style>
