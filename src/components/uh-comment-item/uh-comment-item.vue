<script lang="ts" setup>
	import { computed, ref, watch } from 'vue'
	import dayjs from 'dayjs'
	import relativeTime from 'dayjs/plugin/relativeTime'
	import { checkAvatarUrl } from '@/utils/url'
	import { useSettingStore } from '@/store/setting'
	import type { ICommentReply } from '@/api/types/halo'

	const props = withDefaults(defineProps<{
		comment : ICommentReply
		isChild ?: boolean
		useActions ?: boolean
		useSolid ?: boolean
		useContentBg ?: boolean
		disallowComment ?: boolean
		postName ?: string
		classItem ?: string[]
		/** 回复引用名映射(quoteReply name -> 被引用人 displayName),命中时显示「回复 @xxx」 */
		quoteReplyMap ?: Record<string, string>
	}>(), {
		isChild: false,
		useActions: true,
		useSolid: true,
		useContentBg: true,
		disallowComment: false,
		postName: '',
		classItem: () => [],
		quoteReplyMap: () => ({}),
	})
	const emit = defineEmits<{
		(e : 'on-comment', data : { type : string, comment : ICommentReply }) : void
		(e : 'on-copy', raw : string) : void
		(e : 'on-detail', comment : ICommentReply) : void
	}>()
	dayjs.extend(relativeTime)
	dayjs.locale('zh-cn')

	const settingStore = useSettingStore()
	const globalAppSettings = computed(() => settingStore.settings)

	const avatar = computed(() => checkAvatarUrl(props.comment.spec.owner.avatar))

	/** 用户是否提供了头像(无头像时用昵称首字占位) */
	const hasAvatar = computed(() => !!props.comment.spec.owner.avatar?.trim())

	/** 昵称首字(头像占位) */
	const avatarText = computed(() => {
		const name = props.comment.spec.owner.displayName?.trim()
		return name ? Array.from(name)[0] : '?'
	})

	/** 头像加载失败标记(失败后回退首字占位) */
	const avatarError = ref(false)

	/** 是否渲染图片头像(有头像且未加载失败) */
	const showImage = computed(() => hasAvatar.value && !avatarError.value)

	/** 头像地址变化时重置加载失败标记(组件复用时) */
	watch(() => props.comment.spec.owner.avatar, () => {
		avatarError.value = false
	})

	/** 引用回复标识(被引用人在父级已加载回复映射中可查到时显示) */
	const quoteReplyText = computed(() => {
		const quoteName = props.comment.spec.quoteReply
		if (!quoteName)
			return ''
		const displayName = props.quoteReplyMap[quoteName]
		return displayName ? `回复 @${displayName}` : ''
	})

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
		// 头像加载失败时回退昵称首字占位
		avatarError.value = true
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
			<image v-if="showImage"
				class="box-border h-10 w-10 shrink-0 rounded-full border border-white uh-shadow-xs border-solid" :src="avatar"
				mode="aspectFill" @error="handleOnImageError" />
			<view v-else class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#bbe52a6b]">
				<text class="text-sm font-bold text-gray-900">{{ avatarText }}</text>
			</view>
		</view>
		<view class="flex-1 box-border pl-2">
			<view class="text-sm text-gray-500">
				<text class="text-grey text-xs">{{ comment.spec.owner.displayName }}</text>
			</view>
			<view v-if="quoteReplyText" class="mt-1 text-xs text-gray-400">{{ quoteReplyText }}</view>
			<view class="mt-0.5 box-border text-sm text-gray-900 leading-5" @click="handleOnDetail"
				v-html="comment.spec.raw" />
			<view class="mt-2 flex items-center gap-x-4">
				<text class="text-gray-900 text-xs">{{ createTimeText }}</text>
				<view v-if="useActions" class="actions flex gap-2 font-medium">
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