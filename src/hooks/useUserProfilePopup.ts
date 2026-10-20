/**
 * 用户资料卡弹窗（全局挂载于 App.ku.vue，设计对齐 useLoginPopup）
 *
 * 任意处点击用户信息经 openUserProfilePopup 唤起资料卡：
 * - 审核模式下直接忽略（不展示任何内容）
 * - username 为空忽略
 * - 载荷仅兜底展示信息，完整数据（装饰/标牌/统计）由弹窗内部经身份接口拉取
 */
import { ref } from 'vue'
import { useAppConfigStore } from '@/store/appConfig'

export interface IUserProfilePopupPayload {
  /** 目标用户名（Halo metadata.name） */
  username: string
  /** 兜底昵称（点击处的即时数据，身份接口返回前先渲染） */
  nickname?: string
  /** 兜底头像（同上） */
  avatar?: string
}

/** 弹层显隐与载荷（模块级共享，全局仅此一份） */
const userProfilePopupVisible = ref(false)
const payload = ref<IUserProfilePopupPayload>({ username: '' })

/**
 * 打开用户资料卡弹窗（审核模式 / username 为空直接忽略）
 */
function openUserProfilePopup(data: IUserProfilePopupPayload) {
  if (!data?.username) { return }
  const appConfigStore = useAppConfigStore()
  if (appConfigStore.auditModeEnabled) { return }
  payload.value = { ...data }
  userProfilePopupVisible.value = true
}

function closeUserProfilePopup() {
  userProfilePopupVisible.value = false
}

export function useUserProfilePopup() {
  return { userProfilePopupVisible, payload, openUserProfilePopup, closeUserProfilePopup }
}
