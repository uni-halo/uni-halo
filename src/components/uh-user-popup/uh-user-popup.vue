<script lang="ts" setup>
	import { storeToRefs } from 'pinia'
	import { isWechat } from '@/utils/platform'
	import { useSettingStore } from '@/store/setting'
	import { useTokenStore } from '@/store/token'
	import { useUserStore } from '@/store/user'
	import { usePermission } from '@/hooks/usePermission'
	import type { PermissionKey } from '@/config/permissions'

	defineOptions({
		options: {
			styleIsolation: 'apply-shared',
		},
	})
	const props = defineProps<IProps>()
	const emits = defineEmits<IEmits>()
	
	const { userInfo } = storeToRefs(useUserStore())
	const { hasLogin } = storeToRefs(useTokenStore())
	
	const settingStore = useSettingStore()
	const { can } = usePermission()

	interface IProps {
		modelValue : boolean
	}

	interface IEmits {
		(e : 'update:modelValue', value : boolean) : void
	}

	const popupVisible = computed({
		get: () => props.modelValue,
		set: (value : boolean) => emits('update:modelValue', value),
	})
	
	const isAdmin = computed(()=>userInfo.value.roles.includes('super-role'))

	/** 管理模块入口清单（按权限显隐） */
	interface IAdminEntry {
		key : string
		icon : string
		label : string
		/** 对应业务权限常量 key */
		permission : PermissionKey
		url : string
	}

	const ADMIN_ENTRIES : IAdminEntry[] = [
		{ key: 'moment', icon: '✏️', label: '瞬间管理', permission: 'MOMENT_MANAGE', url: '/pages-admin/moment-manage/moment-manage' },
		{ key: 'daily', icon: '✅', label: '恋爱清单管理', permission: 'LOVE_DAILY_MANAGE', url: '/pages-admin/love/daily-manage' },
		{ key: 'story', icon: '📖', label: '恋爱故事管理', permission: 'LOVE_STORY_MANAGE', url: '/pages-admin/love/story-manage' },
		{ key: 'album', icon: '📷', label: '相册管理', permission: 'LOVE_ALBUM_MANAGE', url: '/pages-admin/love/album-manage' },
	]

	/** 按权限过滤后的可见入口 */
	const visibleAdminEntries = computed(() => ADMIN_ENTRIES.filter(e => can(e.permission)))

	function handleClose() {
		emits('update:modelValue', false)
	}

	function handleToAdmin(url : string) {
		handleClose()
		uni.navigateTo({
			url,
			animationType: 'slide-in-right',
		})
	}

	function handleLogout() {
		uni.showModal({
			title: '提示',
			content: '确定退出登录吗？',
			success: (res) => {
				if (res.confirm) {
					useTokenStore().logout().then(() => {
						uni.showToast({
							icon: 'none',
							title: '已退出登录'
						})
						handleClose()
					})
				}
			},
		})
	}
</script>

<template>
	<uh-glass-popup v-model="popupVisible" position="left" custom-class="rounded-rt-xl rounded-rb-xl !border"
		safe-area-inset-bottom :z-index="110" hide-when-close>
		<view class="box-border h-full w-52 flex flex-col gap-y-6 px-3 pt-safe">
			<view class="flex shrink-0 items-center justify-between pt-4">
				<text class="text-md font-bold">我的</text>
				<view
					class="uh-global-card-glass h-6 w-6 flex items-center justify-center border rounded-lg text-gray-500 shadow-none !bg-white/5"
					@click="handleClose()">
					<wd-icon name="close" size="16px" />
				</view>
			</view>

			<!-- 用户信息卡片 -->
			<view v-if="hasLogin" class="w-full">
				<view class="uh-global-card-glass !bg-white/5 shadow-none border p-3 rounded-xl flex items-center gap-x-2">
					<image :src="userInfo.avatar" class="w-10 h-10 uh-global-card-glass uh-shadow-xs border rounded-full"></image>
					<view class="flex justify-center flex-col gap-y-1">
						<text class="text-2xs font-semibold text-gray-900">{{ userInfo.nickname}}</text>
						<text class="text-10px text-gray-500 py-0.5 px-2 rounded-md bg-secondary ">{{ isAdmin?'超级管理员':'普通用户' }}</text>
					</view>
				</view>
			</view>

			<!-- 功能入口区域 -->
			<view class="flex-1 w-full flex flex-col">
				<uh-section-title>功能入口</uh-section-title>
				<scroll-view scroll-y :show-scrollbar="false" class="mt-3 flex-1">
					<view class="box-border flex flex-col gap-y-3 ">
						<uh-permission v-for="entry in visibleAdminEntries" :key="entry.key" :permission="entry.permission">
							<view class="uh-global-card-glass shadow-none flex items-center gap-x-3 rounded-xl px-3 py-2.5"
								@click="handleToAdmin(entry.url)">
								<text class="text-sm">{{ entry.icon }}</text>
								<text class="flex-1 text-2xs text-gray-900 dark:text-gray-100">{{ entry.label }}</text>
								<wd-icon name="arrow-right" size="28rpx" custom-class="text-gray-400" />
							</view>
						</uh-permission>
					</view>
				</scroll-view>
			</view>

			<!-- 底部操作栏 -->
			<view v-if="hasLogin" class="box-border w-full flex shrink-0 items-center" :class="[isWechat ? '' : 'pb-3']">
				<uh-button class="flex-1"
					custom-class="flex-1 uh-global-card-glass bg-red-400 border py-2 text-xs text-white !rounded-full"
					@action-click="handleLogout()">
					退出登录
				</uh-button>
			</view>
		</view>
	</uh-glass-popup>
</template>