import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { favoriteKey, isValidFavoriteItem } from '@/utils/favorite'
import type { FavoriteKind, IFavoriteItem } from '@/utils/favorite'

/**
 * 本地收藏 store(文章/瞬间统一格式,persist 持久化)
 * - 纯本地:收藏数据自包含快照,不依赖接口回源
 * - 去重键 kind + ':' + id;持久化读回数据为边界数据,展示前经 isValidFavoriteItem 过滤
 */
export const useFavoritesStore = defineStore(
  'favorites',
  () => {
    /** 收藏列表(存储顺序为插入顺序,展示按 createTime 倒序) */
    const list = ref<IFavoriteItem[]>([])

    /** 过滤脏数据后的合法列表 */
    const validList = computed(() => list.value.filter(isValidFavoriteItem))

    /** 按收藏时间倒序 */
    function sortByCreateTimeDesc(items: IFavoriteItem[]): IFavoriteItem[] {
      return [...items].sort((a, b) => b.createTime.localeCompare(a.createTime))
    }

    /** 文章收藏(倒序) */
    const postItems = computed(() => sortByCreateTimeDesc(validList.value.filter(item => item.kind === 'post')))
    /** 瞬间收藏(倒序) */
    const momentItems = computed(() => sortByCreateTimeDesc(validList.value.filter(item => item.kind === 'moment')))
    /** 各类型数量 */
    const counts = computed(() => ({
      post: postItems.value.length,
      moment: momentItems.value.length,
      total: validList.value.length,
    }))

    /** 是否已收藏 */
    function isFavorite(kind: FavoriteKind, id: string): boolean {
      const key = favoriteKey(kind, id)
      return validList.value.some(item => favoriteKey(item.kind, item.id) === key)
    }

    /** 添加收藏(已存在则幂等忽略) */
    function add(item: IFavoriteItem): boolean {
      if (!isValidFavoriteItem(item) || isFavorite(item.kind, item.id))
        return false
      list.value.push(item)
      return true
    }

    /** 取消收藏,返回是否删除成功 */
    function remove(kind: FavoriteKind, id: string): boolean {
      const key = favoriteKey(kind, id)
      const index = list.value.findIndex(item => favoriteKey(item.kind, item.id) === key)
      if (index === -1)
        return false
      list.value.splice(index, 1)
      return true
    }

    /** 切换收藏,返回操作后是否处于收藏态 */
    function toggle(item: IFavoriteItem): boolean {
      if (isFavorite(item.kind, item.id))
        remove(item.kind, item.id)
      else
        add(item)
      return isFavorite(item.kind, item.id)
    }

    return {
      list,
      postItems,
      momentItems,
      counts,
      isFavorite,
      add,
      remove,
      toggle,
    }
  },
  {
    persist: true,
  },
)
