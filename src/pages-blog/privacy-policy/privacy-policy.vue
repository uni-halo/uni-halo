<script lang="ts" setup>
/**
 * 隐私政策页
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useAppConfigStore } from '@/store/appConfig'
import { markdownConfig } from '@/config/markdown'
import { DataLoadingStatusEnum } from '@/hooks/useDataLoadingStatus'

definePage({
  style: {
    navigationBarTitleText: '隐私政策',
    navigationStyle: 'custom',
  },
})

const pageTitle = usePageTitle('privacyPolicy', '隐私政策')
const { scrollY, updatePageScrollValue } = usePageScroll()
const { configs } = storeToRefs(useAppConfigStore())

const privacyPolicyContent = computed(() => {
  return configs.value.featureConfig?.pages?.privacyPolicy?.content || ''
})

/* ---------------- 分享 ---------------- */
onShareAppMessage(() => ({
  title: pageTitle.value,
  path: '/pages-blog/privacy-policy/privacy-policy',
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
      v-if="!privacyPolicyContent" :loading-status="DataLoadingStatusEnum.Empty" min-height="80vh"
      :use-refresh-button="false" empty-text="暂时还没有隐私政策" empty-sub-text="也许，可能是博主忘记啦~"
    />

    <view v-else class="uh-global-card-glass uh-shadow-xs h-full w-full rounded-xl p-3 text-3xs text-gray-900">
      <mp-html
        :content="privacyPolicyContent" lazy-load :domain="markdownConfig.domain"
        :loading-img="markdownConfig.loadingGif" scroll-table selectable :tag-style="markdownConfig.tagStyle"
        :container-style="markdownConfig.containStyle" :markdown="true" :show-line-number="true"
        :show-language-name="true" copy-by-long-press
      />
    </view>
  </view>
</template>
