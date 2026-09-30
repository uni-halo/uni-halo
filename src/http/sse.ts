/**
 * 统一 SSE 流式请求工具
 * 平台适配: H5 用 fetch+ReadableStream / 小程序与 APP 用 enableChunked
 * 不支持流式时自动降级: 等待完整响应后一次性回调
 */
import { useTokenStore } from '@/store'
import { getEnvBaseUrl } from '@/utils'

export interface SseRequestOptions {
  /** 请求地址, 非 http 开头自动拼接 baseUrl */
  url: string
  method?: 'POST' | 'GET'
  /** 请求体, POST 时序列化为 JSON */
  data?: unknown
  /** 附加请求头 */
  header?: Record<string, string>
  /** 是否携带登录 token */
  needAuthToken?: boolean
  /** 超时(ms) */
  timeout?: number
  /** 收到一段 SSE data 负载 */
  onMessage: (data: string) => void
  /** 流结束(含降级完成) */
  onDone: () => void
  /** 请求失败 */
  onError: (message: string) => void
}

export interface SseHandle {
  /** 中止请求 */
  abort: () => void
}

/** 调试日志开关: 生产可通过 VITE_DELETE_CONSOLE 剔除 */
function sseLog(...args: unknown[]) {
  console.log('[sse]', ...args)
}

/** 调试用: 二进制前 32 字节的十六进制预览 */
function bytesPreview(chunk: ArrayBuffer | Uint8Array): string {
  const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)
  const head = Array.from(bytes.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' ')
  return `(${bytes.length}B) ${head}`
}

/** 手写 UTF-8 解码(无 TextDecoder 环境兜底, 跨 chunk 安全) */
function createUtf8Decoder() {
  let pending: Uint8Array | null = null
  function decode(chunk: ArrayBuffer | Uint8Array, stream: boolean): string {
    let bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)
    sseLog('decode: bytes in =', bytes.length, 'pending =', pending?.length ?? 0)
    // 拼接上一轮残留的多字节序列
    if (pending && pending.length) {
      const merged = new Uint8Array(pending.length + bytes.length)
      merged.set(pending)
      merged.set(bytes, pending.length)
      bytes = merged
      pending = null
    }
    let end = bytes.length
    if (stream) {
      // 回退末尾不完整的多字节序列, 留到下一轮
      for (let i = 0; i < 4 && end > 0; i++) {
        const byte = bytes[end - 1]
        if (byte < 0x80)
          break
        if (byte >= 0xC0) {
          const need = byte >= 0xF0 ? 4 : byte >= 0xE0 ? 3 : 2
          if (bytes.length - (end - 1) < need)
            end = end - 1
          break
        }
        end--
      }
      if (end < bytes.length)
        pending = bytes.slice(end)
    }
    let out = ''
    for (let i = 0; i < end;) {
      const byte = bytes[i]!
      if (byte < 0x80) {
        out += String.fromCharCode(byte)
        i++
      }
      else if (byte >= 0xC0 && byte < 0xE0 && i + 1 < end) {
        out += String.fromCharCode(((byte & 0x1F) << 6) | (bytes[i + 1]! & 0x3F))
        i += 2
      }
      else if (byte >= 0xE0 && byte < 0xF0 && i + 2 < end) {
        out += String.fromCharCode(((byte & 0x0F) << 12) | ((bytes[i + 1]! & 0x3F) << 6) | (bytes[i + 2]! & 0x3F))
        i += 3
      }
      else if (byte >= 0xF0 && i + 3 < end) {
        const cp = ((byte & 0x07) << 18) | ((bytes[i + 1]! & 0x3F) << 12) | ((bytes[i + 2]! & 0x3F) << 6) | (bytes[i + 3]! & 0x3F)
        out += String.fromCharCode(0xD800 + ((cp - 0x10000) >> 10), 0xDC00 + ((cp - 0x10000) & 0x3FF))
        i += 4
      }
      else {
        // 非法序列跳过
        i++
      }
    }
    return out
  }
  return { decode }
}

/** 解析 SSE 原始文本流为 data 负载(跨 chunk 拼接安全) */
function createSseParser(onData: (data: string) => void) {
  let buffer = ''
  // UTF-8 跨 chunk 可能被截断, 优先 TextDecoder, 无则手写解码兜底
  let decoder: { decode: (chunk: ArrayBuffer | Uint8Array, stream: boolean) => string } | null = null
  try {
    if (typeof TextDecoder !== 'undefined')
      decoder = { decode: (chunk, stream) => new TextDecoder('utf-8').decode(chunk, { stream }) }
  }
  catch {
    decoder = null
  }
  if (!decoder)
    decoder = createUtf8Decoder()

  function feed(chunk: ArrayBuffer | Uint8Array | string) {
    let text = ''
    if (typeof chunk === 'string') {
      text = chunk
      sseLog('feed(string):', JSON.stringify(chunk.slice(0, 200)))
    }
    else {
      text = decoder!.decode(chunk, true)
      sseLog('feed(buffer):', bytesPreview(chunk), '-> text =', JSON.stringify(text.slice(0, 200)))
    }
    buffer += text
    // SSE 事件以空行分隔
    const events = buffer.split(/\r?\n\r?\n/)
    buffer = events.pop() ?? ''
    sseLog('feed: complete events =', events.length, 'buffer left =', buffer.length)
    for (const event of events) {
      emitEvent(event)
    }
  }

  function emitEvent(event: string) {
    const dataLines: string[] = []
    for (const line of event.split(/\r?\n/)) {
      if (line.startsWith('data:'))
        dataLines.push(line.slice(5).trimStart())
      // 忽略 event:/id:/retry: 与注释行
    }
    if (dataLines.length) {
      const payload = dataLines.join('\n')
      sseLog('event -> data payload:', JSON.stringify(payload.slice(0, 300)))
      onData(payload)
    }
    else {
      sseLog('event -> no data lines:', JSON.stringify(event.slice(0, 200)))
    }
  }

  function end() {
    // 冲刷残留缓冲
    if (buffer.trim()) {
      sseLog('end: flush residual buffer:', JSON.stringify(buffer.slice(0, 300)))
      emitEvent(buffer)
      buffer = ''
    }
    else {
      sseLog('end: buffer empty')
    }
  }

  return { feed, end }
}

/** 拼接完整 URL(与 interceptor 规则一致) */
function buildUrl(url: string): string {
  if (url.startsWith('http'))
    return url
  // #ifdef H5
  if (JSON.parse(import.meta.env.VITE_APP_PROXY_ENABLE)) {
    return import.meta.env.VITE_APP_PROXY_PREFIX + url
  }
  // #endif
  return getEnvBaseUrl() + url
}

/** 公共请求头(含 token) */
function buildHeader(options: SseRequestOptions): Record<string, string> {
  const header: Record<string, string> = {
    Accept: 'text/event-stream',
    ...options.header,
  }
  if (options.needAuthToken) {
    const tokenStore = useTokenStore()
    if (tokenStore.validToken)
      header.Authorization = `Bearer ${tokenStore.validToken}`
  }
  return header
}

// #ifdef H5
function requestByFetch(options: SseRequestOptions): SseHandle {
  const controller = new AbortController()
  ;(async () => {
    try {
      const response = await fetch(buildUrl(options.url), {
        method: options.method ?? 'POST',
        headers: buildHeader(options),
        body: options.data != null ? JSON.stringify(options.data) : undefined,
        signal: controller.signal,
        credentials: 'include',
      })
      if (!response.ok || !response.body) {
        options.onError(`请求失败(${response.status})`)
        return
      }
      const parser = createSseParser(options.onMessage)
      const reader = response.body.getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done)
          break
        parser.feed(value)
      }
      parser.end()
      options.onDone()
    }
    catch (error: unknown) {
      if ((error as Error)?.name === 'AbortError')
        return
      options.onError((error as Error)?.message || '连接失败')
    }
  })()
  return { abort: () => controller.abort() }
}
// #endif

// #ifndef H5
/** 小程序/APP: enableChunked 流式, 不支持时自动降级非流式 */
function requestByUni(options: SseRequestOptions): SseHandle {
  const parser = createSseParser(options.onMessage)
  let aborted = false
  let chunkReceived = false
  const task = uni.request({
    url: buildUrl(options.url),
    method: (options.method ?? 'POST') as 'POST' | 'GET',
    data: options.data,
    header: buildHeader(options),
    timeout: options.timeout ?? 120000,
    // #ifdef MP-WEIXIN || APP-PLUS
    enableChunked: true,
    // #endif
    success: (res) => {
      if (aborted)
        return
      // 已流式消费过分片则不再重复喂入; 降级场景一次性喂入完整响应体
      if (!chunkReceived && res.data != null) {
        parser.feed(typeof res.data === 'string' ? res.data : JSON.stringify(res.data))
        parser.end()
      }
      options.onDone()
    },
    fail: (err) => {
      if (aborted)
        return
      options.onError(err.errMsg || '连接失败')
    },
  })
  // #ifdef MP-WEIXIN || APP-PLUS
  ;(task as unknown as { onChunkReceived?: (cb: (res: { data: ArrayBuffer }) => void) => void })
    .onChunkReceived?.((res: { data: ArrayBuffer }) => {
      if (aborted)
        return
      chunkReceived = true
      parser.feed(res.data)
    })
  // #endif
  return {
    abort: () => {
      aborted = true
      task?.abort?.()
    },
  }
}
// #endif

/**
 * 发起 SSE 流式请求
 * @example
 * const handle = requestSse({ url: '/apis/.../ragAgentChat', data, onMessage, onDone, onError })
 * handle.abort() // 停止生成
 */
export function requestSse(options: SseRequestOptions): SseHandle {
  // #ifdef H5
  return requestByFetch(options)
  // #endif
  // #ifndef H5
  return requestByUni(options)
  // #endif
}
