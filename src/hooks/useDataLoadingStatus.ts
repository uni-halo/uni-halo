export enum DataLoadingStatusEnum {
  Loading = 'loading',
  Error = 'error',
  Empty = 'empty',
  Success = 'success',
}

export function useDataLoadingStatus(status?:DataLoadingStatusEnum) {
  const loadingStatus = ref<DataLoadingStatusEnum>(status??DataLoadingStatusEnum.Loading)

  function resetLoadingStatus() {
    loadingStatus.value = DataLoadingStatusEnum.Loading
  }

  function updateLoadingStatus(newStatus: DataLoadingStatusEnum) {
    loadingStatus.value = newStatus
  }

  return {
    loadingStatus,
    resetLoadingStatus,
    updateLoadingStatus,
  }
}
