import { describe, expect, it } from 'vitest'
import { useFavoritesStore } from './favorites'
import type { FavoriteKind, IFavoriteItem } from '@/utils/favorite'

/** 构造合法收藏项(createTime 默认递增,保证字典序即可乱序测试) */
let seq = 0
function makeItem(kind: FavoriteKind, id: string, createTime?: string): IFavoriteItem {
  seq += 1
  return {
    kind,
    id,
    title: kind === 'post' ? `标题${id}` : undefined,
    cover: kind === 'post' ? 'https://example.com/cover.png' : undefined,
    content: `内容${id}-${seq}`,
    createTime: createTime || new Date(2026, 8, seq).toISOString(),
    owner: { id: 'owner-1', displayName: '博主', avatar: 'https://example.com/a.png' },
  }
}

describe('useFavoritesStore', () => {
  it('add：文章与瞬间分类存储并统计数量', () => {
    const store = useFavoritesStore()
    store.add(makeItem('post', 'p-1'))
    store.add(makeItem('moment', 'm-1'))

    expect(store.postItems.map(i => i.id)).toEqual(['p-1'])
    expect(store.momentItems.map(i => i.id)).toEqual(['m-1'])
    expect(store.counts).toEqual({ post: 1, moment: 1, total: 2 })
  })

  it('postItems/momentItems：按收藏时间倒序排列', () => {
    const store = useFavoritesStore()
    store.add(makeItem('post', 'p-old', '2026-08-01T00:00:00.000Z'))
    store.add(makeItem('post', 'p-new', '2026-09-01T00:00:00.000Z'))
    store.add(makeItem('moment', 'm-old', '2026-07-01T00:00:00.000Z'))
    store.add(makeItem('moment', 'm-new', '2026-10-01T00:00:00.000Z'))

    expect(store.postItems.map(i => i.id)).toEqual(['p-new', 'p-old'])
    expect(store.momentItems.map(i => i.id)).toEqual(['m-new', 'm-old'])
  })

  it('add：同一 kind+id 重复收藏幂等忽略', () => {
    const store = useFavoritesStore()
    const item = makeItem('post', 'p-1')
    expect(store.add(item)).toBe(true)
    expect(store.add(item)).toBe(false)
    expect(store.postItems).toHaveLength(1)
  })

  it('add：文章与瞬间允许相同 id(不同 kind 互不冲突)', () => {
    const store = useFavoritesStore()
    store.add(makeItem('post', 'same'))
    store.add(makeItem('moment', 'same'))

    expect(store.counts.total).toBe(2)
    expect(store.isFavorite('post', 'same')).toBe(true)
    expect(store.isFavorite('moment', 'same')).toBe(true)

    expect(store.remove('post', 'same')).toBe(true)
    expect(store.isFavorite('moment', 'same')).toBe(true)
    expect(store.counts.moment).toBe(1)
  })

  it('isFavorite：未收藏返回 false，收藏后返回 true', () => {
    const store = useFavoritesStore()
    expect(store.isFavorite('moment', 'm-1')).toBe(false)
    store.add(makeItem('moment', 'm-1'))
    expect(store.isFavorite('moment', 'm-1')).toBe(true)
  })

  it('toggle：未收藏→收藏返回 true；已收藏→取消返回 false', () => {
    const store = useFavoritesStore()
    expect(store.toggle(makeItem('moment', 'm-1'))).toBe(true)
    expect(store.isFavorite('moment', 'm-1')).toBe(true)
    expect(store.toggle(makeItem('moment', 'm-1'))).toBe(false)
    expect(store.isFavorite('moment', 'm-1')).toBe(false)
  })

  it('remove：删除存在的项返回 true，重复删除返回 false', () => {
    const store = useFavoritesStore()
    store.add(makeItem('post', 'p-1'))
    expect(store.remove('post', 'p-1')).toBe(true)
    expect(store.postItems).toHaveLength(0)
    expect(store.remove('post', 'p-1')).toBe(false)
  })

  it('add：结构非法的收藏项被拒绝', () => {
    const store = useFavoritesStore()
    expect(store.add({} as IFavoriteItem)).toBe(false)
    expect(store.add({ kind: 'post' } as IFavoriteItem)).toBe(false)
    expect(store.list).toHaveLength(0)
  })

  it('脏数据：持久化读回的非法项不进入列表与统计', () => {
    const store = useFavoritesStore()
    store.add(makeItem('post', 'p-ok', '2026-09-01T00:00:00.000Z'))
    // 模拟 storage 中残留的结构非法项(绕过 add 直接写入)
    store.list.push({
      kind: 'post',
      id: '',
      content: 'bad',
      createTime: '2026-09-02T00:00:00.000Z',
      owner: { displayName: '' },
    } as unknown as IFavoriteItem)
    store.list.push({ not: 'an-item' } as unknown as IFavoriteItem)

    expect(store.postItems.map(i => i.id)).toEqual(['p-ok'])
    expect(store.counts).toEqual({ post: 1, moment: 0, total: 1 })
    expect(store.isFavorite('post', 'p-ok')).toBe(true)
  })
})
