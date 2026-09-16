<script lang="ts" setup>
	import { ref } from 'vue'
	import { storeToRefs } from 'pinia'
	import { useSettingStore } from '@/store/setting'
	import { isWechat } from '@/utils/platform'
	import { useTokenStore } from '@/store/token'

	const settingStore = useSettingStore()

	defineOptions({
		options: {
			styleIsolation: 'apply-shared'
		}
	})

	interface IProps {
		modelValue : boolean
	}

	const props = defineProps<IProps>()

	interface IEmits {
		(e : 'update:modelValue', value : boolean) : void,
	}

	const emits = defineEmits<IEmits>()


	const popupVisible = computed({
		get: () => props.modelValue,
		set: (value : boolean) => emits('update:modelValue', value),
	})


	function handleClose() {
		emits('update:modelValue', false)
	}
</script>

<template>
	<uh-glass-popup v-model="popupVisible" position="left" custom-class="rounded-rt-xl rounded-rb-xl !border"
		safe-area-inset-bottom :z-index="110" hide-when-close>
		<view class="w-52 box-border px-3 pt-safe flex flex-col gap-y-6 h-full">
			<view class="shrink-0 pt-4 flex items-center justify-between">
				<text class="text-md font-bold">我的</text>
				<view
					class="uh-global-card-glass shadow-none !bg-white/5 border flex h-6 w-6 items-center justify-center rounded-lg text-gray-500"
					@click="handleClose()">
					<wd-icon name="close" size="16px" />
				</view>
			</view>

			<!-- 用户信息卡片 -->
			<view class="w-full">
				这里显示登录的用户信息，包括头像、昵称等信息
			</view>

			<!-- 功能入口区域 -->
			<scroll-view scroll-y :show-scrollbar="false" class="flex-1">
				<view class="box-border flex flex-col gap-y-4">

					todo：这里显示不同管理模块的入口（登录后根据不同角色权限显示不同的入口清单）

				</view>
			</scroll-view>

			<!-- 底部操作栏 -->
			<view class="box-border w-full shrink-0 flex items-center" :class="[isWechat?'':'pb-3']">
				<uh-button class="flex-1"
					custom-class="flex-1 uh-global-card-glass bg-red-400 border py-2 text-xs text-white !rounded-full">
					退出登录
				</uh-button>
			</view>
		</view>
	</uh-glass-popup>
</template>