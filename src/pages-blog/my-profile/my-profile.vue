<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onPageScroll, onShow } from '@dcloudio/uni-app'
	import { storeToRefs } from 'pinia'
	import { useDialog } from '@wot-ui/ui'
	import { DIALOG_CONFIRM_BUTTON_PROPS, DIALOG_CANCEL_BUTTON_PROPS } from '@/config/dialog'
	import {
		bindMyWechat,
		getMyWechatBinding,
		getWxCode,
		unbindMyWechat,
	} from '@/api/auth'
	import type { IMyWechatBinding } from '@/api/auth'
	import {
		changeMyPassword,
		getCurrentUserDetail,
		getUcCurrentUser,
		updateUserProfile,
		uploadUserAvatar,
	} from '@/api/user'
	import { usePageScroll } from '@/hooks/usePageScroll'
	import { useTokenStore } from '@/store/token'
	import { useUserStore } from '@/store/user'
	import { isWechat } from '@/utils/platform'
	import { checkAvatarUrl } from '@/utils/url'
	import { sleep } from '@/utils/common'

	definePage({
		style: {
			navigationBarTitleText: '我的资料',
			navigationStyle: 'custom',
		},
	})

	const dialog = useDialog()
	const { scrollY, updatePageScrollValue } = usePageScroll()
	const tokenStore = useTokenStore()
	const userStore = useUserStore()
	const { userInfo } = storeToRefs(userStore)

	const isAdmin = computed(() => userInfo.value.roles?.includes('super-role'))

	/** 统一提取报错文案(插件端错误体在 error.data.message) */
	function errText(error : any, fallback : string) {
		return error?.data?.message || error?.message || fallback
	}

	/* ---------------- 头像 ---------------- */
	const avatarUploading = ref(false)

	function chooseAvatar() {
		if (avatarUploading.value)
			return
		const onPicked = (filePath : string) => doUploadAvatar(filePath)

		// #ifdef MP-WEIXIN
		uni.chooseMedia({
			count: 1,
			mediaType: ['image'],
			success: (res) => {
				const file = res.tempFiles?.[0]
				if (file?.tempFilePath)
					onPicked(file.tempFilePath)
			},
		})
		// #endif
		// #ifndef MP-WEIXIN
		uni.chooseImage({
			count: 1,
			success: (res) => {
				const path = res.tempFilePaths?.[0]
				if (path)
					onPicked(path)
			},
		})
		// #endif
	}

	/**
	 * 上传头像（Console multipart 端点）。
	 * 注意：Halo 服务端只写头像注解，spec.avatar 由 User Reconciler 异步回填，
	 * 本次响应里的 spec.avatar 是旧值——上传成功后轮询 profile 直到头像变化。
	 */
	async function doUploadAvatar(filePath : string) {
		if (!userInfo.value.username) {
			uni.showToast({ icon: 'none', title: '登录状态异常，请重新登录' })
			return
		}
		avatarUploading.value = true
		const prevAvatar = userInfo.value.avatar || ''
		try {
			await uploadUserAvatar(userInfo.value.username, filePath)
			// 轮询 profile 等待 Reconciler 回填 spec.avatar(最多 ~3s)
			let refreshed = false
			for (let i = 0; i < 5; i++) {
				await sleep(600)
				const info = await userStore.fetchUserInfo()
				if (info.avatar && info.avatar !== prevAvatar) {
					refreshed = true
					break
				}
			}
			uni.showToast({ icon: 'none', title: refreshed ? '头像已更新' : '头像已上传，稍后自动生效' })
		}
		catch (error : any) {
			console.error('头像上传失败:', error)
			uni.showToast({ icon: 'none', title: errText(error, '头像上传失败') })
		}
		finally {
			avatarUploading.value = false
		}
	}

	/* ---------------- 昵称 ---------------- */
	const editingNickname = ref(false)
	const nicknameDraft = ref('')
	const nicknameSaving = ref(false)

	/** 整行可点进编辑态 */
	function startEditNickname() {
		nicknameDraft.value = userInfo.value.nickname || ''
		editingNickname.value = true
	}

	function cancelEditNickname() {
		editingNickname.value = false
	}

	async function saveNickname() {
		const displayName = nicknameDraft.value.trim()
		if (!displayName) {
			uni.showToast({ icon: 'none', title: '昵称不能为空' })
			return
		}
		if (displayName === userInfo.value.nickname) {
			cancelEditNickname()
			return
		}
		nicknameSaving.value = true
		try {
			// 先取完整 User（含 metadata.version 乐观锁），仅改 displayName 后回写
			const detailRes = await getCurrentUserDetail()
			const user = detailRes.user || (detailRes as any)
			if (!user?.metadata?.name) {
				throw new Error('获取用户资料失败')
			}
			user.spec = { ...(user.spec || {}), displayName }
			await updateUserProfile(user)
			// 重新拉取 profile 同步 store（弹窗/个人主页即时生效）
			await userStore.fetchUserInfo()
			editingNickname.value = false
			uni.showToast({ icon: 'none', title: '昵称已更新' })
		}
		catch (error : any) {
			console.error('昵称保存失败:', error)
			uni.showToast({ icon: 'none', title: errText(error, '昵称保存失败') })
		}
		finally {
			nicknameSaving.value = false
		}
	}

	/* ---------------- 修改密码（UC 端点） ---------------- */
	const passwordSheet = ref(false)
	const passwordSet = ref(true)
	const oldPassword = ref('')
	const newPassword = ref('')
	const confirmPassword = ref('')
	const passwordSaving = ref(false)

	async function openPasswordSheet() {
		oldPassword.value = ''
		newPassword.value = ''
		confirmPassword.value = ''
		passwordSheet.value = true
		// 未设置过密码（如微信自动建号）时旧密码可留空
		try {
			const res = await getUcCurrentUser()
			passwordSet.value = res.data?.passwordSet !== false
		}
		catch {
			passwordSet.value = true
		}
	}

	async function savePassword() {
		const pwd = newPassword.value
		if (passwordSet.value && !oldPassword.value) {
			uni.showToast({ icon: 'none', title: '请输入原密码' })
			return
		}
		if (!pwd || pwd.length < 5) {
			uni.showToast({ icon: 'none', title: '新密码至少 5 位' })
			return
		}
		if (pwd !== confirmPassword.value) {
			uni.showToast({ icon: 'none', title: '两次输入的新密码不一致' })
			return
		}
		passwordSaving.value = true
		try {
			await changeMyPassword(passwordSet.value ? oldPassword.value : undefined, pwd)
			passwordSheet.value = false
			uni.showToast({ icon: 'none', title: '密码修改成功，请重新登录' })
			// 修改密码后登录态已失效：退出登录清空 token 与用户信息，返回上一页
			setTimeout(async () => {
				await tokenStore.logout()
				uni.navigateBack()
			}, 600)
		}
		catch (error : any) {
			console.error('密码修改失败:', error)
			uni.showToast({ icon: 'none', title: errText(error, '密码修改失败') })
		}
		finally {
			passwordSaving.value = false
		}
	}

	/* ---------------- 微信绑定 ---------------- */
	const binding = ref<IMyWechatBinding | null>(null)
	const bindingLoading = ref(false)
	const bindSubmitting = ref(false)

	const isBound = computed(() => binding.value?.bound === true)
	const boundAtText = computed(() => {
		const at = binding.value?.boundAt
		return at ? String(at).slice(0, 10) : ''
	})

	async function fetchBinding() {
		bindingLoading.value = true
		try {
			const res = await getMyWechatBinding()
			binding.value = res.data || null
		}
		catch (error) {
			console.error('获取微信绑定状态失败:', error)
			binding.value = null
		}
		finally {
			bindingLoading.value = false
		}
	}

	/** 一键绑定微信（仅微信小程序环境；身份由 token 携带，code 换微信身份） */
	async function handleBindWechat() {
		if (bindSubmitting.value)
			return
		bindSubmitting.value = true
		try {
			const loginRes = await getWxCode()
			await bindMyWechat(loginRes.code)
			uni.showToast({ icon: 'none', title: '绑定成功' })
			await fetchBinding()
		}
		catch (error : any) {
			console.error('微信绑定失败:', error)
			uni.showToast({ icon: 'none', title: errText(error, '微信绑定失败') })
		}
		finally {
			bindSubmitting.value = false
		}
	}

	/** 解除绑定（幂等：未绑定时同样成功） */
	function handleUnbindWechat() {
		dialog.confirm({
			title: '提示',
			msg: '解绑后将无法使用微信一键登录该账号，确定解除绑定吗？',
			zIndex: 9999,
			confirmButtonProps: DIALOG_CONFIRM_BUTTON_PROPS,
			cancelButtonProps: DIALOG_CANCEL_BUTTON_PROPS,
	}).then(async () => {
		try {
			await unbindMyWechat()
			// 直接本地置为未绑定,不立即重查:服务端 UserConnection 删除是两阶段异步,
			// 删除指令返回后残留的 deleting 记录仍可能让重查返回 bound=true;
			// 下次进入页面 fetchBinding 自然拿到最终状态
			binding.value = {
				username: userInfo.value.username,
				bound: false,
				providerUserId: null,
				boundAt: null,
			}
			uni.showToast({ icon: 'none', title: '已解除绑定' })
		}
		catch (error : any) {
			console.error('解绑失败:', error)
			uni.showToast({ icon: 'none', title: errText(error, '解绑失败') })
		}
	}).catch(() => {})
	}

	/* ---------------- 退出登录（复用「我的」弹窗既有流程） ---------------- */
	function handleLogout() {
		dialog.confirm({
			title: '提示',
			msg: '确定退出登录吗？',
			zIndex: 9999,
			confirmButtonProps: DIALOG_CONFIRM_BUTTON_PROPS,
			cancelButtonProps: DIALOG_CANCEL_BUTTON_PROPS,
		}).then(async () => {
			await tokenStore.logout()
			uni.showToast({ icon: 'none', title: '已退出登录' })
			setTimeout(() => uni.navigateBack(), 600)
		}).catch(() => {})
	}

	/* ---------------- 生命周期 ---------------- */
	onPageScroll((option : Page.PageScrollOption) => {
		updatePageScrollValue(option.scrollTop)
	})

	onShow(() => {
		if (!tokenStore.updateNowTime().hasLogin) {
			uni.showToast({ icon: 'none', title: '请先登录' })
			setTimeout(() => uni.navigateBack(), 600)
			return
		}
		// 拉最新 profile 回显（头像/昵称存原始地址，渲染时 checkAvatarUrl 补全）
		userStore.fetchUserInfo().catch(() => {})
		fetchBinding()
	})
</script>

<template>
	<wd-dialog />
	<view class="box-border min-h-screen bg-page">
		<uh-navbar :scroll-y="scrollY" default-title="我的资料" title-color="text-gray-900" :need-placeholder="true" />

		<view class="box-border flex flex-col gap-y-5 py-3 px-4">
			<!-- 头像卡片 -->
			<view class="uh-global-card-glass uh-shadow-xs flex flex-col items-center gap-y-2 rounded-2xl py-6"
				@click="chooseAvatar">
				<view class="relative">
					<image :src="checkAvatarUrl(userInfo.avatar)"
						class="uh-global-card-glass uh-shadow-xs h-22 w-22 rounded-full" mode="aspectFill" />
					<view
						class="uh-global-card-glass absolute bottom-0 right-0 h-7 w-7 flex items-center justify-center rounded-full border">
						<wd-icon name="camera" size="14px" custom-class="text-gray-500" />
					</view>
					<view v-if="avatarUploading"
						class="absolute inset-0 flex items-center justify-center rounded-full bg-black/30">
						<wd-loading :size="20" color="#ffffff" />
					</view>
				</view>
				<text class="text-md text-gray-900 font-bold">{{ userInfo.nickname || userInfo.username }}</text>
				<text class="text-2xs text-gray-400">点击头像更换</text>
			</view>

			<!-- 账号资料 -->
			<view class="flex flex-col">
				<uh-section-title>账号资料</uh-section-title>
				<view class="uh-global-card-glass uh-shadow-xs mt-3 overflow-hidden rounded-2xl">
					<!-- 昵称(整行可点进编辑) -->
					<view class="flex items-center gap-x-3 px-4 py-3.5"
						:class="editingNickname ? '' : 'border-b border-black/5'"
						@click="!editingNickname && startEditNickname()">
						<wd-icon name="edit" size="36rpx" custom-class="text-gray-900 dark:text-gray-100" />
						<text class="shrink-0 text-2xs text-gray-900 font-semibold">昵称</text>
						<view class="flex flex-1 items-center justify-end gap-x-2">
							<template v-if="editingNickname">
								<wd-input v-model="nicknameDraft" no-border custom-class="uh-profile-input" focus
									placeholder="请输入昵称" :disabled="nicknameSaving" :maxlength="20"
									@confirm="saveNickname" />
								<text class="shrink-0 text-2xs text-gray-400" @click.stop="cancelEditNickname">取消</text>
								<text class="shrink-0 text-2xs text-gray-900 font-semibold"
									:class="nicknameSaving ? 'opacity-60' : ''" @click.stop="saveNickname">
									{{ nicknameSaving ? '保存中' : '保存' }}
								</text>
							</template>
							<template v-else>
								<text class="truncate text-2xs text-gray-500">{{ userInfo.nickname || '-' }}</text>
								<wd-icon name="arrow-right" size="28rpx" custom-class="text-gray-400" />
							</template>
						</view>
					</view>
					<!-- 用户名(资源 name,不可改) -->
					<view class="flex items-center gap-x-3 border-b border-black/5 px-4 py-3.5">
						<wd-icon name="user" size="36rpx" custom-class="text-gray-900 dark:text-gray-100" />
						<text class="shrink-0 text-2xs text-gray-900 font-semibold">用户名</text>
						<view class="flex flex-1 items-center justify-end gap-x-2">
							<text class="text-2xs text-gray-500">{{ userInfo.username || '-' }}</text>
							<text
								class="uh-global-card-glass rounded-md border bg-white/40 px-1.5 py-0.5 text-20rpx text-gray-400 shadow-none">不可修改</text>
						</view>
					</view>
					<!-- 角色 -->
					<view class="flex items-center gap-x-3 border-b border-black/5 px-4 py-3.5">
						<wd-icon name="idcard" size="36rpx" custom-class="text-gray-900 dark:text-gray-100" />
						<text class="shrink-0 text-2xs text-gray-900 font-semibold">角色</text>
						<view class="flex flex-1 items-center justify-end">
							<text
								class="rounded-full bg-secondary px-2 py-0.5 text-20rpx text-[#4d7c0f]">{{ isAdmin ? '超级管理员' : '普通用户' }}</text>
						</view>
					</view>
					<!-- 邮箱 -->
					<view class="flex items-center gap-x-3 px-4 py-3.5">
						<wd-icon name="email" size="36rpx" custom-class="text-gray-900 dark:text-gray-100" />
						<text class="shrink-0 text-2xs text-gray-900 font-semibold">邮箱</text>
						<view class="flex flex-1 items-center justify-end">
							<text class="truncate text-2xs text-gray-500">{{ userInfo.email || '-' }}</text>
						</view>
					</view>
				</view>
			</view>

			<!-- 账号绑定 -->
			<view class="flex flex-col">
				<uh-section-title>账号绑定</uh-section-title>
				<view class="uh-global-card-glass uh-shadow-xs mt-3 flex items-center gap-x-3 rounded-2xl px-4 py-4">
					<view
						class="uh-global-card-glass h-11 w-11 flex shrink-0 items-center justify-center rounded-xl bg-green-400/10 shadow-none">
						<wd-icon name="message" size="46rpx" custom-class="text-green-500" />
					</view>
					<view class="flex min-w-0 flex-1 flex-col gap-y-0.5">
						<view class="flex items-center gap-x-1.5">
							<view class="h-2 w-2 rounded-full"
								:class="isBound ? 'bg-primary' : 'bg-gray-300'" />
							<text class="text-2xs text-gray-900 font-bold">
								{{ bindingLoading ? '查询中...' : isBound ? '已绑定微信' : '未绑定微信' }}
							</text>
						</view>
						<text class="text-xs text-gray-400">
							可在微信小程序内一键登录
						</text>
					</view>
					<template v-if="!bindingLoading">
						<uh-button v-if="isBound"
							custom-class="uh-global-card-glass border !rounded-full border-red-400/30 bg-red-400/10 px-4 py-1.5 text-xs text-red-400 shadow-none"
							@action-click="handleUnbindWechat">
							解除绑定
						</uh-button>
						<uh-button v-else-if="isWechat"
							custom-class="!rounded-full !bg-green-500 px-4 py-1.5 text-xs text-white"
							:class="bindSubmitting ? 'opacity-60' : ''" @action-click="handleBindWechat">
							{{ bindSubmitting ? '绑定中' : '一键绑定' }}
						</uh-button>
					</template>
				</view>
			</view>

			<!-- 账号安全 -->
			<view class="flex flex-col">
				<uh-section-title>账号安全</uh-section-title>
				<view class="uh-global-card-glass uh-shadow-xs mt-3 overflow-hidden rounded-2xl">
					<view class="flex items-center gap-x-3 px-4 py-3.5" @click="openPasswordSheet">
						<wd-icon name="lock" size="36rpx" custom-class="text-gray-900 dark:text-gray-100" />
						<text class="shrink-0 text-2xs text-gray-900 font-semibold">修改密码</text>
						<view class="flex flex-1 items-center justify-end gap-x-2">
							<text class="text-2xs text-gray-400">{{ passwordSet ? '已设置密码' : '未设置密码' }}</text>
							<wd-icon name="arrow-right" size="28rpx" custom-class="text-gray-400" />
						</view>
					</view>
				</view>
			</view>

			<!-- 退出登录 -->
			<view class="mt-2 box-border w-full pb-6">
				<uh-button
					custom-class="uh-global-card-glass w-full border border-red-400/30 bg-red-400/80 py-2.5 text-2xs text-white !rounded-full"
					@action-click="handleLogout()">
					退出登录
				</uh-button>
			</view>
		</view>

		<!-- 修改密码弹层(底部玻璃弹层,取消/确认) -->
		<uh-glass-popup v-model="passwordSheet" :hide-when-close="false" position="bottom" :z-index="100"
			custom-class="rounded-xl">
			<view class="box-border px-4 py-4">
				<view class="mb-3 flex items-center justify-between">
					<text class="text-md font-bold">修改密码</text>
				</view>
				<view class="flex flex-col gap-y-3">
					<wd-input v-if="passwordSet" v-model="oldPassword" custom-class="uh-profile-input" show-password
						prefix-icon="lock" no-border placeholder="请输入原密码" :disabled="passwordSaving" />
					<wd-input v-model="newPassword" custom-class="uh-profile-input" show-password prefix-icon="lock"
						no-border placeholder="请输入新密码(至少 5 位)" :disabled="passwordSaving" />
					<wd-input v-model="confirmPassword" custom-class="uh-profile-input" show-password
						prefix-icon="lock" no-border placeholder="请再次输入新密码" :disabled="passwordSaving" />
					<text v-if="!passwordSet" class="text-2xs text-gray-400">
						当前账号未设置过密码（如微信自动建号），可直接设置新密码
					</text>
				</view>
				<view class="mt-4 flex items-center justify-center gap-x-3">
					<uh-button custom-class="flex-1 uh-global-card-glass uh-shadow-xs border py-2 !rounded-xl bg-white/90"
						@click="passwordSheet = false">
						取消
					</uh-button>
					<uh-button
						custom-class="flex-1 uh-global-card-glass uh-shadow-xs border py-2 !rounded-xl bg-primary text-gray-900"
						:class="passwordSaving ? 'opacity-60' : ''" @action-click="savePassword">
						{{ passwordSaving ? '保存中' : '确定' }}
					</uh-button>
				</view>
			</view>
		</uh-glass-popup>
	</view>
</template>

<style scoped lang="scss">
	:deep(.uh-profile-input) {
		box-sizing: border-box;
		height: 80rpx;
		padding: 0 24rpx;
		background-color: rgb(255 255 255 / 65%);
		border-radius: 20rpx;
		width: 100%;
	}
</style>
