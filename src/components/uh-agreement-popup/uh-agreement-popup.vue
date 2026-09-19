<script lang="ts" setup>
	import { markdownConfig } from '@/config/markdown'

	defineOptions({
		options: {
			styleIsolation: 'apply-shared',
		},
	})

	type AgreementType = 'userAgreement' | 'privacyPolicy'

	interface IProps {
		modelValue : boolean
		contents : { userAgreement ?: string, privacyPolicy ?: string }
		initialTab ?: AgreementType
		showAgreeButton ?: boolean
	}

	interface IEmits {
		(e : 'update:modelValue', value : boolean) : void
		(e : 'agree') : void
	}

	const props = withDefaults(defineProps<IProps>(), {
		initialTab: 'userAgreement',
		showAgreeButton: false,
	})
	const emits = defineEmits<IEmits>()

	const activeTab = ref<AgreementType>(props.initialTab)
	watch(() => props.modelValue, (visible) => {
		if (visible)
			activeTab.value = props.initialTab
	})

	const popupVisible = computed({
		get: () => props.modelValue,
		set: (value : boolean) => emits('update:modelValue', value),
	})

	const TABS = [
		{ id: 'userAgreement' as const, label: '用户协议' },
		{ id: 'privacyPolicy' as const, label: '隐私政策' },
	]
	const activeContent = computed(() => (props.contents[activeTab.value] || '').trim())
	const emptyText = computed(() => `暂未配置${activeTab.value === 'privacyPolicy' ? '隐私政策' : '用户协议'}内容`)

	function handleAgree() {
		emits('agree')
		popupVisible.value = false
	}

	function handleClose() {
		popupVisible.value = false
	}
</script>

<template>
	<uh-glass-popup v-model="popupVisible" position="bottom" custom-class="rounded-2xl">
		<!-- 弹窗容器 -->
		<view class="w-full box-border flex flex-col gap-y-3 p-3">
			<!-- 顶部 -->
			<view class="flex items-center justify-between">
				<text class="text-md font-semibold">协议与政策</text>
				<view
					class="box-border uh-global-card-glass shadow-none !bg-white/5 border flex h-6 w-6 items-center justify-center rounded-lg text-gray-500"
					@click="handleClose">
					<wd-icon name="close" size="28rpx" />
				</view>
			</view>

			<view class="uh-global-card-glass shadow-none flex rounded-xl p-1">
				<view v-for="tab in TABS" :key="tab.id" class="box-border flex-1 rounded-lg py-2 text-center text-3xs"
					:class="activeTab === tab.id ? 'bg-primary' : 'text-gray-500'"
					@click="activeTab = tab.id">
					{{ tab.label }}
				</view>
			</view>

			<!-- 滚动区域 -->
			<scroll-view scroll-y class="box-border h-[50vh]">
				<mp-html v-if="activeContent" :content="activeContent" lazy-load :domain="markdownConfig.domain"
					:loading-img="markdownConfig.loadingGif" scroll-table selectable />
				<uh-data-loading v-else :loading-status="DataLoadingStatusEnum.Empty" :empty-text="emptyText"
					min-height="46vh" size="small" :use-refresh-button="false"></uh-data-loading>
			</scroll-view>

			<view v-if="showAgreeButton" class="box-border w-full flex items-center">
				<uh-button class="w-full"
					custom-class="uh-global-card-glass bg-primary !py-2 uh-shadow-xs border w-full !rounded-full text-gray-900"
					@click="handleAgree">
					同意并继续
				</uh-button>
			</view>
		</view>
	</uh-glass-popup>
</template>