<script lang="ts" setup>
	import { computed } from 'vue'
	import dayjs from 'dayjs'
	import relativeTime from 'dayjs/plugin/relativeTime'
	import { checkAvatarUrl } from '@/utils/url'
	import { useSettingStore } from '@/store/setting'
	import type { IComment } from '@/api/types/halo'

	const props = withDefaults(defineProps<{
		comment : IComment
		isChild ?: boolean
		useActions ?: boolean
		useSolid ?: boolean
		useContentBg ?: boolean
		disallowComment ?: boolean
		postName ?: string
		classItem ?: string[]
	}>(), {
		isChild: false,
		useActions: true,
		useSolid: true,
		useContentBg: true,
		disallowComment: false,
		postName: '',
		classItem: () => [],
	})
	const emit = defineEmits<{
		(e : 'on-comment', data : { type : string, comment : IComment }) : void
		(e : 'on-copy', raw : string) : void
		(e : 'on-detail', comment : IComment) : void
	}>()
	dayjs.extend(relativeTime)
	dayjs.locale('zh-cn')

	const settingStore = useSettingStore()
	const globalAppSettings = computed(() => settingStore.settings)

	const avatar = computed(() => checkAvatarUrl(props.comment.spec.owner.avatar))

	/** 评论时间 */
	const createTimeText = computed(() => {
		const time = props.comment.spec.creationTime
		return time ? dayjs(time).format('YYYY年MM月DD日') : ''
	})

	const createTimeAgo = computed(() => {
		const time = props.comment.spec.creationTime
		return time ? `${dayjs(time).fromNow(true)}前` : ''
	})

	function handleOnImageError() {
		// 头像加载失败时回退默认头像(由 checkAvatarUrl 兜底,此处保持简单)
	}

	function handleOnCopy() {
		emit('on-copy', props.comment.spec.raw)
	}

	function handleOnReply() {
		emit('on-comment', { type: 'user', comment: props.comment })
	}

	function handleOnDetail() {
		emit('on-detail', props.comment)
	}
</script>

<template>
	<view v-if="comment" class="box-border flex pt-4" :class="{
		'pl-10':props.isChild,
	}">
		<view class="flex shrink-0">
			<image class="box-border h-10 w-10 shrink-0 rounded-full border border-white uh-shadow-xs border-solid" :src="avatar" mode="aspectFill"
				@error="handleOnImageError" />
		</view>
		<view class="flex-1 box-border pl-2">
			<view class="text-sm text-gray-500">
				<text class="text-grey text-xs">{{ comment.spec.owner.displayName }}</text>
			</view>
			<view class="mt-0.5 box-border text-sm text-gray-900 leading-5"  @click="handleOnDetail"
				v-html="comment.spec.raw" />
			<view class="mt-2 flex items-center gap-x-4">
				<text class="text-gray-900 text-xs">{{ createTimeText }}</text>
				<view v-if="useActions" class="actions flex gap-2 font-bold">
					<view v-if="!disallowComment" class="text-xs" @click="handleOnReply">
						回复
					</view>
					<view class="text-grey text-xs" @click="handleOnCopy">
						复制
					</view>
				</view>
			</view>
		</view>
	</view>
</template>