<script lang="ts" setup>
	import { computed, ref, watch } from 'vue'
	import { getVoteDetail, submitVote } from '@/api/uni-halo'
	import { calcVoteState, VOTE_TYPES, voteCacheUtil } from '@/utils/vote'
	import { formatTime as formatTimeUtil } from '@/utils/formatTime'
	import type { IVote, IVoteDetail, IVoteOption } from '@/api/types/uni-halo'

	const props = defineProps<{
		voteId : string
		index ?: number
	}>()

	const loading = ref<'loading' | 'success' | 'error'>('loading')
	const loadingText = ref('加载中，请稍等...')
	const isSubmit = ref(false)
	const voteData = ref<IVote | null>(null)
	const submitForm = ref<{ voteData : string[] }>({ voteData: [] })
	const voteCountMap = ref<Record<string, number>>({})

	const isVoted = computed(() => voteCacheUtil.has(props.voteId))

	const voteState = computed(() => {
		if (!voteData.value?.spec) { return null }
		return calcVoteState(voteData.value)
	})

	const voteTypeLabel = computed(() => {
		const type = voteData.value?.spec?.type
		return type ? VOTE_TYPES[type] || type : ''
	})

	function handleCalcPercent(option : IVoteOption) : number {
		const total = voteData.value?.stats?.voteCount || 0
		const count = voteCountMap.value[option.id || ''] || 0
		if (total === 0) { return 0 }
		return Number(((count / total) * 100).toFixed(2))
	}

	/** 是否展示百分比结果(已投票 或 已结束) */
	const showResult = computed(() => isVoted.value || voteData.value?.spec?.hasEnded || false)

	async function handleGetData() {
		loading.value = 'loading'
		loadingText.value = '加载中，请稍等...'
		try {
			const res = await getVoteDetail(props.voteId)
			const detail = res.data as IVoteDetail
			const vote = detail.vote || (detail as unknown as IVote)
			voteData.value = vote
			submitForm.value.voteData = []
			// 票数映射:详情 voteDataList 优先,其次 stats.voteDataList
			const countList = detail.voteDataList?.length ? detail.voteDataList : vote.stats?.voteDataList
			const map : Record<string, number> = {}
				; (countList || []).forEach((item) => {
					if (item.id)
						map[item.id] = item.voteCount || 0
				})
			voteCountMap.value = map
			loading.value = 'success'
		}
		catch (err) {
			console.error('获取投票失败', err)
			loading.value = 'error'
			loadingText.value = '投票内容加载失败，点击重试'
		}
	}

	function handleSelectSingleOption(option : IVoteOption) {
		const spec = voteData.value?.spec
		if (!spec) { return }
		if (voteState.value?.state === '未开始') {
			showToast('投票未开始')
			return
		}
		if (spec.hasEnded || isVoted.value) { return }
		spec.options?.forEach((item) => {
			item.checked = option.id === item.id
		})
		submitForm.value.voteData = (spec.options || []).filter(x => x.checked).map(item => item.id || '')
	}

	function handleSelectCheckboxOption(option : IVoteOption) {
		const spec = voteData.value?.spec
		if (!spec) { return }
		if (voteState.value?.state === '未开始') {
			showToast('投票未开始')
			return
		}
		if (spec.hasEnded || isVoted.value) { return }

		const checkedList = (spec.options || []).filter(x => x.checked && x.id !== option.id)
		// maxVotes 缺失(0/undefined)时不限制多选数量,避免 0 >= 0 恒真导致无法选择
		const maxVotes = spec.maxVotes
		if (spec.type === 'multiple' && maxVotes && maxVotes > 0 && checkedList.length >= maxVotes) {
			showToast(`最多选择 ${maxVotes} 项`)
			return
		}

		spec.options?.forEach((item) => {
			if (option.id === item.id) {
				item.checked = !item.checked
			}
		})
		submitForm.value.voteData = (spec.options || []).filter(x => x.checked).map(item => item.id || '')
	}

	function handleSubmitTip(text : string) {
		showToast(text)
	}

	async function handleSubmit() {
		const spec = voteData.value?.spec
		if (!spec) { return }
		if (submitForm.value.voteData.length === 0) {
			showToast('请先选择选项')
			return
		}
		if (!spec.canAnonymously) {
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
							success: () => showToast('复制成功'),
						})
					}
				},
			})
			return
		}

		isSubmit.value = true
		uni.showLoading({ title: '正在保存...' })
		try {
			await submitVote(props.voteId, submitForm.value, spec.canAnonymously)
			voteCacheUtil.set(props.voteId, {
				selected: [...submitForm.value.voteData],
				data: voteData.value,
			})
			showToast('提交成功')
			await handleGetData()
		}
		catch (err) {
			console.error('提交投票失败', err)
			showToast('提交失败，请重试')
		}
		finally {
			isSubmit.value = false
			uni.hideLoading()
		}
	}

	/** 跳转投票详情 */
	function handleToVoteDetail() {
		uni.navigateTo({
			url: `/pages-blog/vote-detail/vote-detail?name=${props.voteId}`,
		})
	}

	function showToast(content : string) {
		uni.showToast({ icon: 'none', title: content, mask: true })
	}

	/** 格式化时间 */
	function formatTime(date ?: string, fmt = 'yyyy-MM-dd HH:mm') : string {
		return date ? formatTimeUtil({ d: date, f: fmt }) : ''
	}

	watch(() => props.voteId, () => {
		handleGetData()
	}, { immediate: true })

	defineExpose({ refresh: handleGetData })
</script>

<template>
	<view class="uh-global-card-glass shadow-none border border-primary box-border w-full rounded-lg p-3">
		<view v-if="loading === 'error'" class="vote-error py-6 text-center text-xs text-gray-400"
			@click="handleGetData">
			{{ loadingText }}
		</view>
		<view v-else-if="loading === 'loading'" class="loading py-6">
			<wd-skeleton :row="3" :animated="true" />
		</view>

		<template v-else-if="voteData">
			<view class="vote-card-head">
				<view class="flex items-center justify-between">
					<view class="flex flex-wrap items-center gap-1">
						<text v-if="props.index !== undefined"
							class="rounded-md bg-orange-500 px-2 py-0.5 text-xs text-white">
							{{ props.index + 1 }}
						</text>
						<text v-if="voteTypeLabel" class="rounded-md bg-primary px-2 py-0.5 text-xs text-gray-900">
							{{ voteTypeLabel }}
						</text>
						<text v-if="voteState" class="rounded-md px-2 py-0.5 text-xs"
							:style="{ color: voteState.color, backgroundColor: `${voteState.color}1a` }">
							{{ voteState.state }}
						</text>
					</view>
					<view class="shrink-0 flex items-center justify-center text-xs text-gray-400"
						@click="handleToVoteDetail"> 投票详情 <wd-icon name="right" class="mt-0.5" /> </view>
				</view>
				<view class="title mt-2 text-sm text-gray-900 font-bold">
					{{ voteData.spec?.title }}
				</view>
			</view>

			<view class="vote-card-body mt-2">
				<view v-if="voteData.spec?.remark" class="remark mb-3 text-xs text-gray-400">
					{{ voteData.spec.remark }}
				</view>

				<!-- 单选 -->
				<view v-if="voteData.spec?.type === 'single'" class="flex flex-col gap-2">
					<template v-if="showResult">
						<view v-for="(option, optionIndex) in voteData.spec?.options || []" :key="optionIndex"
							class="is-voted-item relative box-border min-h-[72rpx] overflow-hidden rounded-xl text-[24rpx]"
							:class="option.checked ? 'bg-primary/40 text-[#4d7c0f] font-bold' : 'bg-[#e5e5e5]/75'"
							:style="{ '--percent': `${handleCalcPercent(option)}%` }">
							<view class="is-voted-item-content relative z-2 box-border min-h-[72rpx] px-6 py-3">
								<view class="flex items-center justify-between">
									<view class="flex-1 text-left">
										{{ option.title }}
									</view>
									<view class="shrink-0">
										{{ handleCalcPercent(option) }}%
									</view>
								</view>
							</view>
						</view>
					</template>
					<template v-else>
						<view v-for="(option, optionIndex) in voteData.spec?.options || []" :key="optionIndex"
							class="vote-select-option box-border rounded-xl bg-[#f6f3ee] px-5 py-4 text-[24rpx]"
							:class="option.checked ? 'border-2 border-primary bg-primary/15 text-primary font-bold' : ''"
							@click="handleSelectSingleOption(option)">
							{{ option.title }}
						</view>
					</template>
				</view>

				<!-- 多选 -->
				<view v-else-if="voteData.spec?.type === 'multiple'" class="flex flex-col gap-2">
					<template v-if="showResult">
						<view v-for="(option, optionIndex) in voteData.spec?.options || []" :key="optionIndex"
							class="is-voted-item relative box-border min-h-[72rpx] overflow-hidden rounded-xl text-[24rpx]"
							:class="option.checked ? 'bg-primary/40 text-[#4d7c0f] font-bold' : 'bg-[#e5e5e5]/75'"
							:style="{ '--percent': `${handleCalcPercent(option)}%` }">
							<view class="is-voted-item-content relative z-2 box-border min-h-[72rpx] px-6 py-3">
								<view class="flex items-center justify-between">
									<view class="flex-1 text-left">
										{{ option.title }}
									</view>
									<view class="shrink-0">
										{{ handleCalcPercent(option) }}%
									</view>
								</view>
							</view>
						</view>
					</template>
					<template v-else>
						<view v-for="(option, optionIndex) in voteData.spec?.options || []" :key="optionIndex"
							class="vote-select-option box-border rounded-xl bg-[#f6f3ee] px-5 py-4 text-[24rpx]"
							:class="option.checked ? 'border-2 border-primary bg-primary/15 text-primary font-bold' : ''"
							@click="handleSelectCheckboxOption(option)">
							{{ option.title }}
						</view>
					</template>
				</view>

				<!-- PK -->
				<view v-else-if="voteData.spec?.type === 'pk'" class="flex flex-col gap-2">
					<!-- PK 对抗条 -->
					<view class="pk-container box-border w-full flex">
						<view v-for="(option, optionIndex) in voteData.spec?.options || []" :key="optionIndex"
							class="radio-item" :class="optionIndex === 0 ? 'radio-left' : 'radio-right'"
							:style="{ width: `${handleCalcPercent(option)}%` }">
							<view class="option-item box-border w-full rounded-lg px-3 py-2"
								:class="optionIndex === 0 ? 'option-item-left' : 'option-item-right'">
								{{ handleCalcPercent(option) }}%
							</view>
						</view>
					</view>
					<!-- PK 选项列表 -->
					<template v-if="showResult">
						<view v-for="(option, optionIndex) in voteData.spec?.options || []" :key="optionIndex"
							class="is-voted-item relative box-border  overflow-hidden rounded-lg text-xs"
							:class="option.checked ? 'bg-primary/40 text-[#4d7c0f] font-bold' : 'bg-[#e5e5e5]/75'"
							:style="{ '--percent': `${handleCalcPercent(option)}%` }">
							<view class="is-voted-item-content relative z-2 box-border px-3 py-2">
								<view class="flex items-center justify-between">
									<view class="flex-1 text-left">
										选项{{ optionIndex + 1 }}：{{ option.title }}
									</view>
									<view class="shrink-0">
										{{ handleCalcPercent(option) }}%
									</view>
								</view>
							</view>
						</view>
					</template>
					<template v-else>
						<view v-for="(option, optionIndex) in voteData.spec?.options || []" :key="optionIndex"
							class="vote-select-option box-border rounded-xl bg-[#f6f3ee] px-5 py-4 text-[24rpx]"
							:class="option.checked ? 'border-2 border-primary bg-primary/15 text-primary font-bold' : ''"
							@click="handleSelectSingleOption(option)">
							选项{{ optionIndex + 1 }}：{{ option.title }}
						</view>
					</template>
				</view>
			</view>

			<!-- 底部:时间 + 参与人数/已投票 -->
			<view class="mt-3 flex items-center justify-between pt-2">
				<text v-if="voteData.spec?.timeLimit === 'permanent'" class="text-xs text-gray-400">
					结束：永久有效
				</text>
				<text v-else-if="voteState?.state === '未开始'" class="text-xs text-gray-400">
					开始：{{ formatTime(voteData.spec?.startDate) }}
				</text>
				<text v-else class="text-xs text-gray-400">
					结束：{{ formatTime(voteData.spec?.endDate) }}
				</text>
				<view class="flex items-center gap-2">
					<text class="text-xs text-gray-400">{{ voteData.stats?.voteCount || 0 }} 人已参与</text>
					<text v-if="isVoted" class="rounded bg-primary/15 px-2 py-0.5 text-xs text-primary">已投票</text>
				</view>
			</view>

			<!-- 提交按钮(与旧项目一致:选择后才出现状态机) -->
			<view v-if="submitForm.voteData.length !== 0" class="mt-3">
				<wd-button v-if="isVoted" disabled block>
					您已参与投票
				</wd-button>
				<wd-button v-else-if="voteState?.state === '未开始'" plain block type="warning"
					@click="handleSubmitTip('投票未开始')">
					投票未开始
				</wd-button>
				<wd-button v-else-if="voteState?.state === '已结束'" plain block type="danger"
					@click="handleSubmitTip('投票已结束')">
					投票已结束
				</wd-button>
				<wd-button v-else-if="!voteData.spec?.canAnonymously" plain block type="danger" @click="handleSubmit()">
					不支持匿名投票
				</wd-button>
				<wd-button v-else block type="primary" :loading="isSubmit" :disabled="isSubmit" @click="handleSubmit()">
					提交投票
				</wd-button>
			</view>
		</template>
	</view>
</template>

<style scoped lang="scss">
	.pk-container {
		.radio-item {
			flex-grow: 1;
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
</style>