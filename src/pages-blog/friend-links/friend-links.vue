<script lang="ts" setup>
	import { computed, ref, watch } from 'vue'
	import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
	import { getFriendLinkGroupList, getFriendLinkList } from '@/api/halo'
	import { getMiniProgramLinkGroupedList } from '@/api/uni-halo'
	import { useAppConfigStore } from '@/store/appConfig'
	import { useSettingStore } from '@/store/setting'
	import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
	import { checkAvatarUrl, checkImageUrl } from '@/utils/url'
	import { NeedPluginIds } from '@/hooks/usePluginAvailable'
	import type { ILink, ILinkGroup } from '@/api/types/halo'
	import type { IMiniProgramLink, IMiniProgramLinkGroupVo } from '@/api/types/uni-halo'

	definePage({
		style: {
			navigationBarTitleText: '友情链接',
			enablePullDownRefresh: true,
			navigationStyle: 'custom',
		},
	})

	const appConfigStore = useAppConfigStore()
	const settingStore = useSettingStore()

	const haloPluginConfigs = computed(() => appConfigStore.configs.pluginConfig)
	const globalAppSettings = computed(() => settingStore.settings)

	/* ---------------- 依赖插件(参考 gallery 对象传参模式) ---------------- */
	/** 站点 tab:PluginLinks */
	const { pluginId: sitePluginId, checking: siteChecking, tips: siteTips, available: sitePluginAvailable, check: checkSitePluginAvailable } = usePluginAvailable({
		pluginId: NeedPluginIds.PluginLinks,
		tips: '检测到当前插件没有安装或者启用，无法使用友情链接功能哦，请联系管理员',
	})
	/** 小程序 tab:plugin-uni-halo */
	const { pluginId: miniPluginId, checking: miniChecking, tips: miniTips, available: miniPluginAvailable, check: checkMiniPluginAvailable } = usePluginAvailable({
		pluginId: NeedPluginIds.PluginUniHalo,
		tips: '检测到当前插件没有安装或者启用，无法使用小程序链接功能哦，请联系管理员',
	})

	/** 重新检测站点插件:可用则拉取友链数据(供 uh-plugin-unavailable 刷新按钮) */
	async function handleSitePluginRefresh() {
		if (await checkSitePluginAvailable())
			handleGetLinkGroupData()
	}

	/** 重新检测小程序插件:可用则拉取小程序链接数据(供 uh-plugin-unavailable 刷新按钮) */
	async function handleMiniPluginRefresh() {
		if (await checkMiniPluginAvailable())
			handleGetMiniProgramLinks()
	}

	/* ---------------- tabs ---------------- */
	const activeTabIndex = ref(0)

	/** 顶部 tab 定义(同收藏页胶囊 chip;审核模式下小程序 tab 隐藏) */
	const friendLinkTabs = computed(() => [
		{ key: 'site', label: '站点' },
		...(appConfigStore.auditModeEnabled ? [] : [{ key: 'mini', label: '小程序' }]),
	])

	function handleOnTabChange(e : { index : number }) {
		activeTabIndex.value = e.index
	}

	// 审核模式下小程序 tab 隐藏,强制停留在站点 tab
	watch(() => appConfigStore.auditModeEnabled, (enabled) => {
		if (enabled)
			activeTabIndex.value = 0
	})

	/* ==================== 站点 tab(plugin-links) ==================== */
	/* ---------------- 状态 ---------------- */
	const { loadingStatus: siteLoadingStatus, updateLoadingStatus: updateSiteLoadingStatus } = useDataLoadingStatus()
	const queryParams = ref({ size: 10, page: 1 })
	const detail = ref<{ show : boolean, data : ILink | null }>({ show: false, data: null })
	const hasNext = ref(false)
	const isLoadMore = ref(false)
	const loadMoreText = ref('')
	const linkGroupList = ref<ILinkGroup[]>([])
	const dataList = ref<ILink[]>([])

	/* ---------------- 数据加载 ---------------- */
	function findLinkGroupDisplayNameByGroupMetadataName(groupName ?: string) : string {
		if (linkGroupList.value.length === 0) { return groupName || '未分组' }
		const found = linkGroupList.value.find(item => item.metadata.name === groupName)
		return found?.spec.displayName || groupName || '未分组'
	}

	async function handleGetLinkGroupData() {
		try {
			const res = await getFriendLinkGroupList({ page: 1, size: 0 })
			linkGroupList.value = res.data || []
			handleGetData()
		}
		catch (err) {
			console.error(err)
			updateSiteLoadingStatus(DataLoadingStatusEnum.Error)
		}
	}

	async function handleGetData() {
		if (!isLoadMore.value) {
			updateSiteLoadingStatus(DataLoadingStatusEnum.Loading)
		}
		loadMoreText.value = ''

		try {
			const res = await getFriendLinkList({ ...queryParams.value })
			hasNext.value = res.data.hasNext
			// 审核模式:站点链接仅展示选中 LinkGroup 分组内的
			let items = res.data.items
			if (appConfigStore.auditModeEnabled) {
				const auditGroupNames = appConfigStore.auditData.spec?.linkGroups || []
				items = items.filter(item => item.spec.groupName && auditGroupNames.includes(item.spec.groupName))
			}
			const list = items.map(item => ({
				...item,
				spec: {
					...item.spec,
					logo: checkAvatarUrl(item.spec.logo),
					groupName: findLinkGroupDisplayNameByGroupMetadataName(item.spec.groupName),
				},
			}))
			dataList.value = dataList.value.concat(list)
			setTimeout(() => {
				updateSiteLoadingStatus(
					dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success,
				)
				loadMoreText.value = res.data.hasNext ? '上拉加载更多' : '呜呜，没有更多数据啦~'
			}, 500)
		}
		catch (err) {
			console.error(err)
			updateSiteLoadingStatus(DataLoadingStatusEnum.Error)
			loadMoreText.value = '加载失败，请下拉刷新！'
		}
		finally {
			setTimeout(() => {
				uni.stopPullDownRefresh()
			}, 500)
		}
	}

	/* ---------------- 站点交互 ---------------- */
	function handleOnLinkEvent(link : ILink) {
		detail.value = { show: true, data: link }
	}

	function handleCopyLink(link : ILink) {
		uni.setClipboardData({
			data: `${link.spec.displayName}:${link.spec.url}`,
			showToast: false,
			success: () => {
				uni.showToast({ icon: 'none', title: '链接复制成功！' })
			},
			fail: () => {
				uni.showToast({ icon: 'none', title: '复制失败！' })
			},
		})
	}

	function toSubmitLinkPage() {
		uni.navigateTo({ url: '/pages-blog/submit-link/submit-link' })
	}

	function handleToTopPage(duration = 500) {
		uni.pageScrollTo({
			scrollTop: 0,
			duration,
			fail: (err) => {
				console.error('回顶失败', err)
			},
		})
	}

	function calcSiteThumbnail(val ?: string) : string {
		if (!val)
			return ''
		const _val = val.endsWith('/') ? val : `${val}/`
		return `https://image.thum.io/get/width/1000/crop/800/${_val}`
	}

	/* ==================== 小程序 tab(plugin-uni-halo) ==================== */
	/* ---------------- 状态 ---------------- */
	const { loadingStatus: miniLoadingStatus, updateLoadingStatus: updateMiniLoadingStatus } = useDataLoadingStatus()
	const miniGroups = ref<IMiniProgramLinkGroupVo[]>([])
	const miniDetail = ref<{ show : boolean, data : IMiniProgramLink | null }>({ show: false, data: null })
	const applyShow = ref(false)

	/* ---------------- 数据加载 ---------------- */
	async function handleGetMiniProgramLinks() {
		updateMiniLoadingStatus(DataLoadingStatusEnum.Loading)
		try {
			const res = await getMiniProgramLinkGroupedList()
			miniGroups.value = res.data || []
			setTimeout(() => {
				updateMiniLoadingStatus(
					miniGroups.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success,
				)
			}, 500)
		}
		catch (err) {
			console.error(err)
			updateMiniLoadingStatus(DataLoadingStatusEnum.Error)
		}
		finally {
			setTimeout(() => {
				uni.stopPullDownRefresh()
			}, 500)
		}
	}

	function handleOnMiniLinkEvent(link : IMiniProgramLink) {
		miniDetail.value = { show: true, data: link }
	}

	function handleOpenApply() {
		applyShow.value = true
	}

	function handleApplyClose(data : { isSubmit : boolean, refresh : boolean }) {
		applyShow.value = false
		if (data.refresh)
			handleGetMiniProgramLinks()
	}

	/** 复制小程序地址 */
	function handleCopyMiniProgramCode(link : IMiniProgramLink) {
		const url = link.spec?.link
		if (!url) {
			uni.showToast({ icon: 'none', title: '该小程序未填写跳转地址' })
			return
		}
		uni.setClipboardData({
			data: url,
			showToast: false,
			success: () => {
				uni.showToast({ icon: 'none', title: '地址复制成功！' })
			},
			fail: () => {
				uni.showToast({ icon: 'none', title: '复制失败！' })
			},
		})
	}

	/** 预览太阳码(支持长按识别/保存) */
	function handlePreviewMiniProgramCode(link : IMiniProgramLink) {
		const code = link.spec?.miniProgramCode
		if (!code)
			return
		uni.previewImage({
			urls: [checkImageUrl(code)],
			current: checkImageUrl(code),
		})
	}

	/** 保存太阳码到相册 */
	function handleSaveMiniProgramCode(link : IMiniProgramLink) {
		const code = link.spec?.miniProgramCode
		if (!code)
			return
		uni.showLoading({ title: '保存中...' })
		uni.downloadFile({
			url: checkImageUrl(code),
			success: (res) => {
				uni.saveImageToPhotosAlbum({
					filePath: res.tempFilePath,
					success: () => {
						uni.showToast({ icon: 'none', title: '已保存到相册' })
					},
					fail: () => {
						uni.showModal({
							title: '保存失败',
							content: '请检查相册权限后重试',
							showCancel: false,
						})
					},
					complete: () => {
						uni.hideLoading()
					},
				})
			},
			fail: () => {
				uni.hideLoading()
				uni.showToast({ icon: 'none', title: '图片下载失败' })
			},
		})
	}

	/* ---------------- 生命周期 ---------------- */
	onLoad(async () => {
		await Promise.all([
			checkSitePluginAvailable(),
			checkMiniPluginAvailable(),
		])
		if (sitePluginAvailable.value)
			handleGetLinkGroupData()
		if (miniPluginAvailable.value)
			handleGetMiniProgramLinks()
		if (!sitePluginAvailable.value && !miniPluginAvailable.value)
			uni.stopPullDownRefresh()
	})

	onPullDownRefresh(() => {
		if (activeTabIndex.value === 0) {
			if (!sitePluginAvailable.value) {
				uni.stopPullDownRefresh()
				return
			}
			isLoadMore.value = false
			queryParams.value.page = 1
			dataList.value = []
			handleGetData()
		}
		else {
			if (!miniPluginAvailable.value) {
				uni.stopPullDownRefresh()
				return
			}
			handleGetMiniProgramLinks()
		}
	})

	onReachBottom(() => {
		if (activeTabIndex.value === 0) {
			if (!sitePluginAvailable.value) { return }
			if (hasNext.value) {
				queryParams.value.page += 1
				isLoadMore.value = true
				handleGetData()
			}
			else {
				uni.showToast({ icon: 'none', title: '没有更多数据了' })
			}
		}
		else {
			uni.showToast({ icon: 'none', title: '没有更多数据了' })
		}
	})
</script>

<template>
	<view class="app-page min-h-screen w-screen flex flex-col bg-page">
		<!-- 自定义导航 -->
		<uh-navbar default-title="友情链接" title-color="text-gray-900" />

		<!-- 顶部 -->
		<wd-sticky>
			<scroll-view scroll-x class="w-full whitespace-nowrap">
				<view class="flex gap-2 px-3 pb-1 pt-3">
					<view v-for="(tab, index) in friendLinkTabs" :key="tab.key"
						class="uh-global-card-glass uh-shadow-xs inline-block border rounded-2xl px-5 py-1.5 text-sm"
						:class="activeTabIndex === index ? 'bg-primary font-bold' : 'text-gray-500'"
						@click="handleOnTabChange({ index })">
						{{ tab.label }}
					</view>
				</view>
			</scroll-view>
		</wd-sticky>

		<!-- ==================== 站点 tab ==================== -->
		<template v-if="activeTabIndex === 0">
			<uh-plugin-unavailable v-if="!sitePluginAvailable" :plugin-id="sitePluginId" :error-text="siteTips"
				:checking="siteChecking" @on-refresh="handleSitePluginRefresh" />
			<template v-else>
				<view v-if="siteLoadingStatus !== 'success'">
					<uh-data-loading :loading-status="siteLoadingStatus" empty-text="啊偶,博主还没有朋友呢~"
						@refresh="handleGetData" />
				</view>

				<view v-else class="content pt-4">
					<!-- 友链列表 -->
					<view class="box-border flex flex-col gap-4 px-4 pb-4">
						<view v-for="link in dataList" :key="link.metadata?.name || link.spec.displayName">
							<view class="uh-global-card-glass overflow-hidden box-border flex rounded-xl p-3"
								@click="handleOnLinkEvent(link)">
								<image class="h-16 w-16 shrink-0 rounded-lg" :src="link.spec.logo" mode="aspectFill" />
								<view class="overflow-hidden box-border flex flex-1 flex-col justify-center pl-4">
									<view class="flex items-center text-sm text-gray-900 font-bold">
										<text
											class="shrink-0 mr-3 rounded-md bg-secondary px-1.5 py-0.5 text-xs text-[#4d7c0f] font-normal">{{ link.spec.groupName || '暂未分组' }}</text>
										<text class="flex-1 truncate">{{ link.spec.displayName }}</text>
									</view>
									<view class="mt-1 overflow-hidden truncate whitespace-nowrap text-xs text-gray-400">
										站点地址：{{ link.spec.url }}
									</view>
									<view class="mt-2 overflow-hidden truncate whitespace-nowrap text-xs text-gray-600">
										博客简介：{{ link.spec.description || '这个博主很懒，没写简介~' }}
									</view>
								</view>
							</view>
						</view>
					</view>

					<!-- 悬浮按钮 -->
					<view class="flot-buttons fixed bottom-10 right-4 z-999 flex flex-col gap-1.5">
						<view v-if="!haloPluginConfigs?.linksSubmitPlugin?.enabled"
							class="fab-btn uh-global-card-glass h-10 w-10 flex items-center justify-center rounded-full"
							@click="toSubmitLinkPage">
							<wd-icon name="edit" size="20px" color="#6b7280" />
						</view>
					</view>

					<!-- 详情弹窗 -->
					<uh-glass-popup v-model="detail.show" position="bottom" :z-index="999" custom-class="rounded-xl !border">
						<view class="relative w-full flex items-center justify-around box-border px-4 pt-4">
							<view class="w-full flex flex-col gap-y-1">
								<text class="text-md font-bold">站点详情</text>
							</view>
							<view
								class="absolute right-4 top-4 w-6 h-6 uh-global-card-glass shadow-none border rounded-lg text-center"
								@click="miniDetail.show = false">
								<wd-icon name="close" size="32rpx" class="text-gray-500"></wd-icon>
							</view>
						</view>
						<scroll-view v-if="detail.data" :scroll-y="true" :show-scrollbar="false"
							class="box-border p-4 max-h-[60vh]">
							<view class="flex">
								<image class="h-20 w-20 shrink-0 rounded-2xl uh-global-card-glass"
									:src="checkImageUrl(detail.data.spec.logo)" mode="aspectFill" />
								<view class="ml-4 flex flex-1 flex-col gap-y-1 justify-center">
									<view class="text-lg text-gray-900 font-bold">
										{{ detail.data.spec.displayName }}
									</view>
									<view class="flex items-center gap-x-2">
										<text class="uh-global-card-glass border uh-shadow-xs text-xs text-gray-500 rounded-lg bg-secondary px-2 py-0.5 text-gray-900">{{ detail.data.spec.groupName }}</text>
										<text class="uh-global-card-glass border uh-shadow-xs text-xs text-gray-500 rounded-lg bg-secondary px-2 py-0.5 text-gray-900">
											复制地址
										</text>
									</view>
									<view @click="handleCopyLink(detail.data)">
										<text
											class="text-xs text-gray-900">{{ detail.data.spec.url }}</text>
									</view>
								</view>
							</view>
							<view class="poup-desc mt-4 text-[28rpx] text-gray-600 leading-[1.6]">
								{{ detail.data.spec.description || '这个博主很懒，没写简介~' }}
							</view>
						</scroll-view>
					</uh-glass-popup>

					<view class="load-text py-5 text-center text-xs text-gray-400">
						{{ loadMoreText }}
					</view>
				</view>
			</template>
		</template>

		<!-- ==================== 小程序 tab ==================== -->
		<template v-else>
			<uh-plugin-unavailable v-if="!miniPluginAvailable" :plugin-id="miniPluginId" :error-text="miniTips"
				:checking="miniChecking" @on-refresh="handleMiniPluginRefresh" />
			<template v-else>
				<uh-data-loading v-if="miniLoadingStatus !== 'success'" :loading-status="miniLoadingStatus"
					empty-text="还没有收录的小程序呢~" @refresh="handleGetMiniProgramLinks" />
				<view v-else class="content flex flex-1 flex-col">
					<!-- 分组列表 -->
					<view class="box-border flex-1 p-3">
						<view v-for="group in miniGroups" :key="group.groupName || 'ungrouped'" class="group-item mb-8">
							<view class="mb-4 flex items-center">
								<text class="mr-2 inline-block h-[28rpx] w-[8rpx] rounded-full bg-secondary" />
								<text
									class="text-[30rpx] text-gray-900 font-bold">{{ group.displayName || '未分组' }}</text>
								<text class="ml-3 text-xs text-gray-400">（{{ group.links.length }}）</text>
							</view>
							<view class="group-cards flex flex-col gap-4">
								<view v-for="link in group.links" :key="link.metadata?.name"
									class="uh-global-card-glass box-border uh-shadow-xs flex items-center rounded-2xl p-3"
									@click="handleOnMiniLinkEvent(link)">
									<image class="h-16 w-16 shrink-0 rounded-lg"
										:src="checkImageUrl(link.spec?.miniProgramCode)" mode="aspectFill" />
									<view class="box-border flex flex-1 flex-col pl-4">
										<view
											class="overflow-hidden truncate whitespace-nowrap text-[30rpx] text-gray-900 font-bold">
											{{ link.spec?.displayName }}
										</view>
										<view v-if="link.spec?.authorName"
											class="mini-author mt-1 overflow-hidden truncate whitespace-nowrap text-xs text-gray-400">
											{{ link.spec.authorName }}
										</view>
										<view
											class="mini-desc mt-1 overflow-hidden truncate whitespace-nowrap text-xs text-gray-500">
											{{ link.spec?.description || '暂无简介~' }}
										</view>
									</view>
									<wd-icon name="arrow-right" size="36rpx" class="text-primary" />
								</view>
							</view>
						</view>
					</view>

					<!-- 申请收录悬浮按钮 -->
					<view class="fixed bottom-10 right-4 z-50">
						<view
							class="box-border flex flex-col w-10 h-10 items-center justify-center rounded-full bg-gray-900"
							@click="handleOpenApply">
							<text class="text-xs text-white">申请</text>
						</view>
					</view>
				</view>

				<!-- 小程序详情弹窗 -->
				<uh-glass-popup v-model="miniDetail.show" :z-index="999" position="bottom" custom-class="rounded-xl !border">
					<view class="relative w-full flex items-center justify-around box-border px-4 pt-4">
						<view class="w-full flex flex-col gap-y-1">
							<text class="text-md font-bold">小程序详情</text>
						</view>
						<view
							class="absolute right-4 top-4 w-6 h-6 uh-global-card-glass shadow-none border rounded-lg text-center"
							@click="miniDetail.show = false">
							<wd-icon name="close" size="32rpx" class="text-gray-500"></wd-icon>
						</view>
					</view>
					<scroll-view v-if="miniDetail.data" :scroll-y="true" :show-scrollbar="false"
						class="box-border p-4 max-h-[60vh]">
						<!-- 太阳码大图(点击预览/长按保存) -->
						<view class="code-area flex flex-col items-center">
							<image class="code-img h-32 w-32 rounded-xl"
								:src="checkImageUrl(miniDetail.data.spec?.miniProgramCode)" mode="aspectFill"
								@click="handlePreviewMiniProgramCode(miniDetail.data)"
								@longpress="handleSaveMiniProgramCode(miniDetail.data)" />
							<view class="code-tip mt-3 flex items-center text-xs text-gray-400">
								<wd-icon name="picture" size="14px" color="#a8a294" />
								<text class="ml-1">点击预览，长按保存太阳码</text>
							</view>
						</view>

						<!-- 名称与分组 -->
						<view class="mini-head mt-5 flex items-center">
							<text
								class="mini-name text-[34rpx] text-gray-900 font-bold">{{ miniDetail.data.spec?.displayName }}</text>
							<text v-if="miniDetail.data.spec?.groupName"
								class="group-tag ml-3 rounded-md bg-secondary px-2 py-0.5 text-[20rpx] text-[#4d7c0f]">
								{{ miniDetail.data.spec.groupName }}
							</text>
						</view>

						<!-- 描述 -->
						<view v-if="miniDetail.data.spec?.description"
							class="mini-desc mt-4 text-[28rpx] text-gray-600 leading-[1.6]">
							{{ miniDetail.data.spec.description }}
						</view>

						<!-- 作者信息 -->
						<view
							v-if="miniDetail.data.spec?.authorName || miniDetail.data.spec?.avatar || miniDetail.data.spec?.website"
							class="mini-author-info mt-5 flex items-center rounded-xl bg-[#f6f3ee] p-4">
							<image v-if="miniDetail.data.spec?.avatar"
								class="author-avatar h-[72rpx] w-[72rpx] shrink-0 rounded-full"
								:src="checkAvatarUrl(miniDetail.data.spec.avatar)" mode="aspectFill" />
							<view class="author-detail ml-4 flex flex-1 flex-col">
								<text v-if="miniDetail.data.spec?.authorName"
									class="author-name text-[28rpx] text-gray-900 font-medium">{{ miniDetail.data.spec.authorName }}</text>
								<text v-if="miniDetail.data.spec?.website"
									class="author-website mt-1 overflow-hidden truncate whitespace-nowrap text-xs text-gray-400"
									@click="handleCopyMiniProgramCode(miniDetail.data)">
									网站：{{ miniDetail.data.spec.website }}
								</text>
							</view>
						</view>

						<!-- 小程序地址 -->
						<view v-if="miniDetail.data.spec?.link"
							class="mini-link mt-5 flex items-center justify-between rounded-xl bg-secondary p-4">
							<view
								class="link-text flex-1 overflow-hidden truncate whitespace-nowrap text-[26rpx] text-[#4d7c0f]">
								{{ miniDetail.data.spec.link }}
							</view>
							<text class="ml-3 shrink-0 text-[26rpx] text-[#4d7c0f] font-bold"
								@click="handleCopyMiniProgramCode(miniDetail.data)">复制</text>
						</view>

						<!-- 预览图轮播 -->
						<view v-if="miniDetail.data.spec?.screenshots?.length" class="mini-screenshots mt-6">
							<swiper class="screenshots-swiper h-[360rpx] w-full" indicator-dots circular>
								<swiper-item v-for="(img, idx) in miniDetail.data.spec.screenshots" :key="idx">
									<image class="screenshot-img h-full w-full rounded-xl" :src="checkImageUrl(img)"
										mode="aspectFill"
										@click="handlePreviewMiniProgramCode({ spec: { miniProgramCode: img } } as IMiniProgramLink)" />
								</swiper-item>
							</swiper>
						</view>
					</scroll-view>
				</uh-glass-popup>

				<!-- 小程序链接申请弹窗 -->
				<uh-links-mini-apply :show="applyShow" @on-close="handleApplyClose" />
			</template>
		</template>
	</view>
</template>