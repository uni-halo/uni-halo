import { onUnmounted, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

/** 打字机效果 hook 参数 */
interface ITypewriterOptions {
  /** 每步前进的字符数（默认 1） */
  step?: number
  /** 每步间隔毫秒数（默认 40） */
  speed?: number
  /** 源文本变化后是否自动开始（默认 true） */
  immediate?: boolean
}

/**
 * 打字机效果
 *
 * const { displayText, isTyping, start, stop, finish } = useTypewriter(() => text.value)
 *
 * - displayText：当前已打出的文本（绑定到模板）
 * - isTyping：是否正在打字
 * - start()：从头开始打字
 * - stop()：停止打字（保留已打出的内容）
 * - finish()：立即显示全部文本
 */
export function useTypewriter(source: MaybeRefOrGetter<string>, options: ITypewriterOptions = {}) {
  const { step = 1, speed = 40, immediate = true } = options

  const displayText = ref('')
  const isTyping = ref(false)

  let timer: ReturnType<typeof setTimeout> | null = null

  function stop() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    isTyping.value = false
  }

  function start() {
    stop()
    const fullText = toValue(source) ?? ''
    if (!fullText) {
      displayText.value = ''
      return
    }
    isTyping.value = true
    displayText.value = ''
    let pos = 0
    const tick = () => {
      pos = Math.min(pos + step, fullText.length)
      displayText.value = fullText.slice(0, pos)
      if (pos >= fullText.length) {
        isTyping.value = false
        timer = null
        return
      }
      timer = setTimeout(tick, speed)
    }
    tick()
  }

  /** 立即显示全部文本 */
  function finish() {
    stop()
    displayText.value = toValue(source) ?? ''
  }

  if (immediate) {
    // immediate：组件挂载时源文本已有值也需要开始打字
    watch(() => toValue(source), () => start(), { immediate: true })
  }

  onUnmounted(stop)

  return { displayText, isTyping, start, stop, finish }
}
