<script lang="ts" setup>
/**
 * 猜画积分排行榜弹窗（匿名可看）：我的排名 + TopN 榜单，底部仅关闭按钮。
 * score = 累计猜中画作数（猜对一幅 +1，画作删除/隐藏不回收）。
 * 加载/空/错误态复用 uh-data-loading（mini 尺寸，适配弹窗）。
 */
import { computed, ref, watch } from 'vue'
import { getGuessRank } from '@/api/draw'
import { useTokenStore } from '@/store/token'
import { useUserStore } from '@/store/user'
import { useAppConfigStore } from '@/store/appConfig'
import { toLoginPage } from '@/utils/toLoginPage'
import { checkThumbnailUrl } from '@/utils/url'
import { DataLoadingStatusEnum } from '@/hooks/useDataLoadingStatus'
import type { IGuessRankItem } from '@/api/types/draw'

const visible = defineModel<boolean>({ default: false })

const tokenStore = useTokenStore()
const userStore = useUserStore()
const appConfigStore = useAppConfigStore()

/** 应用登录整体开关（与登录页同语义：密码/微信两开关全关 = 登录不可用） */
const loginEnabled = computed(() => {
  const client = appConfigStore.configs?.loginConfig?.client
  return client?.passwordLoginEnabled !== false || client?.wechatLoginEnabled === true
})

/** 未登录且站点开启登录：底部显示「登录后查看我的排名」引导按钮（替代关闭按钮） */
const showLoginEntry = computed(() => loginEnabled.value && !tokenStore.updateNowTime().hasLogin)

const loadingStatus = ref<DataLoadingStatus>(DataLoadingStatusEnum.Loading)
const rankList = ref<IGuessRankItem[]>([])

const myRank = computed(() =>
  rankList.value.find(item => item.username === userStore.userInfo?.username))

watch(visible, (value) => {
  if (value) {
    handleGetData()
  }
})

async function handleGetData() {
  loadingStatus.value = DataLoadingStatusEnum.Loading
  try {
    const res = await getGuessRank({ top: 20 })
    rankList.value = res.data || []
    loadingStatus.value = rankList.value.length === 0
      ? DataLoadingStatusEnum.Empty
      : DataLoadingStatusEnum.Success
  }
  catch (err: any) {
    console.error('获取猜画排行榜失败', err)
    uni.showToast({ title: err?.message || '获取猜画排行榜失败', icon: 'none', duration: 2000 })
    rankList.value = []
    loadingStatus.value = DataLoadingStatusEnum.Error
  }
}

function avatarOf(item: IGuessRankItem) {
  return checkThumbnailUrl(item.avatar || '')
}

function textOf(item: IGuessRankItem) {
  return item.displayName || item.username || '佚名'
}

function initialOf(item: IGuessRankItem) {
  return textOf(item).slice(0, 1).toUpperCase()
}

const medals = ['1', '2', '3'] as const

function rankLabel(rank: number) {
  return rank <= 3 ? medals[rank - 1] : `${rank}`
}

/** 去登录（登录成功返回后重开弹窗可见排名） */
function handleToLogin() {
  visible.value = false
  toLoginPage()
}
</script>

<template>
  <uh-glass-popup
    v-model="visible" position="bottom" custom-class="rounded-2xl" :z-index="120"
    @close="visible = false"
  >
    <view class="box-border flex flex-col gap-y-3 p-3">
      <!-- 顶部 -->
      <view class="relative box-border w-full flex items-center justify-center">
        <view class="flex gap-y-1">
          <text class="text-md font-bold">画谜排行榜</text>
        </view>
        <view
          class="uh-global-card-glass absolute right-0 top-0 h-6 w-6 flex items-center justify-center border rounded-lg shadow-none"
          @click="visible = false"
        >
          <wd-icon name="close" size="28rpx" class="text-gray-500" />
        </view>
      </view>
      <text class="text-center text-3xs text-gray-400 -mt-1">猜对一幅画 +1 分，欢迎参与！</text>

      <!-- 我的排名（仅登录用户；未登录不展示该卡片） -->
      <view
        v-if="tokenStore.updateNowTime().hasLogin"
        class="uh-global-card-glass box-border flex items-center justify-between rounded-xl px-3 py-2 !border !shadow-none"
      >
        <text class="text-xs text-gray-500">我的排名</text>
        <text v-if="myRank" class="text-xs text-gray-900 font-semibold">
          第 {{ myRank.rank }}名 · 共 {{ myRank.score }} 分
        </text>
        <text v-else class="text-xs text-gray-400">暂未上榜，快去猜一幅画吧</text>
      </view>

      <!-- 榜单（加载/空/错误态复用 uh-data-loading） -->
      <view class="w-full flex-1">
        <uh-data-loading
          v-if="loadingStatus !== DataLoadingStatusEnum.Success"
          :loading-status="loadingStatus" size="small" min-height="50vh"
          empty-text="还没有人上榜，抢占第一名！" :use-refresh-button="false"
          @refresh="handleGetData"
        />
        <scroll-view v-else :scroll-y="true" :show-scrollbar="false" class="h-[50vh] w-full flex-1">
          <view class="w-full flex flex-col gap-y-1.5">
            <view
              v-for="(item, index) in rankList" :key="item.username"
              class="uh-global-card-glass box-border flex items-center gap-x-2 rounded-xl py-2 pl-1 pr-3 !border !shadow-none"
              :class="[index <= 2 ? 'bg-secondary' : 'bg-white/80']"
            >
              <text class="w-8 shrink-0 text-center text-sm font-semibold" :class="item.rank <= 3 ? '' : 'text-gray-400'">
                {{ rankLabel(item.rank) }}
              </text>
              <wd-avatar
                :src="avatarOf(item)" :text="initialOf(item)" shape="round" size="52rpx"
                custom-class="uh-global-card-glass !shadow-none !border" mode="aspectFill"
              />
              <text class="flex-1 truncate text-3xs text-gray-900">{{ textOf(item) }}</text>
              <text class="shrink-0 text-3xs text-gray-900">总分 {{ item.score }} 分</text>
            </view>
          </view>
        </scroll-view>
      </view>

      <!-- 底部：未登录且开启登录时为「登录后查看我的排名」引导按钮；已登录无底部按钮（右上角可关闭） -->
      <view v-if="showLoginEntry" class="pt-1">
        <uh-button custom-class="uh-global-card-glass !border !rounded-xl !bg-primary !py-2.5 !text-3xs !text-gray-900 active:opacity-80" @click="handleToLogin">
          登录后查看我的排名
        </uh-button>
      </view>
    </view>
  </uh-glass-popup>
</template>
