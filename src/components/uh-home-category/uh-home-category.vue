<script lang="ts" setup>
	import { computed } from 'vue'
	import { storeToRefs } from 'pinia'
	import { getCategoryList } from '@/api/halo'
	import { checkThumbnailUrl } from '@/utils/url'
	import { useAppConfigStore } from '@/store/appConfig'
	import { sleep } from '@/utils/common'
	import type { ICategory } from '@/api/types/halo'

	const { configs, auditModeEnabled: calcAuditModeEnabled } = storeToRefs(useAppConfigStore())

	const loading = ref<'loading' | 'success' | 'error'>('loading')
	const categoryList = ref<ICategory[]>([])

	const isEnableCategoryModule = computed(() => {
		return !!configs.value.featureConfig?.pages?.home?.useCategory
	})

	async function handleGetCategoryList() {
		try {
			loading.value = 'loading'
			const configured = configs.value.featureConfig?.pages?.home?.categories
			console.log('configured',configured)
			let categoryListRaw : ICategory[] = []
			if (configured && configured.length) {
				// 配置模式
				categoryListRaw = configured.map(c => ({
					metadata: { name: c.name },
					spec: {
						displayName: c.displayName || '',
						slug: '',
						cover: checkThumbnailUrl(c.cover),
						priority: c.priority,
					},
					postCount: c.postCount ?? 0,
				} as ICategory))
			}
			else {
				// 默认模式
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
				.sort((a, b) => b.spec.priority - a.spec.priority)
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

	onMounted(handleGetCategoryList)
</script>

<template>
	<view v-if="isEnableCategoryModule" class="box-border mb-6 px-3">
		<uh-section-title>
			精选分类
			<template #right>
				<view class="uh-global-card-glass uh-shadow-xs border flex items-center justify-center rounded-md p-1 text-gray-400"
					@click="handleToCategoryPage">
					<wd-icon name="arrow-right" size="14px" />
				</view>
			</template>
		</uh-section-title>

		<view v-if="loading!=='success'" class="mt-4 box-border">
			<view class="uh-global-card-glass shadow-none rounded-xl">
				<uh-data-loading :loading-status="loading" min-height="28vh" size="small" :use-refresh-button="true"
					@refresh="handleGetCategoryList()" />
			</view>
		</view>

		<view v-else class="mt-4 w-full grid grid-cols-2 grid-rows-auto h-42 box-border gap-2">
			<view v-for="(category,index) in categoryList" :key="category.metadata.name"
				class="uh-global-card-glass relative w-full h-full overflow-hidden rounded-xl text-center text-white"
				:class="{'grid-row-span-2':index===0 }" @click="handleToCategoryBy(category)">
				<!-- 有图，wd-img 如果加载空的地址 会一直处于loading状态，所以空值我们不加载 -->
				<wd-img v-if="category.spec.cover" :src="category.spec.cover" class="w-full h-full" mode="aspectFill"
					lazy-load>
					<template #loading>
						<wd-loading size="64rpx" custom-class="text-primary" />
					</template>
				</wd-img>
				<!-- 无图 -->
				<view v-else
					class="h-full w-full flex items-center justify-center from-[#ebfabf] to-[#f5fae8] bg-gradient-to-b text-gray-400">
					<wd-icon class-prefix="uhemoji-icon" name="-injury" size="72rpx" />
				</view>
				<view class="absolute bottom-0 left-0 h-16 w-full bg-gradient-to-b from-black/0 to-black/30" />
				<view class="absolute left-2 bottom-2 flex z-2 flex-col text-left">
					<text class="text-xs font-semibold">
						{{ category.spec.displayName }}
					</text>
					<text v-if="category.postCount" class="mt-1 text-xs text-gray-200">共 {{ category.postCount ?? 0 }} 篇</text>
				</view>
			</view>
		</view>
	</view>
</template>