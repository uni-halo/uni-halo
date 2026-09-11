<script lang="ts" setup>
/**
 * 轮播详情页(自定义 Banner 条目点击后进入)
 * 通过公开详情接口(getBannerDetail)拉取 content 富文本与外链,类文章详情页
 * 外链平台差异(条件编译):非 APP-PLUS(小程序/H5)提供复制链接,APP-PLUS 提供访问按钮(web-view)
 */
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getBannerDetail } from '@/api/uni-halo'
import { checkAvatarUrl, checkThumbnailUrl } from '@/utils/url'
import { formatTime } from '@/utils/formatTime'
import { copyToClipboard } from '@/utils/restrictRead'
import { sleep } from '@/utils/common'
import { markdownConfig } from '@/config/markdown'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import type { IBannerPublicDetail } from '@/api/types/uni-halo'

definePage({
	style: {
		navigationBarTitleText: '轮播详情',
		navigationStyle: 'custom',
	},
})

const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()
const name = ref('')
const detail = ref<IBannerPublicDetail | null>(null)
const linkCopied = ref(false)

/** 封面图:无封面时回退默认缩略图 */
const coverUrl = computed(() => checkThumbnailUrl(detail.value?.cover, true))

const authorName = computed(() => detail.value?.authorName || '')

const authorAvatar = computed(() =>
	detail.value?.authorAvatar ? checkAvatarUrl(detail.value.authorAvatar) : '',
)

const dateText = computed(() => {
	if (!detail.value?.date) {
		return ''
	}
	const d = new Date(detail.value.date)
	if (Number.isNaN(d.getTime())) {
		return ''
	}
	return formatTime({ d: detail.value.date, f: 'yyyy-MM-dd' })
})

const content = computed(() => detail.value?.content || '')

/** 外链存在即展示底部操作(复制/访问) */
const hasLink = computed(() => !!detail.value?.link)

/** 加载轮播详情(状态机;404/无数据 → 空态,其余错误 → error 态,可重试) */
async function loadDetail() {
	updateLoadingStatus(DataLoadingStatusEnum.Loading)
	if (!name.value) {
		updateLoadingStatus(DataLoadingStatusEnum.Empty)
		return
	}
	try {
		const res = await getBannerDetail(name.value)
		detail.value = res.data || null
		await sleep(600)
		updateLoadingStatus(detail.value ? DataLoadingStatusEnum.Success : DataLoadingStatusEnum.Empty)
	}
	catch (err) {
		console.error('轮播详情加载失败', err)
		const code = (err as { code ?: number }).code
		updateLoadingStatus(code === 404 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Error)
	}
}

onLoad((options) => {
	name.value = options?.name || ''
	loadDetail()
})

/** 非 APP-PLUS:复制链接 */
function handleCopyLink() {
	if (!detail.value?.link) {
		return
	}
	copyToClipboard(detail.value.link, '链接已复制')
	linkCopied.value = true
	setTimeout(() => {
		linkCopied.value = false
	}, 1500)
}

/** APP-PLUS:打开内置 web-view 访问外链 */
function handleOpenLink() {
	if (!detail.value?.link) {
		return
	}
	uni.navigateTo({
		url: `/pages-blog/website/website?data=${JSON.stringify({
			title: detail.value.title || '查看链接',
			url: encodeURIComponent(detail.value.link),
		})}`,
	})
}
</script>

<template>
	<view class="box-border min-h-screen w-screen bg-page pb-safe">
		<!-- 自定义导航 -->
		<uh-navbar default-title="轮播详情" title-color="text-gray-900" :scroll-title="detail?.title" />

		<!-- 加载/错误/空态(状态机) -->
		<uh-data-loading v-if="loadingStatus !== 'success'" :loading-status="loadingStatus" min-height="75vh"
			error-text="轮播详情加载失败" empty-text="轮播图不存在或已下线" empty-sub-text="" @refresh="loadDetail" />

		<!-- 正文 -->
		<view v-else-if="detail" class="box-border p-4">
			<image v-if="coverUrl" class="mb-5 h-[320rpx] w-full rounded-xl" :src="coverUrl" mode="aspectFill" />

			<view class="text-[36rpx] font-bold leading-snug text-gray-900">
				{{ detail.title }}
			</view>

			<!-- 作者/日期信息 -->
			<view v-if="authorName || dateText" class="mt-3 flex items-center gap-2">
				<image v-if="authorAvatar" :src="authorAvatar" class="h-[44rpx] w-[44rpx] rounded-full"
					mode="aspectFill" />
				<text class="text-[24rpx] text-gray-500">{{ authorName }}</text>
				<text v-if="dateText" class="text-[22rpx] text-gray-500">{{ dateText }}</text>
			</view>

			<!-- 富文本内容 -->
			<view v-if="content" class="box-border w-full mt-2 pt-4 pb-6">
				<mp-html :content="content" lazy-load :domain="markdownConfig.domain ?? ''" scroll-table selectable
					:tag-style="markdownConfig.tagStyle" :container-style="markdownConfig.containStyle"
					:show-line-number="false" copy-by-long-press />
			</view>

			<!-- 外链(平台差异,条件编译):非 APP 复制 / APP 访问 -->
			<view v-if="hasLink" class="fixed left-0 right-0 bottom-0 pb-safe px-4 box-border">
				<view class="w-full h-full uh-global-card-glass border rounded-full mb-4">
					<!-- #ifndef APP-PLUS -->
					<uh-button custom-class="w-full !rounded-full py-2.5 font-medium" @click="handleCopyLink">
						{{ linkCopied ? '已复制' : '复制链接' }}
					</uh-button>
					<!-- #endif -->
					<!-- #ifdef APP-PLUS -->
					<uh-button custom-class="w-full !rounded-full py-2.5 font-medium" @click="handleOpenLink">
						访问链接
					</uh-button>
					<!-- #endif -->
				</view>
			</view>
		</view>
	</view>
</template>
