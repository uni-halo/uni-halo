<script lang="ts" setup>
/**
 * 恋爱清单页(源自旧项目 pagesA/love/list.vue,新建复刻)
 * 恋爱清单卡片列表(未开始/进行中/已完成),展开查看详情与回忆图片
 */
import { ref } from 'vue'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { getLoveDailyItems } from '@/api/uni-halo'
import { checkImageUrl } from '@/utils/url'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import type { ILoveDailyItem } from '@/api/types/uni-halo'

definePage({
  style: {
    navigationBarTitleText: '恋爱清单',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
  },
})

/* ---------------- 展示层类型 ---------------- */
/** 清单展示卡片(script 预处理后的干净展示数据) */
interface ILoveItemCard {
  /** 唯一 key(metadata.name,无则用索引) */
  name: string
  title: string
  content: string
  status: 'wait' | 'doing' | 'complete'
  planDate: string
  completeDate: string
  completeRemark: string
  /** 回忆图片(已预处理 URL) */
  images: string[]
  /** 是否展开详情 */
  open: boolean
}

/** 清单卡片映射:字段取值 + 图片路径预处理(模板不感知原始接口结构) */
function mapItemCard(item: ILoveDailyItem, index: number): ILoveItemCard {
  const spec = item.spec || {}
  return {
    name: item.metadata?.name || `item-${index}`,
    title: spec.title || '',
    content: spec.content || '',
    status: spec.status || 'wait',
    planDate: spec.planDate || '',
    completeDate: spec.completeDate || '',
    completeRemark: spec.completeRemark || '',
    images: (spec.images || []).map(img => checkImageUrl(img || '')),
    open: false,
  }
}

/* ---------------- 状态 ---------------- */
const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()
const list = ref<ILoveItemCard[]>([])

/* ---------------- 数据加载 ---------------- */
async function handleGetList() {
  updateLoadingStatus(DataLoadingStatusEnum.Loading)
  try {
    const res = await getLoveDailyItems({})
    const items = res.data?.items || []
    list.value = items.map(mapItemCard)
    updateLoadingStatus(list.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
  }
  catch (e) {
    console.error('获取清单失败', e)
    updateLoadingStatus(DataLoadingStatusEnum.Error)
  }
  finally {
    setTimeout(() => {
      uni.stopPullDownRefresh()
    }, 200)
  }
}

/* ---------------- 交互 ---------------- */
function handleOnItemOpen(item: ILoveItemCard) {
  item.open = !item.open
}

/** 预览回忆图片(基于已预处理 URL) */
function handlePreviewImages(images: string[], index: number) {
  if (images.length === 0)
    return
  uni.previewImage({ current: images[index], urls: images })
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
onLoad(() => {
  handleGetList()
})

onPullDownRefresh(() => {
  handleGetList()
})
</script>

<template>
  <view class="app-page box-border min-h-screen w-screen flex flex-col" style="background: linear-gradient(135deg, rgb(247 149 51 / 10%), rgb(243 112 85 / 10%) 15%, rgb(239 78 123 / 10%) 30%, rgb(161 102 171 / 10%) 44%, rgb(80 115 184 / 10%) 58%, rgb(16 152 173 / 10%) 72%, rgb(7 179 155 / 10%) 86%, rgb(109 186 130 / 10%));">
    <!-- 自定义导航 -->
    <uh-navbar default-title="恋爱清单" title-color="text-gray-900" />

    <!-- 加载/错误/空占位(状态机) -->
    <uh-data-loading
      v-if="loadingStatus !== DataLoadingStatusEnum.Success"
      :loading-status="loadingStatus"
      min-height="60vh"
      empty-text="暂时还没有恋爱清单，快去制定你们的恋爱清单吧~"
      @refresh="handleGetList"
    />

    <!-- 清单列表 -->
    <view v-else class="list-wrap box-border flex-1 p-6 pb-[144rpx]">
      <view class="list-tip mb-7 w-full text-center text-[26rpx] text-[#999]">
        看看我们的恋爱清单都完成了哪些吧
      </view>
      <block v-for="item in list" :key="item.name">
        <view class="card mb-6 box-border w-full flex flex-col items-center rounded-3xl bg-white p-6 shadow-sm">
          <view class="head box-border w-full flex items-center" @click="handleOnItemOpen(item)">
            <view class="status w-[100rpx] flex">
              <view v-if="item.status === 'wait'" class="text h-[100rpx] w-[100rpx] rounded-full text-center text-[24rpx] leading-[100rpx]" style="background-color: #ffc6ba; color: #55423b;">
                未开始
              </view>
              <view v-else-if="item.status === 'doing'" class="text doing h-[100rpx] w-[100rpx] rounded-full text-center text-[24rpx] leading-[100rpx]" style="background-color: #ffe9a8; color: #55423b;">
                进行中
              </view>
              <view v-else class="text finish h-[100rpx] w-[100rpx] rounded-full text-center text-[24rpx] leading-[100rpx]" style="background-color: #bfe9ef; color: #55423b;">
                已完成
              </view>
            </view>
            <view class="title box-border w-0 flex-1 px-7">
              <view class="title-name text-[30rpx] text-[#333] font-bold">
                {{ item.title }}
              </view>
              <view v-if="item.content" class="title-desc mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[26rpx] text-[#555]">
                {{ item.content }}
              </view>
            </view>
            <view class="actions w-[50rpx]">
              <text class="icon inline-block h-[45rpx] w-[45rpx] rounded-full bg-black/20 text-center text-[32rpx] font-bold leading-[45rpx]">{{ item.open ? '-' : '+' }}</text>
            </view>
          </view>
          <view v-if="item.open" class="body mt-6 box-border w-full rounded-3xl bg-black/5 px-6 pb-3 pt-6 text-[26rpx]">
            <view v-if="item.planDate" class="desc mb-3 flex">
              <view class="desc-label w-[140rpx] shrink-0 text-[#333]">
                计划时间
              </view>
              <view class="desc-value w-0 flex-1 text-[#333] leading-[1.5]">
                {{ item.planDate || '-' }}
              </view>
            </view>
            <view v-if="item.completeDate" class="desc mb-3 flex">
              <view class="desc-label w-[140rpx] shrink-0 text-[#333]">
                完成时间
              </view>
              <view class="desc-value w-0 flex-1 text-[#333] leading-[1.5]">
                {{ item.completeDate || '-' }}
              </view>
            </view>
            <view v-if="item.completeRemark" class="desc mb-3 flex">
              <view class="desc-label w-[140rpx] shrink-0 text-[#333]">
                完成感想
              </view>
              <view class="desc-value w-0 flex-1 text-[#333] leading-[1.5]">
                {{ item.completeRemark || '-' }}
              </view>
            </view>
            <view v-if="item.images.length > 0" class="desc mb-3 flex">
              <view class="desc-label w-[140rpx] shrink-0 text-[#333]">
                回忆图片
              </view>
              <view class="desc-value w-0 flex-1 text-[#333] leading-[1.5]">
                <view class="images flex flex-wrap">
                  <view
                    v-for="(img, imgIndex) in item.images"
                    :key="imgIndex"
                    class="image mb-3 mr-3 h-[180rpx] w-[calc((100%-24rpx)/3)] overflow-hidden rounded-lg"
                    @click="handlePreviewImages(item.images, imgIndex)"
                  >
                    <image class="image-src h-full w-full" :src="img" mode="aspectFill" lazy-load />
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>
      </block>
    </view>

    <view class="to-top-btn fixed bottom-[160rpx] right-6 z-6 h-[72rpx] w-[72rpx] flex items-center justify-center rounded-full bg-white shadow-sm" @click="handleToTopPage()">
      <wd-icon name="arrow-up" size="20px" color="#03a9f4" />
    </view>
  </view>
</template>

<style scoped>
.app-page {
  /* 布局全部由 UnoCSS 原子类实现 */
}
</style>
