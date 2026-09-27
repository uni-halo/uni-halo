/**
 * 豆瓣插件配置
 * 类型与状态的中文文案映射，列表页/详情页共用
 */

/** 豆瓣类型中文映射(movie/music/book/game/drama) */
export const DOUBAN_TYPE_LABELS: Record<string, string> = {
  movie: '电影',
  book: '图书',
  music: '音乐',
  game: '游戏',
  drama: '舞台剧',
}

/** 各类型的状态文案映射(mark/doing/done) */
const DOUBAN_STATUS_LABELS: Record<string, Record<string, string>> = {
  movie: { mark: '想看', doing: '在看', done: '看过' },
  book: { mark: '想读', doing: '在读', done: '读过' },
  music: { mark: '想听', doing: '在听', done: '听过' },
  game: { mark: '想玩', doing: '在玩', done: '玩过' },
  drama: { mark: '想看', doing: '在看', done: '看过' },
}

/** 状态中文文案(按类型取对应文案，未指定类型按电影，未知类型原样返回) */
export function doubanStatusLabelOf(type: string | undefined, status: string | undefined): string {
  if (!status) { return '' }
  return DOUBAN_STATUS_LABELS[type || 'movie']?.[status] || status
}

/** 状态筛选项(文案随所选类型联动) */
export function doubanStatusOptionsOf(type: string | undefined) {
  return [
    { label: '全部状态', value: '' },
    { label: doubanStatusLabelOf(type, 'mark'), value: 'mark' },
    { label: doubanStatusLabelOf(type, 'doing'), value: 'doing' },
    { label: doubanStatusLabelOf(type, 'done'), value: 'done' },
  ]
}
