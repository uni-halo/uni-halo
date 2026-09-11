<script lang="ts" setup>
	/**
 * 免责声明页
 */
	import { computed } from 'vue'
	import { useAppConfigStore } from '@/store/appConfig'

	definePage({
		style: {
			navigationBarTitleText: '免责声明',
			navigationStyle: 'custom',
		},
	})

	const appConfigStore = useAppConfigStore()
	const haloConfigs = computed(() => appConfigStore.configs)

	const disclaimersContent = computed(() => {
		const pageConfig = haloConfigs.value.pageConfig as { disclaimers ?: { content ?: string } } | undefined
		return pageConfig?.disclaimers?.content || ''
	})

	const bloggerInfo = computed(() => {
		const blogger = haloConfigs.value.authorConfig?.blogger as { nickname ?: string, email ?: string } | undefined
		return {
			nickname: blogger?.nickname || '',
			email: blogger?.email || '',
		}
	})

	function copyText(content : string, tips = '复制成功') {
		uni.setClipboardData({
			data: content,
			showToast: false,
			success: () => {
				uni.showToast({ icon: 'none', title: tips })
			},
		})
	}
</script>

<template>
	<view class="box-border min-h-screen bg-page p-3 pt-2">
		<!-- 自定义导航 -->
		<uh-navbar default-title="免责声明" title-color="text-gray-900" />
		
		<view class="w-full h-full uh-global-card-glass uh-shadow-xs rounded-xl">
			<!-- 通过配置 -->
			<view v-if="disclaimersContent" v-html="disclaimersContent" />

			<!-- 静态写法 -->
			<view v-else class="box-border p-4 pt-0 text-sm text-gray-900 leading-6">
				<view class="item mt-4">
					1、本应用属于个人非盈利性质的网站，所有转载的文章都以遵循原作者的版权声明注明了文章来源。
				</view>
				<view class="item mt-4">
					2、如果原文没有版权声明，按照目前互联网开放的原则，本博客将在不通知作者的情况下转载文章。
				</view>
				<view class="item mt-4">
					3、如果原文明确注明"禁止转载"，本博客将不会转载。
				</view>
				<view class="item mt-4">
					4、如果本博客转载的文章不符合作者的版权声明或者作者不想让本博客转载您的文章，请邮件告知
					<text class="email mx-3 text-primary"
						@click="copyText(bloggerInfo.email, '电子邮箱已复制到剪贴板！')">{{ bloggerInfo.email }}</text>
					，博主将会在第一时间删除相关信息！
				</view>
				<view class="item mt-4">
					5、本博客转载文章仅为留做备份和知识点分享的目的。
				</view>
				<view class="item mt-4">
					6、本博客将尽力确保所提供信息的准确性及可靠性，但不保证信息的正确性和完整性，且不对因信息的不正确或遗漏导致的任何损失或损害承担相关责任。
				</view>
				<view class="item mt-4">
					7、本博客所发布、转载的文章，其版权均归原作者所有。如其他自媒体、网站或个人从本博客下载使用，请在转载有关文章时务必尊重该文章的著作权，保留本博客注明的"原文来源"或者自行去原文处复制版权声明，并自负版权等法律责任。
				</view>
				<view class="item mt-4">
					8、本博客的所有原创文章皆可以任意转载，但转载时务必请注明出处。
				</view>
				<view class="item mt-4">
					9、尊重原创，知识共享！
				</view>
			</view>
		</view>
	</view>
</template>