<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { storeToRefs } from 'pinia'
	import { useAppConfigStore } from '@/store/appConfig'
	import { useTokenStore } from '@/store/token'
	import { checkImageUrl } from '@/utils/url'

	definePage({
		style: {
			navigationBarTitleText: '登录',
			navigationStyle: 'custom',
		},
	})

	const { configs } = storeToRefs(useAppConfigStore())
	const tokenStore = useTokenStore()

	/* ---------- 应用信息(顶部 logo 展示,getConfigs 下发于 featureConfig.profile.appInfo) ---------- */
	const appInfo = computed(() => {
		const info = configs.value.featureConfig?.profile?.appInfo as
			| { name ?: string, logo ?: string }
			| undefined
		return {
			name: info?.name || 'uni-halo',
			logo: info?.logo ? checkImageUrl(info.logo) : '',
		}
	})

	/* ---------- 登录配置(getConfigs loginConfig 组,两开关全关即整体不可用) ---------- */
	const loginConfig = computed(() => configs.value.loginConfig?.loginConfig)
	const passwordLoginEnabled = computed(() => loginConfig.value?.passwordLoginEnabled !== false)
	const wechatLoginEnabled = computed(() => loginConfig.value?.wechatLoginEnabled === true)

	const activeTab = ref<'password' | 'wechat'>('password')
	const username = ref('')
	const password = ref('')
	const loading = ref(false)

	/** 可用登录方式(按插件端配置过滤;配置未就绪时默认展示账号密码登录) */
	const availableTabs = computed(() => {
		const tabs : ('password' | 'wechat')[] = []
		if (passwordLoginEnabled.value) {
			tabs.push('password')
		}
		// #ifdef MP-WEIXIN
		if (wechatLoginEnabled.value) {
			tabs.push('wechat')
		}
		// #endif
		return tabs
	})

	/** 账号密码登录(tokenStore.login 内部完成 token 存储与用户信息写入) */
	async function doPasswordLogin() {
		if (!username.value || !password.value) {
			uni.showToast({ icon: 'none', title: '请输入账号和密码' })
			return
		}
		loading.value = true
		try {
			await tokenStore.login({ username: username.value, password: password.value })
			handleLoginSuccess()
		}
		catch (error) {
			console.error('账号密码登录失败:', error)
		}
		finally {
			loading.value = false
		}
	}

	/** 微信登录(仅微信小程序可用) */
	async function doWechatLogin() {
		// #ifdef MP-WEIXIN
		loading.value = true
		try {
			await tokenStore.wxLogin()
			handleLoginSuccess()
		}
		catch (error) {
			console.error('微信登录失败:', error)
		}
		finally {
			loading.value = false
		}
		// #endif
	}

	/** 登录成功统一处理:返回来源页 */
	function handleLoginSuccess() {
		setTimeout(() => {
			uni.navigateBack()
		}, 600)
	}
</script>

<template>
	<view class="relative box-border min-h-screen w-screen flex flex-col bg-[#f5fae8] overflow-hidden">
		<!-- 顶部自定义导航 -->
		<uh-navbar default-title="登录" :need-placeholder="false" />

		<view
			class="pointer-events-none fixed left-0 top-0 z-0 h-[46vh] w-full bg-gradient-to-b from-[#d9f77f] via-[#e8fbaf] to-[#f5fae8]" />

		<view
			class="breathe pointer-events-none absolute left-[-80rpx] top-[calc(var(--status-bar-height)+40rpx)] z-0 h-[280rpx] w-[280rpx] rounded-full bg-white/40 uh-blur-52" />
		<view
			class="pointer-events-none absolute right-[-60rpx] top-[180rpx] z-0 h-[220rpx] w-[220rpx] rounded-full bg-[rgba(184,236,63,0.28)] uh-blur-52" />
		<view
			class="pointer-events-none absolute bottom-[120rpx] right-[80rpx] z-0 h-[180rpx] w-[180rpx] rounded-full bg-[#ffd53d] opacity-20 uh-blur-44" />
		<view
			class="pointer-events-none absolute bottom-[280rpx] left-[-40rpx] z-0 h-[200rpx] w-[200rpx] rounded-full bg-[#ebfabf] opacity-90 uh-blur-44" />

		<view class="relative z-10 box-border px-6 w-screen h-screen flex flex-col items-center justify-center gap-y-6">
			<!-- 顶部:应用 logo + 欢迎语 -->
			<view class="flex flex-col items-center">
				<view class="bob relative h-24 w-24">
					<view
						class="flex items-center justify-center absolute inset-0 rounded-full overflow-hidden from-[#ebfabf] to-[#b8ec3f] bg-gradient-to-br uh-global-card-glass border-2 uh-shadow-xs">
						<image v-if="appInfo.logo" class="h-full w-full" :src="appInfo.logo"
							mode="aspectFill" />
						<wd-icon v-else class-prefix="uhemoji-icon" name="-smile-" size="100rpx"
							class="text-gray-900" />
					</view>
				</view>
				<view class="mt-6 text-xl text-gray-900 font-black">
					欢迎回来
				</view>
				<view class="mt-2 text-[24rpx] text-black/50 font-medium">
					登录 {{ appInfo.name }}，开启你的专属之旅
				</view>
			</view>

			<!-- 登录内容区 -->
			<view class="w-full box-border flex flex-col items-center">
				<!-- 登录能力整体关闭提示 -->
				<view v-if="availableTabs.length === 0"
					class="uh-global-card-glass uh-shadow-xs border box-border w-full rounded-2xl p-8 text-center">
					<view class="text-sm text-gray-500">
						登录功能暂未开启
					</view>
				</view>

				<!-- 登录卡片(玻璃拟态) -->
				<view v-else class="uh-global-card-glass uh-shadow-xs box-border w-full rounded-2xl p-6">
					<!-- 平台切换(仅一种登录方式时不显示切换条) -->
					<view v-if="availableTabs.length > 1" class="mb-6 flex rounded-full bg-white/60 p-1">
						<view v-for="tab in availableTabs" :key="tab"
							class="flex-1 rounded-full py-1.5 text-center text-2xs"
							:class="activeTab === tab ? 'bg-primary text-gray-900' : 'text-gray-500'"
							@click="activeTab = tab">
							{{ tab === 'password' ? '账号密码' : '微信登录' }}
						</view>
					</view>

					<!-- 账号密码登录表单 -->
					<template v-if="activeTab === 'password' && passwordLoginEnabled">
						<wd-input v-model="username" custom-class="uh-login-input" prefix-icon="user" no-border
							placeholder="请输入账号" :disabled="loading" />
						<wd-input v-model="password" custom-class="uh-login-input mt-3" prefix-icon="lock" show-password
							no-border placeholder="请输入密码" :disabled="loading" @confirm="doPasswordLogin" />
						<uh-button class="w-full"
							custom-class="mt-6 uh-global-card-glass bg-primary !py-2 uh-shadow-xs border w-full !rounded-full text-gray-900 border-none"
							:class="loading ? 'opacity-60' : ''" @click="doPasswordLogin">
							{{ loading ? '登录中...' : '登 录' }}
						</uh-button>
					</template>

					<!-- 微信登录 -->
					<template v-else-if="wechatLoginEnabled">
						<!-- #ifdef MP-WEIXIN -->
						<view class="box-border flex flex-col items-center justify-center py-12">
							<button
								class="w-full uh-global-card-glass bg-primary w-full !py-2 !rounded-full text-xs text-gray-900"
								:class="loading ? 'opacity-60' : ''" :disabled="loading" @click="doWechatLogin">
								{{ loading ? '登录中...' : '微信一键登录' }}
							</button>
						</view>
						<!-- #endif -->
					</template>
				</view>
			</view>
			<!-- 页脚 -->
			<view class="relative z-10 box-border py-6 w-full">
				<uh-page-copyright />
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
	:deep(.uh-login-input) {
		box-sizing: border-box;
		height: 88rpx;
		padding: 0 24rpx;
		background-color: rgb(255 255 255 / 65%);
		border-radius: 24rpx;
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

	/* logo 浮动 */
	.bob {
		animation: bob 3.2s ease-in-out infinite;
	}

	@keyframes bob {

		0%,
		100% {
			transform: translateY(0) rotate(-2deg);
		}

		50% {
			transform: translateY(-14rpx) rotate(2deg);
		}
	}
</style>