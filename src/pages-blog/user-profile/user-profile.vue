<script lang="ts" setup>
import { computed, ref, shallowRef } from 'vue'
import { storeToRefs } from 'pinia'
import { onLoad, onPageScroll, onPullDownRefresh, onReachBottom, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { getMomentList, getPostList, getUcMyPostList } from '@/api/halo'
import { useAppConfigStore } from '@/store/appConfig'
import { usePageScroll } from '@/hooks/usePageScroll'
import { useUserStore } from '@/store/user'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { useFavoritesStore } from '@/store/favorites'
import { usePageTitle } from '@/hooks/usePageTitle'
import { buildMomentFavoriteItem } from '@/utils/favorite'
import { useUpvote } from '@/hooks/useUpvote'
import { useUserIdentity } from '@/hooks/useUserIdentity'
import { useCardBgSrc } from '@/hooks/useWornSlots'
import { buildWornSlots, identityMarksStyleCss, nameStyleCssOf, nicknameStyleCss, titleStyleCss } from '@/utils/wornDecorations'
import { checkAvatarUrl, checkImageUrl, checkThumbnailUrl } from '@/utils/url'
import { imagePreview } from '@/utils/image'
import { getAvatarFallbackText } from '@/utils/avatar'
import { formatTime } from '@/utils/formatTime'
import { sleep } from '@/utils/common'
import { decorationTypes } from '@/api/types/halo-plugin-third/interaction-plus'
import type { IMoment, IPost, IUcListedPost } from '@/api/types/halo'
import type { IDecorationWallItem, IIdentityMark } from '@/api/types/halo-plugin-third/interaction-plus'

definePage({
  style: {
    navigationBarTitleText: '个人主页',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
  },
})

const PAGE_SIZE = 10

const { scrollY, updatePageScrollValue } = usePageScroll()
const pageTitle = usePageTitle('userProfile', '个人主页')
const appConfigStore = useAppConfigStore()
const userStore = useUserStore()
const { configs, auditModeEnabled: calcAuditModeEnabled } = storeToRefs(appConfigStore)
const { userInfo } = storeToRefs(userStore)

/* ---------------- 目标用户(onLoad 参数 username=metadata.name;缺省为当前登录用户) ---------------- */
const pageUsername = ref('')
const isSelf = computed(() => !!pageUsername.value && pageUsername.value === userInfo.value.username)

/* ---------------- 互动增强装饰(插件未启用/审核模式/站点开关关闭时槽位全 invisible,静默降级) ---------------- */
const { identity, profile, decorationWall, identityPlusAvailable } = useUserIdentity(pageUsername)
const wornSlots = computed(() => buildWornSlots(identity.value))
const profileNicknameStyle = computed(() => nameStyleCssOf(identity.value))

/* ---------------- 基本资料卡（方案 B 键值行,左右布局:label 左 value 右；增强数据按门控降级） ---------------- */
/** 加入时间（互动增强 identity 优先,公开资料兜底） */
const joinedAt = computed(() => identity.value?.registeredAt || profile.value?.registeredAt || '')
const joinedText = computed(() => joinedAt.value ? formatTime({ d: joinedAt.value, f: 'yyyy/MM/dd' }) : '')

/** 笔记/评论统计文本（仅由互动增强 identity 下发才展示；审核模式不展示） */
const statsPosts = computed(() => identity.value?.stats?.posts)
const statsComments = computed(() => identity.value?.stats?.comments)
const statsText = computed(() => [
  statsPosts.value !== undefined ? `${statsPosts.value} 篇笔记` : '',
  statsComments.value !== undefined ? `${statsComments.value} 条评论` : '',
].filter(Boolean).join(' · '))
const showStatsRow = computed(() => !calcAuditModeEnabled.value && statsText.value !== '')

/** 身份标牌（文字牌/图标/图片三形态,最多 3 个;identity 为空自然隐藏） */
const markChips = computed(() => {
  const marks = (identity.value?.identityMarks || []).slice(0, 3) as IIdentityMark[]
  return marks
    .filter(mark => !!mark?.displayName)
    .map(mark => ({
      displayName: mark.displayName,
      icon: /\/|data:/.test(mark.icon || '') ? mark.icon : '',
      style: identityMarksStyleCss(mark),
    }))
})

/* ---------------- 头部资料(优先级:互动增强 identity > 插件端 profile > 登录信息/兜底) ---------------- */
const headerUser = computed(() => ({
  nickname: identity.value?.displayName
    || profile.value?.displayName
    || (isSelf.value ? userInfo.value.nickname : '')
    || pageUsername.value,
  username: pageUsername.value,
  avatar: identity.value?.avatar
    || profile.value?.avatar
    || (isSelf.value ? userInfo.value.avatar : '')
    || '',
  bio: identity.value?.bio || profile.value?.bio || '这个人很懒，什么都没有留下~',
}))

/* ---------- 图片预览（头像/装扮条目;与资料卡弹窗一致,直接用工具类 imagePreview 原生预览） ---------- */

function handlePreviewAvatar() {
  const url = checkAvatarUrl(headerUser.value.avatar)
  if (!url) { return }
  imagePreview(url)
}

function handlePreviewAsset(item: IDecorationWallItem) {
  const url = checkImageUrl(item?.url)
  if (!url) { return }
  imagePreview(url)
}

/* ---------------- 装扮墙展示样式(与本 app 互动增强资料卡弹窗同一套:稀有度描边+透明网格画布+右上角稀有度徽标) ---------------- */

/** 透明网格棋盘(模拟透明图层纹理) */
const CHECKER_PATTERN = 'conic-gradient(rgb(0 0 0 / 0.05) 25%, transparent 0 50%, rgb(0 0 0 / 0.05) 0 75%, transparent 0)'

/** 仅当稀有度色为 #rrggbb 形式时追加 6 位 alpha，避免 rgb()/颜色名拼接失效 */
function hexAlpha(color: string | undefined, alpha: string): string {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : ''
}

/**
 * 装扮墙条目展示样式（稀有度着色：描边淡色/画布轻染叠加透明网格/右上角类型徽标/名称行稀有度前缀/title 类文字着色，非 hex 安全回退）；
 * item.url 统一经 checkImageUrl 规范化（空值/非法形式置空，给 src 与预览(imagePreview)前统一兜底）
 */
const wallStyled = computed(() => decorationWall.value.map((raw) => {
  const item: IDecorationWallItem = { ...raw, url: checkImageUrl(raw.url) }
  const tint = hexAlpha(item.rarityColor, '14')
  const layers = [tint ? `linear-gradient(160deg, ${tint}, transparent 70%)` : '', CHECKER_PATTERN]
    .filter(Boolean)
    .join(',')
  const sizes = [tint ? '100% 100%' : '', '12px 12px'].filter(Boolean).join(', ')
  return {
    item,
    style: hexAlpha(item.rarityColor, '40') ? `border-color:${hexAlpha(item.rarityColor, '40')};` : '',
    bgStyle: layers ? `background-image:${layers};background-size:${sizes};` : '',
    badgeStyle: item.rarityColor ? `background:${item.rarityColor};` : '',
    rarityTextStyle: item.rarityColor ? `color:${item.rarityColor};` : '',
    textStyle: item.type === 'name_style' ? nicknameStyleCss(item) : titleStyleCss(item),
    isTextDecoration: item.type === 'title' || item.type === 'name_style',
  }
}))

/* 顶部背景：佩戴素材优先；素材缺失或装载失败回退博主页背景图（useCardBgSrc 统一兜底）；连兜底未配置则为空串不渲染 */
const { cardBgSrc, onCardBgError } = useCardBgSrc(() => wornSlots.value?.cardBackground.url || '')
const profileBgUrl = cardBgSrc

/* ---------------- 双 Tab 各自独立的数据状态 ---------------- */
interface IPagedFetchResult<T> {
  items: T[]
  hasNext: boolean
}

/**
 * 分页列表状态机（未加载/加载中/无更多三态 + 加载更多）:
 * 三态 uh-data-loading + 加载更多 uh-data-loadmore + onReachBottom 翻页;
 * 审核模式下一次拉取后本地过滤,不分页
 */
function usePagedList<T extends { metadata: { name: string } }>(options: {
  fetcher: (page: number, size: number) => Promise<IPagedFetchResult<T>>
  auditFilter: (items: T[]) => T[]
}) {
  // 整组替换/拼接,无需深层响应式;shallowRef 同时保住泛型 T 的类型(避免 UnwrapRefSimple 深解包)
  const list = shallowRef<T[]>([])
  const page = ref(1)
  const { loadingStatus, loadMoreStatus, updateLoadingStatus, updateLoadMoreStatus, resetLoadMoreStatus } = useDataLoadingStatus()

  async function fetch(loadMore = false) {
    if (!loadMore) {
      updateLoadingStatus(DataLoadingStatusEnum.Loading)
    }
    try {
      if (calcAuditModeEnabled.value) {
        const res = await options.fetcher(1, 0)
        list.value = options.auditFilter(res.items)
        await sleep(600)
        updateLoadingStatus(list.value.length ? DataLoadingStatusEnum.Success : DataLoadingStatusEnum.Empty)
        updateLoadMoreStatus({ active: false, status: 'noMore', hasNext: false })
        return
      }
      const res = await options.fetcher(page.value, PAGE_SIZE)
      list.value = loadMore ? list.value.concat(res.items) : res.items
      if (!loadMore) {
        await sleep(600)
        updateLoadingStatus(list.value.length ? DataLoadingStatusEnum.Success : DataLoadingStatusEnum.Empty)
      }
      updateLoadMoreStatus({
        active: false,
        status: res.hasNext ? 'loadMore' : 'noMore',
        hasNext: res.hasNext,
      })
    }
    catch (err) {
      console.error('个人主页数据加载失败', err)
      if (loadMore) {
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

  function refresh() {
    resetLoadMoreStatus()
    page.value = 1
    fetch(false)
  }

  function loadMore() {
    if (calcAuditModeEnabled.value) {
      uni.showToast({ icon: 'none', title: '没有更多数据了' })
      return
    }
    // 正在加载时阻止重复请求
    if (loadMoreStatus.value.active) {
      return
    }
    // 有更多数据时继续加载
    if (loadMoreStatus.value.hasNext) {
      page.value += 1
      updateLoadMoreStatus({ active: true, status: 'loading' })
      fetch(true)
    }
  }

  return { list, loadingStatus, loadMoreStatus, refresh, loadMore }
}

/** 按审核模式引用清单本地过滤 */
function auditFilterBy(names: string[]) {
  return <T extends { metadata: { name: string } }>(items: T[]) =>
    items.filter(item => names.includes(item.metadata.name))
}

/** UC ListedPost → 公开列表同构结构(IPost),uh-article-card 直接消费 */
function mapUcListedPost(lp: IUcListedPost): IPost {
  return {
    metadata: lp.post.metadata,
    spec: lp.post.spec,
    status: lp.post.status,
    owner: lp.owner || lp.post.owner,
    stats: lp.stats,
    categories: lp.categories,
    tags: lp.tags,
    contributors: lp.contributors,
  }
}

/* ---------- 笔记 Tab(本人走 UC 端点;他人走公开接口 fieldSelector) ---------- */
const postState = usePagedList<IPost>({
  fetcher: (page, size) => {
    if (isSelf.value) {
      // UC 端点服务端强制 owner=当前用户,固定只取已发布,与站点可见性一致
      return getUcMyPostList({ page, size, sort: ['spec.publishTime,desc'] }).then((res) => {
        const items = (res.data.items || []).map(mapUcListedPost)
        return { items, hasNext: res.data.hasNext }
      })
    }
    // 他人视角走官方公开接口:Halo 聚合器预置 content.halo.run/{owner,published,deleted} 标签,
    // 公开匿名列表仅支持 labelSelector(不白名单 fieldSelector.spec.owner);
    // owner 标签由 reconciler 与 spec.owner 保持同步,返回为完整 Post(owner.metadata.name 在内)
    return getPostList({
      page,
      size,
      sort: ['spec.publishTime,desc'],
      labelSelector: [`content.halo.run/owner=${pageUsername.value}`],
    }).then((res) => {
      const items = res.data.items || []
      return { items, hasNext: res.data.hasNext }
    })
  },
  auditFilter: items => auditFilterBy(appConfigStore.auditNamesOf('posts'))(items),
})

/* ---------- 瞬间 Tab(公开接口原生支持 ownerName 过滤,卡片复用全局 uh-moment-card) ---------- */
type MomentCard = IMoment & {
  images?: { type?: string, url: string }[]
  spec: IMoment['spec'] & { newHtml?: string }
}

/** 移除正文里的标签链接(同 moments.vue,避免卡片内可点进标签页) */
function removeTagLinksCompletely(htmlString: string): string {
  const regex = /<a\b[^>]+class=(['"])[^'"]*\btag\b[^'"]*\1[^>]*>[\s\S]*?<\/a>/gi
  return htmlString.replace(regex, '')
}

/** 映射成 uh-moment-card 需要的扩展结构(newHtml + images,渲染时 check 补全) */
function mapMomentItem(item: IMoment): MomentCard {
  const medium = item.spec?.content?.medium || []
  return {
    ...item,
    stats: { ...(item.stats || {}) },
    spec: {
      ...item.spec,
      newHtml: removeTagLinksCompletely(item.spec?.content?.html || ''),
    },
    images: medium
      .filter(x => x.type === 'PHOTO')
      .map(x => ({ ...x, url: checkThumbnailUrl(x.url || '', true) })),
  }
}

const momentState = usePagedList<MomentCard>({
  fetcher: (page, size) => getMomentList({
    page,
    size,
    ownerName: pageUsername.value,
  }).then((res) => {
    const items = (res.data.items || []).map(mapMomentItem)
    return { items, hasNext: res.data.hasNext }
  }),
  auditFilter: items => auditFilterBy(appConfigStore.auditNamesOf('moments'))(items),
})

type ActiveTab = 'info' | 'post' | 'moment'

/* ---------------- Tab 切换(切换不重置已加载数据,首次进入才拉取) ---------------- */
const activeTab = ref<ActiveTab>('info')
const loadedTabs = ref<Record<ActiveTab, boolean>>({ info: false, post: false, moment: false })

function switchTab(key: ActiveTab) {
  if (activeTab.value === key) { return }
  activeTab.value = key
  if (!loadedTabs.value[key]) {
    loadedTabs.value[key] = true
    if (key === 'post') {
      postState.refresh()
    }
    else if (key === 'moment') {
      momentState.refresh()
    }
  }
}

/* ---------------- 瞬间交互(卡片内媒体/时间由 uh-moment-card 自渲染) ---------------- */

/* ---------------- 跳转(详情页内可评论) ---------------- */
function handleToMoment(moment: IMoment) {
  uni.navigateTo({
    url: `/pages-blog/moment-detail/moment-detail?name=${moment.metadata.name}`,
    animationType: 'slide-in-right',
  })
}

/* ---------------- 点赞/收藏(useUpvote 防重复,收藏走全局 favoritesStore) ---------------- */
const favoritesStore = useFavoritesStore()
const { likeByName } = useUpvote('moments', () => '')

function handleMomentLike(moment: MomentCard) {
  likeByName(moment.metadata.name, () => {
    if (moment.stats) {
      moment.stats.upvote = (moment.stats.upvote || 0) + 1
    }
  })
}

function handleToggleMomentFavorite(moment: MomentCard) {
  const favorited = favoritesStore.toggle(buildMomentFavoriteItem(moment))
  uni.showToast({ icon: 'none', title: favorited ? '收藏成功' : '已取消收藏' })
}

/* ---------------- 分享 ---------------- */

onShareAppMessage(() => ({
  title: `${headerUser.value.nickname || headerUser.value.username}的个人主页`,
  path: `/pages-blog/user-profile/user-profile?username=${pageUsername.value}`,
}))

onShareTimeline(() => ({
  title: `${headerUser.value.nickname || headerUser.value.username}的个人主页`,
  query: pageUsername.value ? `username=${pageUsername.value}` : '',
}))

/* ---------------- 生命周期 ---------------- */

onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})

onLoad((query) => {
  // 路由参数 username = 用户的 metadata.name;未传则回退为当前登录用户
  pageUsername.value = (query as Record<string, string> | undefined)?.username || userInfo.value.username || ''
  if (!pageUsername.value) {
    uni.showToast({ icon: 'none', title: '用户不存在' })
    setTimeout(() => uni.navigateBack(), 1000)
    return
  }
  loadedTabs.value.post = true
  postState.refresh()
})

onPullDownRefresh(() => {
  loadedTabs.value[activeTab.value] = true
  if (activeTab.value === 'post') {
    postState.refresh()
  }
  else {
    momentState.refresh()
  }
})

onReachBottom(() => {
  if (activeTab.value === 'post') {
    postState.loadMore()
  }
  else {
    momentState.loadMore()
  }
})
</script>

<template>
  <view class="box-border min-h-screen w-screen flex flex-col bg-page pb-safe">
    <uh-navbar
      :scroll-y="scrollY" :default-title="pageTitle" :scroll-title="headerUser.nickname"
      :need-placeholder="false"
    />

    <view class="relative mb-8 box-border h-66 w-full">
      <image
        v-if="profileBgUrl" class="absolute left-0 top-0 h-full w-full bg-cover bg-center !block"
        :src="profileBgUrl" mode="aspectFill" @error="onCardBgError()"
      />
      <view class="uh-profile-mask pointer-events-none absolute left-0 top-0 h-full w-full" />
      <view class="absolute left-0 z-30 flex items-center justify-center gap-x-4 px-4 -bottom-6">
        <view class="relative shrink-0" @click="handlePreviewAvatar()">
          <wd-avatar
            :src="checkAvatarUrl(headerUser.avatar)"
            :text="getAvatarFallbackText(headerUser.nickname || headerUser.username)" shape="round"
            custom-class="uh-global-card-glass uh-shadow-xs !h-20 !w-20 !text-gray-900 !font-bold"
            class="!border-2 !border-white/40 !rounded-full" mode="aspectFill"
          />
          <image
            v-if="wornSlots.avatarFrame.visible" :src="wornSlots.avatarFrame.url"
            class="uh-frame-center pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 !block" mode="aspectFit"
          />
        </view>
        <view class="flex flex-1 flex-col gap-y-1.5">
          <view class="flex items-center gap-x-1">
            <text
              class="text-md text-white font-bold text-shadow-[0_2rpx_8rpx_rgba(0,0,0,0.4)] drop-shadow"
              :style="[profileNicknameStyle]"
            >
              {{ headerUser.nickname || '匿名用户' }}
            </text>
            <image
              v-if="wornSlots.primaryBadge.visible" :src="wornSlots.primaryBadge.url" class="h-4.5 w-4.5 !block"
              mode="aspectFit"
            />
          </view>
          <view v-if="wornSlots.title.visible || markChips.length !== 0" class="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <text
              v-if="wornSlots.title.visible" class="box-border rounded-full px-2 py-0.5 text-xs"
              :style="wornSlots.title.style"
            >
              {{ wornSlots.title.text }}
            </text>
            <template v-for="(mark, i) in markChips" :key="i">
              <image v-if="mark.icon" :src="mark.icon" class="h-4 w-4" mode="aspectFit" />
              <text
                v-else class="box-border max-w-fit truncate border rounded-full border-solid px-1.5 py-0.5 text-xs text-white"
                :style="mark.style"
              >
                {{ mark.displayName }}
              </text>
            </template>
          </view>
          <text class="text-xs text-gray-900" :class="[wornSlots.title.visible || markChips.length !== 0 ? 'line-clamp-1' : 'line-clamp-2']">
            {{ headerUser.bio }}
          </text>
        </view>
      </view>
      <view
        class="pointer-events-none absolute bottom-0 left-0 z-20 h-18 w-full from-black/0 to-page bg-gradient-to-b"
      />
    </view>
    <template v-if="activeTab === 'info'">
      <view class="box-border flex flex-col gap-y-3 overflow-hidden p-3">
        <view class="uh-global-card-glass rounded-lg p-3 !border !shadow-none">
          <view class="mb-2 flex items-center justify-between">
            <view class="text-sm text-gray-900 font-bold">
              基本资料
            </view>
          </view>
          <view class="w-full flex flex-col gap-y-2 text-sm text-gray-900">
            <view class="flex items-start gap-x-4">
              <text class="shrink-0 text-3xs text-gray-400 leading-5">
                用户昵称
              </text>
              <view class="min-w-0 flex flex-1 flex-wrap items-center gap-x-1 leading-5">
                <text class="truncate text-3xs text-gray-900" :style="[profileNicknameStyle]">
                  {{ headerUser.nickname || headerUser.username }}
                </text>
              </view>
            </view>
            <view v-if="wornSlots.primaryBadge.visible" class="flex items-start gap-x-4">
              <text class="shrink-0 text-3xs text-gray-400 leading-5">
                佩戴勋章
              </text>
              <view class="min-w-0 flex flex-1 flex-wrap items-center gap-x-1.5 gap-y-1">
                <image
                  :src="wornSlots.primaryBadge.url" class="h-5 w-5" mode="aspectFit"
                  @click="imagePreview(wornSlots.primaryBadge.url)"
                />
                <text class="text-3xs text-gray-900" :style="[]">{{ wornSlots.primaryBadge.data?.displayName }}</text>
              </view>
            </view>
            <view v-if="wornSlots.title.visible" class="flex items-start gap-x-4">
              <text class="shrink-0 text-3xs text-gray-400 leading-5">
                佩戴称号
              </text>
              <view class="min-w-0 flex-1">
                <text
                  class="box-border max-w-fit truncate rounded-full px-2 py-0.5 text-xs"
                  :style="[wornSlots.title.style]"
                >
                  {{ wornSlots.title.text }}
                </text>
              </view>
            </view>
            <view v-if="markChips.length" class="flex items-start gap-x-4">
              <text class="shrink-0 text-3xs text-gray-400 leading-5">
                身份标牌
              </text>
              <view class="min-w-0 flex flex-1 flex-wrap items-center gap-1.5">
                <template v-for="(mark, i) in markChips" :key="i">
                  <image v-if="mark.icon" :src="mark.icon" class="h-4 w-4" mode="aspectFit" />
                  <text
                    v-else class="box-border max-w-fit truncate border rounded-full border-solid px-1.5 py-0.5 text-xs text-white"
                    :style="mark.style"
                  >
                    {{ mark.displayName }}
                  </text>
                </template>
              </view>
            </view>
            <view v-if="joinedText" class="flex items-start gap-x-4">
              <text class="shrink-0 text-3xs text-gray-400 leading-5">
                加入时间
              </text>
              <view class="min-w-0 flex-1">
                <text class="text-3xs text-gray-900 leading-5">
                  {{ joinedText }}
                </text>
              </view>
            </view>
            <view v-if="showStatsRow" class="flex items-start gap-x-4">
              <text class="shrink-0 text-3xs text-gray-400 leading-5">
                互动数据
              </text>
              <view class="min-w-0 flex-1">
                <text class="text-3xs text-gray-900 leading-5">
                  {{ statsText }}
                </text>
              </view>
            </view>
            <view class="flex items-start gap-x-4">
              <text class="shrink-0 text-3xs text-gray-400 leading-5">
                个人简介
              </text>
              <view class="min-w-0 flex-1">
                <text class="text-3xs text-gray-500 leading-5">
                  {{ headerUser.bio }}
                </text>
              </view>
            </view>
          </view>
        </view>
        <view v-if="decorationWall.length" class="uh-global-card-glass rounded-lg p-3 !border !shadow-none">
          <view class="mb-2 flex items-center justify-between">
            <view class="text-sm text-gray-900 font-bold">
              装扮展示
            </view>
            <view class="rounded-full text-xs text-gray-500">
              共 {{ decorationWall.length }} 件
            </view>
          </view>
          <view class="grid grid-cols-3 gap-2.5">
            <view
              v-for="(d, i) in wallStyled" :key="d.item.assetName || i" class="flex flex-1 flex-col cursor-pointer"
              @click="handlePreviewAsset(d.item)"
            >
              <view class="flex flex-col items-center justify-center gap-y-1">
                <view class="relative box-border w-full overflow-hidden border border-gray-100 rounded-lg border-solid" :style="[d.style]">
                  <view
                    class="box-border h-18 w-full flex items-center justify-center p-2"
                    :style="[d.bgStyle]"
                  >
                    <image
                      v-if="d.item.url" :src="d.item.url" class="h-full w-full rounded-lg !block"
                      mode="aspectFit"
                    />
                    <text
                      v-else class="box-border truncate rounded-lg px-2 py-0.5 text-center text-xs font-black"
                      :style="[d.textStyle]"
                    >
                      {{ d.item.displayName }}
                    </text>
                  </view>
                  <!-- 类型角标(稀有度色底,无稀有度回落主题色) -->
                  <text
                    class="absolute right-0 top-0 z-10 box-border rounded-lb-md px-1 text-[10px] text-white"
                    :class="d.item.rarityColor ? '' : 'bg-primary'"
                    :style="[d.badgeStyle]"
                  >
                    {{ decorationTypes[d.item.type] || '-' }}
                  </text>
                </view>
                <!-- 名称行:稀有度在前 -->
                <view class="w-full flex items-center justify-center gap-x-1">
                  <text v-if="d.item.rarityDisplayName" class="shrink-0 text-xs font-bold" :style="[d.rarityTextStyle]">
                    {{ d.item.rarityDisplayName }}
                  </text>
                  <text class="truncate text-xs text-gray-700">{{ d.item.displayName }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </template>

    <template v-else-if="activeTab === 'post'">
      <uh-data-loading
        v-if="postState.loadingStatus.value !== DataLoadingStatusEnum.Success"
        :loading-status="postState.loadingStatus.value" empty-text="啊偶，还没有发布过笔记哦~" min-height="50vh"
        @refresh="postState.refresh()"
      />
      <view v-else class="box-border flex flex-col gap-3 p-3">
        <uh-article-card
          v-for="article in postState.list.value" :key="article.metadata.name" from="articles"
          variant="list" :article="article" :audit-mode="calcAuditModeEnabled" :show-user-profile-home-button="false"
        />
        <uh-data-loadmore :status="postState.loadMoreStatus.value.status" :text="postState.loadMoreStatus.value.text" />
      </view>
    </template>

    <template v-else-if="activeTab === 'moment'">
      <uh-data-loading
        v-if="momentState.loadingStatus.value !== DataLoadingStatusEnum.Success"
        :loading-status="momentState.loadingStatus.value" empty-text="啊偶，还没有发布过瞬间哦~" min-height="50vh"
        @refresh="momentState.refresh()"
      />
      <view v-else class="box-border flex flex-col gap-3 p-3">
        <uh-moment-card
          v-for="moment in momentState.list.value" :key="moment.metadata.name" :moment="moment"
          :blogger="{ nickname: headerUser.nickname, avatar: checkAvatarUrl(headerUser.avatar) }"
          :show-user-profile-home-button="false"
          @detail="handleToMoment(moment)" @like="handleMomentLike(moment)" @comment="handleToMoment(moment)"
          @favorite="handleToggleMomentFavorite(moment)"
        />
        <uh-data-loadmore
          :status="momentState.loadMoreStatus.value.status"
          :text="momentState.loadMoreStatus.value.text"
        />
      </view>
    </template>

    <uh-float-toolbar :need-placeholder="true">
      <view
        class="uh-global-card-glass box-border flex shrink-0 items-center justify-center gap-x-1 border rounded-full px-4 py-2.5 shadow-none"
        :class="[activeTab === 'info' ? 'bg-primary ' : '']" @click="switchTab('info')"
      >
        <text class="shrink-0 text-3xs text-gray-900">用户资料</text>
      </view>
      <view
        class="uh-global-card-glass box-border flex shrink-0 items-center justify-center gap-x-1 border rounded-full px-4 py-2.5 shadow-none"
        :class="[activeTab === 'post' ? 'bg-primary ' : '']" @click="switchTab('post')"
      >
        <text class="shrink-0 text-3xs text-gray-900">笔记</text>
      </view>
      <view
        class="uh-global-card-glass box-border flex shrink-0 items-center justify-center gap-x-1 border rounded-full px-4 py-2.5 shadow-none"
        :class="[activeTab === 'moment' ? 'bg-primary ' : '']" @click="switchTab('moment')"
      >
        <text class="shrink-0 text-3xs text-gray-900">瞬间</text>
      </view>
    </uh-float-toolbar>
  </view>
</template>

<style scoped lang="scss">
.uh-profile-mask {
  background-color: rgba(0, 0, 0, 0.075);
  backdrop-filter: blur(2rpx);
  -webkit-backdrop-filter: blur(2rpx);
}
</style>

<style scoped>
/* -translate-* 工具类在端内不支持,头像框居中经此类实现 */
.uh-frame-center {
  transform: translate(-50%, -50%);
}
</style>
