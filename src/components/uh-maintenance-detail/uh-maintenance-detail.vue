<script lang="ts" setup>
	import { computed } from 'vue'
	import { markdownConfig } from '@/config/markdown'

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
</script>

<template>
	<wd-popup v-model="show" position="bottom" :z-index="200" :safe-area-inset-bottom="true" closable
		custom-class="rounded-lt-4 rounded-rt-4">
		<view class="flex flex-col bg-white">
			<view class="box-border px-4 py-4 text-center">
				<text class="text-[30rpx] text-[#17181a] font-bold">
					维护详情
				</text>
			</view>
			<scroll-view scroll-y
				class="box-border max-h-[60vh] px-[32rpx] pb-4 text-[26rpx] text-[#3a3e44] leading-[1.8]">
				<mp-html :content="content" lazy-load :domain="markdownConfig.domain ?? ''" scroll-table selectable
					:tag-style="markdownConfig.tagStyle" :container-style="markdownConfig.containStyle"
					copy-by-long-press />
			</scroll-view>
		</view>
	</wd-popup>
</template>