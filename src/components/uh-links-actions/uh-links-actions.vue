<script lang="ts" setup>
	defineOptions({
		options: {
			styleIsolation: 'apply-shared'
		}
	})
	
	const props = withDefaults(defineProps<{
		/** 需要显示的按钮:apply=提交申请,info=友链信息;包含即显示 */
		actions ?: string[]
	}>(), {
		actions: () => ['apply', 'info'],
	})

	const emit = defineEmits<{
		(e : 'apply') : void
		(e : 'info') : void
	}>()
</script>

<template>
	<view class="fixed bottom-0 left-1/2 z-10 flex items-center justify-center pb-safe uh-translate-x-center">
		<view
			class="uh-global-card-glass box-border flex items-center justify-center gap-2 border rounded-full p-1 text-primary">
			<view v-if="actions.includes('apply')"
				class="uh-global-card-glass box-border py-2 flex flex-1 items-center justify-center gap-x-1 border rounded-full px-8 shadow-none"
				@click="emit('apply')">
				<wd-icon name="edit" size="32rpx" />
				<text class="shrink-0 text-xs text-gray-900 font-semibold">提交申请</text>
			</view>
			<view v-if="actions.includes('info')"
				class="uh-global-card-glass box-border py-2 flex flex-1 items-center justify-center gap-x-1 border rounded-full px-8 shadow-none"
				@click="emit('info')">
				<wd-icon name="info-circle" size="32rpx" />
				<text class="shrink-0 text-xs text-gray-900 font-semibold">友链信息</text>
			</view>
		</view>
	</view>
</template>

<style scoped lang="scss"> 
	.uh-translate-x-center {
		transform: translateX(-50%);
	}
</style>