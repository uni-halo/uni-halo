<script setup lang="ts">
	import { useAttrs } from 'vue';
	
	interface IProps {
		customClass ?: string | Array<string>;
	}

	const props = defineProps<IProps>();
	const attrs = useAttrs();
</script>

<template>
	<view v-bind="attrs" class="bg-primary uh-shadow-xs text-black text-sm px-4 py-1.5 rounded-lg" :class="props.customClass">
		<slot></slot>
	</view>
</template>