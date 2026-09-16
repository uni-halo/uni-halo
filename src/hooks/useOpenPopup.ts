import { ref } from 'vue';

export function useOpenPopup() {
	const popupVisible = ref(false);

	function openPopup() {
		popupVisible.value = true;
	}

	function closePopup() {
		popupVisible.value = false;
	}

	return { popupVisible, openPopup, closePopup };
}
