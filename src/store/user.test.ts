import { getAuthProfile } from '@/api/auth'
import { describe, expect, it, vi } from 'vitest'
import { useUserStore } from './user'

vi.mock('@/api/auth', () => ({
  getAuthProfile: vi.fn(),
}))

describe('useUserStore', () => {
  it('初始状态：userId 为 -1，username 为空，avatar 为默认头像', () => {
    const store = useUserStore()
    expect(store.userInfo.userId).toBe(-1)
    expect(store.userInfo.username).toBe('')
    expect(store.userInfo.nickname).toBe('')
    expect(store.userInfo.avatar).toBe('/static/images/default-avatar.png')
  })

  it('setUserInfo：正确更新用户信息', () => {
    const store = useUserStore()
    store.setUserInfo({
      userId: 1,
      username: 'testuser',
      nickname: 'Test',
      avatar: 'https://example.com/avatar.png',
    })
    expect(store.userInfo.userId).toBe(1)
    expect(store.userInfo.username).toBe('testuser')
    expect(store.userInfo.avatar).toBe('https://example.com/avatar.png')
  })

  it('setUserInfo：avatar 为空字符串时使用默认头像', () => {
    const store = useUserStore()
    store.setUserInfo({
      userId: 2,
      username: 'user2',
      nickname: 'User2',
      avatar: '',
    })
    expect(store.userInfo.avatar).toBe('/static/images/default-avatar.png')
  })

  it('setUserAvatar：正确更新头像', () => {
    const store = useUserStore()
    store.setUserAvatar('https://example.com/new-avatar.png')
    expect(store.userInfo.avatar).toBe('https://example.com/new-avatar.png')
  })

  it('clearUserInfo：重置为初始状态并调用 uni.removeStorageSync', () => {
    const store = useUserStore()
    store.setUserInfo({ userId: 1, username: 'u', nickname: 'U', avatar: 'a' })

    store.clearUserInfo()

    expect(store.userInfo.userId).toBe(-1)
    expect(store.userInfo.username).toBe('')
    expect(uni.removeStorageSync).toHaveBeenCalledWith('user')
  })

  it('fetchUserInfo：调用 auth/profile 并映射 user/roles/permissions 写入 store', async () => {
    const store = useUserStore()
    vi.mocked(getAuthProfile).mockResolvedValue({
      code: 200,
      message: 'ok',
      data: {
        user: { name: 'api_user', displayName: 'API User', avatar: 'https://x.com/a.png' },
        roles: ['author'],
        permissions: [],
      },
    } as any)

    const info = await store.fetchUserInfo()

    expect(info.username).toBe('api_user')
    expect(info.nickname).toBe('API User')
    expect(info.avatar).toBe('https://x.com/a.png')
    expect(info.roles).toEqual(['author'])
    expect(store.userInfo.username).toBe('api_user')
    expect(store.userInfo.roles).toEqual(['author'])
  })

  it('setUserInfoFromLoginResult：登录结果直接映射用户信息与权限', () => {
    const store = useUserStore()
    const info = store.setUserInfoFromLoginResult({
      token: 'pat_xxx',
      user: { name: 'wx_user', displayName: '微信用户', avatar: '' },
      roles: ['reader'],
      permissions: [],
    })

    expect(info.username).toBe('wx_user')
    expect(info.nickname).toBe('微信用户')
    // avatar 为空时回退默认头像
    expect(info.avatar).toBe('/static/images/default-avatar.png')
    expect(info.roles).toEqual(['reader'])
    expect(store.userInfo.roles).toEqual(['reader'])
  })
})
