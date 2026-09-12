/**
 * 收藏快照:把文章(IPost)/瞬间(IMoment)组装为统一收藏项 IFavoriteItem
 * 纯函数层,快照自包含(纯文本摘要截断),供 store 与三处收藏按钮共用
 */
import type { IMoment, IPost } from '@/api/types/halo'
import { checkAvatarUrl, checkImageUrl } from '@/utils/url'
import { extractPlainExcerpt } from '@/utils/text'

/** 收藏内容类型 */
export type FavoriteKind = 'post' | 'moment'

/** 收藏项作者快照 */
export interface IFavoriteOwner {
  /** post: owner.metadata.name;moment: owner.name */
  id?: string
  displayName: string
  avatar: string
}

/** 统一收藏项(文章/瞬间,纯本地) */
export interface IFavoriteItem {
  kind: FavoriteKind
  /** 详情 id(metadata.name) */
  id: string
  /** 封面(仅文章) */
  cover?: string
  /** 标题(仅文章) */
  title?: string
  /** 纯文本摘要:文章 excerpt/正文抽 120 字;瞬间正文抽 200 字 */
  content: string
  /** 收藏时刻(ISO 字符串) */
  createTime: string
  owner: IFavoriteOwner
}

/** 文章正文/摘要截断字数 */
const POST_EXCERPT_MAX = 120
/** 瞬间正文截断字数 */
const MOMENT_EXCERPT_MAX = 200

/** 取文章摘要文本(excerpt 优先,兜底从正文抽取;候选字段可能被接口返回非字符串,逐个过滤) */
function getPostExcerptText(post: IPost): string {
  const candidates = [post.spec.excerpt, post.content?.content, post.content?.raw]
  const source = candidates.find((item): item is string => typeof item === 'string' && item.trim() !== '')
  return extractPlainExcerpt(source, POST_EXCERPT_MAX)
}

/** 文章 → 收藏快照 */
export function buildPostFavoriteItem(post: IPost, now: Date = new Date()): IFavoriteItem {
  const owner = post.owner
  const cover = post.spec.cover ? checkImageUrl(post.spec.cover) : undefined
  return {
    kind: 'post',
    id: post.metadata.name,
    cover,
    title: post.spec.title,
    content: getPostExcerptText(post),
    createTime: now.toISOString(),
    owner: {
      id: owner.metadata?.name,
      displayName: owner.displayName || '',
      avatar: checkAvatarUrl(owner.avatar),
    },
  }
}

/** 瞬间 → 收藏快照(无封面/标题) */
export function buildMomentFavoriteItem(moment: IMoment, now: Date = new Date()): IFavoriteItem {
  const owner = moment.owner
  // moment.owner 含 index signature,metadata 需显式收窄
  const ownerMeta = owner?.metadata as { name?: string } | undefined
  return {
    kind: 'moment',
    id: moment.metadata.name,
    content: extractPlainExcerpt(moment.spec.content?.html || moment.spec.content?.raw, MOMENT_EXCERPT_MAX),
    createTime: now.toISOString(),
    owner: {
      id: owner?.name || ownerMeta?.name,
      displayName: owner?.displayName || '',
      avatar: checkAvatarUrl(owner?.avatar),
    },
  }
}

/** 收藏唯一键(kind 与 id 拼接,两域 metadata.name 可能撞名) */
export function favoriteKey(kind: FavoriteKind, id: string): string {
  return `${kind}:${id}`
}

/**
 * 持久化读回数据为真边界数据,入库/展示前校验结构
 * 仅校验关键字段,非法项直接丢弃
 */
export function isValidFavoriteItem(item: unknown): item is IFavoriteItem {
  if (!item || typeof item !== 'object')
    return false
  const target = item as Partial<IFavoriteItem>
  const kindOk = target.kind === 'post' || target.kind === 'moment'
  const idOk = typeof target.id === 'string' && target.id !== ''
  const contentOk = typeof target.content === 'string'
  const createTimeOk = typeof target.createTime === 'string'
  const ownerOk = !!target.owner
    && typeof target.owner === 'object'
    && typeof (target.owner as IFavoriteOwner).displayName === 'string'
  return kindOk && idOk && contentOk && createTimeOk && ownerOk
}
