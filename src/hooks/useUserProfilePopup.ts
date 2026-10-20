/**
 * 用户资料卡弹窗（全局共用挂载 App.ku.vue，同模式下 useLoginPopup）
 *
 * 任意场景用户信息卡 openUserProfilePopup 弹出资料卡：
 * - 审核模式：直接拒绝（不展示任何数据）
 * - username 存在：常规模式（资料/装扮/统计等随内部各数据接口取数）
 * - 无 username：匿名（guest）模式——评论未登录访客仅有昵称/头像（可能缺失）/
 *   可选 website；背景图回落 cardBgFallback（博主页背景），
 *   标牌区域展示灰色「匿名用户」，底部「查看主页」→「复制网址」（无 website 只有「关闭」）
 */
import { ref } from 'vue'
import { useAppConfigStore } from '@/store/appConfig'
export interface IUserProfilePopupPayload {
  /**
   * 目标用户名（Halo metadata.name）；
   * 空 = 匿名（guest）模式（通常配合 anonymous 标记）
   */
  username?: string
  /** 展示昵称（常规模式数据接口返回前先行渲染；匿名模式为访客昵称） */
  nickname?: string
  /** 展示头像（同上；可能为空，取昵称首字回退） */
  avatar?: string
  /** 匿名（guest）评论者主页网址；存在时底部展示「复制网址」 */
  website?: string
  /** 匿名（guest）标记：标牌区展示灰色「匿名用户」chip */
  anonymous?: boolean
}
/** 弹窗状态（现状：模块级单例，全局共享一份） */
const userProfilePopupVisible = ref(false)
const payload = ref<IUserProfilePopupPayload>({})
/**
 * 打开用户资料卡弹窗（审核模式直接拒绝；无 username 无 anonymous 无 website 忽略）
 */
function openUserProfilePopup(data: IUserProfilePopupPayload) {
  if (!data?.username && !data?.anonymous) { return }
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
