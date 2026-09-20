<script lang="ts" setup>
	import { computed, onUnmounted, ref } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import { storeToRefs } from 'pinia'
	import { useAppConfigStore } from '@/store/appConfig'
	import { useTokenStore } from '@/store/token'
	import { usePageTitle } from '@/hooks/usePageTitle'
	import { getGlobalInfo, sendRegisterEmailCode } from '@/api/auth'
	import { LOGIN_PAGE } from '@/router/config'
	import { sleep } from '@/utils/common'

	definePage({
		style: {
			navigationBarTitleText: '注册',
			navigationStyle: 'custom',
		},
	})

	const { configs } = storeToRefs(useAppConfigStore())
	/** 页面标题（插件端可配置，留空回退内置默认） */
	const pageTitle = usePageTitle('register', '注册')
	const tokenStore = useTokenStore()

	/* ---------- 应用名称(欢迎语展示) ---------- */
	const appInfo = computed(() => configs.value.featureConfig?.profile?.appInfo?.name || 'uni-halo')

	/* ---------- 注册开关(Halo /actuator/globalinfo,匿名可访问) ---------- */
	const registrationAllowed = ref(true)
	const emailVerifyRequired = ref(false)

	onLoad(() => {
		getGlobalInfo().then((res) => {
			registrationAllowed.value = res.data?.allowRegistration !== false
			emailVerifyRequired.value = res.data?.mustVerifyEmailOnRegistration === true
		}).catch((error) => {
			// 开关读取失败时按 fail closed 处理
			console.error('获取注册开关失败:', error)
			registrationAllowed.value = false
		})
	})

	/* ---------- 用户协议/隐私政策(getConfigs 下发 featureConfig.pages.userAgreement / pages.privacyPolicy) ---------- */
	/** 协议弹窗类型(与插件端 pages 键名一致) */
	type AgreementType = 'userAgreement' | 'privacyPolicy'
	const agreed = ref(false)
	const agreementPopupVisible = ref(false)
	const popupType = ref<AgreementType>('userAgreement')

	/** 协议内容 */
	const agreementContents = computed(() => {
		const pages = configs.value.featureConfig?.pages
		return {
			userAgreement: (pages?.userAgreement?.content || '').trim(),
			privacyPolicy: (pages?.privacyPolicy?.content || '').trim(),
		}
	})

	/** 打开协议弹窗(《用户协议》《隐私政策》文字点击,弹窗内可切换查看) */
	function openAgreementPopup(type : AgreementType) {
		popupType.value = type
		agreementPopupVisible.value = true
	}

	/** 弹窗内「同意并继续」:勾选同意(弹窗由组件自行关闭) */
	function agreeInPopup() {
		agreed.value = true
	}

	/* ---------- 微信注册入口开关(与登录页一致,按插件端 loginConfig 过滤) ---------- */
	const wechatLoginEnabled = computed(() => configs.value.loginConfig?.client?.wechatLoginEnabled === true)

	/* ---------- 邮箱验证码(站点开启 mustVerifyEmailOnRegistration 时) ---------- */
	const email = ref('')
	const emailCode = ref('')
	const codeSending = ref(false)
	const codeCountdown = ref(0)
	let codeTimer : ReturnType<typeof setInterval> | null = null

	/** 邮箱基础格式(与服务端 @Email 校验对齐) */
	const EMAIL_RE = /^[\w.%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i

	/**
	 * 发送注册邮箱验证码(Halo 匿名端点 /signup/send-email-code)
	 * 服务端按客户端 IP 限流,429 = 发送过于频繁
	 */
	async function sendEmailCode() {
		const value = email.value.trim()
		if (!value) {
			uni.showToast({ icon: 'none', title: '请先填写邮箱' })
			return
		}
		if (!EMAIL_RE.test(value)) {
			uni.showToast({ icon: 'none', title: '邮箱格式不正确' })
			return
		}
		if (codeSending.value || codeCountdown.value > 0)
			return
		codeSending.value = true
		try {
			await sendRegisterEmailCode(value)
			uni.showToast({ icon: 'none', title: '验证码已发送，请查收邮箱' })
			startCodeCountdown()
		}
		catch (error) {
			// 429 限流单独提示,其余按通用失败
			const code = (error as { code ?: number })?.code
			uni.showToast({
				icon: 'none',
				title: code === 429 ? '发送过于频繁，请稍后再试' : '验证码发送失败，请稍后重试',
			})
		}
		finally {
			codeSending.value = false
		}
	}

	/** 发码倒计时(60s,页面卸载时清理定时器) */
	function startCodeCountdown() {
		codeCountdown.value = 60
		if (codeTimer)
			clearInterval(codeTimer)
		codeTimer = setInterval(() => {
			codeCountdown.value--
			if (codeCountdown.value <= 0) {
				if (codeTimer)
					clearInterval(codeTimer)
				codeTimer = null
			}
		}, 1000)
	}

	onUnmounted(() => {
		if (codeTimer)
			clearInterval(codeTimer)
	})

	/* ---------- 注册表单 ---------- */
	const username = ref('')
	const displayName = ref('')
	const password = ref('')
	const confirmPassword = ref('')
	const loading = ref(false)

	/** 账号密码注册(校验 → tokenStore.register 内部完成 token 存储与用户信息写入) */
	async function doRegister() {
		if (!username.value || !password.value || !confirmPassword.value) {
			uni.showToast({ icon: 'none', title: '请填写完整注册信息' })
			return
		}
		if (password.value !== confirmPassword.value) {
			uni.showToast({ icon: 'none', title: '两次输入的密码不一致' })
			return
		}
		// 站点开启注册邮箱验证时,邮箱与验证码必填(服务端 Halo signUp 也会 fail closed 校验)
		if (emailVerifyRequired.value) {
			if (!email.value.trim() || !EMAIL_RE.test(email.value.trim())) {
				uni.showToast({ icon: 'none', title: '请填写正确的邮箱' })
				return
			}
			if (!emailCode.value.trim()) {
				uni.showToast({ icon: 'none', title: '请填写邮箱验证码' })
				return
			}
		}
		// 必须先勾选同意(站点配置了协议内容时,服务端 Halo signUp 也会 fail closed 校验)
		if (!agreed.value) {
			uni.showToast({ icon: 'none', title: '请先阅读并同意用户协议与隐私政策' })
			return
		}
		loading.value = true
		try {
			await tokenStore.register({
				username: username.value,
				displayName: displayName.value || username.value,
				password: password.value,
				confirmPassword: confirmPassword.value,
				// 站点开启注册邮箱验证时携带邮箱与验证码(signUp 校验验证码须与发码邮箱一致)
				...(emailVerifyRequired.value
					? { email: email.value.trim(), emailCode: emailCode.value.trim() }
					: {}),
			})
			handleRegisterSuccess()
		}
		catch (error) {
			console.error('注册失败:', error)
		}
		finally {
			loading.value = false
		}
	}

	/** 微信一键注册(逻辑与登录页微信登录一致,仅微信小程序可用) */
	async function doWechatRegister() {
		// #ifdef MP-WEIXIN
		// 微信一键注册同样会创建账号,协议勾选要求与账号密码注册一致
		if (!agreed.value) {
			uni.showToast({ icon: 'none', title: '请先阅读并同意用户协议与隐私政策' })
			return
		}
		loading.value = true
		try {
			await tokenStore.wxRegister()
			handleRegisterSuccess()
		}
		catch (error) {
			console.error('微信注册失败:', error)
		}
		finally {
			loading.value = false
		}
		// #endif
	}

	/** 去登录:返回来源页(通常来自登录页);无上级页面时兜底跳登录页 */
	function goLogin() {
		const pages = getCurrentPages()
		if (pages.length > 1) {
			uni.navigateBack()
		}
		else {
			uni.navigateTo({ url: LOGIN_PAGE })
		}
	}

	/** 注册成功统一处理:注册即登录,返回来源页 */
	async function handleRegisterSuccess() {
		await sleep(600)
		uni.switchTab({ url: '/pages/tabbar/home/home' })
	}

	function goBack() {
		uni.navigateBack()
	}
</script>

<template>
	<view class="relative box-border min-h-screen w-screen flex flex-col overflow-hidden bg-[#f5fae8]">
		<!-- 顶部自定义导航 -->
		<uh-navbar :default-title="pageTitle" :need-placeholder="false" />

		<view
			class="pointer-events-none fixed left-0 top-0 z-0 h-[46vh] w-full from-[#d9f77f] via-[#e8fbaf] to-[#f5fae8] bg-gradient-to-b" />

		<view
			class="breathe uh-blur-52 pointer-events-none absolute left-[-80rpx] top-[calc(var(--status-bar-height)+40rpx)] z-0 h-[280rpx] w-[280rpx] rounded-full bg-white/40" />
		<view
			class="uh-blur-52 pointer-events-none absolute right-[-60rpx] top-[180rpx] z-0 h-[220rpx] w-[220rpx] rounded-full bg-[rgba(184,236,63,0.28)]" />
		<view
			class="uh-blur-44 pointer-events-none absolute bottom-[120rpx] right-[80rpx] z-0 h-[180rpx] w-[180rpx] rounded-full bg-[#ffd53d] opacity-20" />
		<view
			class="uh-blur-44 pointer-events-none absolute bottom-[280rpx] left-[-40rpx] z-0 h-[200rpx] w-[200rpx] rounded-full bg-[#ebfabf] opacity-90" />

		<view class="relative z-10 box-border h-screen w-screen flex flex-col items-center justify-center gap-y-6 px-6">
			<view class="box-border w-full flex flex-1 flex-col items-center justify-center gap-y-4 pt-26">
				<view class="flex flex-col items-center">
					<view class="text-xl text-gray-900 font-black">
						加入 {{ appInfo }}
					</view>
					<view class="mt-2 text-xs text-black/50 font-medium">
						创建账号，开启你的专属之旅
					</view>
				</view>

				<view class="box-border w-full flex flex-col items-center">
					<view class="uh-global-card-glass uh-shadow-xs box-border w-full rounded-2xl p-4">
						<wd-input v-model="username" custom-class="uh-register-input" prefix-icon="user" no-border
							placeholder="请输入账号" :disabled="loading" />
						<wd-input v-model="displayName" custom-class="uh-register-input mt-3" prefix-icon="user"
							no-border placeholder="请输入昵称(选填)" :disabled="loading" />
						<wd-input v-model="password" custom-class="uh-register-input mt-3" prefix-icon="lock"
							show-password no-border placeholder="请输入密码" :disabled="loading" />
						<wd-input v-model="confirmPassword" custom-class="uh-register-input mt-3" prefix-icon="lock"
							show-password no-border placeholder="请再次输入密码" :disabled="loading" @confirm="doRegister" />

						<template v-if="emailVerifyRequired">
							<wd-input v-model="email" custom-class="uh-register-input mt-3" prefix-icon="email"
								no-border placeholder="请输入邮箱" :disabled="loading" />
							<view class="mt-3 flex items-center gap-x-2">
								<wd-input v-model="emailCode" custom-class="uh-register-input flex-1"
									prefix-icon="message" no-border placeholder="请输入邮箱验证码" :disabled="loading"
									@confirm="doRegister" />
								<button class="send-code-btn shrink-0"
									:disabled="codeSending || codeCountdown > 0 || loading" @click="sendEmailCode">
									{{ codeCountdown > 0 ? `${codeCountdown}s 后重发` : (codeSending ? '发送中...' : '发送验证码') }}
								</button>
							</view>
						</template>

						<!-- 用户协议/隐私政策(始终展示勾选行;点击协议名弹出查看,未配置内容时弹窗内显示空态) -->
						<view class="mt-4 flex items-start justify-center gap-x-1.5 px-2" @click="agreed = !agreed">
							<view class="check-circle mt-2rpx shrink-0 text-gray-900"
								:class="agreed ? 'is-checked' : ''">
								<wd-icon v-if="agreed" name="check" size="24rpx" />
							</view>
							<view class="text-xs text-black/50 leading-5">
								我已阅读并同意<text class="text-primary" @click.stop="openAgreementPopup('userAgreement')">
									《用户协议》
								</text>与<text class="text-primary" @click.stop="openAgreementPopup('privacyPolicy')">
									《隐私政策》
								</text>
							</view>
						</view>

						<uh-button class="w-full"
							custom-class="mt-6 uh-global-card-glass bg-primary !py-2 uh-shadow-xs border w-full !rounded-full text-gray-900 border-none"
							:class="loading ? 'opacity-60' : ''" @click="doRegister">
							{{ loading ? '注册中...' : '立即注册' }}
						</uh-button>

						<!-- #ifdef MP-WEIXIN -->
						<button v-if="wechatLoginEnabled"
							class="uh-button-native uh-global-card-glass text-sm mt-3 w-full bg-primary text-gray-900 !rounded-full !py-2"
							:class="loading ? 'opacity-60' : ''" :disabled="loading" @click="doWechatRegister">
							微信一键注册
						</button>
						<!-- #endif -->
					</view>
				</view>

				<!-- 去登录 -->
				<view class="relative z-10 text-xs text-black/50" @click="goLogin">
					已有账号？去登录
				</view>
			</view>

			<!-- 页脚 -->
			<view class="relative z-10 mb-4 box-border w-full shrink-0 pt-4 pb-safe">
				<uh-page-copyright />
			</view>
		</view>

		<!-- 用户协议/隐私政策弹窗(底部弹出,tab 切换查看;「同意并继续」勾选同意) -->
		<uh-agreement-popup v-model="agreementPopupVisible" :contents="agreementContents" :initial-tab="popupType"
			show-agree-button @agree="agreeInPopup" />
	</view>
</template>

<style lang="scss" scoped>
	:deep(.uh-register-input) {
		box-sizing: border-box;
		height: 88rpx;
		padding: 0 24rpx;
		background-color: rgb(255 255 255 / 65%);
		border-radius: 24rpx;
	}

	/* 发送验证码按钮(玻璃拟态,与输入框同高同圆角) */
	.send-code-btn {
		height: 88rpx;
		padding: 0 28rpx;
		font-size: 26rpx;
		line-height: 84rpx;
		color: rgb(31 41 55 / 85%);
		background-color: rgb(255 255 255 / 65%);
		border: 2rpx solid rgb(0 0 0 / 12%);
		border-radius: 24rpx;

		&::after {
			border: none;
		}

		&[disabled] {
			color: rgb(0 0 0 / 35%);
			background-color: rgb(255 255 255 / 45%);
		}
	}

	/* 协议勾选圆圈(玻璃拟态配色,选中填充主题色) */
	.check-circle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28rpx;
		height: 28rpx;
		background-color: rgb(255 255 255 / 65%);
		border: 2rpx solid rgb(0 0 0 / 25%);
		border-radius: 50%;

		&.is-checked {
			background-color: #b8ec3f;
			border-color: #a3d92f;
		}
	}

	.check-mark {
		font-size: 20rpx;
		line-height: 1;
		font-weight: 700;
		color: rgb(31 41 55 / 85%);
	}

	.uh-blur-44 {
		filter: blur(44rpx);
	}

	.uh-blur-52 {
		filter: blur(52rpx);
	}

	/* 光斑呼吸 */
	.breathe {
		animation: breathe 5s ease-in-out infinite;
	}

	@keyframes breathe {

		0%,
		100% {
			transform: scale(1);
			opacity: 0.28;
		}

		50% {
			transform: scale(1.18);
			opacity: 0.4;
		}
	}
</style>