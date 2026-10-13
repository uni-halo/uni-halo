<script setup lang="ts">
import { ref } from 'vue'
import { isPageTabbar } from './tabbar/store'
import { currRoute } from './utils'
import { useOpenPopup } from '@/hooks/useOpenPopup'
import CustomTabbar from '@/tabbar/index.vue'

const isCurrentPageTabbar = ref(true)

const { popupVisible: settingsPopupVisible, openPopup: openSettingsPopup } = useOpenPopup()
const { popupVisible: userPopupVisible, openPopup: openUserPopup } = useOpenPopup()
const { popupVisible: chatPopupVisible, openPopup: openChatPopup } = useOpenPopup()

const actionsVisible = reactive({
  scrollTop: false,
  aiChat: false,
  settings: false,
  user: false,
})

const actionsVisibleCount = computed(() => {
  return Object.values(actionsVisible).filter(visible => visible).length
})

function handleOnUserButtonClick(isLogin: boolean) {
  if (isLogin) {
    openUserPopup()
  }
  else {
    uni.navigateTo({
      url: '/pages/auth/login',
    })
  }
}

function onActionsVisible(visible: boolean, actionName: string) {
  actionsVisible[actionName] = visible
}

onShow(() => {
  const { path } = currRoute()
  if (path === '/') {
    isCurrentPageTabbar.value = true
  }
  else {
    isCurrentPageTabbar.value = isPageTabbar(path)
  }
})
</script>

<template>
  <view>
    <uh-global-actions :visible-count="actionsVisibleCount">
      <uh-scrolltop-button :fixed="false" @is-visible="onActionsVisible($event, 'scrollTop')" />
      <uh-ai-chat-button :fixed="false" @is-visible="onActionsVisible($event, 'aiChat')" @action-click="openChatPopup()" />
      <uh-settings-button :fixed="false" @is-visible="onActionsVisible($event, 'settings')" @action-click="openSettingsPopup()" />
      <uh-user-button :fixed="false" @is-visible="onActionsVisible($event, 'user')" @action-click="handleOnUserButtonClick" />
    </uh-global-actions>

    <uh-settings-popup v-model="settingsPopupVisible" />
    <uh-user-popup v-model="userPopupVisible" />
    <uh-ai-chat-popup v-model="chatPopupVisible" />

    <!-- ui 全局组件 -->
    <wd-dialog />

    <KuRootView />

    <CustomTabbar v-if="isCurrentPageTabbar" />
  </view>
</template>
