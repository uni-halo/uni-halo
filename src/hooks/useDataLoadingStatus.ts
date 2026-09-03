import type { DataLoadingStatus } from './useDataLoading'

/**
 * @deprecated 请改用 useDataLoading:状态由 hook 内部流转,
 * 无需再在 try/catch 里手工调用 updateLoadingStatus 搬运状态。
 * 本文件保留仅为兼容存量页面(category/article-detail 等),后续逐步迁移。
 */
export const DataLoadingStatusEnum = {
  Loading: 'loading',
  Error: 'error',
  Empty: 'empty',
  Success: 'success',
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
