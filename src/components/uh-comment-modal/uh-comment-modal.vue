<script lang="ts" setup>
	import { computed, ref, watch } from 'vue'
	import { addPostComment, addPostCommentReply } from '@/api/halo'
	import { getCommentWidgetCaptcha, getCommentWidgetConfig } from '@/api/uni-halo'
	import { setCache } from '@/utils/storage'
	import { deepMerge } from '@/utils/merge'
	import { UniHaloError } from '@/http/tools/exception'
	const props = withDefaults(defineProps<{
		show : boolean
		isComment ?: boolean
		title ?: string
		postName : string
		/** 评论目标 kind(文章 Post / 瞬间 Moment) */
		subjectKind ?: string
		/** 回复的回复:被引用回复(CommentReply)的 name,提交时转 quoteReply */
		quoteReply ?: string
	}>(), {
		isComment: false,
		title: '',
		subjectKind: 'Post',
		quoteReply: '',
	})

	const emit = defineEmits<{
		(e : 'on-close', data : { isSubmit : boolean, refresh : boolean }) : void
	}>()

	const isShow = ref(false)

	interface ICaptchaConfig {
		security ?: {
			captcha ?: {
				anonymousCommentCaptcha ?: boolean
				[key : string] : unknown
			}
		}
		editor ?: {
			placeholder ?: string
		}
		[key : string] : unknown
	}

	interface ICommentForm {
		allowNotification : boolean
		author : string
		avatar : string
		authorUrl : string
		content : string
		email : string
		postName : string
		captchaCode ?: string
	}

	const config = ref<ICaptchaConfig>({
		security: {
			captcha: {
				anonymousCommentCaptcha: false,
			},
		},
		editor: {
			placeholder: '请输入内容,不超过200字符...',
		},
	})

	const captchaData = ref<{ image : string, status : 'loading' | 'success' | 'fail' }>({
		image: '',
		status: 'loading',
	})

	const form = ref<ICommentForm>({
		allowNotification: true,
		author: '',
		avatar: '',
		authorUrl: '',
		content: '',
		email: '',
		postName: props.postName,
		captchaCode: undefined,
	})

	const calcTitle = computed(() => {
		if (props.isComment)
			return props.title || '新增评论'
		return `回复用户：${props.title}`
	})

	function handleResetForm() {
		form.value = {
			allowNotification: true,
			author: '',
			avatar: '',
			authorUrl: '',
			content: '',
			email: '',
			postName: props.postName,
			captchaCode: undefined,
		}
	}

	/** 获取评论组件配置(验证码开关) */
	async function handleGetConfig() {
		try {
			const res = await getCommentWidgetConfig()
			config.value = deepMerge(config.value as Record<string, unknown>, res.data as Record<string, unknown>) as ICaptchaConfig
			if (config.value?.security?.captcha?.anonymousCommentCaptcha) {
				handleGetCaptchaImage()
			}
		}
		catch (err) {
			console.error('获取验证码配置失败', err)
		}
	}

	/** 获取评论验证码图片 */
	async function handleGetCaptchaImage() {
		captchaData.value.status = 'loading'
		try {
			const res = await getCommentWidgetCaptcha()
			form.value.captchaCode = undefined
			captchaData.value.image = res.data as unknown as string
			captchaData.value.status = 'success'
		}
		catch (err) {
			console.error('获取验证码失败', err)
			captchaData.value.status = 'fail'
			captchaData.value.image = ''
		}
	}

	/** 初始化访客信息 */
	function handleInitVisitor() {
		const visitor = uni.getStorageSync('Visitor')
		if (!visitor)
			return
		try {
			const v = JSON.parse(visitor)
			form.value.author = v.author || ''
			form.value.avatar = v.avatar || ''
			form.value.email = v.email || ''
			form.value.authorUrl = v.authorUrl || ''
		}
		catch {
			// ignore
		}
	}

	/** 保存访客信息 */
	function handleSetVisitor() {
		setCache('Visitor', {
			author: form.value.author,
			avatar: form.value.avatar,
			email: form.value.email,
			authorUrl: form.value.authorUrl,
		})
	}

	/** 提交校验 */
	function validateForm() : boolean {
		if (!form.value.content.trim()) {
			uni.showToast({ icon: 'none', title: '请填写评论内容' })
			return false
		}
		if (!form.value.author.trim()) {
			uni.showToast({ icon: 'none', title: '请填写昵称' })
			return false
		}
		if (!form.value.email.trim()) {
			uni.showToast({ icon: 'none', title: '请填写邮箱' })
			return false
		}
		if (config.value?.security?.captcha?.anonymousCommentCaptcha && !form.value.captchaCode?.trim()) {
			uni.showToast({ icon: 'none', title: '请填写验证码结果！' })
			return false
		}
		return true
	}

	async function handleHandle() {
		if (!validateForm()) { return }

		uni.showLoading({ title: '正在提交...' })

		try {
			if (props.isComment) {
				// 新增评论
				await addPostComment({
					allowNotification: form.value.allowNotification,
					raw: form.value.content,
					content: form.value.content,
					owner: {
						displayName: form.value.author,
						email: form.value.email,
						website: form.value.authorUrl,
					},
					subjectRef: {
						group: 'content.halo.run',
						kind: props.subjectKind,
						name: form.value.postName,
						version: 'v1alpha1',
					},
					captchaCode: config.value?.security?.captcha?.anonymousCommentCaptcha ? form.value.captchaCode : undefined,
				})
				uni.showToast({ icon: 'none', title: '评论成功，可能需要审核！' })
			}
			else {
				// 回复评论
				await addPostCommentReply(form.value.postName, {
					allowNotification: form.value.allowNotification,
					raw: form.value.content,
					content: form.value.content,
					owner: {
						displayName: form.value.author,
						email: form.value.email,
						website: form.value.authorUrl,
					},
					quoteReply: props.quoteReply || undefined,
					captchaCode: config.value?.security?.captcha?.anonymousCommentCaptcha ? form.value.captchaCode : undefined,
				})
				uni.showToast({ icon: 'none', title: '回复成功，可能需要审核！' })
			}

			handleSetVisitor()
			handleClose(true)
			handleResetForm()
		}
		catch (err : any) {
			const error = err as UniHaloError
			if (config.value?.security?.captcha?.anonymousCommentCaptcha) {
				captchaData.value.status = 'success'
				form.value.captchaCode = undefined
				if (error?.data?.captcha) {
					captchaData.value.image = error?.data?.captcha
				} else {
					handleGetCaptchaImage()
				}
			}
			uni.showToast({ icon: 'none', title: error?.data?.detail ?? '提交失败' })
		}
		finally {
			uni.hideLoading()
		}
	}

	function handleOnChange(isOpen : boolean) {
		isShow.value = isOpen
		if (!isOpen) {
			emit('on-close', { isSubmit: false, refresh: false })
		}
	}

	function handleClose(refresh = false) {
		isShow.value = false
		emit('on-close', { isSubmit: true, refresh })
	}

	watch(() => props.show, (newVal) => {
		if (!newVal) {
			return
		}
		isShow.value = true
		handleResetForm()
		form.value.postName = props.postName
		handleGetConfig()
		handleInitVisitor()
	}, {
		immediate: true
	})
</script>

<template>
	<uh-glass-popup v-model="isShow" position="bottom" custom-class="!border rounded-2xl" :z-index="100"
		@close="handleOnChange(false)">
		<view class="box-border p-4">
			<view
				class="relative w-full flex items-center justify-around box-border px-12 text-md font-bold text-center">
				<text>{{ calcTitle }} </text>
				<view
					class="absolute right-0 top-0 w-6 h-6 uh-global-card-glass shadow-none border rounded-lg flex items-center justify-center"
					@click="handleClose">
					<wd-icon name="close" size="28rpx" class="text-gray-500"></wd-icon>
				</view>
			</view>

			<scroll-view :scroll-y="true" class="form mt-6">
				<view class="form-item mb-4 flex items-center">
					<textarea v-model="form.content"
						class="h-22 uh-global-card-glass shadow-none border box-border w-full rounded-xl px-3 py-2 text-xs"
						:placeholder="config.editor?.placeholder || '请输入内容,不超过200字符...'" :maxlength="200" />
				</view>

				<view class="form-item mb-4 flex items-center">
					<text class="label w-16 shrink-0 text-xs text-gray-500">我的昵称</text>
					<input v-model="form.author"
						class="uh-global-card-glass shadow-none border h-9 flex-1 rounded-xl px-3 text-xs"
						placeholder="请输入您的昵称...">
				</view>

				<view class="form-item mb-4 flex items-center">
					<text class="label w-16 shrink-0 text-sm text-gray-500">我的邮箱</text>
					<input v-model="form.email"
						class="uh-global-card-glass shadow-none border h-9 flex-1 rounded-xl px-3 text-xs"
						placeholder="请输入您的邮箱...">
				</view>

				<view class="form-item mb-4 flex items-center">
					<text class="label w-16 shrink-0 text-sm text-gray-500">我的网站</text>
					<input v-model="form.authorUrl"
						class="uh-global-card-glass shadow-none border h-9 flex-1 rounded-xl px-3 text-xs"
						placeholder="[ 可选 ] 请输入您的网址...">
				</view>

				<!-- 匿名评论验证码 -->
				<view v-if="config?.security?.captcha?.anonymousCommentCaptcha"
					class="form-item mb-4 flex items-center">
					<text class="w-16 shrink-0 text-sm text-gray-500">验证码</text>
					<view class="flex flex-1 items-center gap-3">
						<input v-model="form.captchaCode"
							class="uh-global-card-glass shadow-none border h-9 flex-1 rounded-xl px-3 text-xs"
							placeholder="请输入验证码">
						<view class="h-10 w-29 flex shrink-0 items-center justify-center">
							<uh-button v-if="captchaData.status === 'loading'"
								class="w-full uh-global-card-glass shadow-none border py-2.5 !rounded-xl text-xs text-gray-900">获取中...</uh-button>
							<uh-button v-else-if="captchaData.status === 'fail'"
								class="w-full uh-global-card-glass shadow-none border py-2.5 !rounded-xl text-xs text-red-400"
								@click="handleGetCaptchaImage()">请重试</uh-button>
							<image v-else :src="captchaData.image" class="block rounded-xl h-full w-full"
								mode="aspectFit" @click="handleGetCaptchaImage()" />
						</view>
					</view>
				</view>

				<view class="submit-btn my-6">
					<uh-button custom-class="flex-1 uh-global-card-glass uh-shadow-xs text-xs border py-2 !rounded-xl"
						@click="handleHandle">
						提交
					</uh-button>
				</view>
			</scroll-view>
		</view>
	</uh-glass-popup>
</template>