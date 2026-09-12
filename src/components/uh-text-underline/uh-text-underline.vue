<script setup lang="ts">
	interface IProps {
		customClass?: string
		lineClass?: string
		textClass?: string
	}
	const props = withDefaults(defineProps<IProps>(), {
		customClass: '',
		lineClass: '!h-2/5 uh-rotate-n5',
		textClass: 'font-bold'
	})
</script>
 
 <template>
 	<text class="shrink-0 relative" :class="[props.customClass]">
 		<text class="font-bold relative z-2" :class="[props.textClass]">
			<slot></slot>
		</text>
 		<text class="absolute z-1 -right-1 -bottom-0.5 transform rounded-xl bg-secondary h-3/5 w-4/5" :class="[props.lineClass]"></text>
 	</text>
 </template>

<style scoped lang="scss">
/* 下划线轻微旋转 */
.uh-rotate-n5 {
  transform: rotate(-5deg);
}
</style>