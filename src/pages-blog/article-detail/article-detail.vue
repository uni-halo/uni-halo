<script lang="ts" setup>
/**
 * 文章详情页(源自旧项目 pagesA/article-detail/article-detail.vue,新建复刻)
 * 功能:文章头部(标题/作者/封面/统计) + 分类标签 + mp-html 内容渲染 + 受限阅读 + 点赞 + 评论
 * TODO: 投票(article-vote)、豆瓣(article-douban)、分享海报(liu-poster)待阶段2/3 补充
 */
import { computed, ref, watch } from 'vue'
import { onLoad, onPullDownRefresh, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import dayjs from 'dayjs'
import { getPostByName, getPostCommentReplyList, postTrackersCounter, submitUpvote } from '@/api/halo'
import { createVerificationCode, requestRestrictReadCheck } from '@/api/uni-halo'
import { formatTime as formatTimeUtil } from '@/utils/formatTime'
import type { RestrictReadType } from '@/api/types/uni-halo'
import { useAppConfigStore } from '@/store/appConfig'
import { useSettingStore } from '@/store/setting'
import { checkAvatarUrl, checkImageUrl, checkIsUrl } from '@/utils/url'
import { checkPostRestrictRead, copyToClipboard, getRestrictReadTypeName, getShowableContent } from '@/utils/restrictRead'
import { getDomainOnly } from '@/utils/urlParams'
import { markdownConfig } from '@/config/markdown'
import type { IComment, IPost } from '@/api/types/halo'

definePage({
  style: {
    navigationBarTitleText: '内容详情',
    enablePullDownRefresh: true,
  },
})

const appConfigStore = useAppConfigStore()
const settingStore = useSettingStore()

const haloConfigs = computed(() => appConfigStore.configs)

/* ---------------- 状态 ---------------- */
const loading = ref<'loading' | 'success' | 'error'>('loading')
const queryName = ref('')
const result = ref<IPost & {
  _voteIds?: string[]
  _doubanUrls?: string[]
  owner?: { displayName?: string, avatar?: string }
  stats?: { visit?: number, upvote?: number, comment?: number }
} | null>(null)

const showContentArr = ref<string[]>([])
const restrictReadInputCode = ref('')
const commentListScrollTop = ref(0)

const passwordModal = ref({ show: false })
const verificationCodeModal = ref({
  show: false,
  type: '',
  imgUrl: '',
})
const commentModal = ref({
  show: false,
  isComment: false,
  postName: '',
  title: '',
})
const commentDetail = ref({
  show: false,
  loading: 'loading' as 'loading' | 'success' | 'error',
  comment: {} as IComment,
  postName: '',
  list: [] as IComment[],
})

/* ---------------- 计算属性 ---------------- */
const postDetailConfig = computed(() => (haloConfigs.value.basicConfig as { postDetailConfig?: Record<string, unknown> } | undefined)?.postDetailConfig)

const bloggerInfo = computed(() => {
  const blogger = haloConfigs.value.authorConfig?.blogger as { nickname?: string, avatar?: string } | undefined
  return {
    nickname: blogger?.nickname || '',
    avatar: checkAvatarUrl(blogger?.avatar),
  }
})

const calcAuditModeEnabled = computed(() => !!haloConfigs.value.auditConfig?.auditModeEnabled)

const calcIsShowComment = computed(() => !!postDetailConfig.value?.showComment)

const doubanPluginConfig = computed(() => (haloConfigs.value.pluginConfig?.doubanPlugin as { position?: string } | undefined) || {})

/** 原文链接(annotation 配置) */
const originalURL = computed(() => result.value?.metadata.annotations?.unihalo_originalURL || '')

/* ---------------- 工具 ---------------- */
function calcUrl(url: string): string {
  if (checkIsUrl(url))
    return url
  return import.meta.env.VITE_SERVER_BASEURL + url
}

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
  loading.value = 'loading'
  try {
    const res = await getPostByName(queryName.value)
    const tempResult = res.data as typeof result.value
    if (tempResult) {
      tempResult._voteIds = extractVoteBlockIds(res.data.content?.raw || res.data.content?.content || '')
      tempResult._doubanUrls = extractDoubanBlockUrls(res.data.content?.raw || res.data.content?.content || '')

      const openid = uni.getStorageSync('openid')
      if (openid === '' || openid === null) {
        handleGetOpenid()
      }

      // 受限阅读:拆分可展示内容
      if (checkPostRestrictRead(res.data)) {
        showContentArr.value = getShowableContent(res.data)
      }
      else {
        showContentArr.value = []
      }
    }
    result.value = tempResult
    uni.setNavigationBarTitle({ title: '文章详情' })
    loading.value = 'success'
    handleTrackersCounter()
  }
  catch (err) {
    console.error('获取文章失败', err)
    loading.value = 'error'
  }
  finally {
    uni.hideLoading()
    uni.stopPullDownRefresh()
  }
}

/** 访问计数埋点 */
async function handleTrackersCounter() {
  if (!result.value)
    return
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
const upvotedNames = ref<string[]>([])

function hasUpvoted(): boolean {
  return upvotedNames.value.includes(result.value?.metadata.name || '')
}

async function handleDoLikes() {
  if (!result.value)
    return
  if (hasUpvoted()) {
    uni.showToast({ icon: 'none', title: '已经点过赞啦!' })
    return
  }
  try {
    await submitUpvote({
      group: 'content.halo.run',
      plural: 'posts',
      name: result.value.metadata.name,
    })
    uni.showToast({ icon: 'none', title: '点赞成功!' })
    upvotedNames.value.push(result.value.metadata.name)
    if (result.value.stats) {
      result.value.stats.upvote = (result.value.stats.upvote || 0) + 1
    }
  }
  catch (err) {
    console.error('点赞失败', err)
    uni.showToast({ icon: 'none', title: '点赞失败' })
  }
}

/* ---------------- 受限阅读 ---------------- */
function readMore() {
  const annotations = result.value?.metadata?.annotations
  const restrictReadEnable = annotations?.restrictReadEnable
  if (restrictReadEnable === 'password') {
    passwordModal.value.show = true
  }
  else if (restrictReadEnable === 'code') {
    verificationCodeModal.value.show = true
    verificationCodeModal.value.type = 'scan'
    verificationCodeModal.value.imgUrl = checkImageUrl((haloConfigs.value.pluginConfig?.toolsPlugin as { scanCodeUrl?: string } | undefined)?.scanCodeUrl)
  }
  else if (restrictReadEnable === 'comment') {
    handleToComment()
  }
  else if (restrictReadEnable === 'login') {
    uni.showToast({ title: '前往web端登录后访问', icon: 'none' })
  }
  else if (restrictReadEnable === 'pay') {
    uni.showToast({ title: '前往web端支付后访问', icon: 'none' })
  }
  // 两秒后复制原文链接
  setTimeout(() => {
    if (result.value?.status?.permalink) {
      copyToClipboard(import.meta.env.VITE_SERVER_BASEURL + result.value.status.permalink)
    }
  }, 2000)
}

/** 校验密码/验证码 */
async function restrictReadCheck() {
  if (!result.value)
    return
  if (!restrictReadInputCode.value) {
    uni.showToast({ title: '请输入内容', icon: 'none' })
    return
  }
  try {
    const res = await requestRestrictReadCheck(
      (result.value.metadata.annotations?.restrictReadEnable || 'password') as RestrictReadType,
      restrictReadInputCode.value,
      result.value.metadata.name,
    )
    if (res.code === 200) {
      passwordModal.value.show = false
      verificationCodeModal.value.show = false
      handleGetData()
    }
    else {
      uni.showToast({ title: '密码错误', icon: 'none' })
    }
  }
  catch (err) {
    console.error(err)
  }
}

/** 获取验证码(受限阅读 code 模式) */
async function getVerificationCode() {
  uni.showLoading({ title: '正在获取...' })
  try {
    const res = await createVerificationCode()
    if (res.code === 200) {
      verificationCodeModal.value.show = false
      restrictReadInputCode.value = res.data as string || ''
      restrictReadCheck()
    }
    else {
      uni.showToast({ icon: 'none', title: '操作失败，请重试！' })
    }
  }
  catch (err) {
    uni.showToast({ icon: 'none', title: (err as Error).message || '操作失败' })
  }
  finally {
    uni.hideLoading()
  }
}

/* ---------------- 评论 ---------------- */
function handleToComment() {
  if (!result.value)
    return
  if (!calcIsShowComment.value)
    return
  if (!result.value.spec.allowComment) {
    uni.showToast({ icon: 'none', title: '文章已开启禁止评论！' })
    return
  }
  commentModal.value = {
    show: true,
    isComment: true,
    postName: result.value.metadata.name,
    title: '新增评论',
  }
}

function handleOnComment(data: { isComment: boolean, postName: string, title: string }) {
  commentModal.value = {
    show: true,
    isComment: data.isComment,
    postName: data.postName,
    title: data.title,
  }
}

function handleOnCommentModalClose(data: { refresh: boolean, isSubmit: boolean }) {
  if (result.value?.metadata.annotations?.restrictReadEnable === 'comment') {
    handleGetData()
  }
  if (data.refresh && data.isSubmit) {
    // 评论成功后刷新(通过 uni.$emit 广播给 comment-list)
    uni.$emit('comment_list_refresh')
  }
  commentModal.value.show = false
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
    url: `/pages-blog/category-detail/category-detail?name=${category.metadata.name}&title=${category.spec.displayName}`,
  })
}

function handleToTag(tag: { metadata: { name: string }, spec: { displayName: string } }) {
  uni.navigateTo({
    url: `/pages-blog/tag-detail/tag-detail?name=${tag.metadata.name}&title=${tag.spec.displayName}`,
  })
}

function handleToWebview(data: { title: string, url: string }) {
  uni.navigateTo({
    url: `/pages-blog/website/website?data=${JSON.stringify({
      title: data.title,
      url: encodeURIComponent(data.url),
    })}`,
  })
}

function handleToOriginal(originalURLValue: string) {
  handleToWebview({
    title: result.value?.spec.title || '',
    url: originalURLValue,
  })
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

function handlePreview(index: number, list: { url: string }[]) {
  uni.previewImage({
    current: index,
    urls: list.map(item => item.url),
  })
}

/* ---------------- 格式化 ---------------- */
function formatPublishTime(time?: string): string {
  // 与旧项目一致:yyyy年MM月dd日 星期w
  return time ? formatTimeUtil({ d: time, f: 'yyyy年MM月dd日 星期w' }) : ''
}

/* ---------------- 生命周期 ---------------- */
onLoad((options) => {
  uni.setNavigationBarTitle({ title: '文章加载中...' })
  queryName.value = options?.name || ''
  handleGetData()
})

onPullDownRefresh(() => {
  handleGetData()
})

onShareAppMessage(() => {
  const cover = result.value?.spec.cover ? calcUrl(result.value.spec.cover) : ''
  return {
    path: `/pages-blog/article-detail/article-detail?name=${result.value?.metadata.name}`,
    title: result.value?.spec.title || '',
    imageUrl: cover,
  }
})

onShareTimeline(() => {
  const cover = result.value?.spec.cover ? calcUrl(result.value.spec.cover) : ''
  return {
    title: result.value?.spec.title || '',
    query: result.value ? `name=${result.value.metadata.name}` : '',
    imageUrl: cover,
  }
})

watch(haloConfigs, () => {
  // 配置就绪后触发
}, { deep: true })

const globalAppSettings = computed(() => settingStore.settings)
</script>

<template>
  <view class="app-page box-border min-h-screen w-screen flex flex-col pb-[120rpx]" style="background-color: #fafafd;">
    <!-- 骨架屏 -->
    <view v-if="loading !== 'success'" class="loading-wrap bg-white p-3">
      <wd-skeleton :row="4" :animated="true" />
    </view>

    <block v-else>
      <!-- 顶部信息 -->
      <view class="head mx-6 mt-6 flex flex-col items-center rounded-xl bg-white px-6 py-9 shadow-sm">
        <view class="title text-center text-[36rpx] font-semibold">
          {{ result?.spec.title }}
        </view>
        <view class="detail mt-6 w-full text-[26rpx]">
          <view class="author text-center text-[24rpx] text-[#666]">
            <text class="author-name">作者：{{ result?.owner?.displayName || bloggerInfo.nickname }}</text>
            <text class="author-time ml-9">时间：{{ formatPublishTime(result?.spec.publishTime) }}</text>
          </view>

          <view v-if="result?.spec.cover" class="cover mt-6 h-[280rpx] w-full">
            <image
              class="cover-img h-full w-full rounded-xl"
              mode="aspectFill"
              :src="calcUrl(result.spec.cover)"
              @click="handlePreview(0, [{ url: calcUrl(result.spec.cover) }])"
            />
          </view>

          <view class="count mt-6 flex justify-between" :class="{ 'no-thumbnail border-t-2 border-[#f2f2f2] pt-3': !result?.spec.cover }">
            <view class="count-item flex flex-1 items-end justify-center text-[#666]">
              <text class="value text-[32rpx]">{{ result?.stats?.visit ?? 0 }}</text>
              <text class="label pl-2 text-[24rpx]">阅读</text>
            </view>
            <view class="count-item flex flex-1 items-end justify-center text-[#666]">
              <text class="value text-[32rpx]">{{ result?.stats?.upvote ?? 0 }}</text>
              <text class="label pl-2 text-[24rpx]">喜欢</text>
            </view>
            <view v-if="calcIsShowComment" class="count-item flex flex-1 items-end justify-center text-[#666]">
              <text class="value text-[32rpx]">{{ result?.stats?.comment ?? 0 }}</text>
              <text class="label pl-2 text-[24rpx]">评论</text>
            </view>
            <view class="count-item flex flex-1 items-end justify-center text-[#666]">
              <text class="value text-[32rpx]">{{ result?.content?.raw.length || 0 }}</text>
              <text class="label pl-2 text-[24rpx]">字数</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 分类标签 -->
      <view class="category mx-6 mt-6 rounded-xl bg-white p-6 text-[28rpx] shadow-sm">
        <view class="category-type leading-[55rpx]">
          <text class="category-label font-bold">分类：</text>
          <text v-if="!result?.categories?.length" class="category-tag is-empty rounded-md bg-[#607d8b] px-1.5 py-0.5 text-[24rpx] text-white">未选择分类</text>
          <text v-for="(item, index) in result?.categories" v-else :key="index" class="category-tag mr-3 rounded-md bg-[#5bb8fa] px-1.5 py-0.5 text-[24rpx] text-white" @click="handleToCate(item)">
            {{ item.spec.displayName }}
          </text>
        </view>
        <view class="category-type leading-[55rpx]">
          <text class="category-label font-bold">标签：</text>
          <text v-if="!result?.tags?.length" class="category-tag is-empty rounded-md bg-[#607d8b] px-1.5 py-0.5 text-[24rpx] text-white">未选择标签</text>
          <text
            v-for="(item, index) in result?.tags"
            v-else
            :key="index"
            class="category-tag mr-3 rounded-md px-1.5 py-0.5 text-[24rpx] text-white"
            :style="{ backgroundColor: item.spec.color || '#5bb8fa' }"
            @click="handleToTag(item)"
          >
            {{ item.spec.displayName }}
          </text>
        </view>
        <view v-if="originalURL" class="category-type flex leading-[55rpx]">
          <view class="original-url-left w-[84rpx] shrink-0 font-bold">
            原文：
          </view>
          <view class="original-url-right inline-flex flex-1 items-center">
            <text class="original-url-link inline-block w-[410rpx] overflow-hidden text-ellipsis whitespace-nowrap text-[#909399]" @click.stop="handleToOriginal(originalURL)">{{ originalURL }}</text>
            <text class="original-url-btn flex-1 text-right text-[#03a9f4]" @click.stop="handleToOriginal(originalURL)">阅读原文</text>
          </view>
        </view>
      </view>

      <!-- 内容区域 -->
      <view class="content mx-6 mt-6">
        <view class="markdown-wrap overflow-hidden rounded-xl bg-white p-1.5 shadow-sm">
          <!-- 受限阅读 -->
          <template v-if="checkPostRestrictRead(result!)">
            <view v-if="showContentArr.length === 0">
              <uh-restrict-read-skeleton
                :loading="true"
                :lines="3"
                :tip-text="`此处内容已隐藏，「${getRestrictReadTypeName(result!)}可见」`"
                :button-text="getRestrictReadTypeName(result!)"
                button-color="#1890ff"
                @refresh="readMore"
              />
            </view>
            <view v-for="(showContent, showContentIndex) in showContentArr" v-else :key="showContentIndex">
              <mp-html
                class="evan-markdown"
                lazy-load
                :domain="markdownConfig.domain ?? ''"
                :loading-img="markdownConfig.loadingGif"
                scroll-table
                selectable
                :tag-style="markdownConfig.tagStyle"
                :container-style="markdownConfig.containStyle"
                :content="showContent"
                :markdown="true"
                :show-line-number="true"
                :show-language-name="true"
                copy-by-long-press
              />
              <uh-restrict-read-skeleton
                :loading="true"
                :lines="3"
                :tip-text="`此处内容已隐藏，「${getRestrictReadTypeName(result!)}可见」`"
                :button-text="getRestrictReadTypeName(result!)"
                button-color="#1890ff"
                @refresh="readMore"
              />
            </view>
          </template>

          <!-- 正常渲染 -->
          <template v-else>
            <mp-html
              class="evan-markdown"
              lazy-load
              :domain="markdownConfig.domain ?? ''"
              :loading-img="markdownConfig.loadingGif"
              scroll-table
              selectable
              :tag-style="markdownConfig.tagStyle"
              :container-style="markdownConfig.containStyle"
              :content="result?.content?.raw || ''"
              :markdown="true"
              :show-line-number="true"
              :show-language-name="true"
              copy-by-long-press
            />
          </template>
        </view>

        <!-- 版权声明 -->
        <view v-if="postDetailConfig?.copyrightEnabled" class="card-wrap mt-6 rounded-xl bg-white p-6 shadow-sm">
          <view class="card-title relative box-border pl-6 text-[30rpx] font-bold">
            <text class="absolute left-0 top-2 h-[26rpx] w-2 rounded-lg bg-[#03aefc]" />
            版权声明
          </view>
          <view class="copyright-content mt-3 rounded-xl bg-[#fafafa] px-6 py-1.5">
            <view v-if="postDetailConfig.copyrightAuthor" class="copyright-text text-[26rpx] text-[#606266] leading-[1.7]">
              版权归属：{{ postDetailConfig.copyrightAuthor }}
            </view>
            <view v-if="postDetailConfig.copyrightDesc" class="copyright-text text-[26rpx] text-[#606266] leading-[1.7]">
              版权说明：{{ postDetailConfig.copyrightDesc }}
            </view>
            <view v-if="postDetailConfig.copyrightViolation" class="copyright-text text-[26rpx] text-[#f56c6c] leading-[1.7]">
              侵权处理：{{ postDetailConfig.copyrightViolation }}
            </view>
          </view>
        </view>

        <!-- 评论区域 -->
        <view v-if="calcIsShowComment && result" class="card-wrap mt-6 rounded-xl bg-white p-6 shadow-sm">
          <uh-comment-list
            :disallow-comment="!result.spec.allowComment"
            :post-name="result.metadata.name"
            :post="result"
            @on-comment="handleOnComment"
            @on-comment-detail="handleOnShowCommentDetail"
          />
        </view>
      </view>

      <!-- 悬浮操作 -->
      <view class="flot-buttons fixed bottom-[100rpx] right-8 z-999 flex flex-col gap-1.5">
        <view class="fab-btn h-[72rpx] w-[72rpx] flex items-center justify-center rounded-full bg-white shadow-sm" @click="handleToTopPage()">
          <wd-icon name="arrow-up" size="20px" color="#03a9f4" />
        </view>
        <view class="fab-btn h-[72rpx] w-[72rpx] flex items-center justify-center rounded-full bg-white shadow-sm" :class="{ active: hasUpvoted() }" @click="handleDoLikes">
          <wd-icon :name="hasUpvoted() ? 'heart' : 'heart-outline'" size="20px" :color="hasUpvoted() ? '#f44336' : '#03a9f4'" />
        </view>
        <view v-if="calcIsShowComment" class="fab-btn h-[72rpx] w-[72rpx] flex items-center justify-center rounded-full bg-white shadow-sm" @click="handleToComment">
          <wd-icon name="chat" size="20px" color="#4caf50" />
        </view>
      </view>
    </block>

    <!-- 密码弹窗 -->
    <wd-dialog
      v-model="passwordModal.show"
      title="验证提示"
      :show-cancel="true"
      show-confirm-button
      confirm-text="确定"
      @confirm="restrictReadCheck"
    >
      <view class="modal-body py-4">
        <wd-input v-model="restrictReadInputCode" placeholder="请输入密码" />
      </view>
    </wd-dialog>

    <!-- 验证码弹窗 -->
    <wd-dialog
      v-model="verificationCodeModal.show"
      title="验证提示"
      :show-cancel="true"
      confirm-text="确定"
      @confirm="restrictReadCheck"
    >
      <view class="modal-body py-4">
        <image v-if="verificationCodeModal.imgUrl" :src="verificationCodeModal.imgUrl" class="modal-code-img mb-4 h-[200rpx] w-full" mode="aspectFit" />
        <wd-input v-model="restrictReadInputCode" placeholder="请输入验证码" class="mt-2" />
      </view>
    </wd-dialog>

    <!-- 评论弹窗 -->
    <uh-comment-modal
      v-if="commentModal.show"
      :show="commentModal.show"
      :is-comment="commentModal.isComment"
      :title="commentModal.title"
      :post-name="commentModal.postName"
      @on-close="handleOnCommentModalClose"
    />
  </view>
</template>

<style scoped lang="scss">
.app-page {
  display: flex;
  flex-direction: column;
}

.head {
  .detail {
    .author {
      .author-time {
        margin-left: 36rpx;
      }
    }
  }
}

.fab-btn {
  box-shadow: 0 4rpx 16rpx rgb(0 0 0 / 10%);

  &.active {
    background-color: #fef0f0;
  }
}
</style>
