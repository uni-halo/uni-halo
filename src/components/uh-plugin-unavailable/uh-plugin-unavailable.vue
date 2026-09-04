<script lang="ts" setup>
	import { computed } from 'vue'
	import { NeedPlugins } from '@/hooks/usePluginAvailable'

	const props = withDefaults(defineProps<{
		/** 插件名称(与 NeedPlugins 中的 id 对应) */
		pluginId : string
		errorText ?: string
		useDecoration ?: boolean
		useBorder ?: boolean
		customStyle ?: Record<string, string>
	}>(), {
		errorText: '',
		useDecoration: true,
		useBorder: true,
		customStyle: () => ({}),
	})

	const emit = defineEmits<{
		(e : 'on-refresh') : void
	}>()

	/** 插件信息(未在清单中时兜底) */
	const pluginInfo = computed(() => {
		const info = NeedPlugins.get(props.pluginId)
		return info || {
			id: props.pluginId,
			name: props.pluginId,
			desc: '',
			logo: '',
			url: '',
		}
	})

	const defaultStyle = {
		width: '80vw',
		borderRadius: '24rpx',
	}

	const calcCustomStyle = computed(() => ({
		...defaultStyle,
		...props.customStyle,
	}))
 
</script>

<template>
	<view v-if="pluginInfo"
		class="uh-plugin-unavailable mx-auto my-auto box-border flex flex-col gap-6 p-10 text-[28rpx]"
		:class="{ border: useBorder, decoration: useDecoration }" :style="[calcCustomStyle]">
		<!-- 图标 -->
		<image class="plugin-logo box-border h-[120rpx] w-[120rpx] rounded-3xl" :src="pluginInfo.logo"
			mode="scaleToFill" />
		<!-- 名称 -->
		<view class="plugin-name box-border text-[32rpx] text-[#333] font-bold">
			{{ pluginInfo.name }}
		</view>

		<!-- 自定义错误提示 -->
		<view v-if="errorText" class="plugin-tip box-border border-2 rounded-xl border-dashed px-5 py-2.5 text-[24rpx]"
			style="border-color: #f2c97d; color: #f0a020;">
			{{ errorText }}
		</view>

		<!-- 反馈按钮/复制地址 -->
		<view class="plugin-btns box-border w-full">
			<!-- #ifdef MP-WEIXIN -->
			<wd-button type="warning" plain block size="medium" open-type="contact">
				提交反馈
			</wd-button>
			<!-- #endif -->
		</view>
		<!-- 刷新按钮 -->
		<view class="flex justify-center">
			<wd-button size="small" plain type="info" @click="emit('on-refresh')">
				刷新试试
			</wd-button>
		</view>

		<view class="plugin-copyright text-[20rpx] text-[#999]" style="transform: scale(0.9) translateY(20px);">
			提示：请确保 Halo 博客已安装相关插件
		</view>
	</view>
</template>

<style scoped lang="scss">
	.uh-plugin-unavailable {
		&.border {
			border: 2rpx solid #eee;
		}

		&.decoration {
			background-color: rgb(255 255 255 / 95%);
			box-shadow: 0 0 12rpx rgb(226 232 240 / 35%);
			backdrop-filter: blur(6rpx);
			border-top: 12rpx solid rgb(3 169 244);
		}
	}
</style>