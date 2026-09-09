import { ref } from 'vue';

export function useSettingsPopup() {
	const settingsPopupVisible = ref(false);

	function openSettingsPopup() {
		settingsPopupVisible.value = true;
	}

	function closeSettingsPopup() {
		settingsPopupVisible.value = false;
		console.log('Settings popup closed', settingsPopupVisible.value);
	}

	return { settingsPopupVisible, openSettingsPopup, closeSettingsPopup };
}
