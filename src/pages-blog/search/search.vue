<script lang="ts" setup>
/**
 * 内容搜索页(源自旧项目 pagesA/articles,新建复刻)
 * 功能:关键词搜索文章/瞬间,结果列表展示
 */
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { getPostListByKeyword } from '@/api/halo'
import { useAppConfigStore } from '@/store/appConfig'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { NeedPluginIds } from '@/hooks/usePluginAvailable'
import { markdownConfig } from '@/config/markdown'
import { debounce } from '@/utils/debounce'

definePage({
  style: {
    navigationBarTitleText: '内容搜索',
    enablePullDownRefresh: true,
    navigationStyle: 'custom',
  },
})

const appConfigStore = useAppConfigStore()
const calcAuditModeEnabled = computed(() => appConfigStore.auditModeEnabled)

/** 依赖插件(plugin-search-widget,参考 gallery 对象传参模式) */
const { pluginId, checking, tips, available: uniHaloPluginAvailable, check: checkPluginAvailable } = usePluginAvailable({
  pluginId: NeedPluginIds.PluginSearchWidget,
  tips: '检测到当前插件没有安装或者启用，无法使用搜索功能哦，请联系管理员',
})

/** 重新检测插件:可用则重新搜索(供 uh-plugin-unavailable 刷新按钮) */
async function handlePluginRefresh() {
  if (await checkPluginAvailable())
    handleOnSearch()
}

/* ---------------- 状态 ---------------- */
const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()
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

/** 空态文案(无关键词提示输入;有关键词提示未搜到) */
const emptyText = computed(() =>
  queryParams.value.keyword ? `未搜到 ${queryParams.value.keyword} 相关内容` : '请输入关键词搜索',
)

/* ---------------- 搜索 ---------------- */
async function handleGetData() {
  if (calcAuditModeEnabled.value)
    return
  updateLoadingStatus(DataLoadingStatusEnum.Loading)
  try {
    const res = await getPostListByKeyword({ ...queryParams.value })
    dataList.value = (res.data as unknown as { hits?: typeof dataList.value }).hits || []
    updateLoadingStatus(
      dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success,
    )
  }
  catch (err) {
    console.error(err)
    updateLoadingStatus(DataLoadingStatusEnum.Error)
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
    updateLoadingStatus(DataLoadingStatusEnum.Empty)
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
  await checkPluginAvailable()
  if (!uniHaloPluginAvailable.value) {
    uni.stopPullDownRefresh()
    return
  }
  // 关键词非空(如带参进入)时自动搜索,否则展示空态
  if (!queryParams.value.keyword) {
    updateLoadingStatus(DataLoadingStatusEnum.Empty)
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
  <view class="box-border min-h-screen w-screen flex flex-col bg-page pb-6">
    <!-- 自定义导航 -->
    <uh-navbar default-title="内容搜索" title-color="text-gray-900" />

    <uh-plugin-unavailable
      v-if="!uniHaloPluginAvailable"
      :plugin-id="pluginId"
      :error-text="tips"
      :checking="checking"
      @on-refresh="handlePluginRefresh"
    />
	
    <template v-else>
      <!-- 顶部搜索框-->
      <wd-sticky class="">
        <view class="w-screen box-border px-3 py-2">
          <view class="uh-global-card-glass h-9 flex items-center gap-3 rounded-full px-5">
            <wd-icon name="search" size="16px" />
            <input
              v-model="queryParams.keyword"
              class="flex-1 text-[26rpx] text-gray-900"
              placeholder="哈喽，想看些什么呢~"
              placeholder-class="text-gray-400"
              confirm-type="search"
              @input="handleOnInput"
              @confirm="handleOnSearch"
            >
            <view v-if="queryParams.keyword" class="clear-btn flex items-center" @click="queryParams.keyword = ''; handleOnSearch()">
              <wd-icon name="close" size="14px" />
            </view>
          </view>
        </view>
      </wd-sticky>

      <!-- 加载/错误/空占位(状态机) -->
      <uh-data-loading
        v-if="loadingStatus !== 'success'"
        :loading-status="loadingStatus"
        min-height="65vh"
        error-text="搜索异常"
        :empty-text="emptyText"
        @refresh="handleOnSearch"
      />

      <!-- 内容区域(成功态) -->
      <view v-else class="box-border pt-2 px-3 flex flex-col gap-y-3">
        <block v-if="dataList.length !== 0">
          <view
            v-for="(item, index) in dataList"
            :key="index"
            class="uh-global-card-glass uh-shadow-xs border flex flex-col overflow-hidden rounded-2xl p-4"
            :style="{ animationDelay: `${calcAniDelays[index]}ms` }"
            @click="handleToDetail(item)"
          >
            <view class="card-head mb-3 flex items-center">
              <view
                class="type-tag mr-3 shrink-0 rounded-md px-1.5 py-1 text-xs leading-none"
                :class="isArticle(item) ? 'bg-secondary text-gray-900' : 'bg-blue-500 text-gray-50'"
              >
                {{ isArticle(item) ? '文章' : '瞬间' }}
              </view>
              <text class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-gray-900 font-bold">{{ item.title }}</text>
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
