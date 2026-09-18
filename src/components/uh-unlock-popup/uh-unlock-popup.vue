<script lang="ts" setup>
	import { computed, ref, watch } from 'vue'
	import { getPluginCaptcha } from '@/api/uni-halo'
	import type { ICaptchaQuery, IPluginCaptcha } from '@/api/uni-halo'
	
	defineOptions({
		options: {
			styleIsolation: 'apply-shared'
		}
	})

	interface IProps {
		show : boolean
		/** 弹窗标题(如"解锁相册"/"请输入访问密码") */
		title ?: string
		/** 提示文案(如"此相册已加密,请输入密码查看") */
		tip ?: string
		/** 密码输入占位符 */
		placeholder ?: string
		/** 确认按钮文案 */
		confirmText ?: string
		/** 是否可关闭(强制解锁场景传 false:隐藏关闭按钮/取消按钮,点遮罩不关) */
		closeable ?: boolean
		/** 是否启用防刷验证码(受保护写接口 403 附新码时展示) */
		captchaEnabled ?: boolean
		/** 解锁请求函数(父组件注入具体接口;返回含 token 的对象表示成功) */
		request ?: (password : string, captcha ?: ICaptchaQuery | null) => Promise<{ token ?: string, [key : string] : unknown } | null | undefined>
	}

	const props = withDefaults(defineProps<IProps>(), {
		title: '解锁',
		tip: '',
		placeholder: '请输入密码',
		confirmText: '解锁',
		closeable: true,
		captchaEnabled: false,
		request: undefined,
	})

	const emit = defineEmits<{
		(e : 'update:show', show : boolean) : void
		(e : 'success', data : { token ?: string, [key : string] : unknown }) : void
	}>()

	const isShow = ref(false)
	const password = ref('')
	const loading = ref(false)

	// 防刷验证码(服务端 403 附新码 / 主动刷新;captchaEnabled 时启用)
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

	/** 用服务端返回的验证码(403 响应体附新码)填充展示 */
	function applyCaptcha(captcha : IPluginCaptcha) {
		captchaImage.value = captcha.imageBase64
		captchaId.value = captcha.id
		captchaCode.value = ''
	}

	/** 点击验证码图刷新 */
	async function handleRefreshCaptcha() {
		if (captchaLoading.value) { return }
		captchaLoading.value = true
		try {
			const res = await getPluginCaptcha()
			if (res.data) { applyCaptcha(res.data) }
		}
		catch (e) {
			console.error('获取验证码失败', e)
		}
		finally {
			captchaLoading.value = false
		}
	}

	// immediate:组件 v-if 条件创建时 show 可能已为 true,需立即同步(如相册解锁弹窗)
	watch(() => props.show, (val) => {
		isShow.value = val
		if (val) {
			password.value = ''
			resetCaptcha()
			// 插件端开启验证码时打开即拉取显示,避免首次提交 403 后才出现
			if (props.captchaEnabled) {
				handleRefreshCaptcha()
			}
		}
	}, { immediate: true })

	/** 弹窗开关同步(遮罩/关闭按钮/取消):关闭时复位输入并通知父组件 */
	function handleOnPopupClose(val : boolean) {
		isShow.value = val
		if (!val) {
			password.value = ''
			resetCaptcha()
		}
		emit('update:show', val)
	}

	function handleOnCancel() {
		handleOnPopupClose(false)
	}

	async function handleOnConfirm() {
		if (loading.value)
			return
		if (!password.value.trim()) {
			uni.showToast({ title: '请输入密码', icon: 'none' })
			return
		}
		if (!props.request) {
			uni.showToast({ title: '未配置解锁请求', icon: 'none' })
			return
		}

		loading.value = true
		try {
			const captchaQuery : ICaptchaQuery | undefined = props.captchaEnabled && captchaImage.value
				? { captchaId: captchaId.value, captchaCode: captchaCode.value }
				: undefined
			const res = await props.request(password.value, captchaQuery)
			if (res && res.token) {
				password.value = ''
				resetCaptcha()
				isShow.value = false
				emit('update:show', false)
				emit('success', res)
				uni.showToast({ title: '解锁成功', icon: 'success' })
			}
			else {
				uni.showToast({ title: '解锁失败，请重试', icon: 'none' })
			}
		}
		catch (e) {
			console.error('解锁失败', e)
			const err = e as { code ?: number, data ?: { message ?: string, captcha ?: IPluginCaptcha } }
			if (err.code === 403 && err.data?.captcha) {
				// 需要/校验失败:服务端附新验证码(一次性,旧码已作废),展示并要求重试
				applyCaptcha(err.data.captcha)
				uni.showToast({ title: '请完成验证码后重新解锁', icon: 'none' })
			}
			else {
				// 密码错误等业务失败:清空密码并复位验证码(一次性,需重新获取)
				password.value = ''
				resetCaptcha()
				uni.showToast({ title: '密码错误，请重试', icon: 'none' })
			}
		}
		finally {
			loading.value = false
		}
	}
</script>

<template>
	<uh-glass-popup :model-value="isShow" position="bottom" :z-index="100" custom-class="!border rounded-2xl"
		:close-on-click-modal="closeable" safe-area-inset-bottom @update:model-value="handleOnPopupClose">
		<view class="box-border p-4 w-full">
			<view class="w-full flex items-center justify-between">
				<view class="font-bold flex items-center gap-x-1 text-love">
					<wd-icon name="lock" size="42rpx"></wd-icon> {{ title }}
				</view>
				<view v-if="closeable"
					class="w-6 h-6 uh-global-card-glass border uh-shadow-xs flex items-center justify-center rounded-lg"
					@click="handleOnCancel">
					<wd-icon name="close" size="28rpx"></wd-icon>
				</view>
			</view>
			<view class="mt-6 flex flex-col items-center">
				<view class="tip-text text-xs text-gray-600">
					{{ tip }}
				</view>
			</view>
			<input v-model="password" :password="true" :placeholder="placeholder"
				class="box-border mt-6 h-9 px-3 rounded-xl text-xs uh-global-card-glass uh-shadow-xs border" />

			<view v-if="captchaEnabled && captchaSrc" class="mt-5 flex items-center justify-center gap-4">
				<input v-model="captchaCode" placeholder="验证码"
					class="box-border flex-1 h-9 px-3 rounded-xl text-xs uh-global-card-glass uh-shadow-xs border" />
				<image :src="captchaSrc" class="shrink-0 h-9 w-24 rounded-xl" mode="widthFix"
					@click="handleRefreshCaptcha" />
			</view>
			<view v-if="captchaEnabled && captchaSrc" class="mt-4 text-center text-xs text-gray-500">
				点击图片刷新验证码
			</view>

			<!-- 操作按钮:取消 + 解锁(强制解锁场景隐藏取消) -->
			<view class="w-full mt-6 box-border flex items-center justify-center gap-4">
				<uh-button v-if="closeable" class="flex-1"
					custom-class="flex-1 uh-global-card-glass uh-shadow-xs text-xs border py-2 !rounded-xl bg-white/90"
					@click="handleOnCancel">
					取消
				</uh-button>
				<uh-button class="flex-1"
					custom-class="flex-1 uh-global-card-glass uh-shadow-xs text-xs border py-2 !rounded-xl !bg-love/90 text-white"
					@click="handleOnConfirm">
					{{ loading ? '解锁中...' : confirmText }}
				</uh-button>
			</view>
		</view>
	</uh-glass-popup>
</template>