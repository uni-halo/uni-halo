<script lang="ts" setup>
/**
 * 恋爱清单页(源自旧项目 pagesA/love/list.vue,新建复刻)
 * 恋爱清单卡片列表(未开始/进行中/已完成),展开查看详情与回忆图片
 */
import { ref } from 'vue'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { getLoveDailyItems } from '@/api/uni-halo'
import { checkImageUrl } from '@/utils/url'

definePage({
  style: {
    navigationBarTitleText: '恋爱清单',
    enablePullDownRefresh: true,
  },
})

/* ---------------- 状态 ---------------- */
const loading = ref<'loading' | 'success' | 'error'>('loading')
const list = ref<(ILoveItem & { open: boolean })[]>([])

interface ILoveItem {
  name?: string
  title?: string
  content?: string
  status?: 'wait' | 'doing' | 'complete'
  planDate?: string
  completeDate?: string
  completeRemark?: string
  images?: string[]
  [key: string]: unknown
}

/* ---------------- 数据加载 ---------------- */
async function handleGetList() {
  loading.value = 'loading'
  try {
    const res = await getLoveDailyItems({})
    if (res.data && (res.data as unknown as { items?: unknown[] }).items) {
      list.value = ((res.data as unknown as { items: unknown[] }).items as unknown as {
        spec?: ILoveItem
        metadata?: { name?: string }
        name?: string
      }[]).map(item => ({
        ...item.spec,
        name: item.metadata?.name || item.name || '',
        open: false,
      }))
      loading.value = 'success'
    }
    else {
      list.value = []
      loading.value = 'success'
    }
  }
  catch (e) {
    console.error('获取清单失败', e)
    loading.value = 'error'
    uni.showToast({ icon: 'none', title: '加载失败，请下拉刷新重试！' })
  }
  finally {
    setTimeout(() => {
      uni.stopPullDownRefresh()
    }, 200)
  }
}

/* ---------------- 交互 ---------------- */
function handleOnItemOpen(item: ILoveItem & { open: boolean }) {
  item.open = !item.open
}

function handlePreviewImages(images: string[] | undefined, index: number) {
  const urls = (images || []).map(img => checkImageUrl(img || ''))
  if (urls.length === 0)
    return
  uni.previewImage({ current: urls[index], urls })
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
  uni.setNavigationBarTitle({ title: '恋爱清单' })
  handleGetList()
})

onPullDownRefresh(() => {
  handleGetList()
})
</script>

<template>
  <view class="app-page box-border min-h-screen w-screen p-6 pb-[144rpx]" style="background: linear-gradient(135deg, rgb(247 149 51 / 10%), rgb(243 112 85 / 10%) 15%, rgb(239 78 123 / 10%) 30%, rgb(161 102 171 / 10%) 44%, rgb(80 115 184 / 10%) 58%, rgb(16 152 173 / 10%) 72%, rgb(7 179 155 / 10%) 86%, rgb(109 186 130 / 10%));">
    <view v-if="loading === 'loading'" class="loading-wrap box-border h-[60vh] w-full flex items-center justify-center p-9">
      <view class="loadig-text mt-7 text-[28rpx] text-[#56bbf9]">
        清单正在努力加载中啦~
      </view>
    </view>
    <view v-else-if="loading === 'error'" class="loading-wrap box-border h-[60vh] w-full flex items-center justify-center p-9">
      <wd-empty description="啊偶,加载失败了呢~">
        <wd-button size="small" plain type="danger" @click="handleGetList()">
          刷新试试
        </wd-button>
      </wd-empty>
    </view>
    <view v-else class="list-wrap w-full">
      <view v-if="list.length === 0" class="list h-[60vh] flex flex-col items-center justify-center">
        <wd-empty description="暂时还没有恋爱清单，快去制定你们的恋爱清单吧~">
          <wd-button size="small" plain type="primary" @click="handleGetList()">
            刷新试试
          </wd-button>
        </wd-empty>
      </view>
      <view v-else class="list">
        <view class="list-tip mb-7 w-full text-center text-[26rpx] text-[#999]">
          看看我们的恋爱清单都完成了哪些吧
        </view>
        <block v-for="(item, index) in list" :key="item.name || index">
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
              <view v-if="item.images && item.images.length > 0" class="desc mb-3 flex">
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
                      <image class="image-src h-full w-full" :src="checkImageUrl(img)" mode="aspectFill" lazy-load />
                    </view>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </block>
      </view>
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
