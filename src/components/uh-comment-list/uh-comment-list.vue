<script lang="ts" setup>
	import { onMounted, onUnmounted, ref } from 'vue'
	import { getPostCommentList } from '@/api/halo'
	import { checkAvatarUrl } from '@/utils/url'
	import type { IComment, ICommentListRes } from '@/api/types/halo'

	const props = withDefaults(defineProps<{
		disallowComment ?: boolean
		postName : string
		post : { metadata : { name : string } }
		/** 评论目标 kind(文章 Post / 瞬间 Moment) */
		kind ?: string
	}>(), {
		disallowComment: false,
		kind: 'Post',
	})

	const emit = defineEmits<{
		(e : 'on-comment', data : { isComment : boolean, postName : string, title : string }) : void
		(e : 'on-comment-detail', data : { postName : string, comment : IComment }) : void
		(e : 'on-loaded', list : IComment[]) : void
	}>()

	const loading = ref<'loading' | 'success' | 'error'>('loading')
	const queryParams = ref({
		group: 'content.halo.run',
		kind: props.kind,
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
			dataList.value = res.data.items.map((item) => {
				// todo：临时
				item.spec.owner.avatar = checkAvatarUrl(item.spec.owner.avatar ?? 'https://api.dicebear.com/10.x/adventurer-neutral/svg')
				return item
			})
			loading.value = 'success'
			emit('on-loaded', dataList.value)
		}
		catch (err) {
			console.error('获取评论失败', err)
			loading.value = 'error'
		}
	}

	function handleToComment(data ?: { type : string, comment : IComment }) {
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

	function handleCopyContent(content : string) {
		uni.setClipboardData({
			data: content,
			showToast: false,
			success: () => {
				uni.showToast({ icon: 'none', title: '内容已复制成功！' })
			},
		})
	}

	function handleShowCommentDetail(comment : IComment) {
		emit('on-comment-detail', {
			postName: props.postName,
			comment,
		})
	}

	/** 外部刷新(评论成功后由宿主调用) */
	function refresh() {
		handleGetData()
	}

	/** 兼容旧广播链路(article-detail 评论成功后 uni.$emit('comment_list_refresh')) */
	onMounted(() => {
		uni.$on('comment_list_refresh', handleGetData)
	})

	onUnmounted(() => {
		uni.$off('comment_list_refresh', handleGetData)
	})

	defineExpose({ refresh })

	handleGetData()
</script>

<template>
	<view class="w-full box-border">
		<view class="uh-global-card-glass box-border uh-shadow-xs rounded-xl p-3">
			<!-- 顶部区域 -->
			<uh-section-title>
				评论列表
				<template #right>
					<view class="flex items-center gap-1.5 text-xs text-gray-500 font-normal" @click="handleGetData">
						<wd-icon name="refresh" size="28rpx" />
						<text class="">刷新</text>
					</view>
				</template>
			</uh-section-title>

			<!-- 内容区域 -->
			<view class="mt-2">
				<view v-if="loading !== 'success'"
					class="loading-wrap h-[506rpx] w-full flex items-center justify-center">
					<view v-if="loading === 'loading'" class="loading flex flex-col items-center justify-center">
						<view class="loading-text text-[26rpx] text-[#999]">
							加载中，请稍等...
						</view>
					</view>
					<view v-else-if="loading === 'error'" class="error flex flex-col items-center">
						<text class="text-grey">加载失败</text>
						<wd-button v-if="!disallowComment" size="small" plain type="primary" class="mt-2"
							@click="handleGetData">
							刷新试试
						</wd-button>
					</view>
				</view>

				<block v-else>
					<view v-if="dataList.length === 0" class=" py-12">
						<view class=" flex flex-col items-center">
							<wd-icon class-prefix="uhemoji-icon" name="-confused" size="100rpx" class="text-primary" />
							<text class="mt-2 text-sm text-gray-500">暂无评论</text>
							<view v-if="disallowComment" class="mt-2 text-xs text-red-400">
								文章已开启禁止评论
							</view>
							<view v-else class="mt-2 bg-primary text-black text-sm px-4 py-1.5 rounded-lg"
								@click="handleToComment()">
								抢沙发
							</view>
						</view>
					</view>

					<block v-else>
						<!-- 一级评论 -->
						<template v-for="comment in dataList" :key="comment.metadata.name">
							<uh-comment-item :use-content-bg="false" :is-child="false" :comment="comment"
								:post-name="postName" :disallow-comment="disallowComment" @on-copy="handleCopyContent"
								@on-comment="handleToComment" @on-detail="handleShowCommentDetail" />

							<!-- 二级评论 -->
							<template v-if="comment.replies && comment.replies.items.length !== 0">
								<uh-comment-item v-for="childComment in comment.replies.items"
									:key="childComment.metadata.name" :use-content-bg="false" :is-child="true"
									:comment="childComment" :post-name="postName" :disallow-comment="disallowComment"
									@on-copy="handleCopyContent" @on-comment="handleToComment"
									@on-detail="handleShowCommentDetail" />
							</template>
						</template>
					</block>
				</block>
			</view>
		</view>
	</view>
</template>