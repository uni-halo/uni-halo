<script lang="ts" setup>
/**
 * 轮播组件(源自旧项目 components/e-swiper,新建复刻)
 * 数据高内聚:默认内部请求 plugin-uni-halo 公开 banners 接口(getBanners),支持外部 list 覆盖
 * 支持:图片轮播、日期角标(useTop,显示当前条目 date 快照)、标题浮层(useTitle)、
 *      作者/日期信息浮层(useUser)、底部小图指示器(useDot)
 */
import { computed, onMounted, ref, watch } from 'vue'
import { getBanners } from '@/api/uni-halo'
import { checkAvatarUrl, checkThumbnailUrl } from '@/utils/url'
import type { IBannerPublicItem } from '@/api/types/uni-halo'

export interface IBannerItem {
  /** 条目标识(Banner 为 metadata.name;兼容旧数据) */
  id?: string | number
  /** Banner 条目 metadata.name(custom 详情页跳转用) */
  name?: string
  title?: string
  image?: string
  src?: string
  /** 来源:post=文章快照 / custom=自定义 */
  type?: string
  /** 文章 id(source=post 时跳转文章详情) */
  postId?: string
  content?: string
  url?: string
  /** 展示日期(ISO 快照) */
  date?: string
  authorName?: string
  authorAvatar?: string
  [key: string]: unknown
}

const props = withDefaults(defineProps<{
  title?: string
  height?: string
  dotPosition?: string
  /** 日期角标(显示当前条目 date) */
  useTop?: boolean
  /** 底部小图指示器 */
  useDot?: boolean
  /** 标题浮层 */
  useTitle?: boolean
  /** 作者/日期信息浮层 */
  useUser?: boolean
  /** 轮播数据列表(可选;不传时组件内部调公开 banners 接口拉取) */
  list?: IBannerItem[]
  /** 当前选中的项(指示器坐标位置) */
  current?: number
  /** 是否自动轮播 */
  autoplay?: boolean
}>(), {
  title: '',
  height: '450rpx',
  dotPosition: 'bottom',
  useTop: true,
  useDot: true,
  useTitle: true,
  useUser: true,
  current: 0,
  autoplay: false,
})

const emit = defineEmits<{
  (e: 'on-click', item: IBannerItem): void
  (e: 'on-more'): void
  (e: 'change', event: { current: number }): void
}>()

/* ---------------- 状态 ---------------- */
const currentIndex = ref(props.current)
/** 是否禁止用户 touch 操作 */
const disableTouch = ref(false)

/* ---------------- 数据(高内聚:内部请求公开接口) ---------------- */
const internalList = ref<IBannerItem[]>([])

/** 展示列表:外部传入(list)优先,否则使用内部拉取数据 */
const displayItems = computed<IBannerItem[]>(() =>
  props.list && props.list.length > 0 ? props.list : internalList.value,
)

/** 公开 Banner 条目 → 轮播展示项 */
function mapBanners(items: IBannerPublicItem[]): IBannerItem[] {
  return items.map(item => ({
    id: item.name,
    name: item.name,
    title: item.title || '',
    image: checkThumbnailUrl(item.cover),
    src: checkThumbnailUrl(item.cover),
    type: item.source,
    postId: item.postId,
    url: item.link,
    date: item.date,
    authorName: item.authorName,
    authorAvatar: item.authorAvatar ? checkAvatarUrl(item.authorAvatar) : '',
  }))
}

onMounted(async () => {
  // 外部已传数据时不再重复请求
  if (props.list && props.list.length > 0) {
    return
  }
  try {
    const res = await getBanners()
    internalList.value = mapBanners(res.data || [])
  }
  catch (err) {
    console.error('获取轮播图失败', err)
  }
})

// 列表变化(外部覆盖/接口返回)后索引越界时归零
watch(displayItems, (val) => {
  if (currentIndex.value >= val.length) {
    currentIndex.value = 0
  }
})

/* ---------------- 计算属性 ---------------- */
const currentItem = computed<IBannerItem>(() =>
  displayItems.value[currentIndex.value] || {},
)

/** 日期角标(useTop):当前条目 date 快照转换(年/月/日) */
const dateParts = computed(() => {
  const dateStr = currentItem.value.date as string | undefined
  if (!dateStr) {
    return null
  }
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) {
    return null
  }
  const monthArray = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: String(d.getMonth() + 1).padStart(2, '0'),
    monthEn: monthArray[d.getMonth()],
    year: String(d.getFullYear()),
  }
})

const currentTitle = computed(() => currentItem.value.title || props.title || '')

/** 作者日期展示(useUser 用) */
const authorDateText = computed(() => {
  const dateStr = currentItem.value.date as string | undefined
  if (!dateStr) {
    return ''
  }
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) {
    return ''
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
})

/* ---------------- 交互 ---------------- */
/** current 改变时会触发 change 事件,event.detail = {current, source} */
function change(e: { detail: { current: number, source: string } }) {
  const { current, source } = e.detail
  // 只有页面自动切换、手动切换时才轮播,其他不允许
  if (source === 'autoplay' || source === 'touch') {
    const event = { current }
    currentIndex.value = current
    emit('change', event)
  }
}

/** 手动点击了指示器[小图模式] */
function swiperIndTap(index: number) {
  const event = { current: index }
  currentIndex.value = index
  emit('change', event)
}

function handleOnClick(item: IBannerItem) {
  emit('on-click', item)
}
</script>

<template>
  <view v-if="displayItems.length > 0" class="uh-e-swiper">
    <view class="swiper-box" :class="[dotPosition]">
      <swiper
        class="swiper"
        :style="{ height }"
        :circular="true"
        :indicator-dots="false"
        :autoplay="autoplay"
        :interval="3000"
        :duration="1000"
        :current="currentIndex"
        :disable-touch="disableTouch"
        @change="change"
      >
        <swiper-item v-for="(item, index) in displayItems" :key="index" class="swiper-mfw-item">
          <image
            :src="item.image || item.src"
            class="image h-full w-full"
            mode="aspectFill"
            @click.stop="handleOnClick(item)"
          />
        </swiper-item>
      </swiper>

      <!-- 指示器 [Top 日期角标]:显示当前条目 date(年/月/日) -->
      <view v-if="useTop && dateParts" class="indicator-box indicator-top-box">
        <view class="top-date-hot">
          <view class="left-date-ri">
            <text class="date-ri-text">{{ dateParts.day }}</text>
          </view>
          <view class="center-date-nianyue">
            <view class="left-width-bgcolor" />
            <view class="right-date-nianyue">
              <text class="top-yue-usa">{{ dateParts.monthEn }}</text>
              <text class="bottom-nian">{{ dateParts.year }}</text>
            </view>
          </view>
          <view class="right-hot-ttf">
            <text class="hot-text text-overflow-2">{{ title }}</text>
          </view>
        </view>
      </view>

      <!-- 指示器 标题区域 + 作者/日期信息(useUser) -->
      <view v-if="useTitle" class="indicator-top" :class="{ 'no-dot': !useDot }">
        <view v-if="useUser && (currentItem.authorName || authorDateText)" class="author-line">
          <view v-if="currentItem.authorAvatar" class="author-avatar">
            <image :src="currentItem.authorAvatar" class="h-full w-full" mode="aspectFill" />
          </view>
          <text class="author-name">{{ currentItem.authorName }}</text>
          <text v-if="authorDateText" class="author-date">{{ authorDateText }}</text>
        </view>
        <view v-if="currentTitle" class="top-title">
          <text class="title-text text-overflow-2">{{ currentTitle }}</text>
        </view>
      </view>

      <!-- 指示器 [左边图片列表] -->
      <view v-if="useDot" class="indicator-bottom">
        <view class="bottom-left-imagelist">
          <view
            v-for="(item, index) in displayItems"
            :key="index"
            class="bottom-item"
            :class="currentIndex === index ? 'current' : 'no'"
            @click="swiperIndTap(index)"
          >
            <image :src="item.image || item.src" class="image h-full w-full" mode="aspectFill" />
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.uh-e-swiper {
  position: relative;
  width: 100%;
  overflow: hidden;

  .swiper-box {
    position: relative;
    width: 100%;

    .swiper {
      width: 100%;
      border-radius: 12rpx;
    }
  }

  /* 日期角标(顶部) */
  .indicator-top-box {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 5;
    padding: 16rpx 24rpx;

    .top-date-hot {
      display: flex;
      align-items: center;

      .left-date-ri {
        .date-ri-text {
          font-size: 40rpx;
          font-weight: bold;
          color: #fff;
          text-shadow: 0 2rpx 8rpx rgb(0 0 0 / 40%);
        }
      }

      .center-date-nianyue {
        display: flex;
        align-items: center;
        margin-left: 12rpx;

        .left-width-bgcolor {
          width: 2rpx;
          height: 40rpx;
          background-color: rgb(255 255 255 / 50%);
          margin-right: 12rpx;
        }

        .right-date-nianyue {
          display: flex;
          flex-direction: column;

          .top-yue-usa {
            font-size: 20rpx;
            color: #fff;
            text-shadow: 0 2rpx 8rpx rgb(0 0 0 / 40%);
          }

          .bottom-nian {
            font-size: 16rpx;
            color: rgb(255 255 255 / 80%);
          }
        }
      }

      .right-hot-ttf {
        flex: 1;
        margin-left: 20rpx;

        .hot-text {
          display: block;
          font-size: 24rpx;
          color: #fff;
          text-shadow: 0 2rpx 8rpx rgb(0 0 0 / 40%);
        }
      }
    }
  }

  /* 底部标题/作者浮层 */
  .indicator-top {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 5;
    padding: 48rpx 24rpx 20rpx;
    background: linear-gradient(to top, rgb(0 0 0 / 45%), transparent);

    .author-line {
      display: flex;
      align-items: center;
      gap: 8rpx;
      margin-bottom: 8rpx;

      .author-avatar {
        width: 36rpx;
        height: 36rpx;
        border-radius: 50%;
        overflow: hidden;
        border: 1rpx solid rgb(255 255 255 / 60%);
      }

      .author-name {
        font-size: 22rpx;
        color: rgb(255 255 255 / 92%);
        text-shadow: 0 1rpx 4rpx rgb(0 0 0 / 40%);
      }

      .author-date {
        font-size: 20rpx;
        color: rgb(255 255 255 / 70%);
        text-shadow: 0 1rpx 4rpx rgb(0 0 0 / 40%);
      }
    }

    .top-title {
      .title-text {
        display: block;
        font-size: 28rpx;
        font-weight: bold;
        color: #fff;
        text-shadow: 0 2rpx 8rpx rgb(0 0 0 / 40%);
      }
    }
  }

  /* 底部小图指示器 */
  .indicator-bottom {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 16rpx;
    z-index: 5;
    padding: 0 24rpx;
    display: flex;
    justify-content: flex-end;

    .bottom-left-imagelist {
      display: flex;
      gap: 12rpx;

      .bottom-item {
        width: 96rpx;
        height: 64rpx;
        border-radius: 8rpx;
        overflow: hidden;
        opacity: 0.6;
        border: 2rpx solid transparent;

        &.current {
          opacity: 1;
          border-color: #fff;
        }
      }
    }
  }
}
</style>
