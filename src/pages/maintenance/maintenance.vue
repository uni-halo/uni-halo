<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad, onUnload } from '@dcloudio/uni-app'
	import { useAppConfigStore } from '@/store/appConfig'
	import { checkUrl } from '@/utils/url'
	import { markdownConfig } from '@/config/markdown'
	import { usePluginAvailable } from '@/utils/plugin'
	import type { IPublicMaintenance } from '@/api/types/uni-halo'

	definePage({
		style: {
			navigationStyle: 'custom',
			navigationBarTitleText: '维护中...',
		},
	})

	type ViewState = 'loading' | 'normal' | 'error' | 'maintenance'
	type FromReason = 'plugin' | 'maintenance'

	const uniHaloPluginId = 'plugin-uni-halo'
	/** 默认维护标题(拦截场景未配置维护信息时展示) */
	const DEFAULT_MAINTENANCE_TITLE = '我们正在加油升级！'
	/** 恢复检测轮询间隔(ms):插件激活/维护结束探测 */
	const RECOVERY_POLL_INTERVAL = 30 * 1000

	const store = useAppConfigStore()

	const viewState = ref<ViewState>('loading')
	const maintenance = ref<IPublicMaintenance | null>(null)
	/** 拦截来源(index/首页 ?from=plugin|maintenance);为空 = 手动进入(保留四态) */
	const fromReason = ref<FromReason | null>(null)
	const nowMs = ref(Date.now())
	/** 刷新按钮旋转中 */
	const spinning = ref(false)
	/** Toast 文案(空 = 隐藏) */
	const toast = ref('')
	let timer : ReturnType<typeof setInterval> | null = null
	let recoveryTimer : ReturnType<typeof setInterval> | null = null
	let toastTimer : ReturnType<typeof setTimeout> | null = null
	let refreshing = false

	const isIntercepted = computed(() => !!fromReason.value)
	const isScheduled = computed(() => maintenance.value?.status === 'scheduled')
	const title = computed(() => maintenance.value?.title || DEFAULT_MAINTENANCE_TITLE)
	/** 配置的富文本说明(未配置时展示设计稿默认文案) */
	const description = computed(() => maintenance.value?.description || '')

	/** 应用信息 logo(相对插件内置资源路径 → BASE_API 补全) */
	const appLogo = computed(() => {
		const appInfo = store.configs.appConfig?.appInfo
		const logo = appInfo && typeof appInfo === 'object'
			? (appInfo as { logo ?: string }).logo
			: ''
		return logo ? checkUrl(logo) : ''
	})

	/** 倒计时目标:scheduled → startTime / active → endTime */
	const countdownTarget = computed(() => {
		const info = maintenance.value
		if (!info)
			return ''
		return isScheduled.value ? info.startTime || '' : info.endTime || ''
	})

	const countdownPrefix = computed(() => (isScheduled.value ? '距维护开始' : '预计恢复倒计时'))

	/** 倒计时四格(天/时/分/秒),无目标或已归零为 null */
	const countdownParts = computed(() => {
		const target = countdownTarget.value
		if (!target)
			return null
		const remaining = Math.max(0, Math.floor((new Date(target).getTime() - nowMs.value) / 1000))
		if (remaining <= 0)
			return null
		const pad = (n : number) => String(n).padStart(2, '0')
		return {
			days: pad(Math.floor(remaining / 86400)),
			hours: pad(Math.floor((remaining % 86400) / 3600)),
			minutes: pad(Math.floor((remaining % 3600) / 60)),
			seconds: pad(remaining % 60),
		}
	})

	/** 倒计时备注(本地时间):scheduled → 开始时刻 / active → 预计完成时刻 */
	const etaNote = computed(() => {
		const target = countdownTarget.value
		if (!target)
			return ''
		const date = new Date(target)
		if (Number.isNaN(date.getTime()))
			return ''
		const pad = (n : number) => String(n).padStart(2, '0')
		const hm = `${pad(date.getHours())}:${pad(date.getMinutes())}`
		return isScheduled.value ? `将于 ${hm} 开始维护` : `预计 ${hm} 前完成 · 实际进度可能提前哦～`
	})

	function startTimer() {
		stopTimer()
		timer = setInterval(tick, 1000)
	}

	function stopTimer() {
		if (timer) {
			clearInterval(timer)
			timer = null
		}
	}

	function startRecoveryCheck() {
		stopRecoveryCheck()
		recoveryTimer = setInterval(() => {
			void silentCheck()
		}, RECOVERY_POLL_INTERVAL)
	}

	function stopRecoveryCheck() {
		if (recoveryTimer) {
			clearInterval(recoveryTimer)
			recoveryTimer = null
		}
	}

	/** 每秒刷新倒计时;目标时刻已到 → 静默重拉(服务端可能已切换 scheduled→active 或自动结束) */
	function tick() {
		nowMs.value = Date.now()
		const target = countdownTarget.value
		if (!target) {
			return
		}
		const remaining = new Date(target).getTime() - nowMs.value
		if (Number.isFinite(remaining) && remaining <= 0)
			void silentCheck()
	}

	/**
	 * 恢复检测(拦截场景):强制刷新配置;插件已激活且无维护信息 → 重定向入口页重新走拦截流程。
	 * 拉取失败(服务器停机)保持维护页不打扰。
	 */
	async function silentCheck() {
		if (refreshing) { return }
		refreshing = true
		try {
			await store.bootstrap({ force: true })
			if (fromReason.value === 'plugin') {
				const available = await usePluginAvailable(uniHaloPluginId)
				if (!available) {
					const info = store.configs.maintenance
					if (info) {
						maintenance.value = info
						viewState.value = 'maintenance'
						startTimer()
					}
					return
				}
			}
			const info = store.configs.maintenance
			if (info) {
				maintenance.value = info
				viewState.value = 'maintenance'
				startTimer()
				return
			}
			// 恢复:插件可用且无维护信息(或维护已到点自动结束) → 重定向入口页重新检查
			goIndex()
		}
		catch {
			// 服务器停机/接口异常 → 维持维护页
		}
		finally {
			refreshing = false
		}
	}

	async function load(force = false) {
		if (refreshing) { return }
		refreshing = true
		viewState.value = 'loading'
		maintenance.value = null
		stopTimer()
		stopRecoveryCheck()
		try {
			const { ok } = await store.bootstrap({ force })
			const info = store.configs.maintenance
			if (info) {
				maintenance.value = info
				viewState.value = 'maintenance'
				startTimer()
				if (isIntercepted.value)
					startRecoveryCheck()
			}
			else if (isIntercepted.value) {
				// 拦截场景无维护信息(插件未激活/未配置)→ 默认文案
				maintenance.value = null
				viewState.value = 'maintenance'
				startRecoveryCheck()
			}
			else if (ok) {
				// 拉取成功但无 maintenance 键:未维护(或已到点自动结束)→ 服务正常
				viewState.value = 'normal'
			}
			else {
				viewState.value = 'error'
			}
		}
		catch {
			if (isIntercepted.value) {
				maintenance.value = null
				viewState.value = 'maintenance'
				startRecoveryCheck()
			}
			else {
				viewState.value = 'error'
			}
		}
		finally {
			refreshing = false
		}
	}

	/**
	 * 检查通过 → 重定向入口页(index):由入口页重新执行「插件可用性 + 维护模式」拦截,
	 * 通过后再进入首页/文章详情等(保证任何时刻都从完整门禁通过)。
	 */
	function goIndex() {
		stopTimer()
		stopRecoveryCheck()
		uni.reLaunch({ url: '/pages/index/index' })
	}

	/** Toast 提示(1.8s 自动消失) */
	function showToast(message : string) {
		toast.value = message
		if (toastTimer)
			clearTimeout(toastTimer)
		toastTimer = setTimeout(() => {
			toast.value = ''
		}, 1800)
	}

	/** 刷新看看:转圈 → 静默重查(恢复则回入口页),仍在维护则提示 */
	async function handleRefresh() {
		if (spinning.value) { return }
		spinning.value = true
		await silentCheck()
		spinning.value = false
		if (viewState.value === 'maintenance') {
			showToast('站点仍在维护中，请稍后再试')
		}
	}

	onLoad((options) => {
		const from = options?.from
		fromReason.value = from === 'plugin' || from === 'maintenance' ? from : null
		void load()
	})

	onUnload(() => {
		stopTimer()
		stopRecoveryCheck()
		if (toastTimer) {
			clearTimeout(toastTimer)
		}
	})
</script>

<template>
	<view class="maintenance-page">
		<!-- 加载中 -->
		<view v-if="viewState === 'loading'" class="flex flex-col items-center justify-center py-48">
			<text class="text-[26rpx] text-[#999]">
				加载中...
			</text>
		</view>

		<!-- 服务正常(未维护,手动进入时) -->
		<view v-else-if="viewState === 'normal'"
			class="flex flex-col items-center justify-center px-10 py-48 text-center">
			<text class="text-[64rpx]">
				✅
			</text>
			<text class="mt-6 text-[28rpx] text-[#333]">
				当前服务正常，无需维护
			</text>
			<text class="mt-2 text-[24rpx] text-[#999]">
				如果仍然无法访问，请稍后重试或联系站长
			</text>
			<view class="mt-10">
				<wd-button type="primary" round @click="goIndex">
					返回首页
				</wd-button>
			</view>
		</view>

		<!-- 拉取失败(手动进入,通常为服务器停机中) -->
		<view v-else-if="viewState === 'error'"
			class="flex flex-col items-center justify-center px-10 py-48 text-center">
			<text class="text-[64rpx]">
				⚠️
			</text>
			<text class="mt-6 text-[28rpx] text-[#333]">
				服务暂时无法访问
			</text>
			<text class="mt-2 text-[24rpx] text-[#999]">
				站点可能正在维护中，请稍后重试
			</text>
			<view class="mt-10">
				<wd-button type="primary" plain round @click="load(true)">
					重新加载
				</wd-button>
			</view>
		</view>

		<!-- 维护页(参考 .design/维护页面.html) -->
		<view v-else class="app-container">
			<!-- ===== Hero(无边界淡出) ===== -->
			<view class="hero">
				<view class="blob breathe hero-blob-1 b-white" />
				<view class="blob b-acc hero-blob-2" />
				<view class="blob hero-blob-3 b-white" />

				<view class="medal">
					<view class="medal-bg" />
					<image v-if="appLogo" class="medal-img" :src="appLogo" mode="aspectFill" />
					<wd-icon v-else class="medal-emoji" name="tool" size="52px" />
					<view class="gear gear-1">
						<wd-icon name="settings" size="24px" />
					</view>
					<view class="gear gear-2">
						<wd-icon name="settings" size="16px" />
					</view>
					<view class="sticker st-acc medal-st">
						MAINTENANCE
					</view>
				</view>

				<view class="hero-h1">
					{{ title }}
				</view>
				<view class="doodle" />

				<view class="hero-sub">
					<mp-html v-if="description" :content="description" lazy-load :domain="markdownConfig.domain ?? ''"
						scroll-table selectable :tag-style="markdownConfig.tagStyle"
						:container-style="markdownConfig.containStyle" copy-by-long-press />
					<template v-else>
						<text>为了给你带来更好的体验，站点正在维护升级中</text>
						<text class="block">
							别担心，你的数据都安然无恙 💚
						</text>
					</template>
				</view>
			</view>

			<!-- ===== 内容区 ===== -->
			<view class="layer">
				<view class="bridge bridge-1" />
				<view class="bridge bridge-2" />

				<view class="content">
					<!-- 恢复倒计时 -->
					<view v-if="countdownParts" class="eta-card">
						<view class="eta-wm">
							GO!
						</view>
						<view class="eta-k">
							<wd-icon name="clock-circle" size="14px" />
							{{ countdownPrefix }}
						</view>
						<view class="eta-clock">
							<view class="eta-cell hot">
								<text class="cell-num">{{ countdownParts.days }}</text>
								<text class="cell-unit">天 DAY</text>
							</view>
							<view class="eta-cell">
								<text class="cell-num">{{ countdownParts.hours }}</text>
								<text class="cell-unit">时 HR</text>
							</view>
							<view class="eta-cell">
								<text class="cell-num">{{ countdownParts.minutes }}</text>
								<text class="cell-unit">分 MIN</text>
							</view>
							<view class="eta-cell">
								<text class="cell-num">{{ countdownParts.seconds }}</text>
								<text class="cell-unit">秒 SEC</text>
							</view>
						</view>
						<view v-if="etaNote" class="eta-note">
							{{ etaNote }}
						</view>
					</view>

					<!-- 操作 -->
					<view class="cta-row">
						<view class="btn-refresh ink-btn press" @click="handleRefresh">
							<wd-icon class="refresh-ic" :class="{ spinning }" name="refresh" size="17px" />
							<text>刷新看看</text>
						</view>
					</view>

					<!-- 页脚 -->
					<view class="foot">
						<view class="foot-text">
							升级期间给你带来不便，非常抱歉
							<text class="block">
								去喝杯奶茶等等吧～
							</text>
						</view>
					</view>
				</view>
			</view>

			<!-- Toast -->
			<view v-if="toast" class="toast">
				{{ toast }}
			</view>
		</view>
	</view>
</template>

<style scoped lang="scss">
	$ink: #17181a;
	$ink2: #8a9099;
	$ink3: #c9cdd4;
	$sun: #ffd53d;
	$acc: #b8ec3f;
	$acc-deep: #a7e93b;
	$acc-soft: #ebfabf;
	$acc-pale: #f4fbe0;
	$acc-ink: #63a002;
	$hero: linear-gradient(175deg, #d9f77f 0%, #e8fbaf 52%, #f5fae8 100%);
	$page: #f7f9f1;
	$glow: rgba(168, 232, 52, 0.5);

	.maintenance-page {
		min-height: 100vh;
		background: #e9edf1;
	}

	/* ========== 应用容器 ========== */
	.app-container {
		max-width: 960rpx;
		margin: 0 auto;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background: $page;
		box-shadow: 0 0 60rpx rgba(50, 60, 25, 0.12);
	}

	/* ========== Hero ========== */
	.hero {
		position: relative;
		overflow: hidden;
		flex-shrink: 0;
		padding: calc(var(--status-bar-height) + 76rpx) 40rpx 64rpx;
		background: $hero;
		text-align: center;
	}

	.blob {
		position: absolute;
		border-radius: 50%;
		filter: blur(52rpx);
		pointer-events: none;
		z-index: 0;
	}

	.b-white {
		background: rgba(255, 255, 255, 0.4);
	}

	.b-acc {
		background: $acc;
		opacity: 0.28;
	}

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

	.hero-blob-1 {
		left: -60rpx;
		top: 104rpx;
		width: 260rpx;
		height: 260rpx;
	}

	.hero-blob-2 {
		right: -48rpx;
		top: 40rpx;
		width: 200rpx;
		height: 200rpx;
	}

	.hero-blob-3 {
		right: 72rpx;
		bottom: -40rpx;
		width: 160rpx;
		height: 160rpx;
	}

	/* 勋章 */
	.medal {
		position: relative;
		width: 236rpx;
		height: 236rpx;
		margin: 44rpx auto 0;
		z-index: 2;
	}

	.medal-bg {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: linear-gradient(135deg, $acc-soft, $acc);
		box-shadow:
			0 0 0 12rpx #fff,
			0 28rpx 60rpx rgba(98, 124, 44, 0.22);
		animation: bob 3.2s ease-in-out infinite;
	}

	.medal-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		z-index: 1;
	}

	.medal-emoji {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: $ink;
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

	.gear {
		position: absolute;
		display: flex;
		align-items: center;
		justify-content: center;
		animation: spin 6s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.gear-1 {
		width: 68rpx;
		height: 68rpx;
		right: -28rpx;
		top: -16rpx;
	}

	.gear-2 {
		width: 48rpx;
		height: 48rpx;
		left: -32rpx;
		bottom: 16rpx;
		animation-duration: 4.5s;
		animation-direction: reverse;
	}

	.sticker {
		display: inline-flex;
		align-items: center;
		background: #fff;
		border: 4rpx solid #fff;
		border-radius: 999rpx;
		box-shadow: 0 10rpx 28rpx rgba(90, 110, 45, 0.18);
		font-weight: 800;
		line-height: 1;
		white-space: nowrap;
		position: relative;
		z-index: 2;
	}

	.st-acc {
		background: $acc-soft;
		border-color: $acc-soft;
	}

	.medal-st {
		position: absolute;
		left: 50%;
		transform: translateX(-50%) rotate(-5deg);
		bottom: -28rpx;
		font-size: 22rpx;
		padding: 12rpx 24rpx;
	}

	.rot-l {
		transform: rotate(-7deg);
	}

	/* 标题与副标题 */
	.hero-h1 {
		margin-top: 64rpx;
		font-size: 54rpx;
		line-height: 64rpx;
		font-weight: 900;
		position: relative;
		z-index: 2;
	}

	.doodle {
		width: 224rpx;
		height: 8rpx;
		margin: 8rpx auto 0;
		border-radius: 999rpx;
		background: linear-gradient(90deg, transparent, $acc-deep, transparent);
		position: relative;
		z-index: 2;
	}

	.hero-sub {
		margin-top: 20rpx;
		font-size: 25rpx;
		font-weight: 500;
		color: rgba(23, 24, 26, 0.55);
		position: relative;
		z-index: 2;
		line-height: 1.7;
	}

	/* ========== 内容区 ========== */
	.layer {
		position: relative;
		flex: 1;
	}

	.layer> :not(.bridge) {
		position: relative;
		z-index: 1;
	}

	.bridge {
		position: absolute;
		border-radius: 999rpx;
		filter: blur(44rpx);
		pointer-events: none;
		z-index: 0;
	}

	.bridge-1 {
		top: -52rpx;
		left: 64rpx;
		width: 192rpx;
		height: 192rpx;
		background: $acc-soft;
		opacity: 0.9;
	}

	.bridge-2 {
		top: 300rpx;
		right: -52rpx;
		width: 168rpx;
		height: 168rpx;
		background: $sun;
		opacity: 0.2;
	}

	.content {
		padding: 32rpx 32rpx 68rpx;
		display: flex;
		flex-direction: column;
		gap: 28rpx;
		align-items: center;
	}

	/* 倒计时卡 */
	.eta-card {
		border-radius: 36rpx;
		padding: 36rpx 32rpx;
		text-align: center;
		position: relative;
		overflow: hidden;
		width: 100%;
		background: #fff;
		border: 1rpx solid rgba(112, 138, 42, 0.08);
		box-shadow: 0 4rpx 24rpx rgba(98, 124, 44, 0.08);
	}

	.eta-wm {
		position: absolute;
		right: -12rpx;
		bottom: -48rpx;
		font-size: 176rpx;
		font-weight: 900;
		color: $acc-deep;
		opacity: 0.1;
		line-height: 1;
		pointer-events: none;
	}

	.eta-k {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8rpx;
		font-size: 20rpx;
		font-weight: 800;
		letter-spacing: 2px;
		color: $ink2;
	}

	.eta-clock {
		margin-top: 22rpx;
		display: flex;
		justify-content: center;
		gap: 10rpx;
	}

	.eta-cell {
		min-width: 118rpx;
		padding: 18rpx 8rpx 16rpx;
		border-radius: 24rpx;
		background: $acc-pale;
	}

	.cell-num {
		display: block;
		font-size: 42rpx;
		font-weight: 900;
		line-height: 1;
		color: $ink;
		font-variant-numeric: tabular-nums;
	}

	.eta-cell.hot .cell-num {
		color: $acc-ink;
	}

	.cell-unit {
		display: block;
		margin-top: 10rpx;
		font-size: 18rpx;
		font-weight: 800;
		color: $ink2;
		letter-spacing: 1px;
	}

	.eta-note {
		margin-top: 24rpx;
		font-size: 21rpx;
		color: $ink3;
		font-weight: 500;
	}

	/* 操作区 */
	.cta-row {
		display: flex;
		gap: 20rpx;
		width: 100%;
		margin-top: 4rpx;
	}

	.btn-refresh {
		flex: 1;
		height: 100rpx;
		border-radius: 999rpx;
		font-size: 28rpx;
		font-weight: 800;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 16rpx;
	}

	.ink-btn {
		color: #fff;
		background: linear-gradient(150deg, #3a3e44 0%, #1d1f22 55%, #151619 100%);
		box-shadow:
			0 10rpx 28rpx -10rpx rgba(21, 23, 25, 0.4),
			0 12rpx 36rpx -10rpx $glow,
			inset 0 2rpx 0 rgba(255, 255, 255, 0.16);
	}

	.refresh-ic {
		display: inline-block;
	}

	.refresh-ic.spinning {
		animation: spin 0.7s linear;
	}

	.press {
		transition: transform 0.12s ease;
	}

	.press:active {
		transform: scale(0.94);
	}

	/* 页脚 */
	.foot {
		margin-top: 12rpx;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.foot .sticker {
		font-size: 44rpx;
		padding: 14rpx 22rpx;
	}

	.foot-text {
		margin-top: 18rpx;
		font-size: 21rpx;
		color: $ink3;
		font-weight: 500;
		text-align: center;
		line-height: 1.7;
	}

	/* Toast */
	.toast {
		position: fixed;
		left: 50%;
		bottom: calc(72rpx + env(safe-area-inset-bottom));
		transform: translateX(-50%);
		padding: 18rpx 36rpx;
		border-radius: 999rpx;
		font-size: 24rpx;
		font-weight: 700;
		color: #fff;
		background: linear-gradient(150deg, #3a3e44 0%, #1d1f22 55%, #151619 100%);
		box-shadow:
			0 10rpx 28rpx -10rpx rgba(21, 23, 25, 0.4),
			0 12rpx 36rpx -10rpx $glow,
			inset 0 2rpx 0 rgba(255, 255, 255, 0.16);
		white-space: nowrap;
		z-index: 60;
	}

	:deep(img) {
		max-width: 100%;
		border-radius: 8rpx;
	}
</style>