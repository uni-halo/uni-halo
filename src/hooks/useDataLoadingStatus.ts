import type { DataLoadingStatus } from './useDataLoading'

export const DataLoadingStatusEnum = {
  Loading: 'loading',
  Error: 'error',
  Empty: 'empty',
  Success: 'success',
  NoNetwork: 'noNetwork',
} as const

export function useDataLoadingStatus(status?: DataLoadingStatus) {
  const loadingStatus = ref<DataLoadingStatus>(status ?? DataLoadingStatusEnum.Loading)

  function resetLoadingStatus() {
    loadingStatus.value = DataLoadingStatusEnum.Loading
  }

  function updateLoadingStatus(newStatus: DataLoadingStatus) {
    loadingStatus.value = newStatus
  }

  return {
    loadingStatus,
    resetLoadingStatus,
    updateLoadingStatus,
  }
}
