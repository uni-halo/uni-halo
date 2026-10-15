<script lang="ts" setup>
import { computed, ref } from 'vue'
import { onPageScroll, onPullDownRefresh } from '@dcloudio/uni-app'
import { getFaqs } from '@/api/uni-halo'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { usePageScroll } from '@/hooks/usePageScroll'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useNavbarSticky } from '@/hooks/useNavbarSticky'
import { debounce } from '@/utils/debounce'
import { markdownConfig } from '@/config/markdown'
import type { IFaqItem } from '@/api/types/uni-halo'

definePage({
  style: {
    navigationBarTitleText: '常见问题',
    enablePullDownRefresh: true,
    navigationStyle: 'custom',
  },
})

const { scrollY, updatePageScrollValue } = usePageScroll()
/** 吸顶偏移 = 自定义导航栏高度（与 votes/notice 等列表页同用法） */
const { height: offsetTop } = useNavbarSticky()
/** 页面标题（插件端可配置，留空回退内置默认） */
const pageTitle = usePageTitle('faq', '常见问题')

/* ---------------- 状态 ---------------- */
/** 全量数据（插件端接口一次取全量：size=0） */
const allList = ref<IFaqItem[]>([])
const keyword = ref('')
const accordionName = ref<string>('')
const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()
/** 详情弹窗 */
const detail = ref<{ show: boolean, item: IFaqItem | null }>({ show: false, item: null })

/* ---------------- 数据加载 ---------------- */
/** 拉取全量（page=1, size=0 返回全部） */
async function handleGetData() {
  updateLoadingStatus(DataLoadingStatusEnum.Loading)
  try {
    const res = await getFaqs({ page: 1, size: 0 })
    allList.value = res.data?.items || []
    updateLoadingStatus(
      allList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success,
    )
  }
  catch (err) {
    console.error('[faq] 获取常见问题失败', err)
    updateLoadingStatus(DataLoadingStatusEnum.Error)
  }
  finally {
    uni.stopPullDownRefresh()
  }
}

/* ---------------- 搜索 ---------------- */
const handleOnInput = debounce(() => {
  accordionName.value = ''
}, 300)

function handleOnClear() {
  keyword.value = ''
  accordionName.value = ''
}

/* ---------------- 列表分组（搜索过滤 → 按分类分组，排序由服务端完成） ---------------- */
const filteredList = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) {
    return allList.value
  }
  return allList.value.filter(item =>
    (item.spec?.title || '').toLowerCase().includes(kw)
    || (item.spec?.description || '').toLowerCase().includes(kw)
    || (item.spec?.category || '').toLowerCase().includes(kw))
})

const groupedFaq = computed(() => {
  const groups = new Map<string, IFaqItem[]>()
  for (const item of filteredList.value) {
    const category = item.spec?.category || '其他'
    if (!groups.has(category)) {
      groups.set(category, [])
    }
    groups.get(category)!.push(item)
  }
  return [...groups.entries()].map(([category, items]) => ({ category, items }))
})

/* ---------------- 交互 ---------------- */
function handleOpenDetail(item: IFaqItem) {
  detail.value = { show: true, item }
}

/** 相关链接点击：内部页面跳转 / 外部链接复制 / 客服按钮由 open-type 原生处理 */
function handleLinkClick(link: NonNullable<NonNullable<IFaqItem['spec']>['links']>[number]) {
  if (link.type === 'contact') {
    return
  }
  if (!link.url) {
    return
  }
  if (link.type === 'internal') {
    detail.value.show = false
    uni.navigateTo({ url: link.url })
    return
  }
  // 外部链接：复制到剪贴板并提示
  uni.setClipboardData({
    data: link.url,
    success: () => {
      uni.showToast({ icon: 'none', title: '链接已复制，请在浏览器打开' })
    },
  })
}

/* ---------------- 生命周期 ---------------- */
onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})

onPullDownRefresh(() => {
  handleGetData()
})

handleGetData()
</script>

<template>
  <view class="app-page min-h-screen w-screen flex flex-col bg-page">
    <uh-navbar :scroll-y="scrollY" :default-title="pageTitle" title-color="text-gray-900" />

    <!-- 吸顶搜索框（参考投票列表搜索框） -->
    <wd-sticky :offset-top="offsetTop">
      <view class="box-border w-screen px-3 pb-1 pt-2">
        <view class="uh-global-card-glass h-9 flex items-center gap-3 rounded-full px-5 shadow-none">
          <wd-icon name="search-line" size="32rpx" />
          <input
            v-model="keyword" class="flex-1 text-sm text-gray-900"
            placeholder="搜索问题..." placeholder-class="text-gray-400" confirm-type="search"
            @input="handleOnInput"
          >
          <view v-if="keyword" class="flex items-center text-gray-500" @click="handleOnClear">
            <wd-icon name="close" size="28rpx" />
          </view>
        </view>
      </view>
    </wd-sticky>

    <!-- 加载/空/错误状态 -->
    <uh-data-loading
      v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus"
      empty-text="没有找到相关问题哦~"
      min-height="70vh" @refresh="handleGetData"
    />

    <!-- 分类分组列表 -->
    <view v-else class="box-border flex flex-col gap-y-4 p-3 pt-2">
      <view v-for="group in groupedFaq" :key="group.category" class="flex flex-col gap-y-3">
        <view class="box-border">
          <uh-section-title>{{ group.category }}</uh-section-title>
        </view>
        <view class="question-collapse uh-global-card-glass uh-shadow-xs overflow-hidden rounded-xl">
          <wd-collapse v-model="accordionName" :accordion="true">
            <wd-collapse-item
              v-for="(item, index) in group.items" :key="item.metadata?.name || item.spec?.title"
              :border="index !== 0" custom-body-class="px-3 py-1"
              :title="item.spec?.title" :name="item.metadata?.name || item.spec?.title || ''"
            >
              <view class="w-full items-center text-gray-600 leading-5.5">
                <text class="leading-5.5 !text-3xs">{{ item.spec?.description || '查看详细内容' }}</text>
                <button
                  class="uh-button-native uh-global-card-glass mx-1 box-border rounded-lg bg-primary px-2 py-0.5 text-xs text-gray-900 !inline-flex !border !shadow-none"
                  @click="handleOpenDetail(item)"
                >
                  查看详情
                </button>
              </view>
            </wd-collapse-item>
          </wd-collapse>
        </view>
      </view>
    </view>

    <!-- 详情弹窗 -->
    <uh-glass-popup
      v-model="detail.show" :z-index="999" position="bottom" custom-class="!rounded-2xl !border"
    >
      <view v-if="detail.item" class="box-border w-full flex flex-col gap-y-3 p-3">
        <!-- 顶部（参考友链详情弹窗：标题 + 右上角关闭按钮） -->
        <view class="relative box-border w-full flex items-center pr-10">
          <view class="w-full flex flex-1 items-center gap-x-1 overflow-hidden">
            <wd-icon name="question-circle" size="36rpx" custom-class="shrink-0 text-gray-600" />
            <text class="text-md flex-1 truncate text-gray-900 font-bold">{{ detail.item.spec?.title }}</text>
          </view>
          <view
            class="uh-global-card-glass absolute right-0 top-0 h-6 w-6 flex items-center justify-center border rounded-lg text-gray-500 shadow-none !bg-white/5"
            @click="detail.show = false"
          >
            <wd-icon name="close" size="28rpx" />
          </view>
        </view>
        <!-- 内容滚动区 -->
        <scroll-view
          :scroll-y="true" :show-scrollbar="false" class="box-border max-h-[50vh] w-full"
        >
          <view class="w-full flex flex-col gap-y-3">
            <view v-if="!detail.item.spec?.content" class="text-3xs text-gray-600 leading-5">
              {{ detail.item.spec?.description }}
            </view>
            <view v-if="detail.item.spec?.content" class="uh-global-card-glass box-border rounded-xl text-sm text-gray-600 !bg-white/80 !px-3 !shadow-none">
              <mp-html
                :content="detail.item.spec?.content"
                lazy-load :domain="markdownConfig.domain"
                :loading-img="markdownConfig.loadingGif" scroll-table selectable
                :tag-style="markdownConfig.tagStyle" :container-style="markdownConfig.containStyle"
                :markdown="true" :show-line-number="true"
                :show-language-name="true" copy-by-long-press
              />
            </view>
          </view>
        </scroll-view>
        <!-- 相关链接按钮区 -->
        <view v-if="detail.item.spec?.links?.length" class="w-full flex flex-col gap-2">
          <template v-for="link in detail.item.spec?.links" :key="link.title">
            <!-- 客服按钮：仅微信小程序端渲染 -->
            <!-- #ifdef MP-WEIXIN -->
            <button
              v-if="link.type === 'contact'"
              class="uh-button-native uh-global-card-glass box-border w-full flex flex-1 items-center justify-center gap-1 border rounded-xl px-4 text-gray-900 shadow-none !bg-primary !py-2.5 !text-3xs"
              open-type="contact"
            >
              <wd-icon name="chat" size="14px" />
              {{ link.title || '联系在线客服' }}
            </button>
            <!-- #endif -->
            <uh-button
              v-if="link.type !== 'contact'"
              class="w-full flex-1"
              custom-class="uh-global-card-glass !border !rounded-xl !py-2.5 !text-3xs !shadow-none"
              @action-click="handleLinkClick(link)"
            >
              {{ link.title }}
            </uh-button>
          </template>
        </view>
      </view>
    </uh-glass-popup>
  </view>
</template>

<style scoped lang="scss">
.question-collapse {
  &:deep(.wd-collapse-item__header) {
    padding: 16rpx 24rpx;
  }

  &:deep(.wd-collapse-item__title) {
    font-size: 28rpx;
  }
  &:deep(.wd-collapse) {
    background: transparent !important;
  }
}
</style>
