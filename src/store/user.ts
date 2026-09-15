import type { IUserInfoRes } from '@/api/types/login'
import type { ILoginResult, ILoginUser } from '@/api/types/uni-halo'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getAuthProfile } from '@/api/auth'

// 初始化状态
const userInfoState: IUserInfoRes = {
  userId: -1,
  username: '',
  nickname: '',
  avatar: '/static/images/default-avatar.png',
}

/**
 * 插件端 LoginUser 摘要 → IUserInfoRes 映射
 * (登录接口与 auth/profile 均返回 {user, roles, permissions},user 不含数字 id)
 */
function mapLoginUser(user?: ILoginUser): IUserInfoRes {
  return {
    ...userInfoState,
    username: user?.name || '',
    nickname: user?.displayName || user?.name || '',
    avatar: user?.avatar || userInfoState.avatar,
    email: user?.email,
  }
}

export const useUserStore = defineStore(
  'user',
  () => {
    // 定义用户信息
    const userInfo = ref<IUserInfoRes>({ ...userInfoState })
    // 设置用户信息
    const setUserInfo = (val: IUserInfoRes) => {
      // 若头像为空 则使用默认头像
      if (!val.avatar) {
        val.avatar = userInfoState.avatar
      }
      userInfo.value = val
    }
    const setUserAvatar = (avatar: string) => {
      userInfo.value.avatar = avatar
    }
    // 删除用户信息
    const clearUserInfo = () => {
      userInfo.value = { ...userInfoState }
      uni.removeStorageSync('user')
    }

    /**
     * 获取用户信息(独立接口:auth/profile,需登录 token)
     * 用于登录结果未携带用户信息时的兜底刷新
     */
    const fetchUserInfo = async () => {
      const res = await getAuthProfile()
      const profile = res.data || {}
      const info: IUserInfoRes = {
        ...mapLoginUser(profile.user),
        roles: profile.roles || [],
        permissions: profile.permissions || [],
      }
      setUserInfo(info)
      return info
    }

    /**
     * 登录结果直接写入(登录接口已一并返回用户信息与权限,无需再调 profile)
     */
    const setUserInfoFromLoginResult = (result: ILoginResult) => {
      const info: IUserInfoRes = {
        ...mapLoginUser(result.user),
        roles: result.roles || [],
        permissions: result.permissions || [],
      }
      setUserInfo(info)
      return info
    }

    return {
      userInfo,
      clearUserInfo,
      fetchUserInfo,
      setUserInfo,
      setUserAvatar,
      setUserInfoFromLoginResult,
    }
  },
  {
    persist: true,
  },
)
