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
import { useIdentityStore } from '@/store/identity'
import { useLoginPopup } from '@/hooks/useLoginPopup'
import { useUserProfilePopup } from '@/hooks/useUserProfilePopup'
import { checkAvatarUrl } from '@/utils/url'
import { DataLoadingStatusEnum } from '@/hooks/useDataLoadingStatus'
import type { IGuessRankItem } from '@/api/types/draw'

const visible = defineModel<boolean>({ default: false })

const tokenStore = useTokenStore()
const userStore = useUserStore()
const appConfigStore = useAppConfigStore()
const { openLoginPopup } = useLoginPopup()

/** 应用登录整体开关（与登录页同语义：密码/微信两开关全关 = 登录不可用） */
const loginEnabled = computed(() => {
  const client = appConfigStore.configs?.loginConfig?.client
  return client?.passwordLoginEnabled !== false || client?.wechatLoginEnabled === true
})

/** 未登录且站点开启登录：底部显示「登录后查看我的排名」引导按钮（替代关闭按钮） */
const showLoginEntry = computed(() => loginEnabled.value && !tokenStore.updateNowTime().hasLogin)

const loadingStatus = ref<DataLoadingStatus>(DataLoadingStatusEnum.Loading)
const rankList = ref<IGuessRankItem[]>([])

/** 榜单用户互动增强身份(批量拉取 + TTL 缓存;统一走 store.slotsOf 门控,查无/门控未过返回全 invisible) */
const identityStore = useIdentityStore()
const myRankSlots = computed(() => identityStore.slotsOf(userStore.userInfo?.username || ''))

function slotsOf(item: IGuessRankItem) {
  return identityStore.slotsOf(item.username)
}

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
    // 榜单用户身份批量预取(与排名数据独立失败,不影响榜单展示)
    identityStore.ensureMany(rankList.value.map(item => item.username))
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
  return checkAvatarUrl(item?.avatar || '')
}

function textOf(item: IGuessRankItem) {
  return item.displayName || item.username || '佚名'
}

function initialOf(item: IGuessRankItem) {
  return textOf(item).slice(0, 1).toUpperCase()
}

function rankColorClass(index: number) {
  switch (index) {
    case 1:
      return 'bg-yellow-400 text-white'
    case 2:
      return 'bg-blue-400 text-white'
    case 3:
      return 'bg-orange-400 text-white'
    default:
      return 'bg-gray-300 text-white'
  }
}

const { openUserProfilePopup } = useUserProfilePopup()

/** 点击榜单用户:打开用户资料卡(审核模式下 hook 内直接忽略) */
function handleToUserCard(item: IGuessRankItem) {
  openUserProfilePopup({
    username: item.username,
    nickname: item.displayName,
    avatar: item.avatar,
  })
}

/** 去登录(弹窗登录,成功后原地刷新排名) */
function handleToLogin() {
  openLoginPopup(() => handleGetData())
  visible.value = false
}
</script>

<template>
  <uh-glass-popup
    v-model="visible" position="bottom" custom-class="rounded-2xl" :z-index="110"
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
        v-if="myRank && tokenStore.updateNowTime().hasLogin"
        class="uh-global-card-glass box-border flex items-center justify-between rounded-xl px-3 py-2 !border !shadow-none"
      >
        <view class="flex shrink-0 items-center gap-x-1">
          <text class="text-xs text-gray-400">我的排名</text>

          <view class="relative shrink-0">
            <wd-avatar
              :src="avatarOf(myRank)" :text="initialOf(myRank)" shape="round" size="50rpx"
              custom-class="uh-global-card-glass !shadow-none !border !block" mode="aspectFill"
            />
            <image
              v-if="myRankSlots.avatarFrame.visible" :src="myRankSlots.avatarFrame.url"
              class="uh-frame-center pointer-events-none absolute left-1/2 top-1/2 h-[66rpx] w-[66rpx]"
              mode="aspectFit"
            />
          </view>
          <view class="flex items-center gap-x-1">
            <text class="text-3xs text-gray-600">{{ myRank.displayName }}</text>
            <image
              v-if="myRankSlots.primaryBadge.visible" :src="myRankSlots.primaryBadge.url"
              class="h-3 w-3 shrink-0" mode="aspectFit"
            />
          </view>
        </view>
        <text v-if="myRank" class="text-xs text-gray-600">
          第 <text class="text-base text-primary font-semibold">{{ myRank.rank }}</text> 名 · 共 <text class="text-base text-primary font-semibold">{{ myRank.score }} </text> 分
        </text>
        <text v-else class="text-xs text-gray-400">暂未上榜，快去猜一幅画吧</text>
      </view>

      <!-- 榜单（加载/空/错误态复用 uh-data-loading） -->
      <view class="w-full flex-1">
        <uh-data-loading
          v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus"
          size="small" min-height="50vh" empty-text="还没有人上榜，抢占第一名！" :use-refresh-button="false"
          @refresh="handleGetData"
        />
        <scroll-view v-else :scroll-y="true" :show-scrollbar="false" class="h-[50vh] w-full flex-1">
          <view class="w-full flex flex-col gap-y-2.5">
            <view
              v-for="item in rankList" :key="item.username"
              class="box-border flex items-center gap-x-2.5 px-1"
              @click="handleToUserCard(item)"
            >
              <text
                class="h-6 min-w-6 flex shrink-0 items-center justify-center rounded-full text-xs"
                :class="[rankColorClass(item.rank)]"
              >
                {{ item.rank }}
              </text>
              <view class="relative shrink-0">
                <wd-avatar
                  :src="avatarOf(item)" :text="initialOf(item)" shape="round" size="60rpx"
                  custom-class="uh-global-card-glass !shadow-none !border" mode="aspectFill"
                />
                <image
                  v-if="slotsOf(item).avatarFrame.visible" :src="slotsOf(item).avatarFrame.url"
                  class="uh-frame-center pointer-events-none absolute left-1/2 top-1/2 h-[78rpx] w-[78rpx]"
                  mode="aspectFit"
                />
              </view>
              <view class="min-w-0 flex flex-1 items-center gap-x-1">
                <text class="min-w-0 truncate text-3xs text-gray-900 font-semibold">{{ textOf(item) }}</text>
                <image
                  v-if="slotsOf(item).primaryBadge.visible" :src="slotsOf(item).primaryBadge.url"
                  class="h-3 w-3 shrink-0" mode="aspectFit"
                />
              </view>
              <text class="shrink-0 text-3xs text-gray-500"> <text class="text-sm text-gray-900 font-bold"> {{ item.score }} </text>  分</text>
            </view>
          </view>
        </scroll-view>
      </view>

      <!-- 底部：未登录且开启登录时为「登录后查看我的排名」引导按钮；已登录无底部按钮（右上角可关闭） -->
      <view v-if="showLoginEntry" class="pt-1">
        <uh-button
          custom-class="uh-global-card-glass !border !rounded-xl !bg-primary !py-2.5 !text-3xs !text-gray-900 active:opacity-80"
          @click="handleToLogin"
        >
          登录后查看我的排名
        </uh-button>
      </view>
    </view>
  </uh-glass-popup>
</template>

<style scoped>
/* -translate-* 工具类在端内不支持,头像框居中经此类实现 */
.uh-frame-center {
  transform: translate(-50%, -50%);
}
</style>
