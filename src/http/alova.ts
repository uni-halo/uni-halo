import type { uniappRequestAdapter } from '@alova/adapter-uniapp'
import type { IResponse } from './types'
import AdapterUniapp from '@alova/adapter-uniapp'
import { createAlova } from 'alova'
import { createServerTokenAuthentication } from 'alova/client'
import VueHook from 'alova/vue'
import { storeToRefs } from 'pinia'
import { useTokenStore } from '@/store/token'
import { toLoginPage } from '@/utils/toLoginPage'
import { ContentTypeEnum, RequestFrom, ResultEnum, ShowMessage } from './tools/enum'
import { saveCommentCookies } from './tools/commentCookies'
import { handleCategoryPasswordError } from './tools/categoryPassword'
import { UniHaloError } from './tools/exception'

// 配置动态Tag
export const API_DOMAINS = {
  DEFAULT: import.meta.env.VITE_SERVER_BASEURL,
  SECONDARY: import.meta.env.VITE_SERVER_BASEURL_SECONDARY,
}

/**
 * 创建请求实例
 */
const { onAuthRequired, onResponseRefreshToken } = createServerTokenAuthentication<typeof VueHook, typeof uniappRequestAdapter>({
  // 如果下面拦截不到，请使用 refreshTokenOnSuccess by 群友@琛
  refreshTokenOnError: {
    isExpired: (error) => {
      return error.response?.status === ResultEnum.Unauthorized
    },
    handler: async () => {
      try {
        // await authLogin();
      }
      catch (error) {
        // 切换到登录页
        toLoginPage({ mode: 'reLaunch' })
        throw error
      }
    },
  },
})

/**
 * alova 请求实例
 */
const alovaInstance = createAlova({
  baseURL: API_DOMAINS.DEFAULT,
  ...AdapterUniapp(),
  timeout: 5000,
  statesHook: VueHook,

  beforeRequest: onAuthRequired((method) => {
    // 设置默认 Content-Type
    method.config.headers = {
      ContentType: ContentTypeEnum.JSON,
      Accept: 'application/json, text/plain, */*',
      ...method.config.headers,
    }

    const { config } = method
    const ignoreAuth = !config.meta?.ignoreAuth
    console.log('ignoreAuth===>', ignoreAuth)
    // 处理认证信息   自行处理认证问题
    if (ignoreAuth) {
      const token = 'getToken()'
      if (!token) {
        throw new Error('[请求错误]：未登录')
      }
      // method.config.headers.token = token;
    }

    if (config.meta?.personalToken) {
      config.headers.Authorization = `Bearer ${config.meta.personalToken}`
    }

    // 认证接口的登录 token(如 auth/profile、auth/logout),由 tokenStore 提供
    if (config.meta?.needAuthToken) {
      const tokenStore = useTokenStore()
      tokenStore.updateNowTime()
      const { validToken: token } = storeToRefs(tokenStore)
      if (token.value) {
        config.headers.Authorization = `Bearer ${token.value}`
      }
    }

    // 处理动态域名
    if (config.meta?.domain) {
      method.baseURL = config.meta.domain
      console.log('当前域名', method.baseURL)
    }
  }),
  responded: onResponseRefreshToken({
    onSuccess: (response, method) => {
      console.log('onResponseRefreshToken response===>', response)
      console.log('onResponseRefreshToken method===>', method)
      const { config } = method
      const { requestType } = config
      const { statusCode, data: rawData, header } = response as UniNamespace.RequestSuccessCallbackResult

      // 处理特殊请求类型（上传/下载）
      if (requestType === 'upload' || requestType === 'download') {
        return response
      }

      // 保存评论验证码 cookie
      saveCommentCookies(method.url, header as Record<string, string> | undefined)

      // 分类加密密码处理（Halo 私密分类 401/403）
      // 注意:此处需在 alova 统一 401 刷新之前消费,避免分类密码请求被误判为登录过期
      // const isCategoryConsumed = handleCategoryPasswordError(statusCode, method.url, rawData as { status?: number });
      // if (isCategoryConsumed) {
      // 	throw new Error('分类访问受限');
      // }
      if (statusCode !== ResultEnum.Success200) {
        const errorMessage = ShowMessage(statusCode) || `HTTP请求错误[${statusCode}]`
        throw new UniHaloError({
          message: errorMessage,
          data: rawData,
          code: statusCode,
        })
      }

      // 归一化响应结构:Halo 来源的原始数据统一封装为 { code, data, message },
      // 与标准接口走同一条解析路径,保证响应模型一致
      let responseData: IResponse
      if (config.meta?.requestFrom === RequestFrom.Halo) {
        responseData = {
          code: statusCode,
          data: rawData,
          message: '请求成功',
        }
      }
      else {
        responseData = rawData as IResponse
      }
      return responseData
    },
    onError: (error, method) => {
      console.error('onResponseRefreshToken error===>', error)
      console.error('onResponseRefreshToken method===>', method)
    },
  }),
})

export const http = alovaInstance
