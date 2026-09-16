<script setup lang="ts">
	defineOptions({
		options: {
			styleIsolation: 'apply-shared'
		}
	})

	interface IProps {
		customClass ?: string | Array<string>;
	}

	interface IEmits {
		(e : 'click') : void;
		(e : 'action-click') : void;
	}

	const props = defineProps<IProps>();
	const emits = defineEmits<IEmits>();

	function handleClick() {
		emits('action-click');
		emits('click');
	}
</script>

<template>
	<view
		class="box-border bg-primary uh-shadow-xs text-black flex items-center justify-center text-sm px-4 py-1.5 rounded-lg"
		:class="props.customClass" @click="handleClick">
		<slot />
	</view>
</template>