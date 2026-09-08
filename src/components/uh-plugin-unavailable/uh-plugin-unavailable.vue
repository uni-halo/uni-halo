<script lang="ts" setup>
	import { computed } from 'vue'
	import { NeedPlugins } from '@/hooks/usePluginAvailable'

	const props = withDefaults(defineProps<{
		pluginId : string
		errorText ?: string
		checking : boolean
		customClass ?: string
	}>(), {
		errorText: '',
	})

	const emit = defineEmits<{
		(e : 'on-refresh') : void
	}>()

	/** 插件信息(未在清单中时兜底) */
	const pluginInfo = computed(() => {
		return NeedPlugins.get(props.pluginId) ?? { pluginId: props.pluginId, name: '未找到插件' }
	})

	function handleRefresh() {
		if (props.checking) { return }
		emit('on-refresh')
	}
</script>

<template>
	<view v-if="pluginInfo"
		class="max-w-3/5 mx-auto my-auto box-border flex flex-col items-center justify-center gap-6 text-sm"
		:class="props.customClass">

		<wd-icon class-prefix="uhemoji-icon" name="-cry" size="160rpx"></wd-icon>

		<view class="box-border text-lg text-gray-900 font-bold">
			{{ pluginInfo.name }}
		</view>

		<view v-if="errorText" class=" text-yellow-500 text-sm">
			{{ errorText }}
		</view>

		<view class="w-full flex flex-col gap-y-4">
			<uh-button custom-class="!rounded-full py-2 !uh-shadow-xs" @click="handleRefresh()">
				{{props.checking?'正在刷新':'刷新试试'}}
			</uh-button>
			<!-- #ifdef MP-WEIXIN -->
			<!-- 微信端客服会话只能由原生 button 的 open-type="contact" 唤起,故此处不用 uh-button(view 实现) -->
			<button
				class="uh-contact-btn bg-white py-2 px-4 !rounded-full text-black text-sm leading-none flex items-center justify-center"
				open-type="contact" hover-class="none">提交反馈</button>
			<!-- #endif -->
		</view>
	</view>
</template>

<style lang="scss">
	/* #ifdef MP-WEIXIN */
	/* 重置微信原生 button 默认样式(灰底、字号行高、::after 细边框),保证与 uh-button(view 实现)视觉一致 */
	.uh-contact-btn::after {
		border: none;
	}

	/* #endif */
</style>