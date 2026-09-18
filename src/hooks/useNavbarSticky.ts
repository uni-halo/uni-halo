import { ref } from 'vue';

/**
 * 自定义导航栏吸顶偏移量
 * (返回 height = 状态栏 + 导航栏高度,供 wd-sticky offset-top 使用)
 */
export function useNavbarSticky(customNavbarHeight?: number) {
	const height = ref(0);

	function init() {
		const winInfo = uni.getWindowInfo();
		const safeAreaTop = winInfo.safeArea.top;

		height.value += safeAreaTop;
		// #ifdef H5
		height.value += 10;
		// #endif
		// #ifndef H5
		height.value += customNavbarHeight ?? 46;
		// #endif
	}

	onMounted(init);

	return { height };
}
