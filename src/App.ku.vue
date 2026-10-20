<script setup lang="ts">
import { ref } from 'vue'
import { isPageTabbar } from './tabbar/store'
import { currRoute } from './utils'
import { useOpenPopup } from '@/hooks/useOpenPopup'
import { useLoginPopup } from '@/hooks/useLoginPopup'

import CustomTabbar from '@/tabbar/index.vue'

const isCurrentPageTabbar = ref(true)

const { popupVisible: settingsPopupVisible, openPopup: openSettingsPopup } = useOpenPopup()
const { popupVisible: userPopupVisible, openPopup: openUserPopup } = useOpenPopup()
const { popupVisible: chatPopupVisible, openPopup: openChatPopup } = useOpenPopup()

// 登录弹窗全局挂载:任意页面通过 useLoginPopup().openLoginPopup() 唤起
const { loginPopupVisible, handleLoginSuccess } = useLoginPopup()

const actionsVisible = reactive({
  scrollTop: true,
  aiChat: true,
  settings: true,
  user: true,
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
      <uh-scrolltop-button v-show="actionsVisible.scrollTop" :fixed="false" @is-visible="onActionsVisible($event, 'scrollTop')" />
      <uh-ai-chat-button v-show="actionsVisible.aiChat" :fixed="false" @is-visible="onActionsVisible($event, 'aiChat')" @action-click="openChatPopup()" />
      <uh-settings-button v-show="actionsVisible.settings" :fixed="false" @is-visible="onActionsVisible($event, 'settings')" @action-click="openSettingsPopup()" />
      <uh-user-button v-show="actionsVisible.user" :fixed="false" @is-visible="onActionsVisible($event, 'user')" @action-click="handleOnUserButtonClick" />
    </uh-global-actions>

    <uh-settings-popup v-model="settingsPopupVisible" />
    <uh-user-popup v-model="userPopupVisible" />
    <uh-ai-chat-popup v-model="chatPopupVisible" />
    <!-- 用户资料卡(经 useUserProfilePopup 唤起,审核模式下不展示) -->
    <uh-user-profile-popup />

    <!-- ui 全局组件 -->
    <wd-dialog />
    <uh-login-popup v-model="loginPopupVisible" @on-success="handleLoginSuccess" />

    <KuRootView />

    <CustomTabbar v-if="isCurrentPageTabbar" />
  </view>
</template>
