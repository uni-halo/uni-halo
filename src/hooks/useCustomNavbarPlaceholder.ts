import { ref } from 'vue';

/**
 * 自定义导航顶部位置
 */
export function useCustomNavbarPlaceholder(customNavbarHeight?: number) {
	const height = ref(0);

	function init() {
		const winInfo = uni.getWindowInfo();
		const safeAreaTop = winInfo.safeArea.top;

		height.value += safeAreaTop + 10;
		// #ifndef H5
		height.value += customNavbarHeight ?? 46;
		// #endif
		
		console.log('最终高度', height.value);
	}

	onMounted(init);

	return { height };
}
