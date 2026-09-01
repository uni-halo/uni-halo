<script lang="ts" setup>
/**
 * 评论列表(源自旧项目 components/comment-list,新建复刻)
 * 支持一级/二级评论展示、刷新、回复入口
 */
import { ref } from 'vue'
import { getPostCommentList } from '@/api/halo'
import type { IComment, ICommentListRes } from '@/api/types/halo'

const props = withDefaults(defineProps<{
  disallowComment?: boolean
  postName: string
  post: { metadata: { name: string } }
}>(), {
  disallowComment: false,
})

const emit = defineEmits<{
  (e: 'on-comment', data: { isComment: boolean, postName: string, title: string }): void
  (e: 'on-comment-detail', data: { postName: string, comment: IComment }): void
  (e: 'on-loaded', list: IComment[]): void
}>()

const loading = ref<'loading' | 'success' | 'error'>('loading')
const queryParams = ref({
  group: 'content.halo.run',
  kind: 'Post',
  version: 'v1alpha1',
  name: props.postName,
  page: 1,
  size: 50,
  withReplies: true,
  replySize: 10,
})
const result = ref<ICommentListRes | null>(null)
const dataList = ref<IComment[]>([])

async function handleGetData() {
  loading.value = 'loading'
  try {
    const res = await getPostCommentList({ ...queryParams.value })
    result.value = res.data
    dataList.value = res.data.items
    loading.value = 'success'
    emit('on-loaded', dataList.value)
  }
  catch (err) {
    console.error('获取评论失败', err)
    loading.value = 'error'
  }
}

function handleToComment(data?: { type: string, comment: IComment }) {
  if (props.disallowComment) {
    uni.showToast({ icon: 'none', title: '文章已禁止评论！' })
    return
  }
  if (data) {
    // 回复某条评论
    emit('on-comment', {
      isComment: false,
      postName: data.comment.metadata.name,
      title: data.comment.spec.owner.displayName,
    })
  }
  else {
    // 新增评论
    emit('on-comment', {
      isComment: true,
      postName: props.post.metadata.name,
      title: '新增评论',
    })
  }
}

function handleCopyContent(content: string) {
  uni.setClipboardData({
    data: content,
    showToast: false,
    success: () => {
      uni.showToast({ icon: 'none', title: '内容已复制成功！' })
    },
  })
}

function handleShowCommentDetail(comment: IComment) {
  emit('on-comment-detail', {
    postName: props.postName,
    comment,
  })
}

handleGetData()
</script>

<template>
  <view class="uh-comment-list">
    <!-- 顶部区域 -->
    <view class="comment-list-head relative box-border pl-6 text-[30rpx] font-bold">
      <view class="title">
        <text>评论列表</text>
        <text class="count text-[28rpx] font-normal">（{{ result?.total || 0 }}条）</text>
      </view>
      <view class="refresh flex items-center gap-1.5 text-[26rpx] text-[#666] font-normal" @click="handleGetData">
        <wd-icon name="refresh" size="14px" color="#909399" />
        <text class="refresh-text ml-1.5">刷新</text>
      </view>
    </view>

    <!-- 内容区域 -->
    <view class="comment-list-content mt-6 pb-9">
      <view v-if="loading !== 'success'" class="loading-wrap h-[506rpx] w-full flex items-center justify-center">
        <view v-if="loading === 'loading'" class="loading flex flex-col items-center justify-center">
          <view class="loading-text text-[26rpx] text-[#999]">
            加载中，请稍等...
          </view>
        </view>
        <view v-else-if="loading === 'error'" class="error flex flex-col items-center">
          <text class="text-grey">加载失败</text>
          <wd-button v-if="!disallowComment" size="small" plain type="primary" class="mt-2" @click="handleGetData">
            刷新试试
          </wd-button>
        </view>
      </view>

      <block v-else>
        <view v-if="disallowComment && dataList.length !== 0" class="disallow-tip rounded-xl bg-[#fef0f0] px-3 py-2 text-[26rpx] text-[#f56c6c]">
          Ծ‸Ծ 博主已设置该文章禁止评论!
        </view>

        <view v-if="dataList.length === 0" class="empty pt-5">
          <view class="empty-box flex flex-col items-center">
            <wd-empty :description="disallowComment ? '暂无评论' : '暂无评论'" />
            <view v-if="disallowComment" class="empty-tip mt-1.5 text-[24rpx] text-[#f56c6c]">
              - 文章已开启禁止评论 -
            </view>
            <wd-button v-else size="small" plain type="primary" class="mt-2" @click="handleToComment()">
              抢沙发
            </wd-button>
          </view>
        </view>

        <block v-else>
          <!-- 一级评论 -->
          <template v-for="comment in dataList" :key="comment.metadata.name">
            <uh-comment-item
              :use-content-bg="false"
              :is-child="false"
              :comment="comment"
              :post-name="postName"
              :disallow-comment="disallowComment"
              @on-copy="handleCopyContent"
              @on-comment="handleToComment"
              @on-detail="handleShowCommentDetail"
            />

            <!-- 二级评论 -->
            <template v-if="comment.replies && comment.replies.items.length !== 0">
              <uh-comment-item
                v-for="childComment in comment.replies.items"
                :key="childComment.metadata.name"
                :use-content-bg="false"
                :is-child="true"
                :comment="childComment"
                :post-name="postName"
                :disallow-comment="disallowComment"
                @on-copy="handleCopyContent"
                @on-comment="handleToComment"
                @on-detail="handleShowCommentDetail"
              />
            </template>
          </template>
        </block>
      </block>
    </view>
  </view>
</template>

<style scoped lang="scss">
.uh-comment-list {
  .comment-list-head {
    display: flex;
    align-items: center;
    justify-content: space-between;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 8rpx;
      width: 8rpx;
      height: 26rpx;
      background-color: rgb(3 174 252);
      border-radius: 6rpx;
    }
  }

  .comment-list-content {
    .loading-wrap {
      .loading-text {
        /* 无额外样式 */
      }
    }
  }
}
</style>
