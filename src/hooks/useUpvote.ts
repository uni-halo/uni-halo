/**
 * 点赞交互(笔记详情 / 瞬间详情 / 瞬间列表共用)
 * 已点赞名单本地持久化(刷新/重进后仍防重复);支持单目标(详情页)与多目标(列表页)。
 */
import { ref } from 'vue'
import { submitUpvote } from '@/api/halo'
import { getCache, setCache } from '@/utils/storage'

const UPVOTE_CACHE_KEY = 'uh_upvoted_names'
const UPVOTE_COUNT_KEY = 'uh_upvoted_counts'

function readUpvotedNames(): string[] {
	const list = getCache<string[]>(UPVOTE_CACHE_KEY)
	return Array.isArray(list) ? list : []
}

function readUpvoteCounts(): Record<string, number> {
	const map = getCache<Record<string, number>>(UPVOTE_COUNT_KEY)
	return map && typeof map === 'object' ? map : {}
}

export function useUpvote(plural: 'posts' | 'moments', getName: () => string | undefined) {
	const upvotedNames = ref<string[]>(readUpvotedNames())
	const upvoteCounts = ref<Record<string, number>>(readUpvoteCounts())

	/** 判断是否已点赞(可指定 name;缺省用单目标 getName) */
	function hasUpvoted(name?: string): boolean {
		const n = name ?? getName()
		return !!n && upvotedNames.value.includes(n)
	}

	/** 记录点赞后的计数快照(服务端计数异步落库,刷新拉列表时用它兜底) */
	function recordUpvoteCount(name: string, count: number) {
		upvoteCounts.value[name] = count
		setCache(UPVOTE_COUNT_KEY, upvoteCounts.value)
	}

	/** 展示用点赞数:已点赞时取服务端值与本地快照的较大者 */
	function upvoteDisplay(serverCount: number | undefined, name?: string): number {
		const n = name ?? getName()
		const server = serverCount || 0
		if (!n || !hasUpvoted(n))
			return server
		return Math.max(server, upvoteCounts.value[n] || 0)
	}

	/** 按 name 点赞(列表多目标场景;成功后持久化 + 回调) */
	async function likeByName(name: string, onSuccess?: (name: string) => void) {
		if (!name)
			return
		if (upvotedNames.value.includes(name)) {
			uni.showToast({ icon: 'none', title: '已经点过赞啦!' })
			return
		}
		try {
			await submitUpvote({ group: 'content.halo.run', plural, name })
			uni.showToast({ icon: 'none', title: '点赞成功!' })
			upvotedNames.value.push(name)
			setCache(UPVOTE_CACHE_KEY, upvotedNames.value)
			onSuccess?.(name)
		}
		catch (err) {
			console.error('点赞失败', err)
			uni.showToast({ icon: 'none', title: '点赞失败' })
		}
	}

	/** 点赞当前目标(详情页单目标场景) */
	async function handleDoLikes(onSuccess?: (name: string) => void) {
		const name = getName()
		if (!name)
			return
		await likeByName(name, onSuccess)
	}

	return {
		upvotedNames,
		hasUpvoted,
		upvoteDisplay,
		recordUpvoteCount,
		handleDoLikes,
		likeByName,
	}
}
