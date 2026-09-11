export const DataLoadingStatusEnum = {
	Loading: 'loading',
	Error: 'error',
	Empty: 'empty',
	Success: 'success',
	NoNetwork: 'noNetwork'
} as const;

export type DataLoadingStatus = (typeof DataLoadingStatusEnum)[keyof typeof DataLoadingStatusEnum];

const LoadMoreStatusText = {
	loadMore: '哎嘿，往下还有数据哦~',
	loading: '稍等，正在加载中哦~',
	noMore: '呜呜，没有更多数据了~',
	error: '呜呜，加载失败了哦~',
	noNetwork: '呜呜，网络好像有点问题哦~'
} as const;

export type LoadMoreStatus = keyof typeof LoadMoreStatusText

export interface LoadMoreStatusOption {
	// 是否激活加载
	active?: boolean;
	status?: LoadMoreStatus;
	text?: string;
	hasNext?: boolean;
}

export function useDataLoadingStatus(defaultStatus?: DataLoadingStatus) {
	const loadingStatus = ref<DataLoadingStatus>(defaultStatus ?? DataLoadingStatusEnum.Loading);

	const _loadMoreStatus = ref<LoadMoreStatus>({
		active: false,
		hasNext: false,
		status: 'loadMore',
		text: ''
	});

	const loadMoreStatus = computed(() => {
		const result = {
			..._loadMoreStatus.value
		};
		if (!_loadMoreStatus.value.text) {
			result.text = LoadMoreStatusText[_loadMoreStatus.value.status];
		}
		console.log('会触发吗？', _loadMoreStatus.value);
		console.log('会触发吗 result', result);
		return result;
	});

	function resetLoadMoreStatus() {
		_loadMoreStatus.value.active = false;
		_loadMoreStatus.value.hasNext = false;
		_loadMoreStatus.value.status = 'loadMore';
		_loadMoreStatus.value.text = '';
	}

	function resetLoadingStatus() {
		loadingStatus.value = DataLoadingStatusEnum.Loading;
		resetLoadMoreStatus();
	}

	function updateLoadingStatus(status: DataLoadingStatus) {
		loadingStatus.value = status;
	}

	function updateLoadMoreStatus(status: LoadMoreStatusOption) {
		_loadMoreStatus.value.active = status.active;
		_loadMoreStatus.value.status = status.status;
		_loadMoreStatus.value.hasNext = status.hasNext;
		_loadMoreStatus.value.text = status.text;
	}

	return {
		loadingStatus,
		loadMoreStatus,
		resetLoadingStatus,
		resetLoadMoreStatus,
		updateLoadingStatus,
		updateLoadMoreStatus
	};
}
