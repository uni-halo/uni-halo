import { ref } from 'vue';
import { onPageScroll } from '@dcloudio/uni-app';

export function usePageScroll() {
	const scrollY = ref(0);

	onPageScroll((e: any) => {
		scrollY.value = e.scrollTop;
		console.log('滚动数据', scrollY.value);
	});

	return { scrollY };
}
