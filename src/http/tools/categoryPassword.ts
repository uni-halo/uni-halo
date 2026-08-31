/**
 * 分类加密密码逻辑(源自旧项目 common/http/interceptors.js 的
 * showCategoryInputPasswordModal / 401/403 分类密码分支)
 * Halo 私密分类:请求分类文章接口 401/403 时触发密码输入
 */
import { delCache, setCache } from '@/utils/storage'

/** 分类密码缓存前缀 */
const CATEGORY_PWD_PREFIX = 'APP_CATEGORY_PWD_'

/** 分类文章接口路径特征(用于判断请求是否为分类相关) */
const CATEGORY_API_REG = /\/api\/content\/categories\/.+\/posts/

/**
 * 从分类接口 URL 提取分类 code
 */
function getCategoryNameByUrl(url: string): string {
  const reg = '(?<=/api/content/categories/).+(?=/posts)'
  const m = url.match(reg)
  return m?.[0] || '无分类名'
}

/**
 * 分类密码输入弹窗
 */
function showCategoryInputPasswordModal(url: string, category: string): void {
  uni.showModal({
    title: `[ ${category} ] 分类已加密`,
    content: '',
    editable: true,
    placeholderText: '请输入分类密码后访问',
    confirmText: '验证密码',
    cancelText: '暂不访问',
    showCancel: true,
    cancelColor: '#999999',
    confirmColor: '#03a9f4',
    success: (res) => {
      if (res.confirm) {
        if (!res.content) {
          uni.showToast({
            title: '提示：请输入密码',
            icon: 'none',
            success: () => {
              setTimeout(() => {
                showCategoryInputPasswordModal(url, category)
              }, 800)
            },
          })
          return
        }
        // 按分类 code 缓存密码,解决多分类加密时密码串用问题
        setCache(CATEGORY_PWD_PREFIX + category, res.content)
        uni.reLaunch({
          url: '/pages/tabbar/category/category',
        })
      }
    },
  })
}

/**
 * 处理分类加密相关 401/403 响应
 * @param statusCode HTTP 状态码
 * @param url 请求 URL
 * @param data 响应体(含业务 status)
 * @returns 是否已由本模块消费该错误(调用方应直接终止)
 */
export function handleCategoryPasswordError(statusCode: number, url: string, data: { status?: number }): boolean {
  const isCategoryApi = CATEGORY_API_REG.test(url)
  if (!isCategoryApi)
    return false

  const category = getCategoryNameByUrl(url)

  if (statusCode === 401) {
    // 密码错误:清除该分类密码,下次点击再弹窗
    delCache(CATEGORY_PWD_PREFIX + category)
    uni.showToast({
      title: '提示：密码不正确',
      icon: 'none',
      success: () => {
        setTimeout(() => {
          showCategoryInputPasswordModal(url, category)
        }, 800)
      },
    })
    return true
  }

  if (statusCode === 403) {
    // 私密分类,需要输入密码
    showCategoryInputPasswordModal(url, category)
    return true
  }

  return false
}
