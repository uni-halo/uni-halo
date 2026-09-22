import type { CustomRequestOptions } from '@/http/types'
import { storeToRefs } from 'pinia'
import { useTokenStore } from '@/store'
import { getEnvBaseUrl } from '@/utils'
import { stringifyQuery } from './tools/queryString'
// import qs from 'qs'

// 请求基准地址
const baseUrl = getEnvBaseUrl()

// 拦截器配置
const httpInterceptor = {
  // 拦截前触发
  invoke(options: CustomRequestOptions) {
    // 如果您使用了alova，则请把下面的代码放开注释
    // alova 执行流程：alova beforeRequest --> 本拦截器 --> alova responded
    // return options

    // 非 alova 请求，正常执行
    // 接口请求支持通过 query 参数配置 queryString

    if (options?.meta?.query) {
      // const queryStr = qs.stringify(options?.meta?.query, {
      // allowDots: true,
      // encodeValuesOnly: true,
      // skipNulls: true,
      // encode: true,
      // arrayFormat: 'repeat'
      // })

      const queryStr = stringifyQuery(options?.meta?.query)
      if (options.url.includes('?')) {
        options.url += `&${queryStr}`
      }
      else {
        options.url += `?${queryStr}`
      }
    }

    // 非 http 开头需拼接地址
    if (!options.url.startsWith('http')) {
      // #ifdef H5
      if (JSON.parse(import.meta.env.VITE_APP_PROXY_ENABLE)) {
        // 自动拼接代理前缀
        options.url = import.meta.env.VITE_APP_PROXY_PREFIX + options.url
      }
      else {
        options.url = baseUrl + options.url
      }
      // #endif
      // 非H5正常拼接
      // #ifndef H5
      options.url = baseUrl + options.url
      // #endif
      // TIPS: 如果需要对接多个后端服务，也可以在这里处理，拼接成所需要的地址
    }

    // 请求超时
    options.timeout = 60000 // 60s

    // 这里也可以添加一些公共请求头
    options.header = {
      ...options.header,
    }

    // 需要登录token的请求，添加token到请求头
    // 为什么这么设计？因为有些接口不需要token，加上了token反而会报错
    // 那如果是一些第三方接口，需要token，怎么办？可以直接在请求的时候在请求头自己添加header即可
    if (options?.meta?.needLoginToken) {
      const tokenStore = useTokenStore()
      tokenStore.updateNowTime()
      const { validToken: token } = storeToRefs(tokenStore)
      if (token.value) {
        options.header.Authorization = `Bearer ${token.value}`
      }
    }
    return options
  },
}

export const requestInterceptor = {
  install() {
    // 拦截 request 请求
    uni.addInterceptor('request', httpInterceptor)
    // 拦截 uploadFile 文件上传
    uni.addInterceptor('uploadFile', httpInterceptor)
  },
}
