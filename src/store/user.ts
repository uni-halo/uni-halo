import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getAuthProfile } from '@/api/auth'
import type { IUserInfoRes } from '@/api/types/login'
import type { ILoginResult, ILoginUser } from '@/api/types/uni-halo'

const DefaultUserInfo: IUserInfoRes = {
  userId: '',
  username: '',
  nickname: '',
  avatar: '',
  email: '',
  roles: [],
  permissions: [],
}

/**
 * 插件端 LoginUser 摘要 → IUserInfoRes 映射
 * (登录接口与 auth/profile 均返回 {user, roles, permissions},user 不含数字 id)
 *
 * 注意:avatar 保存服务端原始地址(允许相对路径),不在此处补全——
 * 渲染时经 checkAvatarUrl() 补全,保证博客迁移(域名变更)后仍可访问
 */
function mapLoginUser(user?: ILoginUser): IUserInfoRes {
  return {
    userId: user?.name,
    username: user?.name || '',
    nickname: user?.displayName || user?.name || '',
    avatar: user?.avatar || '',
    email: user?.email,
  }
}

export const useUserStore = defineStore(
  'user',
  () => {
    // 定义用户信息
    const userInfo = ref<IUserInfoRes>({ ...DefaultUserInfo })
    // 设置用户信息
    const setUserInfo = (val: IUserInfoRes) => {
      userInfo.value = val
    }
    const setUserAvatar = (avatar: string) => {
      userInfo.value.avatar = avatar
    }

    // 删除用户信息
    const clearUserInfo = () => {
      userInfo.value = { ...DefaultUserInfo }
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
