<script lang="ts" setup>
	import { computed } from 'vue'
	import { getCategoryList } from '@/api/halo'
	import { checkThumbnailUrl } from '@/utils/url'
	import { useAppConfigStore } from '@/store/appConfig'
	import type { ICategory } from '@/api/types/halo'

	const appConfigStore = useAppConfigStore()

	const haloConfigs = computed(() => appConfigStore.configs)

	const calcAuditModeEnabled = computed(() => appConfigStore.auditModeEnabled)

	const loading = ref<'loading' | 'success' | 'error'>('loading')
	const categoryList = ref<ICategory[]>([])

	const calcIsShowCategory = computed(() => {
		if (calcAuditModeEnabled.value) {
			return false;
		}
		return !!haloConfigs.value.pageConfig?.homeConfig?.useCategory
	})

	/** 精选分类 */
	async function handleGetCategoryList() {
		if (calcAuditModeEnabled.value || !calcIsShowCategory.value) {
			loading.value = 'success'
			return
		}
		try {
			loading.value = 'loading'
			const res = await getCategoryList({ fieldSelector: ['spec.hideFromList=false'], size: 3 })
			categoryList.value = res.data.items
				.map(item => {
					item.spec.cover = checkThumbnailUrl(item.spec.cover)
					return {
						...item,
						postCount: item.postCount ?? 0
					}
				})
				.sort((a, b) => (b.postCount || 0) - (a.postCount || 0))
			loading.value = 'success'
		}
		catch (err) {
			console.error('获取分类失败', err)
			loading.value = 'error'
		}
	}


	function handleToCategoryPage() {
		uni.switchTab({ url: '/pages/tabbar/category/category' })
	}


	function handleToCategoryBy(category : ICategory) {
		if (calcAuditModeEnabled.value)
			return
		uni.navigateTo({
			url: `/pages-blog/category-articles/category-articles?name=${category.metadata.name}&title=${category.spec.displayName}`,
		})
	}

	onMounted(() => {
		handleGetCategoryList()
	})
</script>

<template>
	<view v-if="calcIsShowCategory" class="mb-6">
		<uh-section-title class="mb-4 px-3 box-border">
			精选分类
			<template #right>
				<view class="flex items-center justify-center rounded-md bg-white p-1.5 text-gray-400" @click="handleToCategoryPage">
					<wd-icon name="arrow-right" size="12px" />
				</view>
			</template>
		</uh-section-title>
			
		<view class="w-full grid grid-cols-2 grid-rows-auto h-42 box-border px-3 gap-2">
			<view v-if="categoryList.length === 0"
				class="cate-empty text-grey  w-full flex items-center justify-center">
				还没有任何分类~
			</view>
			<block v-else>
				<view v-for="(category,index) in categoryList" :key="category.metadata.name"
					class="uh-global-card-glass relative w-full h-full overflow-hidden rounded-xl text-center text-white"
					:class="{'grid-row-span-2':index===0 }" @click="handleToCategoryBy(category)">
					<image :src="category.spec.cover" class="w-full h-full" mode="aspectFill" lazy-load />
					<view
						class="absolute bottom-0 left-0 h-[140rpx] w-full bg-gradient-to-b from-black/0 to-black/30" />
					<view class="absolute left-2 bottom-2 flex z-2 flex-col text-left">
						<text class="text-sm font-bold">
							{{ category.spec.displayName }}
						</text>
						<text class="mt-1 text-xs text-gray-200">共 {{ category.postCount ?? 0 }} 篇</text>
					</view>
				</view>
			</block>
		</view>
	</view>
</template>