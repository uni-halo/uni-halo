import { ref } from 'vue';

export function useSettingsPopup() {
	const settingsPopupVisible = ref(false);

	function openSettingsPopup() {
		settingsPopupVisible.value = true;
	}

	function closeSettingsPopup() {
		settingsPopupVisible.value = false;
	}

	return { settingsPopupVisible, openSettingsPopup, closeSettingsPopup };
}
