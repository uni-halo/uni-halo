import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useDataLoading } from './useDataLoading'

/**
 * 在 Vue 应用上下文中运行 composable。
 * composable 的 ref/computed 只能在 setup() 内使用，
 * withSetup 通过挂载一个临时组件来提供这个上下文。
 */
function withSetup<T>(composableFn: () => T): T {
  let result!: T
  const Comp = defineComponent({
    setup() {
      result = composableFn()
      return () => h('div')
    },
  })
  const wrapper = mount(Comp)
  wrapper.unmount()
  return result
}

describe('useDataLoading', () => {
  it('初始状态：status=loading, data=undefined', () => {
    const fetcher = vi.fn().mockResolvedValue('data')
    const { status, data } = withSetup(() => useDataLoading(fetcher))

    expect(status.value).toBe('loading')
    expect(data.value).toBeUndefined()
  })

  it('run 成功：status 从 loading 流转到 success，data 更新为返回值并触发 onSuccess', async () => {
    const fetcher = vi.fn().mockResolvedValue('result')
    const onSuccess = vi.fn()
    const { status, data, run } = withSetup(() => useDataLoading(fetcher, { onSuccess }))

    const promise = run()
    expect(status.value).toBe('loading')

    await promise
    expect(status.value).toBe('success')
    expect(data.value).toBe('result')
    expect(onSuccess).toHaveBeenCalledWith('result')
  })

  it('run 返回空数组：status 流转到 empty', async () => {
    const fetcher = vi.fn().mockResolvedValue([])
    const { status, run } = withSetup(() => useDataLoading(fetcher))

    await run()
    expect(status.value).toBe('empty')
  })

  it('isEmpty 自定义判空：返回 true 时 status 为 empty', async () => {
    const fetcher = vi.fn(async (): Promise<{ total: number, items: number[] }> => ({ total: 0, items: [1] }))
    const { status, run } = withSetup(() => useDataLoading(fetcher, { isEmpty: data => data.total === 0 }))

    await run()
    expect(status.value).toBe('empty')
  })

  it('run 失败：不向外抛出异常，status 流转到 error 并触发 onError', async () => {
    const err = new Error('network error')
    const onError = vi.fn()
    const fetcher = vi.fn().mockRejectedValue(err)
    const { status, data, run } = withSetup(() => useDataLoading(fetcher, { onError }))

    await expect(run()).resolves.toBeUndefined()

    expect(status.value).toBe('error')
    expect(data.value).toBeUndefined()
    expect(onError).toHaveBeenCalledWith(err)
  })

  it('带参数 run：参数透传给 fetcher', async () => {
    const fetcher = vi.fn(async (name: string) => `hi ${name}`)
    const { data, run } = withSetup(() => useDataLoading(fetcher))

    await run('world')
    expect(fetcher).toHaveBeenCalledWith('world')
    expect(data.value).toBe('hi world')
  })
})
