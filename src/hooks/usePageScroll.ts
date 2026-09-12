import { ref } from 'vue';

export function usePageScroll(defaultScrollValue: number = 0) {
	const scrollY = ref(defaultScrollValue);

	function updatePageScrollValue(scrollValue: number) {
		scrollY.value = scrollValue;
	}

	return { scrollY, updatePageScrollValue };
}
