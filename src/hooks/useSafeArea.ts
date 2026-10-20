import { computed } from 'vue'

export function useSafeArea() {
  const windowInfo = uni.getWindowInfo()

  const safeBottomStyle = computed(() => {
    let safeBottom = windowInfo.safeAreaInsets.bottom
    // #ifdef H5
    safeBottom += 14
    // #endif
    if (safeBottom === 0) {
      safeBottom = 14
    }
    return {
      paddingBottom: `${safeBottom}px`,
    }
  })

  return { safeBottomStyle }
}
