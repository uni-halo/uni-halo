<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { useDialog } from '@wot-ui/ui'
import { DIALOG_CANCEL_BUTTON_PROPS, DIALOG_CONFIRM_BUTTON_PROPS } from '@/config/dialog'
import { isWechat } from '@/utils/platform'
import { checkAvatarUrl } from '@/utils/url'
import { getAvatarFallbackText } from '@/utils/avatar'
import { getUnreadNotificationCount } from '@/api/notification'
import { useTokenStore } from '@/store/token'
import { useUserStore } from '@/store/user'
import { usePermission } from '@/hooks/usePermission'
import { useCardBgSrc, useWornSlots } from '@/hooks/useWornSlots'
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
  /** 入口显隐开关（false 时整体过滤，用于暂时下线某入口） */
  visible?: boolean
}

interface IProps {
  modelValue: boolean
}

interface IEmits {
  (e: 'update:modelValue', value: boolean): void
}

const { updateNowTime } = useTokenStore()
const { userInfo } = storeToRefs(useUserStore())

/** 互动增强装饰槽位(登录用户自身;插件未启用/审核模式/站点开关关闭时全 invisible) */
const wornSlots = useWornSlots(() => userInfo.value.username)
/** 名片背景（素材缺失/装载失败回退博主页背景图，连兜底未配置则为空串不渲染） */
const { cardBgSrc, onCardBgError } = useCardBgSrc(() => wornSlots.value?.cardBackground.url || '')

const { can } = usePermission()

const dialog = useDialog('user-popup')

// 获取窗口信息
const windowInfo = uni.getWindowInfo()

const containerStyle = computed(() => ({
  // paddingTop: `${windowInfo.statusBarHeight}px`,
  paddingBottom: `${windowInfo.safeAreaInsets.bottom}px`,
}))

const popupVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emits('update:modelValue', value),
})

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

/** 个人入口（我的信息 / 个人主页 / 消息通知） */
const PROFILE_ENTRIES = computed<Array<IProfileEntry>>(() => {
  const entries: Array<IProfileEntry> = [
    { key: 'home', type: 'switch', icon: 'home', label: '应用首页', path: '/pages/tabbar/home/home', visible: true },
    { key: 'my-profile', type: 'navigate', icon: 'edit', label: '我的资料', path: '/pages-admin/my-profile/my-profile', visible: true },
    { key: 'user-profile', type: 'navigate', icon: 'user', label: '个人主页', path: '/pages-blog/user-profile/user-profile', visible: true },
    { key: 'notifications', type: 'navigate', icon: 'notification', label: '消息通知', path: '/pages-admin/notifications/notifications', visible: true },
  ]

  return entries.filter(entry => entry.visible)
})

const ADMIN_ENTRIES: IAdminEntry[] = [
  { key: 'moment', icon: 'send', label: '我的瞬间管理', permission: 'MOMENT_MANAGE', url: '/pages-admin/moment-manage/moment-manage' },
  { key: 'love-info', icon: 'heart', label: '恋爱信息管理', permission: 'LOVE_INFO_MANAGE', url: '/pages-admin/love/info-manage' },
  { key: 'daily', icon: 'subscribed', label: '恋爱清单管理', permission: 'LOVE_DAILY_MANAGE', url: '/pages-admin/love/daily-manage' },
  { key: 'story', icon: 'book', label: '恋爱故事管理', permission: 'LOVE_STORY_MANAGE', url: '/pages-admin/love/story-manage' },
  { key: 'album', icon: 'image', label: '恋爱相册管理', permission: 'LOVE_ALBUM_MANAGE', url: '/pages-admin/love/album-manage' },
  { key: 'draw-manage', icon: 'bg-colors', label: '我的绘画管理', permission: 'DRAW_MANAGE', url: '/pages-admin/draw-manage/draw-manage' },
  { key: 'draw-review', icon: 'check-square', label: '绘画审核管理', permission: 'DRAW_REVIEW', url: '/pages-admin/draw-review/draw-review' },
]

/** 按权限过滤后的可见入口 */
const visibleAdminEntries = computed(() => ADMIN_ENTRIES.filter(e => can(e.permission)))

/** 个人入口按 key 查找(避免索引寻址随顺序变更跳错页) */
function profileEntry(key: string) {
  return PROFILE_ENTRIES.value.find(entry => entry.key === key)
}

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

  const targetRoute = options.url.replace('/', '')
  let existIndex = -1
  for (let i = pages.length - 1; i >= 0; i--) {
    const page = pages[i]
    if (`/${page.route}` === targetRoute) {
      existIndex = i
      break
    }
  }

  if (existIndex !== -1) {
    const delta = pages.length - 1 - existIndex
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

/** 未读通知数（弹窗打开时刷新，用于入口红点徽标） */
const unreadNotifyCount = ref(0)

watch(popupVisible, (visible) => {
  if (visible && !updateNowTime().hasLogin) {
    uni.showToast({ icon: 'none', title: '请先登录' })
    setTimeout(() => handleClose(), 600)
    return
  }

  if (visible && updateNowTime().hasLogin) {
    const username = userInfo.value.username
    if (!username) {
      return
    }
    getUnreadNotificationCount(username).then((count) => {
      unreadNotifyCount.value = count
    })
  }
})

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
      handleToPage(PROFILE_ENTRIES.value[0])
    })
  }).catch(() => { })
}
</script>

<template>
  <uh-glass-popup
    v-model="popupVisible" position="left" custom-class="rounded-rt-xl rounded-rb-xl !border !border-l-none !border-t-none"
    :z-index="110" hide-when-close
  >
    <view class="relative box-border h-full w-[70vw] flex flex-col gap-y-4 overflow-hidden" :style="[containerStyle]">
      <view
        v-if="false"
        class="uh-global-card-glass absolute right-4 top-4 z-30 box-border h-6 w-6 flex items-center justify-center border rounded-lg bg-white/90 text-gray-900 !shadow-none"
        @click="handleClose()"
      >
        <wd-icon name="close" size="28rpx" />
      </view>
      <view v-if="cardBgSrc" class="absolute left-0 top-0 h-42 w-full overflow-hidden">
        <image
          :src="cardBgSrc"
          class="pointer-events-none absolute inset-0 h-full w-full" mode="aspectFill"
          @error="onCardBgError()"
        />
        <view class="uh-profile-mask pointer-events-none inset-0 h-full w-full" />
        <view
          class="pointer-events-none absolute bottom-0 left-0 h-6 w-full"
          style="background:linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(255, 255, 255, 0.7));"
        />
      </view>
      <!-- 用户信息卡片 -->
      <view v-if="updateNowTime().hasLogin" class="box-border w-full flex shrink-0 px-4 pt-30">
        <view
          class="uh-global-card-glass relative w-full overflow-hidden rounded-xl bg-white/80 !shadow-none"
          @click="handleToPage(profileEntry('my-profile'))"
        >
          <view
            class="relative z-20 box-border flex items-center gap-x-2 p-3"
          >
            <view class="relative shrink-0">
              <wd-avatar
                :src="checkAvatarUrl(userInfo.avatar)" :text="getAvatarFallbackText(userInfo.nickname)"
                shape="round"
                custom-class="uh-global-card-glass uh-shadow-xs !h-12 !w-12 !shrink-0 !text-gray-900 !font-bold"
                class="!rounded-full" mode="aspectFill"
              />
              <image
                v-if="wornSlots.avatarFrame.visible" :src="wornSlots.avatarFrame.url"
                class="uh-frame-center pointer-events-none absolute left-1/2 top-1/2 h-14 w-14"
                mode="aspectFit"
              />
            </view>
            <view class="min-w-0 flex-1">
              <view class="flex items-center gap-x-1">
                <text class="line-clamp-1 text-sm text-gray-900 font-semibold" :style="wornSlots.nameStyle.style">{{ userInfo.nickname }}</text>
                <image
                  v-if="wornSlots.primaryBadge.visible" :src="wornSlots.primaryBadge.url"
                  class="h-4 w-4 shrink-0 !block" mode="aspectFit"
                />
              </view>
              <text
                v-if="wornSlots.title.visible" class="mt-1 box-border max-w-fit shrink-0 truncate rounded-full px-2 py-[1px] text-[10px]"
                :style="wornSlots.title.style"
              >
                {{ wornSlots.title.text }}
              </text>
              <text v-else class="mt-0.5 block truncate text-3xs text-gray-400">
                @{{ userInfo.username }}
              </text>
            </view>
            <view
              class="uh-global-card-glass h-7 w-7 flex shrink-0 items-center justify-center border rounded-lg"
              @click.stop="handleToPage(profileEntry('my-profile'))"
            >
              <wd-icon name="edit" size="28rpx" custom-class="text-gray-500" />
            </view>
          </view>
        </view>
      </view>

      <!-- 个人入口 -->
      <view class="box-border w-full flex shrink-0 flex-col px-4">
        <uh-section-title>基本功能</uh-section-title>
        <view class="grid grid-cols-3 mt-3 box-border gap-2.5">
          <view
            v-for="entry in PROFILE_ENTRIES" :key="entry.key"
            class="uh-global-card-glass flex flex-col items-center gap-y-1 overflow-hidden rounded-xl p-2 !shadow-none"
            @click="handleToPage(entry)"
          >
            <view class="relative box-border w-full flex items-center justify-center text-gray-900">
              <wd-icon :name="entry.icon" size="52rpx" />
              <view
                v-if="entry.key === 'notifications' && unreadNotifyCount > 0"
                class="absolute box-border h-4 min-w-4 flex items-center justify-center rounded-full bg-red-400 p-0.5 -right-1.5 -top-1.5"
              >
                <text class="text-11px text-white leading-none">
                  {{ unreadNotifyCount > 99 ? '99+' : unreadNotifyCount
                  }}
                </text>
              </view>
            </view>
            <text class="flex-1 text-xs text-gray-900">{{ entry.label }}</text>
          </view>
        </view>
      </view>

      <!-- 管理入口区域(有权限才显示整节;无权限连同标题隐藏,不做空态占位;此区为唯一滚动区,贴底逻辑由 flex-1 spacer 兜底) -->
      <view v-if="visibleAdminEntries.length" class="box-border w-full flex flex-1 flex-col overflow-hidden px-4">
        <uh-section-title>管理中心</uh-section-title>
        <scroll-view scroll-y :show-scrollbar="false" class="mt-3 min-h-0 flex-1">
          <view class="box-border flex flex-col gap-y-2">
            <view
              v-for="entry in visibleAdminEntries" :key="entry.key"
              class="uh-global-card-glass flex items-center gap-x-2 rounded-xl px-3 py-2 !shadow-none"
              @click="handleToAdmin(entry.url)"
            >
              <wd-icon :name="entry.icon" size="32rpx" custom-class="text-gray-900 dark:text-gray-100" />
              <text class="flex-1 text-3xs text-gray-900 dark:text-gray-100">{{ entry.label }}</text>
              <wd-icon name="arrow-right" size="28rpx" custom-class="text-gray-400" />
            </view>
          </view>
        </scroll-view>
      </view>
      <view v-else class="w-full flex-1" />

      <!-- 底部操作栏 -->
      <view
        v-if="updateNowTime().hasLogin" class="box-border w-full flex shrink-0 items-center px-4"
        :class="[isWechat ? '' : 'pb-4']"
      >
        <uh-button
          class="flex-1"
          custom-class="flex-1 uh-global-card-glass uh-shadow-xs border !py-2.5 !rounded-full !bg-red-400 !text-white !text-3xs"
          @action-click="handleLogout()"
        >
          退出登录
        </uh-button>
      </view>
    </view>
  </uh-glass-popup>
  <wd-dialog selector="user-popup" />
</template>

<style scoped>
/* -translate-* 工具类在端内不支持,头像框居中经此类实现 */
.uh-frame-center {
  transform: translate(-50%, -50%);
}

/* 素材带磨砂面纱(对齐 user-profile 顶部/资料卡弹窗) */
.uh-profile-mask {
  background-color: rgba(0, 0, 0, 0.075);
  backdrop-filter: blur(2rpx);
  -webkit-backdrop-filter: blur(2rpx);
}
</style>
