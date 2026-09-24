<script lang="ts" setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { onLoad, onPullDownRefresh, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { getPostByName, getPostCommentReplyList, postTrackersCounter } from '@/api/halo'
import { useUpvote } from '@/hooks/useUpvote'
import { usePageScroll } from '@/hooks/usePageScroll'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatTime } from '@/utils/formatTime'
import { useAppConfigStore } from '@/store/appConfig'
import { useFavoritesStore } from '@/store/favorites'
import { useSettingStore } from '@/store/setting'
import { checkAvatarUrl, checkImageUrl } from '@/utils/url'
import { getAvatarFallbackText } from '@/utils/avatar'
import { buildPostFavoriteItem } from '@/utils/favorite'
import { getDomainOnly } from '@/utils/urlParams'
import { handleScrollToSelector } from '@/utils/page'
import { markdownConfig } from '@/config/markdown'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import type { IComment, IPost } from '@/api/types/halo'

definePage({
  style: {
    navigationBarTitleText: '笔记详情',
    enablePullDownRefresh: true,
    navigationStyle: 'custom',
  },
})

const { scrollY, updatePageScrollValue } = usePageScroll()
/** 页面标题（插件端可配置，留空回退内置默认；滚动后显示笔记题目） */
const pageTitle = usePageTitle('postDetail', '笔记详情')
const appConfigStore = useAppConfigStore()
const favoritesStore = useFavoritesStore()
const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()

const { configs: haloConfigs, auditModeEnabled: calcAuditModeEnabled } = storeToRefs(appConfigStore)
const { settings } = storeToRefs(useSettingStore())

/* ---------------- 状态 ---------------- */
const queryName = ref('')
const result = ref<IPost & {
  _voteIds?: string[]
  _doubanUrls?: string[]
  owner?: { displayName?: string, avatar?: string }
  stats?: { visit?: number, upvote?: number, comment?: number }
} | null>(null)

const commentModal = ref({
  show: false,
  isComment: false,
  postName: '',
  title: '',
  quoteReply: '',
})
const commentDetail = ref({
  show: false,
  loading: 'loading' as 'loading' | 'success' | 'error',
  comment: {} as IComment,
  postName: '',
  list: [] as IComment[],
})

/* ---------------- 计算属性 ---------------- */
const postDetailPageConfig = computed(() => haloConfigs.value.featureConfig?.pages?.postDetail)

const bloggerInfo = computed(() => {
  const blogger = haloConfigs.value.featureConfig?.profile?.blogger
  return {
    nickname: blogger?.nickname || '',
    avatar: checkAvatarUrl(blogger?.avatar),
  }
})

const calcIsShowComment = computed(() => !!postDetailPageConfig.value?.showComment)
/** 是否启用评论（站点开关 + 文章自身开关，文章未配置时视为允许） */
const calcEnableComment = computed(() =>
  !!postDetailPageConfig.value?.enableComment
  && result.value?.spec.allowComment !== false)

const avatarShape = computed(() => (settings.value.avatarShape === 'circle' ? 'round' : 'square') as 'round' | 'square')

const avatarClass = computed(() => {
  if (settings.value.avatarShape === 'circle') {
    return '!rounded-full'
  }
  return '!rounded-lg'
})

/** 从 HTML 提取投票块 id */
function extractVoteBlockIds(html: string): string[] {
  const regex = /<vote-block\s+id="(vote-\w+)"\s*\/?>/g
  const ids: string[] = []
  for (const match of html.matchAll(regex)) {
    ids.push(match[1])
  }
  return ids
}

/** 从 HTML 提取豆瓣块 url */
function extractDoubanBlockUrls(html: string): string[] {
  const regex = /<douban\s+src="([^"]+)"\s*\/?>/g
  const urls: string[] = []
  for (const match of html.matchAll(regex)) {
    urls.push(match[1])
  }
  return urls
}

/** 移除内容中的 tag 链接 */
function removeTagLinksCompletely(html: string): string {
  const regex = /<a\b[^>]+class=(['"])[^'"]*\btag\b[^'"]*\1[^>]*>[\s\S]*?<\/a>/gi
  return html.replace(regex, '')
}

/** 获取 openid(微信端) */
function handleGetOpenid() {
  // #ifdef MP-WEIXIN
  uni.login({
    provider: 'weixin',
    success: (loginRes) => {
      try {
        uni.setStorageSync('openid', loginRes.code)
      }
      catch (error) {
        console.error(error)
      }
    },
  })
  // #endif
}

/* ---------------- 数据加载 ---------------- */
async function handleGetData() {
  updateLoadingStatus(DataLoadingStatusEnum.Loading)
  try {
    const res = await getPostByName(queryName.value)
    const tempResult = res.data as typeof result.value
    if (tempResult) {
      tempResult._voteIds = extractVoteBlockIds(res.data.content?.raw || res.data.content?.content || '')
      tempResult._doubanUrls = extractDoubanBlockUrls(res.data.content?.raw || res.data.content?.content || '')
      tempResult.owner.avatar = checkAvatarUrl(tempResult.owner.avatar)
      tempResult.spec.cover = checkImageUrl(tempResult.spec.cover)
      const openid = uni.getStorageSync('openid')
      if (openid === '' || openid === null) {
        handleGetOpenid()
      }
    }
    result.value = tempResult
    uni.setNavigationBarTitle({ title: '笔记详情' })
    updateLoadingStatus(DataLoadingStatusEnum.Success)
    handleTrackersCounter()
  }
  catch (err) {
    console.error('获取笔记失败', err)
    updateLoadingStatus(DataLoadingStatusEnum.Error)
  }
  finally {
    uni.hideLoading()
    uni.stopPullDownRefresh()
  }
}

/** 访问计数埋点 */
async function handleTrackersCounter() {
  if (!result.value) {
    return
  }
  const winInfo = uni.getWindowInfo()
  const appBaseInfo = uni.getAppBaseInfo()
  const baseUrl = import.meta.env.VITE_SERVER_BASEURL || ''
  try {
    await postTrackersCounter({
      group: 'content.halo.run',
      plural: 'posts',
      name: result.value.metadata.name,
      hostname: getDomainOnly(baseUrl),
      screen: `${winInfo.screenWidth}x${winInfo.screenHeight}`,
      language: appBaseInfo.language,
      url: `/archives/${baseUrl}`,
      referrer: `${baseUrl}/`,
    })
  }
  catch (err) {
    console.error('埋点失败', err)
  }
}

/* ---------------- 点赞 ---------------- */
const { hasUpvoted, handleDoLikes } = useUpvote('posts', () => result.value?.metadata.name)

function handleDoLikesClick() {
  handleDoLikes(() => {
    if (result.value?.stats) {
      result.value.stats.upvote = (result.value.stats.upvote || 0) + 1
    }
  })
}

/* ---------------- 收藏 ---------------- */
/** 当前笔记是否已收藏 */
function hasFavorited(): boolean {
  const name = result.value?.metadata.name
  return !!name && favoritesStore.isFavorite('post', name)
}

/** 切换收藏(收藏/取消),收藏时按当前笔记内容生成快照入库 */
function handleTogglePostFavorite() {
  const post = result.value
  if (!post) { return }
  const favorited = favoritesStore.toggle(buildPostFavoriteItem(post))
  uni.showToast({ icon: 'none', title: favorited ? '收藏成功' : '已取消收藏' })
}

/* ---------------- 评论 ---------------- */
/** 底部悬浮评论按钮:滚动到评论区并弹出评论窗 */
function handleToComment() {
  if (!result.value) {
    return
  }
  if (!calcEnableComment.value) {
    uni.showToast({ icon: 'none', title: '笔记已开启禁止评论！' })
    return
  }
  handleScrollToSelector('#comment-section')
  commentModal.value = {
    show: true,
    isComment: true,
    postName: result.value.metadata.name,
    title: '新增评论',
    quoteReply: '',
  }
}

function handleOnComment(data: { isComment: boolean, postName: string, title: string, quoteReply?: string }) {
  commentModal.value = {
    show: true,
    isComment: data.isComment,
    postName: data.postName,
    title: data.title,
    quoteReply: data.quoteReply ?? '',
  }
}

function handleOnCommentModalClose(data: { refresh: boolean, isSubmit: boolean, replyTo?: string }) {
  if (data.refresh && data.isSubmit) {
    // 评论成功后刷新(通过 uni.$emit 广播给 comment-list);回复时自动展开对应回复区
    uni.$emit('comment_list_refresh', data.replyTo ? { expandCommentName: data.replyTo } : undefined)
  }
  commentModal.value.show = false
}

/** 评论列表加载完成:同步评论计数(统计区展示) */
function handleCommentLoaded(list: IComment[]) {
  if (result.value?.stats) {
    result.value.stats.comment = list.length
  }
}

function handleOnShowCommentDetail(data: { postName: string, comment: IComment }) {
  commentDetail.value = {
    show: true,
    loading: 'loading',
    comment: data.comment,
    postName: data.postName,
    list: [],
  }
}

async function handleGetChildComments() {
  commentDetail.value.loading = 'loading'
  try {
    const res = await getPostCommentReplyList(commentDetail.value.postName, {
      page: 1,
      size: 100,
    })
    commentDetail.value.loading = 'success'
    commentDetail.value.list = res.data.items
  }
  catch (err) {
    console.error(err)
    commentDetail.value.loading = 'error'
  }
}

/* ---------------- 跳转 ---------------- */
function handleToCate(category: { metadata: { name: string }, spec: { displayName: string } }) {
  uni.navigateTo({
    url: `/pages-blog/category-articles/category-articles?name=${category.metadata.name}&title=${category.spec.displayName}`,
  })
}

function handleToTag(tag: { metadata: { name: string }, spec: { displayName: string } }) {
  uni.navigateTo({
    url: `/pages-blog/tag-articles/tag-articles?name=${tag.metadata.name}&title=${tag.spec.displayName}`,
  })
}

/* ---------------- 格式化 ---------------- */
function formatPublishTime(time?: string): string {
  // yyyy年MM月dd日 星期w
  return time ? formatTime({ d: time, f: 'yyyy年MM月dd日 星期w' }) : ''
}

/* ---------------- 生命周期 ---------------- */
onLoad((options) => {
  uni.setNavigationBarTitle({ title: '笔记加载中...' })
  queryName.value = options?.name || ''
  handleGetData()
})

onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})

onPullDownRefresh(() => {
  handleGetData()
})

onShareAppMessage(() => {
  const cover = result.value?.spec.cover ? checkImageUrl(result.value.spec.cover) : ''
  return {
    path: `/pages-blog/article-detail/article-detail?name=${result.value?.metadata.name}`,
    title: result.value?.spec.title || '',
    imageUrl: cover,
  }
})

onShareTimeline(() => {
  const cover = result.value?.spec.cover ? checkImageUrl(result.value.spec.cover) : ''
  return {
    title: result.value?.spec.title || '',
    query: result.value ? `name=${result.value.metadata.name}` : '',
    imageUrl: cover,
  }
})
</script>

<template>
  <view class="box-border min-h-screen w-screen flex flex-col bg-page pb-safe">
    <!-- 顶部导航 -->
    <uh-navbar
      :scroll-y="scrollY" :default-title="pageTitle" :need-placeholder="false"
      :scroll-title="result?.spec?.title"
    />

    <uh-data-loading
      v-if="loadingStatus !== 'success'" :loading-status="loadingStatus"
      @refresh="handleGetData()"
    />

    <view v-else class="box-border pb-4 pt-72">
      <!-- 顶部背景封面区域 -->
      <view class="fixed left-0 top-0 h-72 w-full">
        <wd-img v-if="result?.spec.cover" :src="result.spec.cover" class="h-full w-full" mode="aspectFill">
          <template #loading>
            <wd-loading size="64rpx" custom-class="text-primary" />
          </template>
        </wd-img>
        <view class="absolute bottom-0 left-0 h-[140rpx] w-full from-white/0 to-page bg-gradient-to-b" />
      </view>

      <view
        class="uh-global-card-glass uh-content-lift box-border overflow-hidden border rounded-lt-3xl rounded-rt-3xl border-b-none"
        :style="{ boxShadow: '0 -16rpx 12rpx rgba(0, 0, 0, 0.035)' }"
      >
        <!-- 顶部信息 -->
        <view class="box-border flex flex-col gap-3 p-3 pb-2">
          <view class="flex items-center gap-x-2">
            <wd-avatar
              :src="checkAvatarUrl(result.owner.avatar)"
              :text="getAvatarFallbackText(result?.owner?.displayName || result?.owner?.metadata?.name)"
              :shape="avatarShape"
              custom-class="uh-global-card-glass !block !h-6 !w-6 !text-[12px] !leading-none !text-gray-900"
              :class="avatarClass"
              mode="aspectFill"
            />
            <text class="text-sm text-gray-600">{{ result?.owner?.displayName }}</text>
          </view>
          <view class="font-semibold">
            {{ result?.spec.title }}
          </view>
          <view
            v-if="result?.categories.length !== 0 || result?.tags.length !== 0"
            class="flex flex-wrap items-center gap-2 text-xs"
          >
            <text
              v-for="(item, index) in result?.categories" :key="index"
              class="uh-global-card-glass uh-shadow-xs border rounded-full px-2 py-1"
              @click="handleToCate(item)"
            >
              {{ item.spec.displayName }}
            </text>
            <text
              v-for="(item, index) in result?.tags" :key="index"
              class="uh-global-card-glass uh-shadow-xs border rounded-full px-2 py-1"
              @click="handleToTag(item)"
            >
              #{{ item.spec.displayName }}
            </text>
          </view>

          <view class="uh-global-card-glass uh-shadow-xs box-border flex flex-col gap-3 rounded-xl p-3">
            <view class="flex flex-1 items-center gap-x-2 text-gray-500">
              <text class="text-xs">日期</text>
              <text class="text-xs text-gray-900">{{ formatPublishTime(result?.spec.publishTime) }}</text>
            </view>
            <view class="flex items-center">
              <view class="flex flex-1 items-center gap-x-2 text-gray-500">
                <text class="text-xs">阅读</text>
                <text class="text-xs text-gray-900">{{ result?.stats?.visit ?? 0 }}</text>
              </view>
              <view class="flex flex-1 items-center gap-x-2 text-gray-500">
                <text class="text-xs">喜欢</text>
                <text class="text-xs text-gray-900">{{ result?.stats?.upvote ?? 0 }}</text>
              </view>
              <view
                v-if="calcEnableComment" class="flex flex-1 items-center gap-x-2 text-gray-500"
                @click="handleToComment()"
              >
                <text class="text-xs">评论</text>
                <text class="text-xs text-gray-900">{{ result?.stats?.comment ?? 0 }}</text>
              </view>
              <view class="flex flex-1 items-center gap-x-2 text-gray-500">
                <text class="text-xs">字数</text>
                <text class="text-xs text-gray-900">{{ result?.content?.raw.length || 0 }}</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 内容区域 -->
        <view class="box-border flex flex-col gap-y-4 p-3 pt-2">
          <view class="uh-global-card-glass uh-shadow-xs box-border rounded-xl p-3 text-3xs text-gray-900 leading-6 !bg-white/10">
            <mp-html
              :content="result?.content?.raw"
              lazy-load :domain="markdownConfig.domain"
              :loading-img="markdownConfig.loadingGif" scroll-table selectable
              :tag-style="markdownConfig.tagStyle" :container-style="markdownConfig.containStyle"
              :markdown="true" :show-line-number="true"
              :show-language-name="true" copy-by-long-press
            />
          </view>
        </view>

        <!-- 相关投票(容器内置插件检查/展开收起,无数据或插件未激活自动不渲染) -->
        <uh-article-vote :vote-ids="result?._voteIds || []" />

        <view class="box-border px-3">
          <!-- 版权声明 -->
          <view v-if="postDetailPageConfig?.copyrightEnabled" class="mb-3 box-border">
            <view class="uh-global-card-glass uh-shadow-xs rounded-xl p-3">
              <uh-section-title>版权声明</uh-section-title>
              <view class="mt-3 flex flex-col gap-y-2 text-3xs text-gray-600">
                <view v-if="postDetailPageConfig.copyrightAuthor" class="leading-5">
                  版权归属：{{ postDetailPageConfig.copyrightAuthor }}
                </view>
                <view v-if="postDetailPageConfig.copyrightDesc" class="leading-5">
                  版权说明：{{ postDetailPageConfig.copyrightDesc }}
                </view>
                <view v-if="postDetailPageConfig.copyrightViolation" class="text-red-400 leading-5">
                  侵权处理：{{ postDetailPageConfig.copyrightViolation }}
                </view>
              </view>
            </view>
          </view>

          <!-- 评论区域 -->
          <view id="comment-section" class="box-border">
            <uh-comment-list
              v-if="calcIsShowComment && result" :allow-comment="calcEnableComment"
              :post-name="result.metadata.name" :post="result" @on-comment="handleOnComment"
              @on-comment-detail="handleOnShowCommentDetail" @on-comment-entry="handleToComment()"
              @on-loaded="handleCommentLoaded"
            />
          </view>
        </view>
      </view>

      <!-- 悬浮操作 -->
      <view class="uh-translate-x-center fixed bottom-0 left-1/2 z-10 flex items-center justify-center pb-safe">
        <view
          class="uh-global-card-glass box-border flex items-center justify-center gap-2 border rounded-full p-1 text-primary"
        >
          <view
            class="uh-global-card-glass box-border h-9 flex flex-1 items-center justify-center gap-x-1 border rounded-full px-5 shadow-none"
            :class="[hasUpvoted() ? 'text-primary' : 'text-gray-900']" @click="handleDoLikesClick"
          >
            <wd-icon class-prefix="uhemoji-icon" name="-kiss-" size="36rpx" />
            <text class="shrink-0 text-xs font-semibold">点赞</text>
          </view>
          <view
            v-if="calcEnableComment"
            class="uh-global-card-glass box-border h-9 flex flex-1 items-center justify-center gap-x-1 border rounded-full px-4 shadow-none"
            @click="handleToComment()"
          >
            <wd-icon class-prefix="uhemoji-icon" name="-thinking" size="36rpx" />
            <text class="shrink-0 text-xs text-gray-900 font-semibold">评论</text>
          </view>
          <view
            class="uh-global-card-glass box-border h-9 flex flex-1 items-center justify-center gap-x-1 border rounded-full px-4 shadow-none"
            @click="handleTogglePostFavorite"
          >
            <wd-icon class-prefix="uhemoji-icon" name="-smile-" size="36rpx" />
            <text
              class="shrink-0 text-xs font-semibold"
              :class="[hasFavorited() ? 'text-primary' : 'text-gray-900']"
            >
              {{ hasFavorited() ? '已收藏' : '收藏' }}
            </text>
          </view>
        </view>
      </view>
    </view>

    <!-- 评论弹窗 -->
    <uh-comment-modal
      v-if="commentModal.show" :show="commentModal.show" :is-comment="commentModal.isComment"
      :title="commentModal.title" :post-name="commentModal.postName" :quote-reply="commentModal.quoteReply"
      @on-close="handleOnCommentModalClose"
    />
  </view>
</template>

<style scoped lang="scss">
.uh-content-lift {
  transform: translateY(-3rem);
}

.uh-translate-x-center {
  transform: translateX(-50%);
}
</style>
