<script lang="ts" setup>
	import { computed } from 'vue'
	import { getCategoryList } from '@/api/halo'
	import { checkThumbnailUrl } from '@/utils/url'
	import { useAppConfigStore } from '@/store/appConfig'
	import type { ICategory } from '@/api/types/halo'
	import { sleep } from '@/utils/common'

	const appConfigStore = useAppConfigStore()

	const haloConfigs = computed(() => appConfigStore.configs)

	const calcAuditModeEnabled = computed(() => appConfigStore.auditModeEnabled)

	const loading = ref<'loading' | 'success' | 'error'>('loading')
	const categoryList = ref<ICategory[]>([])

	const isEnableCategoryModule = computed(() => {
		return !!haloConfigs.value.pageConfig?.homeConfig?.useCategory
	})

	async function handleGetCategoryList() {
		try {
			loading.value = 'loading'
			const configured = haloConfigs.value.pageConfig?.homeConfig?.categories
			let categoryListRaw : ICategory[] = []
			if (configured && configured.length) {
				// 配置模式：按 name 用 in 查询（Halo fieldSelector 数组为 AND 语义，多 name 需 in 语法）
				const names = configured.map(c => c.name)
				const res = await getCategoryList({
					fieldSelector: [`metadata.name in (${names.join(',')})`],
					size: 3,
				})
				// 按配置顺序排列；配置的 name 查不到（分类已删除）则跳过
				const byName = new Map(res.data.items.map(item => [item.metadata.name, item]))
				categoryListRaw = names
					.map(name => byName.get(name))
					.filter((item) : item is ICategory => !!item)
			}
			else {
				// 默认模式（老部署无配置）：保持原有取数与排序
				const res = await getCategoryList({ fieldSelector: ['spec.hideFromList=false'], size: 3 })
				categoryListRaw = res.data.items
			}
			categoryList.value = categoryListRaw
				.map(item => {
					item.spec.cover = checkThumbnailUrl(item.spec.cover)
					return {
						...item,
						postCount: item.postCount ?? 0
					}
				})
				.sort((a, b) => {
					if (configured && configured.length) {
						return 0
					}
					return (b.postCount || 0) - (a.postCount || 0)
				})
				
			await sleep(600)
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
		uni.navigateTo({
			url: `/pages-blog/category-articles/category-articles?name=${category.metadata.name}&title=${category.spec.displayName}`,
		})
	}

	onMounted(() => {
		handleGetCategoryList()
	})
</script>

<template>
	<view v-if="isEnableCategoryModule" class="mb-6">
		<uh-section-title class="mb-4 px-3 box-border">
			精选分类
			<template #right>
				<view class="box-border flex items-center justify-center rounded-md bg-white p-1.5 text-gray-400"
					@click="handleToCategoryPage">
					<wd-icon name="arrow-right" size="24rpx" />
				</view>
			</template>
		</uh-section-title>

		<view v-if="loading!=='success'" class="box-border px-3">
			<view class="uh-global-card-glass shadow-none rounded-xl">
				<uh-data-loading :loading-status="loading" min-height="28vh" size="small" :use-refresh-button="true"
					@refresh="handleGetCategoryList()" />
			</view>
		</view>

		<view v-else class="w-full grid grid-cols-2 grid-rows-auto h-42 box-border px-3 gap-2">
			<view v-for="(category,index) in categoryList" :key="category.metadata.name"
				class="uh-global-card-glass relative w-full h-full overflow-hidden rounded-xl text-center text-white"
				:class="{'grid-row-span-2':index===0 }" @click="handleToCategoryBy(category)">
				<image :src="category.spec.cover" class="w-full h-full" mode="aspectFill" lazy-load />
				<view class="absolute bottom-0 left-0 h-[140rpx] w-full bg-gradient-to-b from-black/0 to-black/30" />
				<view class="absolute left-2 bottom-2 flex z-2 flex-col text-left">
					<text class="text-sm font-bold">
						{{ category.spec.displayName }}
					</text>
					<text class="mt-1 text-xs text-gray-200">共 {{ category.postCount ?? 0 }} 篇</text>
				</view>
			</view>
		</view>
	</view>
</template>