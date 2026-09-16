<script lang="ts" setup>
/**
 * 瞬间管理页：我的瞬间列表（分页加载）+ 删除
 * 仅 author/admin 可进入（入口经 uh-permission 控制显隐）
 */
import { computed, ref } from 'vue'
import { onLoad, onPageScroll, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import dayjs from 'dayjs'
import { deleteMoment, listMyMoments } from '@/api/uni-admin'
import { usePermission } from '@/hooks/usePermission'
import { usePageScroll } from '@/hooks/usePageScroll'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { extractMomentContent, stripHtmlTags } from '@/utils/moment'

definePage({
  style: {
    navigationBarTitleText: '瞬间管理',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
  },
})

const { scrollY, updatePageScrollValue } = usePageScroll()
const { can } = usePermission()

/* ---------------- 数据加载(参考 tabbar/category 的分页控制) ---------------- */
const { loadingStatus, loadMoreStatus, updateLoadingStatus, updateLoadMoreStatus, resetLoadMoreStatus } = useDataLoadingStatus()
const queryParams = ref({ size: 10, page: 1 })

interface MomentItem {
  name: string
  content: string
  images: string[]
  releaseTime: string
  visible: string
  approved?: boolean
}
const dataList = ref<MomentItem[]>([])

async function handleGetData() {
  if (!loadMoreStatus.value.active) {
    updateLoadingStatus(DataLoadingStatusEnum.Loading)
  }
  try {
    const res = await listMyMoments({ ...queryParams.value })
    const items: MomentItem[] = (res.data?.items || []).map((x: any) => {
      // UC 列表接口的条目为 { moment, owner, stats }，实际数据在 moment 字段
      const m = x.moment || x
      // 兼容对象格式 { raw, html, medium } 与数组格式 [{ content, medium }]
      const c = extractMomentContent(m.spec?.content)
      return {
        name: m.metadata?.name || '',
        content: stripHtmlTags(c.raw || c.html),
        images: c.photos,
        releaseTime: m.spec?.releaseTime || '',
        visible: m.spec?.visible || 'PUBLIC',
        approved: m.spec?.approved,
      }
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

onLoad(() => {
  handleGetData()
})

onPullDownRefresh(() => {
  resetLoadMoreStatus()
  queryParams.value.page = 1
  handleGetData()
})

onReachBottom(() => {
  if (loadMoreStatus.value.active)
    return
  if (loadMoreStatus.value.hasNext) {
    queryParams.value.page += 1
    updateLoadMoreStatus({ active: true, status: 'loading' })
    handleGetData()
  }
})

/* ---------------- 交互 ---------------- */
function formatMomentTime(time?: string) {
  return time ? dayjs(time).format('YYYY-MM-DD HH:mm') : ''
}

function handlePreview(index: number, urls: string[]) {
  uni.previewImage({ current: index, urls })
}

/* ---------------- 发布/编辑弹窗（抽离组件） ---------------- */
const popupVisible = ref(false)
const popupRef = ref<{ openEdit: (name: string) => Promise<boolean> } | null>(null)

function handleOpenPublish() {
  popupVisible.value = true
}

function handleEdit(item: MomentItem) {
  // 编辑模式仅传 metadata.name，弹窗内部查询详情回填
  popupRef.value?.openEdit(item.name)
}

function handlePopupClose(data: { isSubmit: boolean, refresh: boolean }) {
  popupVisible.value = false
  if (data.refresh)
    handleRetry()
}

function handleDelete(item: MomentItem) {
  uni.showModal({
    title: '删除瞬间',
    content: '确定删除这条瞬间吗？删除后不可恢复。',
    confirmColor: '#ef4444',
    success: async (res) => {
      if (!res.confirm)
        return
      try {
        await deleteMoment(item.name)
        dataList.value = dataList.value.filter(x => x.name !== item.name)
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

function handleRetry() {
  queryParams.value.page = 1
  handleGetData()
}

onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})

const isAdminView = computed(() => can('MOMENT_MANAGE'))
</script>

<template>
  <view class="box-border min-h-screen w-screen flex flex-col bg-page">
    <uh-navbar :scroll-y="scrollY" :use-back="true" default-title="瞬间管理" title-color="text-gray-900" />

    <!-- 无权限提示（uh-permission 跨端控制显隐） -->
    <uh-permission roles="admin,author">
      <view />
    </uh-permission>

    <template v-if="isAdminView">
      <uh-data-loading v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus" min-height="70vh" @refresh="handleRetry" />

      <view v-else class="box-border flex flex-col gap-3 px-3 pt-3">
        <view v-for="moment in dataList" :key="moment.name" class="uh-global-card-glass uh-shadow-xs overflow-hidden rounded-xl">
          <view class="flex items-center justify-between px-4 pt-3">
            <text class="text-xs text-gray-400">{{ formatMomentTime(moment.releaseTime) }}</text>
            <view class="flex items-center gap-2">
              <text v-if="moment.approved === false" class="rounded-full bg-orange-100 px-2 py-0.5 text-3xs text-orange-500">待审核</text>
              <text v-else-if="moment.visible === 'PRIVATE'" class="rounded-full bg-gray-100 px-2 py-0.5 text-3xs text-gray-500">私密</text>
            </view>
          </view>
          <view class="px-4 pt-2 text-3xs text-gray-900 leading-relaxed">
            <text class="line-clamp-3">{{ moment.content || '（无文字内容）' }}</text>
          </view>
          <view v-if="moment.images.length" class="flex flex-wrap gap-1 px-3 pt-2">
            <image
              v-for="(img, imgIndex) in moment.images.slice(0, 3)"
              :key="img"
              :src="img"
              mode="aspectFill"
              class="h-20 w-20 rounded-lg"
              @click="handlePreview(imgIndex, moment.images)"
            />
          </view>
          <view class="mt-2 flex items-center justify-end gap-4 border-t border-black/5 px-4 py-2.5 text-xs">
            <view class="flex items-center gap-1 text-gray-500" @click="handleEdit(moment)">
              <wd-icon name="edit" size="26rpx" />
              <text>编辑</text>
            </view>
            <view class="flex items-center gap-1 text-red-500" @click="handleDelete(moment)">
              <wd-icon name="delete" size="26rpx" />
              <text>删除</text>
            </view>
          </view>
        </view>
        <uh-data-loadmore :status="loadMoreStatus.status" :text="loadMoreStatus.text" />
      </view>

      <!-- 底部悬浮：发布瞬间（参考文章详情悬浮设计） -->
      <view class="uh-translate-x-center fixed bottom-0 left-1/2 z-10 flex items-center justify-center pb-safe">
        <view
          class="uh-global-card-glass box-border h-[72rpx] flex items-center justify-center gap-x-1 border rounded-full px-6 text-primary shadow-none"
          @click="handleOpenPublish"
        >
          <wd-icon name="add-circle" size="36rpx" />
          <text class="shrink-0 text-xs font-semibold">发布瞬间</text>
        </view>
      </view>

      <!-- 发布/编辑弹窗（全局组件，easycom 自动注册） -->
      <uh-moment-edit-popup ref="popupRef" :show="popupVisible" @on-close="handlePopupClose" />
    </template>
  </view>
</template>

<style scoped lang="scss">
.uh-translate-x-center {
  transform: translateX(-50%);
}
</style>
