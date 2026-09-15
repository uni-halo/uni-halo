<script setup lang="ts">
	import { computed, ref } from 'vue'

	defineOptions({
		options: {
			styleIsolation: 'apply-shared'
		}
	})

	function handleScan() {
		uni.scanCode({
			scanType: ['qrCode'],
			success: (res) => {
				console.log('扫码成功', res)
				// todo: 处理扫码结果 比如跳转到指定页面
			},
			fail: () => {
				uni.showToast({
					title: '扫码失败',
					icon: 'none'
				})
			}
		})
	}
</script>

<template>
	<view class="fixed left-0 top-0 z-100 box-border w-full pt-safe">
		<view class="box-border h-[46px] w-full flex items-center gap-x-4 px-4">
			<view
				class="uh-global-card-glass uh-shadow-xs w-8 h-8 flex items-center justify-center gap-x-2 border rounded-full text-primary"
				@click="handleScan()">
				<wd-icon name="scan" size="30rpx" />
			</view>
		</view>
	</view>
</template>