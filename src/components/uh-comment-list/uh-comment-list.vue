<script lang="ts" setup>
	import { onMounted, onUnmounted, reactive, ref } from 'vue'
	import { getPostCommentList, getPostCommentReplyList } from '@/api/halo'
	import { checkAvatarUrl } from '@/utils/url'
	import type { IComment, ICommentListRes, ICommentReply } from '@/api/types/halo'

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
		(e : 'on-comment', data : { isComment : boolean, postName : string, title : string, quoteReply ?: string }) : void
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
	})
	const result = ref<ICommentListRes | null>(null)
	const dataList = ref<IComment[]>([])

	/** 回复按需加载每页条数(对齐官方 comment-widget replySize 默认 20) */
	const REPLIES_PAGE_SIZE = 20

	interface IRepliesState {
		list : ICommentReply[]
		total : number
		page : number
		hasNext : boolean
		status : 'loading' | 'success' | 'error'
	}

	/** 已展开的评论 name 集合 */
	const expanded = reactive(new Set<string>())
	/** 各评论已加载回复(展开后缓存,收起再展开不重拉) */
	const repliesMap = reactive(new Map<string, IRepliesState>())

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
			// 列表刷新后清空展开缓存,保证回复区展示最新数据
			expanded.clear()
			repliesMap.clear()
			loading.value = 'success'
			emit('on-loaded', dataList.value)
		}
		catch (err) {
			console.error('获取评论失败', err)
			loading.value = 'error'
		}
	}

	/** 回复数(优先可见数,兜底总回复数/内嵌 total) */
	function getReplyCount(comment : IComment) : number {
		return comment.status?.visibleReplyCount ?? comment.status?.replyCount ?? comment.replies?.total ?? 0
	}

	function getRepliesState(comment : IComment) : IRepliesState | undefined {
		return repliesMap.get(comment.metadata.name)
	}

	/** 展开/收起某条评论的回复(首次展开时按需拉取) */
	function toggleReplies(comment : IComment) {
		const name = comment.metadata.name
		if (expanded.has(name)) {
			expanded.delete(name)
			return
		}
		expanded.add(name)
		if (!repliesMap.has(name)) {
			loadReplies(comment)
		}
	}

	/** 首次展开:拉取第一页回复 */
	async function loadReplies(comment : IComment) {
		const name = comment.metadata.name
		if (!repliesMap.has(name)) {
			repliesMap.set(name, { list: [], total: 0, page: 0, hasNext: false, status: 'loading' })
		}
		const state = repliesMap.get(name)!
		state.status = 'loading'
		try {
			const res = await getPostCommentReplyList(name, { page: 1, size: REPLIES_PAGE_SIZE })
			const data = res.data
			state.list = data.items
			state.total = data.total
			state.page = data.page
			state.hasNext = data.hasNext
			state.status = 'success'
		}
		catch (err) {
			console.error('获取回复失败', err)
			state.status = 'error'
		}
	}

	/** 加载更多回复(追加下一页) */
	async function loadMoreReplies(comment : IComment) {
		const state = repliesMap.get(comment.metadata.name)
		if (!state || state.status === 'loading')
			return
		state.status = 'loading'
		try {
			const res = await getPostCommentReplyList(comment.metadata.name, { page: state.page + 1, size: REPLIES_PAGE_SIZE })
			const data = res.data
			state.list = state.list.concat(data.items)
			state.page = data.page
			state.hasNext = data.hasNext
			state.status = 'success'
		}
		catch (err) {
			console.error('加载更多回复失败', err)
			state.status = 'error'
		}
	}

	/** 已加载回复的 name -> displayName 映射(供「回复 @xxx」引用标识查询) */
	function buildQuoteReplyMap(comment : IComment) : Record<string, string> {
		const state = repliesMap.get(comment.metadata.name)
		if (!state)
			return {}
		const map : Record<string, string> = {}
		state.list.forEach((reply) => {
			map[reply.metadata.name] = reply.spec.owner.displayName
		})
		return map
	}

	/** 回复/新增评论(data 有值=回复某条评论;parentComment=所属一级评论,回复接口需要其 name) */
	function handleToComment(data ?: { type : string, comment : ICommentReply }, parentComment ?: IComment) {
		if (props.disallowComment) {
			uni.showToast({ icon: 'none', title: '文章已禁止评论！' })
			return
		}
		if (data && parentComment) {
			// 回复:postName 必须是一级评论(Comment)的 name;回复二级评论时带 quoteReply 引用其 name
			const isQuote = data.comment.metadata.name !== parentComment.metadata.name
			emit('on-comment', {
				isComment: false,
				postName: parentComment.metadata.name,
				title: data.comment.spec.owner.displayName,
				quoteReply: isQuote ? data.comment.metadata.name : undefined,
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
						<!-- 一级评论 + 按需展开的回复区 -->
						<template v-for="comment in dataList" :key="comment.metadata.name">
							<uh-comment-item :use-content-bg="false" :is-child="false" :comment="comment"
								:post-name="postName" :disallow-comment="disallowComment" @on-copy="handleCopyContent"
								@on-comment="(d) => handleToComment(d, comment)" @on-detail="handleShowCommentDetail" />

							<!-- 回复展开区(默认收起,抖音式) -->
							<view v-if="getReplyCount(comment) > 0">
								<!-- 未展开:仅显示回复数 -->
								<view v-if="!expanded.has(comment.metadata.name)"
									class="mt-2 ml-10 inline-flex items-center rounded-lg bg-gray-100 px-3 py-1 text-xs text-gray-500"
									@click="toggleReplies(comment)">
									共 {{ getReplyCount(comment) }} 条回复
								</view>

								<!-- 已展开:回复列表 -->
								<block v-else>
									<view v-if="getRepliesState(comment)?.status === 'error'"
										class="mt-2 ml-10 text-xs text-red-400" @click="loadReplies(comment)">
										回复加载失败,点击重试
									</view>
									<view v-else-if="getRepliesState(comment)?.status === 'loading' && getRepliesState(comment)?.list.length === 0"
										class="mt-2 ml-10 text-xs text-gray-400">
										回复加载中...
									</view>
									<template v-else>
										<uh-comment-item v-for="childComment in getRepliesState(comment)?.list"
											:key="childComment.metadata.name" :use-content-bg="false" :is-child="true"
											:comment="childComment" :post-name="postName"
											:disallow-comment="disallowComment"
											:quote-reply-map="buildQuoteReplyMap(comment)"
											@on-copy="handleCopyContent" @on-comment="(d) => handleToComment(d, comment)"
											@on-detail="handleShowCommentDetail" />

										<!-- 加载更多(响应 hasNext) -->
										<view v-if="getRepliesState(comment)?.hasNext"
											class="mt-2 flex items-center justify-center">
											<text class="text-xs text-gray-400" @click="loadMoreReplies(comment)">
												{{ getRepliesState(comment)?.status === 'loading' ? '加载中...' : '加载更多回复' }}
											</text>
										</view>
									</template>

									<!-- 收起 -->
									<view class="mt-2 ml-10 text-xs text-gray-400" @click="toggleReplies(comment)">
										收起回复
									</view>
								</block>
							</view>
						</template>
					</block>
				</block>
			</view>
		</view>
	</view>
</template>
