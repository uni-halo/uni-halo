<script lang="ts" setup>
/**
 * 轮播组件(源自旧项目 components/e-swiper,新建复刻)
 * 支持:图片/视频轮播、今日首推日期指示器(useTop)、标题区域(useTitle)、底部小图指示器(useDot)
 */
import { computed, ref } from 'vue'

export interface IBannerItem {
  id: string | number
  title?: string
  image?: string
  src?: string
  mp4?: string
  type?: string
  content?: string
  url?: string
  [key: string]: unknown
}

const props = withDefaults(defineProps<{
  title?: string
  height?: string
  dotPosition?: string
  useTop?: boolean
  useDot?: boolean
  useTitle?: boolean
  useUser?: boolean
  /** 轮播图数据列表 */
  list: IBannerItem[]
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

/** 日期(今日首推指示器用) */
const date = ref({ year: '-', monthEn: '-', month: '-' })

/* ---------------- 计算属性 ---------------- */
/** 仅渲染前 5 条 */
const displayList = computed(() => props.list.slice(0, 5))

const currentTitle = computed(() => props.list[currentIndex.value]?.title || '')

/* ---------------- 初始化 ---------------- */
function initDate() {
  const now = new Date()
  const monthArray = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  date.value.year = String(now.getFullYear())
  const month = now.getMonth() + 1
  date.value.month = month < 10 ? `0${month}` : String(month)
  date.value.monthEn = monthArray[now.getMonth()].toUpperCase()
}

initDate()

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
  <!-- 轮播图 -->
  <view class="uh-e-swiper">
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
        <!-- 只需要前5条数据 -->
        <block v-for="(item, index) in list" :key="index">
          <swiper-item v-if="index <= 4" class="swiper-mfw-item">
            <!-- 如果有视频,则显示视频 -->
            <template v-if="item.mp4 && currentIndex === index">
              <video
                :id="`ImageVideo${index}`"
                :src="item.mp4"
                class="image-video h-full w-full"
                :loop="true"
                :muted="false"
                :autoplay="true"
                :controls="false"
                :show-fullscreen-btn="false"
                :show-play-btn="false"
                :enable-progress-gesture="false"
                :poster="item.image || item.src"
              />
            </template>
            <!-- 否则显示图片 -->
            <image
              v-else
              :src="item.image || item.src"
              class="image h-full w-full"
              mode="aspectFill"
              @click.stop="handleOnClick(item)"
            />
          </swiper-item>
        </block>
      </swiper>

      <!-- 指示器 [Top 今日首推] -->
      <view v-if="useTop" class="indicator-box indicator-top-box">
        <view class="top-date-hot">
          <view class="left-date-ri">
            <text class="date-ri-text">{{ date.month }}</text>
          </view>
          <view class="center-date-nianyue">
            <view class="left-width-bgcolor" />
            <view class="right-date-nianyue">
              <text class="top-yue-usa">{{ date.monthEn }}</text>
              <text class="bottom-nian">{{ date.year }}</text>
            </view>
          </view>
          <view class="right-hot-ttf">
            <text class="hot-text text-overflow-2">{{ title }}</text>
          </view>
        </view>
      </view>

      <!-- 指示器 标题区域 -->
      <view v-if="useTitle" class="indicator-top" :class="{ 'no-dot': !useDot }">
        <block v-for="(item, index) in list" :key="index">
          <view v-if="currentIndex === index" class="top-item" :class="currentIndex === index ? 'current' : 'no'">
            <!-- 如果存在视频,则显示"视频预览"提示 -->
            <view v-if="item.mp4" class="top-image-video">
              <view class="icons">
                <text class="video-icon">▶</text>
              </view>
              <text class="image-video-text">视频预览</text>
            </view>
            <!-- 标题 -->
            <view class="top-title">
              <text class="title-text text-overflow-2">{{ item.title }}</text>
            </view>
          </view>
        </block>
      </view>

      <!-- 指示器 [左边图片列表+右边按钮] -->
      <view v-if="useDot" class="indicator-bottom">
        <!-- 左边 -->
        <view class="bottom-left-imagelist">
          <block v-for="(item, index) in list" :key="index">
            <view
              v-if="Number(index) <= 4"
              class="bottom-item"
              :class="currentIndex === index ? 'current' : 'no'"
              @click="swiperIndTap(index)"
            >
              <image :src="item.image || item.src" class="image h-full w-full" mode="aspectFill" />
            </view>
          </block>
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

  /* 今日首推指示器 */
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

  /* 标题区域 */
  .indicator-top {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 60rpx;
    z-index: 5;
    padding: 0 24rpx;

    .top-item {
      .top-image-video {
        display: flex;
        align-items: center;
        gap: 8rpx;

        .icons {
          .video-icon {
            font-size: 20rpx;
            color: #fff;
          }
        }

        .image-video-text {
          font-size: 20rpx;
          color: #fff;
        }
      }

      .top-title {
        margin-top: 8rpx;

        .title-text {
          display: block;
          font-size: 28rpx;
          font-weight: bold;
          color: #fff;
          text-shadow: 0 2rpx 8rpx rgb(0 0 0 / 40%);
        }
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
