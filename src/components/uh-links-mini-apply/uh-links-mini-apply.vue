<script lang="ts" setup>
	import { computed, ref, watch } from 'vue'
	import { getPluginCaptcha, submitMiniProgramLinkApplication } from '@/api/uni-halo'
	import type { ICaptchaQuery, IPluginCaptcha } from '@/api/uni-halo'

	const props = withDefaults(defineProps<{
		show ?: boolean
	}>(), {
		show: false,
	})

	const emit = defineEmits<{
		(e : 'on-close', data : { isSubmit : boolean, refresh : boolean }) : void
	}>()

	const isShow = ref(false)

	interface IApplyForm {
		displayName : string
		miniProgramCode : string
		link : string
		authorName : string
		avatar : string
		website : string
		description : string
		applyRemark : string
		email : string
	}

	const form = ref<IApplyForm>({
		displayName: '',
		miniProgramCode: '',
		link: '',
		authorName: '',
		avatar: '',
		website: '',
		description: '',
		applyRemark: '',
		email: '',
	})

	const submitting = ref(false)

	// 防刷验证码(服务端 403 附新码 / 点击图片刷新)
	const captchaImage = ref('')
	const captchaId = ref('')
	const captchaCode = ref('')
	const captchaLoading = ref(false)

	const captchaSrc = computed(() => {
		if (!captchaImage.value)
			return ''
		return captchaImage.value.startsWith('data:')
			? captchaImage.value
			: `data:image/png;base64,${captchaImage.value}`
	})

	function resetCaptcha() {
		captchaImage.value = ''
		captchaId.value = ''
		captchaCode.value = ''
	}

	function applyCaptcha(captcha : IPluginCaptcha) {
		captchaImage.value = captcha.imageBase64
		captchaId.value = captcha.id
		captchaCode.value = ''
	}

	async function handleRefreshCaptcha() {
		if (captchaLoading.value) { return }
		captchaLoading.value = true
		try {
			const res = await getPluginCaptcha()
			if (res.data)
				applyCaptcha(res.data)
		}
		catch (e) {
			console.error('获取验证码失败', e)
		}
		finally {
			captchaLoading.value = false
		}
	}

	function handleResetForm() {
		form.value = {
			displayName: '',
			miniProgramCode: '',
			link: '',
			authorName: '',
			avatar: '',
			website: '',
			description: '',
			applyRemark: '',
			email: '',
		}
		resetCaptcha()
	}

	function checkIsUrl(url : string) : boolean {
		return /^https?:\/\//i.test(url)
	}

	function checkIsEmail(email : string) : boolean {
		return /^[\w.-]+@[\w-]+(?:\.[\w-]+)+$/.test(email)
	}

	/** 提交校验 */
	function validateForm() : boolean {
		if (!form.value.displayName.trim()) {
			uni.showToast({ icon: 'none', title: '请填写小程序名称' })
			return false
		}
		if (!form.value.miniProgramCode.trim()) {
			uni.showToast({ icon: 'none', title: '请填写太阳码图片地址' })
			return false
		}
		if (form.value.miniProgramCode.trim() && !checkIsUrl(form.value.miniProgramCode.trim())) {
			uni.showToast({ icon: 'none', title: '太阳码地址需为 http(s) 链接' })
			return false
		}
		if (form.value.link.trim() && !checkIsUrl(form.value.link.trim())) {
			uni.showToast({ icon: 'none', title: '小程序地址需为 http(s) 链接' })
			return false
		}
		if (form.value.avatar.trim() && !checkIsUrl(form.value.avatar.trim())) {
			uni.showToast({ icon: 'none', title: '头像地址需为 http(s) 链接' })
			return false
		}
		if (form.value.website.trim() && !checkIsUrl(form.value.website.trim())) {
			uni.showToast({ icon: 'none', title: '网站地址需为 http(s) 链接' })
			return false
		}
		if (form.value.email.trim() && !checkIsEmail(form.value.email.trim())) {
			uni.showToast({ icon: 'none', title: '请输入正确的邮箱地址' })
			return false
		}
		return true
	}

	/** 提交申请 */
	async function handleHandle() {
		if (!validateForm()) { return }

		submitting.value = true
		uni.showLoading({ title: '正在提交...' })
		try {
			const captchaQuery : ICaptchaQuery | undefined = captchaImage.value
				? { captchaId: captchaId.value, captchaCode: captchaCode.value }
				: undefined
			await submitMiniProgramLinkApplication({
				displayName: form.value.displayName.trim(),
				miniProgramCode: form.value.miniProgramCode.trim(),
				link: form.value.link.trim() || undefined,
				authorName: form.value.authorName.trim() || undefined,
				avatar: form.value.avatar.trim() || undefined,
				website: form.value.website.trim() || undefined,
				description: form.value.description.trim() || undefined,
				applyRemark: form.value.applyRemark.trim() || undefined,
				email: form.value.email.trim() || undefined,
			}, captchaQuery)
			uni.showToast({ icon: 'none', title: '申请提交成功，等待审核！' })
			handleClose(true)
			handleResetForm()
		}
		catch (err) {
			console.error('小程序链接申请提交失败', err)
			const e = err as { code ?: number, data ?: { message ?: string, captcha ?: IPluginCaptcha } }
			if (e.code === 403 && e.data?.captcha) {
				// 需要/校验失败:服务端附新验证码(一次性),展示并要求重试
				applyCaptcha(e.data.captcha)
				uni.showToast({ icon: 'none', title: '请完成验证码后重新提交' })
			}
			else {
				uni.showToast({ icon: 'none', title: '提交失败，请稍后重试！' })
			}
		}
		finally {
			submitting.value = false
			uni.hideLoading()
		}
	}

	function handleOnChange(isOpen : boolean) {
		isShow.value = isOpen
		if (!isOpen) { emit('on-close', { isSubmit: false, refresh: false }) }
	}

	function handleClose(refresh = false) {
		isShow.value = false
		emit('on-close', { isSubmit: true, refresh })
	}

	watch(() => props.show, (newVal) => {
		if (!newVal) { return }
		isShow.value = true
		handleResetForm()
	})
</script>

<template>
	<uh-glass-popup v-model="isShow" :z-index="100" position="bottom"
		custom-class="!border rounded-lt-2xl rounded-rt-2xl" @close="handleClose(false)">
		<view class="mb-4 relative w-full flex items-center justify-around box-border px-4 pt-4">
			<view class="w-full flex flex-col gap-y-1">
				<text class="text-md font-bold">申请收录小程序</text>
				<text class="text-xs text-gray-500">提交后审核通过后展示在「小程序」列表中</text>
			</view>
			<view class="absolute right-4 top-4 w-6 h-6 uh-global-card-glass shadow-none border rounded-lg text-center"
				@click="handleClose(false)">
				<wd-icon name="close" size="32rpx" class="text-gray-500"></wd-icon>
			</view>
		</view>
		<scroll-view :scroll-y="true" :show-scrollbar="false" class="box-border p-4 pt-0 max-h-[60vh]">
			<view class="mb-5 flex items-center">
				<text class="label w-[140rpx] shrink-0 text-sm text-[#666]">名称 *</text>
				<input v-model="form.displayName"
					class="uh-global-card-glass shadow-none border h-9 flex-1 rounded-xl px-4 text-sm"
					placeholder="请输入小程序名称">
			</view>

			<view class="mb-5 flex items-center">
				<text class="label w-[140rpx] shrink-0 text-sm text-[#666]">太阳码 *</text>
				<input v-model="form.miniProgramCode"
					class="uh-global-card-glass shadow-none border h-9 flex-1 rounded-xl px-4 text-sm"
					placeholder="小程序码图片链接(必填)">
			</view>

			<view class="mb-5 flex items-center">
				<text class="label w-[140rpx] shrink-0 text-sm text-[#666]">小程序地址</text>
				<input v-model="form.link"
					class="uh-global-card-glass shadow-none border h-9 flex-1 rounded-xl px-4 text-sm"
					placeholder="跳转链接(选填)">
			</view>

			<view class="mb-5 flex items-center">
				<text class="label w-[140rpx] shrink-0 text-sm text-[#666]">作者昵称</text>
				<input v-model="form.authorName"
					class="uh-global-card-glass shadow-none border h-9 flex-1 rounded-xl px-4 text-sm" placeholder="选填">
			</view>

			<view class="mb-5 flex items-center">
				<text class="label w-[140rpx] shrink-0 text-sm text-[#666]">作者头像</text>
				<input v-model="form.avatar"
					class="uh-global-card-glass shadow-none border h-9 flex-1 rounded-xl px-4 text-sm"
					placeholder="头像图片链接(选填)">
			</view>

			<view class="mb-5 flex items-center">
				<text class="label w-[140rpx] shrink-0 text-sm text-[#666]">作者网站</text>
				<input v-model="form.website"
					class="uh-global-card-glass shadow-none border h-9 flex-1 rounded-xl px-4 text-sm" placeholder="选填">
			</view>

			<view class="mb-5">
				<text class="label mb-2 block text-sm text-[#666]">小程序描述</text>
				<textarea v-model="form.description"
					class="w-full h-24 uh-global-card-glass box-border shadow-none border flex-1 rounded-xl p-3 text-sm"
					placeholder="介绍一下这个小程序(选填)" :maxlength="200" />
			</view>

			<view class="mb-5">
				<text class="label mb-2 block text-sm text-[#666]">申请说明</text>
				<textarea v-model="form.applyRemark"
					class="w-full h-24 uh-global-card-glass box-border shadow-none border flex-1 rounded-xl p-3 text-sm"
					placeholder="方便管理员了解申请意图(选填)" :maxlength="200" />
			</view>

			<view class="mb-5 flex items-center">
				<text class="label w-[140rpx] shrink-0 text-sm text-[#666]">通知邮箱</text>
				<input v-model="form.email"
					class="uh-global-card-glass shadow-none border h-9 flex-1 rounded-xl px-4 text-sm"
					placeholder="审核结果通知(选填)">
			</view>

			<!-- 防刷验证码(提交 403 后展示;点击图片可刷新) -->
			<view v-if="captchaSrc" class="captcha-box mb-5 flex items-center">
				<text class="label w-[140rpx] shrink-0 text-sm text-[#666]">验证码 *</text>
				<image :src="captchaSrc" class="captcha-img h-[76rpx] w-[200rpx] shrink-0 rounded-lg" mode="widthFix"
					@click="handleRefreshCaptcha" />
				<input v-model="captchaCode" class="input ml-3 h-[72rpx] flex-1 rounded-xl bg-[#f5f5f5] px-4 text-sm"
					placeholder="输入图中字符">
			</view>

			<view class="my-6">
				<uh-button custom-class="py-2 !rounded-xl" @click="handleHandle">
					提交申请
				</uh-button>
			</view>
		</scroll-view>
	</uh-glass-popup>
</template>