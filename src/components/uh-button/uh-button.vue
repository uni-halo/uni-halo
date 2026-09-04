<script setup lang="ts">
	interface IProps {
		customClass ?: string | Array<string>;
	}

	interface IEmits {
		(e : 'click') : void;
	}

	const props = defineProps<IProps>();
	const emit = defineEmits<IEmits>();
</script>

<template>
	<view class="box-border bg-primary uh-shadow-xs text-black flex items-center justify-center text-sm px-4 py-1.5 rounded-lg" :class="props.customClass" @click="emit('click')">
		<slot></slot>
	</view>
</template>
