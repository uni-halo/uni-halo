<script lang="ts" setup>
/**
 * 用户协议页
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useAppConfigStore } from '@/store/appConfig'
import { markdownConfig } from '@/config/markdown'
import { DataLoadingStatusEnum } from '@/hooks/useDataLoadingStatus'

definePage({
  style: {
    navigationBarTitleText: '用户协议',
    navigationStyle: 'custom',
  },
})

const pageTitle = usePageTitle('userAgreement', '用户协议')
const { scrollY, updatePageScrollValue } = usePageScroll()
const { configs } = storeToRefs(useAppConfigStore())

const agreementContent = computed(() => {
  return configs.value.featureConfig?.pages?.userAgreement?.content || ''
})

/* ---------------- 分享 ---------------- */
onShareAppMessage(() => ({
  title: pageTitle.value,
  path: '/pages-blog/user-agreement/user-agreement',
}))

onShareTimeline(() => ({
  title: pageTitle.value,
  query: '',
}))

onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})
</script>

<template>
  <view class="box-border min-h-screen bg-page p-3 pt-2 pb-safe">
    <uh-navbar :scroll-y="scrollY" :default-title="pageTitle" title-color="text-gray-900" />

    <uh-data-loading
      v-if="!agreementContent" :loading-status="DataLoadingStatusEnum.Empty" min-height="80vh"
      :use-refresh-button="false" empty-text="暂时还没有用户协议" empty-sub-text="也许，可能是博主忘记啦~"
    />

    <view v-else class="uh-global-card-glass uh-shadow-xs h-full w-full rounded-xl p-3 text-3xs text-gray-900">
      <mp-html
        :content="agreementContent" lazy-load :domain="markdownConfig.domain"
        :loading-img="markdownConfig.loadingGif" scroll-table selectable :tag-style="markdownConfig.tagStyle"
        :container-style="markdownConfig.containStyle" :markdown="true" :show-line-number="true"
        :show-language-name="true" copy-by-long-press
      />
    </view>
  </view>
</template>
