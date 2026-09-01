<script lang="ts" setup>
/**
 * 图库页(源自旧项目 pages/tabbar/gallery/gallery.vue,新建复刻)
 * 功能:相册分组切换 + 图片列表(瀑布流/网格) + 图片预览
 */
import { computed, ref, watch } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { getPhotoGroupList, getPhotoListByGroupName } from '@/api/halo'
import { useAppConfigStore } from '@/store/appConfig'
import { checkImageUrl } from '@/utils/url'
import { t } from '@/locale'
import { usePluginAvailable } from '@/utils/plugin'
import type { IPhoto, IPhotoGroup } from '@/api/types/halo'

definePage({
  style: {
    navigationBarTitleText: '图库',
    enablePullDownRefresh: true,
  },
})

const appConfigStore = useAppConfigStore()
const haloConfigs = computed(() => appConfigStore.configs)
const calcAuditModeEnabled = computed(() => appConfigStore.auditModeEnabled)

const galleryConfig = computed(() => haloConfigs.value.pageConfig?.galleryConfig)

/** 依赖插件(plugin-photos) */
const uniHaloPluginId = 'plugin-photos'
const uniHaloPluginAvailable = ref(true)

/* ---------------- 状态 ---------------- */
const loading = ref<'loading' | 'success' | 'error'>('loading')
const category = ref<{ activeIndex: number, list: { name?: string, displayName: string, priority: number }[] }>({
  activeIndex: 0,
  list: [],
})
const queryParams = ref({ size: 10, page: 1, group: '' })
const isLoadMore = ref(false)
const loadMoreText = ref('')
const hasNext = ref(false)
const dataList = ref<IPhoto[]>([])
const lock = ref(false)

/* ---------------- 数据加载 ---------------- */
async function handleGetCategory() {
  if (calcAuditModeEnabled.value) {
    // 审核模式:仅展示所选图库分组(galleryGroups)内的照片,未分组照片不展示
    const auditGroupNames = appConfigStore.auditData.spec?.galleryGroups || []
    try {
      const res = await getPhotoGroupList({ page: 1, size: 99999 })
      const filtered = ((res.data as unknown as IPhotoGroup[] | undefined) || [])
        .filter(item => auditGroupNames.includes(item.metadata.name))
        .map(item => ({
          name: item.metadata.name,
          displayName: item.spec.displayName,
          priority: item.spec.priority ?? 0,
        }))
        .sort((a, b) => a.priority - b.priority)
      category.value.list = filtered
      if (category.value.list.length !== 0) {
        queryParams.value.group = category.value.list[0].name || ''
        handleGetData(true)
      }
      else {
        loading.value = 'success'
        loadMoreText.value = t('common.noMore')
        uni.stopPullDownRefresh()
      }
    }
    catch (e) {
      console.error(e)
      loading.value = 'error'
      category.value = { activeIndex: 0, list: [] }
    }
    return
  }
  try {
    const res = await getPhotoGroupList({ page: 1, size: 0 })
    category.value.list = ((res.data as unknown as IPhotoGroup[] | undefined) || [])
      .map(item => ({
        name: item.metadata.name,
        displayName: item.spec.displayName,
        priority: item.spec.priority ?? 0,
      }))
      .sort((a, b) => a.priority - b.priority)
    category.value.list.unshift({ name: undefined, displayName: '全部', priority: 0 })
    if (category.value.list.length !== 0) {
      queryParams.value.group = category.value.list[0].name || ''
      handleGetData(true)
    }
  }
  catch (e) {
    console.error(e)
    loading.value = 'error'
    category.value = { activeIndex: 0, list: [] }
  }
}

async function handleGetData(isClearList = false) {
  if (isClearList) {
    dataList.value = []
    queryParams.value.page = 1
  }

  if (!isLoadMore.value) {
    loading.value = 'loading'
  }
  loadMoreText.value = ''

  try {
    const res = await getPhotoListByGroupName({ ...queryParams.value })
    hasNext.value = res.data.hasNext
    loading.value = 'success'
    if (res.data.items.length !== 0) {
      const list = res.data.items.map(item => ({
        ...item,
        spec: { ...item.spec, url: checkImageUrl(item.spec.url || item.spec.cover) },
      }))
      dataList.value = isLoadMore.value
        ? dataList.value.concat(list)
        : list
    }
    loadMoreText.value = res.data.hasNext ? t('common.loadMore') : t('common.noMore')
  }
  catch (err) {
    console.error(err)
    loading.value = 'error'
    loadMoreText.value = t('common.loadFailed')
  }
  finally {
    setTimeout(() => {
      uni.hideLoading()
      uni.stopPullDownRefresh()
      lock.value = false
    }, 500)
  }
}

function handleGetDataByCategory(index: number) {
  const item = category.value.list[index]
  if (!item)
    return
  queryParams.value.group = item.name || ''
  queryParams.value.page = 1
  uni.pageScrollTo({ scrollTop: 0, duration: 500 })
  dataList.value = []
  handleGetData(true)
}

function handleOnCategoryChange(e: { index: number, name: number }) {
  console.log('切换分类', e)
  if (lock.value)
    return
  handleGetDataByCategory(e.index)
}

/* ---------------- 图片预览 ---------------- */
function handlePreview(data: IPhoto) {
  const current = dataList.value.findIndex(x => x.metadata.name === data.metadata.name)
  uni.previewImage({
    current,
    urls: dataList.value.map(x => x.spec.url),
    indicator: 'number',
    loop: true,
  })
}

/* ---------------- 生命周期 ---------------- */
onLoad(async () => {
  // 检查插件可用性
  uniHaloPluginAvailable.value = await usePluginAvailable(uniHaloPluginId)
  if (!uniHaloPluginAvailable.value) {
    uni.stopPullDownRefresh()
    return
  }
})

watch(galleryConfig, (newVal) => {
  if (!newVal)
    return
  uni.setNavigationBarTitle({ title: newVal.pageTitle || t('page.gallery.title') })
  handleGetCategory()
}, { deep: true, immediate: true })

onPullDownRefresh(() => {
  if (!uniHaloPluginAvailable.value) {
    uni.stopPullDownRefresh()
    return
  }
  dataList.value = []
  isLoadMore.value = false
  queryParams.value.page = 1
  handleGetData(true)
})

onReachBottom(() => {
  if (!uniHaloPluginAvailable.value)
    return
  if (calcAuditModeEnabled.value) {
    uni.showToast({ icon: 'none', title: t('common.noMoreData') })
    return
  }
  if (hasNext.value) {
    queryParams.value.page += 1
    isLoadMore.value = true
    handleGetData(false)
  }
  else {
    uni.showToast({ icon: 'none', title: t('common.noMoreData') })
  }
})
</script>

<template>
  <view class="app-page min-h-screen w-screen flex flex-col pb-6" style="background-color: #fafafa;">
    <uh-plugin-unavailable
      v-if="!uniHaloPluginAvailable"
      :plugin-id="uniHaloPluginId"
      error-text="检测到当前插件没有安装或者启用，无法使用图库功能哦，请联系管理员"
      @on-refresh="handleGetCategory"
    />
    <template v-else>
      <!-- 顶部切换 -->
      <wd-tabs
        v-if="category.list.length > 0"
        v-model="category.activeIndex"
        align="left"
        sticky
        :offset-top="0"
        @change="handleOnCategoryChange"
      >
        <wd-tab v-for="cate in category.list" :key="cate.displayName" :title="cate.displayName" />
      </wd-tabs>

      <!-- 骨架屏 -->
      <view v-if="loading === 'loading'" class="loading-wrap box-border p-3">
        <wd-skeleton :row="4" :animated="true" />
      </view>

      <!-- 错误态 -->
      <view v-else-if="loading === 'error'" class="error-wrap h-[60vh] w-full flex flex-col items-center justify-center gap-6">
        <wd-empty description="阿偶，获取数据失败了~" />
        <wd-button size="small" plain type="primary" @click="handleGetCategory()">
          刷新试试
        </wd-button>
      </view>

      <!-- 内容区域 -->
      <view v-else class="content box-border w-full p-3">
        <view v-if="dataList.length === 0" class="h-[70vh] w-full flex items-center justify-center content-empty">
          <wd-empty description="博主还没有分享图片~" />
        </view>
        <block v-else>
          <!-- 瀑布流(双列) -->
          <view class="waterfall flex flex-wrap gap-1.5">
            <view
              v-for="(item, index) in dataList"
              :key="index"
              class="waterfall-item h-[250rpx] w-[calc(50%-6rpx)] overflow-hidden rounded-xl"
              :class="{ 'is-even mt-3': index % 2 === 1 }"
            >
              <image
                class="waterfall-img h-full w-full"
                :src="item.spec.url"
                mode="aspectFill"
                lazy-load
                @click="handlePreview(item)"
              />
            </view>
          </view>
          <view class="load-text w-full py-5 text-center text-[24rpx] text-[#999]">
            {{ loadMoreText }}
          </view>
        </block>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.app-page {
  display: flex;
  flex-direction: column;
}

.error-wrap {
  .error-wrap-inner {
    /* 无额外样式 */
  }
}
</style>
