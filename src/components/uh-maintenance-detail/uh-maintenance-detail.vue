<script lang="ts" setup>
	import { computed } from 'vue'
	import { markdownConfig } from '@/config/markdown'

	defineOptions({
		options: {
			styleIsolation: 'apply-shared'
		}
	})

	const props = withDefaults(defineProps<{
		modelValue ?: boolean
		content ?: string
	}>(), {
		modelValue: false,
		content: '',
	})

	const emit = defineEmits<{
		(e : 'update:modelValue', value : boolean) : void
	}>()

	const show = computed({
		get: () => props.modelValue,
		set: (value : boolean) => {
			emit('update:modelValue', value)
		},
	})

	function close() {
		emit('update:modelValue', false)
	}
</script>

<template>
	<uh-glass-popup v-model="show" position="bottom" :z-index="100" :safe-area-inset-bottom="true"
		custom-class="rounded-xl">
		<view class="box-border px-4 py-4 text-center">
			<text class="text-sm text-gray-900 font-bold">
				维护详情
			</text>
		</view>
		<scroll-view scroll-y :show-scrollbar="false"
			class="box-border max-h-[60vh] px-4 text-2xs text-gray-900 leading-5">
			<mp-html :content="content" lazy-load :domain="markdownConfig.domain" scroll-table selectable
				:tag-style="markdownConfig.tagStyle" :container-style="markdownConfig.containStyle"
				copy-by-long-press />
		</scroll-view>
		<view class="w-full box-border flex items-center p-3">
			<uh-button class="w-full flex-1" custom-class="w-full flex-1 uh-global-card-glass uh-shadow-xs border py-2 !rounded-xl bg-white text-primary" @click="close()">关闭</uh-button>
		</view>
	</uh-glass-popup>
</template>