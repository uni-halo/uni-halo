/**
 * 轻言插件 API 类型定义
 * 对应 src/api/halo-plugin-third/hitokoto.ts
 */

/** 句子(HitokotoVo) */
export interface IHitokotoSentence {
  /** 句子唯一标识,如 sentence-xxxx */
  metaName?: string
  /** 句子内容 */
  content?: string
  /** 作者 */
  author?: string
  /** 来源 */
  source?: string
  /** 点赞数 */
  likeCount?: number
  /** 浏览数 */
  viewCount?: number
  /** 当前用户是否已点赞(点赞接口响应) */
  hasLiked?: boolean
  [key: string]: unknown
}

/** 随机获取句子响应 */
export interface IHitokotoRandomSentenceResponse {
  categoryName: string
  maxRandomLimit: number
  returned: number
  sentences?: Array<IHitokotoSentence>
}

/** 随机获取句子请求参数 */
export interface IHitokotoRandomReq {
  /** 分类名筛选 */
  categoryName?: string
  /** 获取条数 */
  limit?: number
  /** 输出格式 */
  encode?: 'json' | 'text'
  [key: string]: unknown
}

/** 点赞/取消点赞请求参数 */
export interface IHitokotoLikeReq {
  /** 句子唯一标识 */
  name: string
  /** 点赞或取消点赞 */
  action?: 'like' | 'unlike'
  [key: string]: unknown
}
