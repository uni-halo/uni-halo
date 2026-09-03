<script setup lang="ts">
	import { useSlots } from 'vue'
	const slots = useSlots();
	const hasRightSlot = computed(() => !!slots.right?.())
</script>
 
 <template>
 <view class="w-full flex items-center justify-between">
 	<view class="shrink-0 relative">
 		<text class="font-bold relative z-2">
			<slot></slot>
		</text>
 		<view class="absolute z-1 -right-1 -bottom-0.5 rounded-xl bg-secondary h-4 w-4/5"></view>
 	</view>
 	<view v-if="hasRightSlot" class="flex-1 flex items-center justify-end">
		<slot name="right"></slot>
	</view>
 </view>
 </template>
 