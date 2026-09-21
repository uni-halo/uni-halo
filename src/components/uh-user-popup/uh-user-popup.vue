<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { useDialog } from '@wot-ui/ui'
import { DIALOG_CANCEL_BUTTON_PROPS, DIALOG_CONFIRM_BUTTON_PROPS } from '@/config/dialog'
import { isWechat } from '@/utils/platform'
import { checkAvatarUrl } from '@/utils/url'
import { useTokenStore } from '@/store/token'
import { useUserStore } from '@/store/user'
import { usePermission } from '@/hooks/usePermission'
import type { PermissionKey } from '@/config/permissions'

defineOptions({
  options: {
    styleIsolation: 'apply-shared',
  },
})

const props = defineProps<IProps>()

const emits = defineEmits<IEmits>()

interface IProfileEntry {
  key: string
  type: 'switch' | 'navigate'
  icon: string
  label: string
  path: NavigateToOptions['url']
}

interface IProps {
  modelValue: boolean
}

interface IEmits {
  (e: 'update:modelValue', value: boolean): void
}

const { userInfo } = storeToRefs(useUserStore())
const { hasLogin } = storeToRefs(useTokenStore())

const { can } = usePermission()

const dialog = useDialog('user-popup')

const popupVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emits('update:modelValue', value),
})

const isAdmin = computed(() => userInfo.value.roles.includes('super-role'))

/** 管理模块入口清单（按权限显隐） */
interface IAdminEntry {
  key: string
  /** wot-ui 图标名 */
  icon: string
  label: string
  /** 对应业务权限常量 key */
  permission: PermissionKey
  url: NavigateToOptions['url']
}

const ADMIN_ENTRIES: IAdminEntry[] = [
  { key: 'moment', icon: 'send', label: '瞬间管理', permission: 'MOMENT_MANAGE', url: '/pages-admin/moment-manage/moment-manage' },
  { key: 'love-info', icon: 'heart', label: '恋爱信息管理', permission: 'LOVE_INFO_MANAGE', url: '/pages-admin/love/info-manage' },
  { key: 'daily', icon: 'subscribed', label: '恋爱清单管理', permission: 'LOVE_DAILY_MANAGE', url: '/pages-admin/love/daily-manage' },
  { key: 'story', icon: 'book', label: '恋爱故事管理', permission: 'LOVE_STORY_MANAGE', url: '/pages-admin/love/story-manage' },
  { key: 'album', icon: 'image', label: '恋爱相册管理', permission: 'LOVE_ALBUM_MANAGE', url: '/pages-admin/love/album-manage' },
]

/** 按权限过滤后的可见入口 */
const visibleAdminEntries = computed(() => ADMIN_ENTRIES.filter(e => can(e.permission)))

function handleClose() {
  emits('update:modelValue', false)
}

// 判断当前页面是否与跳转页面一样
function isSamePage(url: string) {
  return getCurrentPages()[getCurrentPages().length - 1].route === url.replace('/', '')
}

// 优化 navigateTo 跳转
function safeNavigateTo(options: UniNamespace.NavigateToOptions & NavigateToOptions) {
  const pages = getCurrentPages()
  const targetIndex = pages.findLastIndex(p => p.route === options.url.replace('/', ''))
  if (targetIndex !== -1) {
    const delta = pages.length - 1 - targetIndex
    uni.navigateBack({ delta })
  }
  else {
    uni.navigateTo(options)
  }
}

function handleToAdmin(url: NavigateToOptions['url']) {
  handleClose()
  if (isSamePage(url)) {
    return
  }
  safeNavigateTo({
    url,
    animationType: 'slide-in-right',
  })
}

function handleToPage(entry: IProfileEntry) {
  handleClose()
  if (isSamePage(entry.path)) {
    return
  }
  if (entry.type === 'switch') {
    uni.switchTab({
      url: entry.path,
      animationType: 'slide-in-right',
    })
    return
  }
  if (entry.type === 'navigate') {
    safeNavigateTo({
      url: entry.path,
      animationType: 'slide-in-right',
    })
    return
  }
}

/** 个人入口（我的信息 / 个人主页） */
const PROFILE_ENTRIES: Array<IProfileEntry> = [
  { key: 'home', type: 'switch', icon: 'home', label: '应用首页', path: '/pages/tabbar/home/home' },
  { key: 'my-profile', type: 'navigate', icon: 'edit', label: '我的资料', path: '/pages-admin/my-profile/my-profile' },
  { key: 'user-profile', type: 'navigate', icon: 'user', label: '个人主页', path: '/pages-blog/user-profile/user-profile' },
]

function handleLogout() {
  dialog.confirm({
    title: '提示',
    msg: '确定退出登录吗？',
    zIndex: 9999,
    confirmButtonProps: DIALOG_CONFIRM_BUTTON_PROPS,
    cancelButtonProps: DIALOG_CANCEL_BUTTON_PROPS,
  }).then(() => {
    useTokenStore().logout().then(() => {
      uni.showToast({
        icon: 'none',
        title: '已退出登录',
      })
      handleClose()
    })
  }).catch(() => { })
}
</script>

<template>
  <uh-glass-popup
    v-model="popupVisible" position="left" custom-class="rounded-rt-xl rounded-rb-xl !border"
    safe-area-inset-bottom :z-index="110" hide-when-close
  >
    <view class="box-border h-full w-[70vw] flex flex-col gap-y-6 px-4 pt-safe">
      <view class="flex shrink-0 items-center justify-between pt-4">
        <text class="text-md font-bold">我的</text>
        <view
          class="uh-global-card-glass h-6 w-6 flex items-center justify-center border rounded-lg text-gray-500 shadow-none !bg-white/5"
          @click="handleClose()"
        >
          <wd-icon name="close" size="28rpx" />
        </view>
      </view>

      <!-- 用户信息卡片 -->
      <view v-if="hasLogin" class="w-full">
        <view
          class="uh-global-card-glass flex items-center gap-x-2 border rounded-xl p-3 shadow-none !bg-white/5"
        >
          <image
            :src="checkAvatarUrl(userInfo.avatar)"
            class="uh-global-card-glass uh-shadow-xs h-12 w-12 shrink-0 rounded-full" mode="aspectFill"
          />
          <view class="flex-1">
            <text class="text-sm text-gray-900 font-semibold">{{ userInfo.nickname }}</text>
            <text
              class="uh-global-card-glass mt-1 inline-block border rounded-md bg-secondary px-2 py-0.5 text-10px text-gray-500"
            >
              {{ isAdmin ? '超级管理员' : '普通用户' }}
            </text>
          </view>
          <view class="flex shrink-0 items-center justify-center">
            <wd-icon name="edit" size="36rpx" custom-class="text-gray-400" />
          </view>
        </view>
      </view>

      <!-- 个人入口 -->
      <view class="w-full flex shrink-0 flex-col">
        <uh-section-title>功能入口</uh-section-title>
        <view class="grid grid-cols-3 mt-3 box-border gap-3">
          <view
            v-for="entry in PROFILE_ENTRIES" :key="entry.key"
            class="uh-global-card-glass flex flex-col items-center gap-y-1 overflow-hidden rounded-xl p-2 shadow-none"
            @click="handleToPage(entry)"
          >
            <view class="uh-global-card-glass box-border w-12 flex items-center justify-center border rounded-lg bg-gray-50 py-1.5 text-gray-900 shadow-none">
              <wd-icon :name="entry.icon" size="52rpx" />
            </view>
            <text class="flex-1 text-xs text-gray-900">{{ entry.label }}</text>
          </view>
        </view>
      </view>

      <!-- 功能入口区域 -->
      <view class="w-full flex flex-1 flex-col">
        <uh-section-title>功能入口</uh-section-title>
        <scroll-view
          v-if="visibleAdminEntries.length !== 0 " scroll-y :show-scrollbar="false"
          class="mt-3 flex-1"
        >
          <view class="box-border flex flex-col gap-y-3">
            <uh-permission
              v-for="entry in visibleAdminEntries" :key="entry.key"
              :permission="entry.permission"
            >
              <view
                class="uh-global-card-glass flex items-center gap-x-3 rounded-xl px-3 py-2.5 shadow-none"
                @click="handleToAdmin(entry.url)"
              >
                <wd-icon
                  :name="entry.icon" size="36rpx"
                  custom-class="text-gray-900 dark:text-gray-100"
                />
                <text class="flex-1 text-2xs text-gray-900 dark:text-gray-100">{{ entry.label }}</text>
                <wd-icon name="arrow-right" size="28rpx" custom-class="text-gray-400" />
              </view>
            </uh-permission>
          </view>
        </scroll-view>
        <view
          v-else
          class="uh-global-card-glass mt-3 box-border w-full flex flex-1 items-center justify-center border rounded-xl bg-white p-4 shadow-none backdrop-filter-none"
        >
          <uh-data-loading
            :loading-status="DataLoadingStatusEnum.Empty" empty-text="您没有任何权限" size="small"
            min-height="32vh" :use-refresh-button="false"
          />
        </view>
      </view>

      <!-- 底部操作栏 -->
      <view
        v-if="hasLogin" class="box-border w-full flex shrink-0 items-center"
        :class="[isWechat ? '' : 'pb-4']"
      >
        <uh-button
          class="flex-1"
          custom-class="flex-1 uh-global-card-glass uh-shadow-xs border py-2 !rounded-full bg-red-400 text-white"
          @action-click="handleLogout()"
        >
          退出登录
        </uh-button>
      </view>
    </view>
  </uh-glass-popup>
  <wd-dialog selector="user-popup" />
</template>
