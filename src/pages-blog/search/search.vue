<script lang="ts" setup>
/**
 * 内容搜索页(源自旧项目 pagesA/articles,新建复刻)
 * 功能:关键词搜索文章/瞬间,结果列表展示
 */
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { getPostListByKeyword } from '@/api/halo'
import { useAppConfigStore } from '@/store/appConfig'
import { usePluginAvailable } from '@/utils/plugin'
import { markdownConfig } from '@/config/markdown'
import { formatTime as formatTimeUtil } from '@/utils/formatTime'
import { debounce } from '@/utils/debounce'

definePage({
  style: {
    navigationBarTitleText: '内容搜索',
    enablePullDownRefresh: true,
  },
})

const appConfigStore = useAppConfigStore()
const calcAuditModeEnabled = computed(() => appConfigStore.auditModeEnabled)

/** 依赖插件(plugin-search-widget) */
const uniHaloPluginId = 'plugin-search-widget'
const uniHaloPluginAvailable = ref(true)

/* ---------------- 状态 ---------------- */
const loading = ref<'loading' | 'success' | 'error'>('loading')
const queryParams = ref({
  keyword: '',
  limit: 50,
  highlightPreTag: '',
  highlightPostTag: '',
})
const dataList = ref<{
  metadataName?: string
  type?: string
  title?: string
  description?: string
  content?: string
  updateTimestamp?: string
}[]>([])

/* ---------------- 动画(对应旧版 mixin calcAniWait) ---------------- */
/** 预计算列表项入场延迟(每 10 项重置一轮,每项递增 50ms);必须在渲染外算好,渲染中修改响应式状态会导致递归更新 */
const calcAniDelays = computed(() => {
  let wait = 0
  return dataList.value.map((_, index) => {
    wait = (index + 1) % 10 === 0 ? 1 : wait + 1
    return wait * 50
  })
})

/* ---------------- 搜索 ---------------- */
async function handleGetData() {
  if (calcAuditModeEnabled.value)
    return
  loading.value = 'loading'
  try {
    const res = await getPostListByKeyword({ ...queryParams.value })
    loading.value = 'success'
    dataList.value = (res.data as unknown as { hits?: typeof dataList.value }).hits || []
  }
  catch (err) {
    console.error(err)
    loading.value = 'error'
  }
  finally {
    setTimeout(() => {
      uni.stopPullDownRefresh()
    }, 800)
  }
}

function handleOnSearch() {
  if (!queryParams.value.keyword) {
    dataList.value = []
    loading.value = 'success'
  }
  else {
    handleGetData()
  }
}

/** 实时搜索:输入防抖 400ms 后触发(对应旧版 tm-search 的 @input) */
const handleOnInput = debounce(() => {
  handleOnSearch()
}, 400)

function isArticle(item: { type?: string }): boolean {
  return item.type === 'post.content.halo.run'
}

function handleToDetail(item: { metadataName?: string, type?: string }) {
  if (calcAuditModeEnabled.value)
    return
  if (isArticle(item)) {
    uni.navigateTo({
      url: `/pages-blog/article-detail/article-detail?name=${item.metadataName}`,
      animationType: 'slide-in-right',
    })
  }
  else {
    uni.navigateTo({
      url: `/pages-blog/moment-detail/moment-detail?name=${item.metadataName}`,
      animationType: 'slide-in-right',
    })
  }
}

function handleToTopPage(duration = 500) {
  uni.pageScrollTo({
    scrollTop: 0,
    duration,
    fail: (err) => {
      console.error('回顶失败', err)
    },
  })
}

/* ---------------- 生命周期 ---------------- */
onLoad(async () => {
  uniHaloPluginAvailable.value = await usePluginAvailable(uniHaloPluginId)
  if (!uniHaloPluginAvailable.value) {
    uni.stopPullDownRefresh()
    return
  }
  // 关键词非空(如带参进入)时自动搜索,否则展示空态
  if (!queryParams.value.keyword) {
    loading.value = 'success'
  }
  else {
    handleGetData()
  }
})

onPullDownRefresh(() => {
  if (!uniHaloPluginAvailable.value) {
    uni.stopPullDownRefresh()
    return
  }
  handleOnSearch()
})
</script>

<template>
  <view class="app-page min-h-screen w-screen flex flex-col bg-page pb-6">
    <uh-plugin-unavailable
      v-if="!uniHaloPluginAvailable"
      :plugin-id="uniHaloPluginId"
      error-text="检测到当前插件没有安装或者启用，无法使用搜索功能哦，请联系管理员"
      @on-refresh="handleOnSearch"
    />
    <template v-else>
      <!-- 顶部搜索框(玻璃吸顶,呼应首页搜索条) -->
      <view class="search-bar uh-global-card-glass sticky top-0 z-10 px-3 py-2">
        <view class="search-input h-[72rpx] flex items-center gap-3 rounded-full bg-[#f6f3ee] px-5">
          <wd-icon name="search" size="16px" color="#a8a294" />
          <input
            v-model="queryParams.keyword"
            class="search-field flex-1 text-[26rpx] text-gray-900"
            placeholder="哈喽，想看些什么呢~"
            placeholder-class="text-gray-400"
            confirm-type="search"
            @input="handleOnInput"
            @confirm="handleOnSearch"
          >
          <view v-if="queryParams.keyword" class="clear-btn flex items-center" @click="queryParams.keyword = ''; handleOnSearch()">
            <wd-icon name="close" size="14px" color="#a8a294" />
          </view>
        </view>
      </view>

      <!-- 骨架屏 -->
      <view v-if="loading === 'loading'" class="loading-wrap p-3">
        <wd-skeleton :row="4" :animated="true" />
      </view>
      <view v-else-if="loading === 'error'" class="min-h-[60vh] flex items-center justify-center content-empty">
        <wd-empty description="搜索异常" />
      </view>

      <!-- 内容区域 -->
      <view v-else class="content pt-4">
        <view v-if="dataList.length === 0" class="min-h-[60vh] flex items-center justify-center content-empty">
          <wd-empty v-if="!queryParams.keyword" description="请输入关键词搜索" />
          <wd-empty v-else :description="`未搜到 ${queryParams.keyword} 相关内容`" />
        </view>

        <block v-else>
          <view
            v-for="(item, index) in dataList"
            :key="index"
            class="article-card fade-up uh-global-card-glass mx-4 mb-4 flex flex-col overflow-hidden rounded-2xl p-4"
            :style="{ animationDelay: `${calcAniDelays[index]}ms` }"
            @click="handleToDetail(item)"
          >
            <view class="card-head mb-3 flex items-center">
              <view
                class="type-tag mr-3 shrink-0 rounded-md px-1.5 py-0.5 text-[20rpx] leading-none"
                :class="isArticle(item) ? 'bg-secondary text-[#4d7c0f]' : 'bg-[#e8e3d8] text-gray-600'"
              >
                {{ isArticle(item) ? '文章' : '瞬间' }}
              </view>
              <text class="card-title flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[28rpx] text-gray-900 font-bold">{{ item.title }}</text>
            </view>
            <mp-html
              class="evan-markdown"
              lazy-load
              :domain="markdownConfig.domain ?? ''"
              :loading-img="markdownConfig.loadingGif"
              scroll-table
              selectable
              :tag-style="markdownConfig.tagStyle"
              :container-style="markdownConfig.containStyle"
              :content="item.description || item.content || ''"
              :markdown="true"
              :show-line-number="true"
              :show-language-name="true"
              copy-by-long-press
            />
            <view class="card-foot mt-3 flex items-center">
              <text class="text-[24rpx] text-gray-400">{{ item.updateTimestamp ? `最近更新：${formatTimeUtil({ d: item.updateTimestamp, f: 'yyyy年MM月dd日 HH点mm分ss秒' })}` : '' }}</text>
            </view>
          </view>

          <view class="to-top-btn uh-global-card-glass fixed bottom-[100rpx] right-6 z-6 h-[72rpx] w-[72rpx] flex items-center justify-center rounded-full" @click="handleToTopPage()">
            <wd-icon name="arrow-up" size="20px" color="#6b7280" />
          </view>
        </block>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
/* 列表项入场动画(对应旧版 tm-translate fadeUp):@keyframes 无法用原子类表达,保留 scoped 样式 */
.fade-up {
  animation: fade-up 0.4s ease-out both;

  @keyframes fade-up {
    from {
      opacity: 0;
      transform: translateY(24rpx);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
}
</style>
