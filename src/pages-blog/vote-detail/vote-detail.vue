<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad, onPullDownRefresh, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
	import { getVoteDetail, submitVote } from '@/api/uni-halo'
	import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
	import { calcVotePercent, calcVoteState, VOTE_TYPES, voteCacheUtil } from '@/utils/vote'
	import { formatTime as formatTimeUtil } from '@/utils/formatTime'
	import type { IVote, IVoteDetail, IVoteOption } from '@/api/types/uni-halo'

	definePage({
		style: {
			navigationBarTitleText: '投票详情',
			enablePullDownRefresh: true,
			navigationStyle: 'custom',
		},
	})

	/* ---------------- 状态 ---------------- */
	const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()
	const submitLoading = ref(false)
	const pageTitle = ref('加载中...')
	const safeAreaBottom = ref(24)
	const name = ref('')
	const detail = ref<unknown>(null)
	const vote = ref<(IVote & {
		spec ?: {
			title ?: string
			remark ?: string
			type ?: string
			maxVotes ?: number
			startDate ?: string
			endDate ?: string
			timeLimit ?: string
			canAnonymously ?: boolean
			options ?: (IVoteOption & {
				id ?: string
				title ?: string
				count ?: number
				checked ?: boolean
				isVoted ?: boolean
				disabled ?: boolean
				_uh_percent ?: number
			})[]
			isVoted ?: boolean
			hasEnded ?: boolean
			disabled ?: boolean
			_uh_type ?: string
			_uh_state ?: { state : string, color : string }
		}
		stats ?: { voteCount ?: number }
	}) | null>(null)
	const submitForm = ref<{ voteData : string[] }>({ voteData: [] })

	/* ---------------- 计算属性 ---------------- */
	const isVoted = computed(() => voteCacheUtil.has(name.value))
	const isEnded = computed(() => vote.value?.spec?.hasEnded || false)

	/* ---------------- 工具 ---------------- */
	function formatTime(date ?: string, fmt = 'yyyy-MM-dd HH:mm') : string {
		// 与旧项目一致:yyyy-MM-dd HH:mm
		return date ? formatTimeUtil({ d: date, f: fmt }) : ''
	}

	function showToast(content : string) {
		uni.showToast({ icon: 'none', title: content, mask: true })
	}

	function handleCalcIsChecked(option : { id ?: string }) : boolean {
		const data = voteCacheUtil.get(name.value)
		if (!data)
			return false
		return data.selected.includes(option.id || '')
	}

	/* ---------------- 数据加载 ---------------- */
	async function handleGetData() {
		updateLoadingStatus(DataLoadingStatusEnum.Loading)
		pageTitle.value = '加载中...'
		try {
			const res = await getVoteDetail(name.value)
			const detailRes = res.data as IVoteDetail
			const tempVote = detailRes.vote as typeof vote.value
			if (tempVote) {
				const typeKey = ((tempVote.spec?.type || 'single') as string).toLowerCase()
				pageTitle.value = `投票详情（${VOTE_TYPES[typeKey] || tempVote.spec?.type}）`
				tempVote.spec = tempVote.spec || {}
				tempVote.spec.isVoted = isVoted.value
				tempVote.spec.disabled = isVoted.value
				tempVote.spec._uh_type = VOTE_TYPES[typeKey] || tempVote.spec.type

				// 计算状态(与旧项目 calcVoteState 一致,含 timeLimit 非 custom 时 hasEnded 兜底)
				tempVote.spec._uh_state = calcVoteState(tempVote)
				if (tempVote.spec._uh_state.state === '已结束')
					tempVote.spec.hasEnded = true

				// 选项计算
				// 插件选项为 {id,title},票数在 VoteDetail.voteDataList / Vote.stats.voteDataList
				const countList = (detailRes.voteDataList || tempVote.stats?.voteDataList || []) as { id ?: string, voteCount ?: number }[]
				const countMap : Record<string, number> = {}
				countList.forEach((item) => {
					if (item.id)
						countMap[item.id] = item.voteCount || 0
				})
				tempVote.spec.options = (tempVote.spec.options || []).map((option) => {
					const checked = handleCalcIsChecked(option)
					const optionWithCount = {
						...option,
						value: option.id,
						label: option.title,
						count: countMap[option.id || ''] || 0,
						isVoted: isVoted.value,
						checked,
						disabled: isVoted.value,
					}
					return {
						...optionWithCount,
						_uh_percent: calcVotePercent(tempVote, optionWithCount),
					}
				})
			}
			vote.value = tempVote
			detail.value = res
			setTimeout(() => {
				updateLoadingStatus(
					tempVote ? DataLoadingStatusEnum.Success : DataLoadingStatusEnum.Empty,
				)
			}, 200)
		}
		catch (err) {
			console.error(err)
			updateLoadingStatus(DataLoadingStatusEnum.Error)
			pageTitle.value = '加载失败，请重试...'
		}
		finally {
			setTimeout(() => {
				uni.hideLoading()
				uni.stopPullDownRefresh()
			}, 200)
		}
	}

	/* ---------------- 交互 ---------------- */
	function handleSelectSingleOption(option : { id ?: string }) {
		if (vote.value?.spec?._uh_state?.state === '未开始') {
			showToast('投票未开始')
			return
		}
		if (vote.value?.spec?.hasEnded)
			return
		if (vote.value?.spec?.disabled)
			return
		vote.value!.spec!.options!.forEach((item) => {
			item.checked = option.id === item.id
		})
		submitForm.value.voteData = vote.value!.spec!.options!.filter(x => x.checked).map(item => item.id || '')
	}

	function handleSelectCheckboxOption(option : { id ?: string }) {
		if (vote.value?.spec?._uh_state?.state === '未开始') {
			showToast('投票未开始')
			return
		}
		if (vote.value?.spec?.hasEnded)
			return
		if (vote.value?.spec?.disabled)
			return

		const checkedList = vote.value!.spec!.options!.filter(x => x.checked && x.id !== option.id)
		if (vote.value?.spec?.type === 'multiple' && checkedList.length >= (vote.value.spec.maxVotes || 0)) {
			showToast(`最多选择 ${vote.value.spec.maxVotes} 项`)
			return
		}

		vote.value!.spec!.options!.forEach((item) => {
			if (option.id === item.id) {
				item.checked = !item.checked
			}
		})
		submitForm.value.voteData = vote.value!.spec!.options!.filter(x => x.checked).map(item => item.id || '')
	}

	function handleSubmitTip(text : string) {
		showToast(text)
	}

	async function handleSubmit() {
		if (!vote.value?.spec?.canAnonymously) {
			uni.showModal({
				title: '提示',
				content: '该投票不支持匿名，请到博主的 网站端 进行投票！',
				cancelColor: '#666666',
				cancelText: '关闭',
				confirmText: '复制地址',
				success: (res) => {
					if (res.confirm) {
						uni.setClipboardData({
							data: import.meta.env.VITE_SERVER_BASEURL || '',
							showToast: false,
							success: () => {
								showToast('复制成功')
							},
						})
					}
				},
			})
			return
		}

		submitLoading.value = true
		uni.showLoading({ title: '正在保存...' })
		try {
			await submitVote(name.value, submitForm.value, vote.value.spec.canAnonymously)
			showToast('提交成功')
			voteCacheUtil.set(name.value, {
				selected: [...submitForm.value.voteData],
				data: vote.value,
			})
			setTimeout(() => {
				uni.startPullDownRefresh()
				submitLoading.value = false
			}, 1500)
		}
		catch (err) {
			console.error(err)
			showToast('提交失败，请重试')
			submitLoading.value = false
		}
		finally {
			uni.hideLoading()
		}
	}

	/* ---------------- 生命周期 ---------------- */
	onLoad((options) => {
		name.value = options?.name || ''
		// #ifndef H5
		const systemInfo = uni.getSystemInfoSync()
		safeAreaBottom.value = systemInfo.safeAreaInsets?.bottom ? systemInfo.safeAreaInsets.bottom + 12 : 24
		// #endif
		handleGetData()
	})

	onPullDownRefresh(() => {
		handleGetData()
	})

	onShareAppMessage(() => ({
		path: `/pages-blog/vote-detail/vote-detail?name=${name.value}`,
		title: vote.value?.spec?.title || '来投个票吧',
		imageUrl: '',
	}))

	onShareTimeline(() => ({
		title: vote.value?.spec?.title || '来投个票吧',
		query: name.value ? `name=${name.value}` : '',
		imageUrl: '',
	}))
</script>

<template>
	<view class="box-border min-h-screen w-screen flex flex-col bg-page pb-safe">
		<!-- 自定义导航 -->
		<uh-navbar :default-title="pageTitle" title-color="text-gray-900" />

		<!-- 加载/错误/空占位(状态机) -->
		<uh-data-loading v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus"
			empty-text="未查询到数据" @refresh="handleGetData" />

		<view v-else class="box-border px-3 pt-2 pb-16 flex flex-col gap-y-3">
			<!-- 投票信息 -->
			<view class="uh-global-card-glass box-border flex flex-col gap-y-3 rounded-2xl p-3">
				<uh-section-title> 投票信息 </uh-section-title>
				<view class="flex flex-col gap-3 rounded-xl bg-gray-100 p-4 text-sm text-gray-600">
					<view class="info-row">
						<text>投票类型：</text>
						<text class="tag">{{ vote.spec?._uh_type }}</text>
					</view>
					<view class="info-row">
						<text>投票状态：</text>
						<text class="tag"
							:style="{ color: vote.spec?._uh_state?.color }">{{ vote.spec?._uh_state?.state }}</text>
					</view>
					<view class="info-row">
						<text>投票方式：</text>
						<text class="tag" :class="vote.spec?.canAnonymously ? 'text-primary' : 'text-[#f44336]'">
							{{ vote.spec?.canAnonymously ? '匿名' : '不匿名' }}
						</text>
					</view>
					<view class="info-row">
						<text>开始时间：{{ formatTime(vote.spec?.startDate) }}</text>
					</view>
					<view class="info-row">
						<text v-if="vote.spec?.timeLimit === 'permanent'">结束时间：永久有效</text>
						<text v-else>结束时间：{{ formatTime(vote.spec?.endDate) }}</text>
					</view>
				</view>
			</view>

			<!-- 投票内容 -->
			<view class="uh-global-card-glass box-border flex flex-col rounded-2xl p-3 gap-3">
				<uh-section-title> 投票内容 </uh-section-title>
				<view class="box-border flex flex-col gap-y-2 p-4 rounded-xl bg-gray-100">
					<view class="text-sm text-gray-900 font-bold">
						{{ vote.spec?.title }}
					</view>
					<view v-if="vote.spec?.remark" class="text-xs text-gray-500">
						{{ vote.spec.remark }}
					</view>
				</view>
				<view class="w-full flex flex-col gap-y-2">
					<view class="relative box-border text-sm flex items-center gap-x-2">
						投票选项
						<text v-if="vote.spec?.type === 'multiple'"
							class="text-xs font-normal">（最多选择
							{{ vote.spec?.maxVotes }} 项）
						</text>
					</view>
					<view class="options flex flex-col gap-3">
						<!-- PK 对抗条(与旧项目 pk-container 一致) -->
						<view v-if="vote.spec?.type === 'pk'" class="pk-container box-border flex w-full">
							<view v-for="(option, optionIndex) in vote.spec?.options" :key="optionIndex"
								class="radio-item flex-grow" :class="optionIndex === 0 ? 'radio-left' : 'radio-right'"
								:style="{ width: `${option._uh_percent}%` }">
								<view class="option-item box-border w-full rounded-xl py-3 px-3"
									:class="optionIndex === 0 ? 'option-item-left' : 'option-item-right'">
									{{ option._uh_percent }}%
								</view>
							</view>
						</view>

						<template v-if="isVoted || isEnded">
							<view v-for="(option, optionIndex) in vote.spec?.options" :key="optionIndex"
								class="is-voted-item relative box-border overflow-hidden rounded-xl text-xs"
								:class="option.checked ? 'bg-primary text-gray-900 font-bold' : 'bg-gray-100'"
								:style="{ '--percent': `${option._uh_percent}%` }">
								<view class="is-voted-item-content relative z-2 box-border px-4 py-3">
									<view class="flex items-center justify-between">
										<view class="flex-1 text-left">
											{{ vote.spec?.type === 'pk' ? `选项${optionIndex + 1}：` : '' }}{{ option.title }}
										</view>
										<view class="shrink-0">
											{{ option._uh_percent }}%
										</view>
									</view>
								</view>
							</view>
						</template>
						<template v-else>
							<view v-for="(option, optionIndex) in vote.spec?.options" :key="optionIndex"
								class="vote-select-option box-border rounded-xl bg-gray-100 px-6 py-5 text-xs"
								:class="option.checked ? 'border-2 border-primary bg-primary/15 text-primary font-bold' : ''"
								@click="vote.spec?.type === 'multiple' ? handleSelectCheckboxOption(option) : handleSelectSingleOption(option)">
								{{ vote.spec?.type === 'pk' ? `选项${optionIndex + 1}：` : '' }}{{ option.title }}
							</view>
						</template>
					</view>
				</view>
			</view>

			<!-- 投票统计 -->
			<view class="uh-global-card-glass box-border flex flex-col rounded-2xl p-3">
				<uh-section-title> 投票统计 </uh-section-title>
				<view class="stat-text mt-3 text-xs text-gray-600">
					{{ vote.stats?.voteCount || 0 }} 人已参与
				</view>
			</view>

			<!-- 提交按钮 -->
			<view class="fixed bottom-0 left-0 z-99 box-border w-screen pb-safe px-3">
				<view
					class="uh-global-card-glass border rounded-xl w-full flex items-center justify-center gap-x-2 mb-2">
					<uh-button v-if="isVoted" custom-class="flex-1 py-2 !rounded-xl">
						您已参与投票
					</uh-button>
					<uh-button v-else-if="vote.spec?._uh_state?.state === '未开始'" custom-class="flex-1 py-2 !rounded-xl"
						@click="handleSubmitTip('投票未开始')">
						投票未开始
					</uh-button>
					<uh-button v-else-if="vote.spec?._uh_state?.state === '已结束'" custom-class="flex-1 py-2 !rounded-xl"
						@click="handleSubmitTip('投票已结束')">
						投票已结束
					</uh-button>
					<uh-button v-else-if="!vote.spec?.canAnonymously" custom-class="flex-1 py-2 !rounded-xl"
						@click="handleSubmit()">
						不支持匿名投票
					</uh-button>
					<uh-button v-else-if="submitForm.voteData.length === 0" custom-class="flex-1 py-2 !rounded-xl"
						@click="handleSubmitTip('请选择选项')">
						提交投票（请选择选项）
					</uh-button>
					<uh-button v-else custom-class="flex-1 py-2 !rounded-xl" @click="handleSubmit()">
						提交投票
					</uh-button>
				</view>
			</view>
		</view>
	</view>
</template>

<style scoped lang="scss">
	.vote-card {
		.sub-title {
			&::before {
				content: '';
				width: 8rpx;
				height: 28rpx;
				position: absolute;
				left: 0;
				top: 6rpx;
				background: var(--wot-color-theme, #b9e424);
				border-radius: 6rpx;
			}
		}

		.is-voted-item {
			&::before {
				content: '';
				width: var(--percent);
				position: absolute;
				left: 0;
				top: 0;
				bottom: 0;
				background-color: #d0d0d0;
				z-index: 0;
				border-radius: 6rpx;
			}
		}

		.pk-container {
			.radio-item {
				min-width: 30%;
				max-width: 70%;
			}

			.option-item-left {
				background: linear-gradient(90deg, #3b82f6, #60a5fa);
				color: white;
				clip-path: polygon(0 0, calc(100% - 40rpx) 0, 100% 100%, 0 100%);
			}

			.option-item-right {
				background: linear-gradient(90deg, #f87171, #ef4444);
				color: white;
				clip-path: polygon(0 0, 100% 0, 100% 100%, 40rpx 100%);
				text-align: right;
			}
		}
	}
</style>