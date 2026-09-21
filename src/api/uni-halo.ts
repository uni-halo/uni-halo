/**
 * uni-halo 自定义 API 接口定义
 */
import { http } from '@/http/alova'
import { RequestFrom } from '@/http/tools/enum'
import type { IResponse } from '@/http/types'
import { useAppConfigStore } from '@/store/appConfig'
import { getLoveModuleToken } from '@/utils/loveModuleToken'
import { getNologinEmail, getOpenid } from '@/utils/auth'
import { getPersonalToken } from '@/store/token'
import type {
  IAppConfig,
  IAuditDataResult,
  IBannerPublicDetail,
  IBannerPublicItem,
  ICommentWidgetConfig,
  IDoubanDetail,
  IHaloGlobalConfig,
  ILoveAlbum,
  ILoveAlbumListReq,
  ILoveAlbumListRes,
  ILoveDailyItem,
  ILoveDailyItemListReq,
  ILoveDailyItemListRes,
  ILoveInfo,
  ILoveStory,
  ILoveStoryListReq,
  ILoveStoryListRes,
  IMiniProgramLink,
  IMiniProgramLinkGroupedRes,
  IMiniProgramLinkGroupOption,
  IMiniProgramLinkSubmissionForm,
  INoticeDetail,
  INoticeListRes,
  INoticeListVo,
  INoticeTypeListRes,
  IQRCodeInfo,
  IRestrictReadCheckReq,
  IRestrictReadCheckRes,
  ISubmitLinkForm,
  IUpdateCheckRes,
  IVoteDetail,
  IVoteListReq,
  IVoteListRes,
  IVoteSubmitReq,
  RestrictReadType,
} from './types/uni-halo'

/** 评论验证码 cookie key */
const COMMENT_WIDGET_CAPTCHA_COOKIES = 'comment-widget-captcha'

/* ==================== uni-halo 配置 ==================== */

/**
 * 获取应用配置
 * 注意:cacheFor: 0 绕过 alova 内存缓存——维护模式/配置变更后需即时生效
 * (维护页刷新、入口/首页拦截均依赖本接口的最新状态)
 */
export function getAppConfigs() {
  return http.Get<IResponse<IAppConfig>>('/apis/api.unihalo.ialley.cn/v1alpha1/getConfigs', {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 获取审核模式数据(公开接口;enabled=true 时返回选中引用列表,否则 {enabled:false})
 */
export function getAuditData() {
  return http.Get<IResponse<IAuditDataResult>>('/apis/api.unihalo.ialley.cn/v1alpha1/audit-data', {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 获取首页轮播图列表(公开;按 priority 有序,脱敏不含 content)
 */
export function getBanners() {
  return http.Get<IResponse<IBannerPublicItem[]>>('/apis/api.unihalo.ialley.cn/v1alpha1/banners', {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 获取轮播图详情(公开;含 content 富文本 HTML)
 */
export function getBannerDetail(name: string) {
  return http.Get<IResponse<IBannerPublicDetail>>(`/apis/api.unihalo.ialley.cn/v1alpha1/banners/${name}`, {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 获取 Halo 全局配置信息
 */
export function getHaloGlobalInfo() {
  return http.Get<IResponse<IHaloGlobalConfig>>('/actuator/globalinfo', {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 获取评论组件配置
 */
export function getCommentWidgetConfig() {
  return http.Get<IResponse<ICommentWidgetConfig>>('/apis/api.commentwidget.halo.run/v1alpha1/config', {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 检查更新(uhalo-upgrade 插件对接,插件本体引入后业务侧入口)
 */
export function checkVersion(baseUrl: string) {
  return http.Get<IResponse<IUpdateCheckRes>>('/apis/api.unihalo.ialley.cn/v1alpha1/upgrade/checkVersion', {
    params: { baseUrl },
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 获取二维码信息
 */
export function getQRCodeInfo(key: string) {
  return http.Get<IResponse<IQRCodeInfo>>(`/apis/api.unihalo.ialley.cn/v1alpha1/getQRCodeInfo/${key}`, {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/* ==================== 防刷验证码(uni-halo) ==================== */

/** 防刷验证码(服务端 captcha/generate 返回;受保护写接口 403 时响应体亦附带新验证码) */
export interface IPluginCaptcha {
  id: string
  imageBase64: string
}

/** 受保护写接口携带的验证码 query(未触发时省略,触发后每次提交都需携带,一次性) */
export interface ICaptchaQuery {
  captchaId?: string
  captchaCode?: string
}

/**
 * 获取防刷验证码(公开;适用 POST /mini-program-links/-/submissions 与
 * /love-albums/{name}/unlock;站点关闭验证码或该功能不在生效范围时无需携带)
 */
export function getPluginCaptcha() {
  return http.Get<IResponse<IPluginCaptcha>>('/apis/api.unihalo.ialley.cn/v1alpha1/captcha/generate', {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/** 仅当携带有效验证码时拼接 query 参数 */
export function buildCaptchaQuery(captcha?: ICaptchaQuery | null): ICaptchaQuery | undefined {
  if (!captcha || !captcha.captchaId || !captcha.captchaCode)
    return undefined
  return { captchaId: captcha.captchaId, captchaCode: captcha.captchaCode }
}

/* ==================== 通知公告(uni-halo) ==================== */

/**
 * 公告分页列表(公开,仅已发布;脱敏不含 content,内嵌类型信息)。
 * type:公告分类 metadata.name,传空/不传=全部分类;sort:date_desc 最新在前(默认,置顶优先)
 * / date_asc 最早在前 / type 按类型分组(分类筛选与排序均由服务端完成)。
 */
export function getNotices(params: { page?: number, size?: number, type?: string, sort?: string }) {
  return http.Get<IResponse<INoticeListRes>>('/apis/api.unihalo.ialley.cn/v1alpha1/notices', {
    params,
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 最新一条已发布公告(公开;无数据返回 null,供首页/我的弹窗)
 */
export function getNoticeLatest() {
  return http.Get<IResponse<INoticeListVo | null>>('/apis/api.unihalo.ialley.cn/v1alpha1/notices/latest', {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 公告详情(公开;含 content 富文本 HTML 与内嵌类型信息;不存在/删除中返回 404)
 */
export function getNoticeDetail(name: string) {
  return http.Get<IResponse<INoticeDetail>>(`/apis/api.unihalo.ialley.cn/v1alpha1/notices/${name}`, {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 公告分类列表(公开,按 priority 排序,app 端筛选用)
 */
export function getNoticeTypes() {
  return http.Get<IResponse<INoticeTypeListRes>>('/apis/api.unihalo.ialley.cn/v1alpha1/notice-types', {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/* ==================== 恋爱模块 ==================== */

/**
 * 获取恋爱相册列表（lovePhoto 模块设密码时需携带模块解锁 token）
 */
export function getLoveAlbums(params: ILoveAlbumListReq) {
  const token = getLoveModuleToken('lovePhoto')
  return http.Get<IResponse<ILoveAlbumListRes>>('/apis/api.unihalo.ialley.cn/v1alpha1/love-albums', {
    params: { ...params, ...(token ? { token } : {}) },
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 获取恋爱相册详情（lovePhoto 模块设密码时需携带模块解锁 token）
 */
export function getLoveAlbumByName(name: string, params: ILoveAlbumListReq) {
  const token = getLoveModuleToken('lovePhoto')
  return http.Get<IResponse<ILoveAlbum>>(`/apis/api.unihalo.ialley.cn/v1alpha1/love-albums/${name}`, {
    params: { ...params, ...(token ? { token } : {}) },
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 密码解锁相册（lovePhoto 模块设密码时需携带模块解锁 token）
 */
export function unlockAlbum(name: string, password: string, captcha?: ICaptchaQuery | null) {
  const token = getLoveModuleToken('lovePhoto')
  return http.Post<IResponse<{ token: string, photos?: unknown[] }>>(
    `/apis/api.unihalo.ialley.cn/v1alpha1/love-albums/${name}/unlock`,
    {
      password,
    },
    {
      params: { ...buildCaptchaQuery(captcha), ...(token ? { token } : {}) },
      cacheFor: 0,
      meta: { requestFrom: RequestFrom.Halo },
    },
  )
}

/**
 * 恋爱模块入口解锁（入口密码，签发 30 分钟 token；module：loveDiary(恋爱日记入口)/
 * ourStory/lovePhoto/loveDaily；插件端要求验证码，失败 403 返回新验证码）
 */
export function unlockLoveModule(module: string, password: string, captcha?: ICaptchaQuery | null) {
  return http.Post<IResponse<{ token: string }>>(
    '/apis/api.unihalo.ialley.cn/v1alpha1/love-modules/-/unlock',
    {
      module,
      password,
    },
    {
      params: buildCaptchaQuery(captcha),
      cacheFor: 0,
      meta: { requestFrom: RequestFrom.Halo },
    },
  )
}

/**
 * 获取恋爱清单列表(分页)（loveDaily 模块设密码时需携带模块解锁 token）
 */
export function getLoveDailyItems(params: ILoveDailyItemListReq) {
  const token = getLoveModuleToken('loveDaily')
  return http.Get<IResponse<ILoveDailyItemListRes>>(
    '/apis/api.unihalo.ialley.cn/v1alpha1/love-daily-items',
    {
      params: { ...params, ...(token ? { token } : {}) },

      cacheFor: 0,
      meta: { requestFrom: RequestFrom.Halo },
    },
  )
}

/**
 * 获取恋爱故事列表（ourStory 模块设密码时需携带模块解锁 token）
 */
export function getLoveStories(params: ILoveStoryListReq) {
  const token = getLoveModuleToken('ourStory')
  return http.Get<IResponse<ILoveStoryListRes>>('/apis/api.unihalo.ialley.cn/v1alpha1/love-stories', {
    params: { ...params, ...(token ? { token } : {}) },
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 获取恋爱信息(纪念日 + 恋人信息,公开接口)
 */
export function getLoveInfo() {
  return http.Get<IResponse<ILoveInfo>>('/apis/api.unihalo.ialley.cn/v1alpha1/love-info', {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/* ==================== 小程序链接(uni-halo) ==================== */

/**
 * 获取小程序链接分组列表(grouped=true,仅可见,按分组聚合返回)
 */
export function getMiniProgramLinkGroupedList() {
  return http.Get<IResponse<IMiniProgramLinkGroupedRes>>(
    '/apis/api.unihalo.ialley.cn/v1alpha1/mini-program-links',
    {
      params: { grouped: true },
      cacheFor: 0,
      meta: { requestFrom: RequestFrom.Halo },
    },
  )
}

/**
 * 获取小程序链接分组选项(/types,仅可见链接引用的分组)
 */
export function getMiniProgramLinkTypes() {
  return http.Get<IResponse<IMiniProgramLinkGroupOption[]>>(
    '/apis/api.unihalo.ialley.cn/v1alpha1/mini-program-links/types',
    {
      cacheFor: 0,
      meta: { requestFrom: RequestFrom.Halo },
    },
  )
}

/**
 * 获取小程序链接详情(仅可见,不存在返回 404)
 */
export function getMiniProgramLinkDetail(name: string) {
  return http.Get<IResponse<IMiniProgramLink>>(
    `/apis/api.unihalo.ialley.cn/v1alpha1/mini-program-links/${name}`,
    {
      cacheFor: 0,
      meta: { requestFrom: RequestFrom.Halo },
    },
  )
}

/**
 * 提交小程序链接申请(公开接口,落库为待审核;受 linkConfig.submissionEnabled 开关
 * 与防刷验证码 captchaConfig 控制)
 */
export function submitMiniProgramLinkApplication(data: IMiniProgramLinkSubmissionForm, captcha?: ICaptchaQuery | null) {
  return http.Post<IResponse<unknown>>(
    '/apis/api.unihalo.ialley.cn/v1alpha1/mini-program-links/-/submissions',
    {
      spec: data,
    },
    {
      params: buildCaptchaQuery(captcha),
      cacheFor: 0,
      meta: { requestFrom: RequestFrom.Halo },
    },
  )
}

/* ==================== 受限阅读(tools.muyin.site) ==================== */

/**
 * 受限阅读检查(密码/验证码/登录/付费/评论)
 */
export function requestRestrictReadCheck(restrictType: RestrictReadType, code: string, keyId: string) {
  const data: IRestrictReadCheckReq = {
    code,
    templateType: 'post',
    restrictType,
    keyId,
  }
  return http.Post<IResponse<IRestrictReadCheckRes>>('/apis/tools.muyin.site/v1alpha1/restrict-read/check', data, {
    headers: {
      'Authorization': getToolsAuthorization(),
      'Wechat-Session-Id': getOpenid(),
      'nologin-email': getNologinEmail(),
    },
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 创建验证码(受限阅读)
 */
export function createVerificationCode() {
  return http.Get<IResponse<string>>('/apis/tools.muyin.site/v1alpha1/restrict-read/create', {
    headers: {
      'Authorization': getToolsAuthorization(),
      'Wechat-Session-Id': getOpenid(),
    },
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/* ==================== 友链提交(linkssubmit.muyin.site) ==================== */

/* ==================== 投票(api.vote.kunkunyu.com) ==================== */

/**
 * 投票列表
 */
export function getVoteList(params: IVoteListReq) {
  return http.Get<IResponse<IVoteListRes>>('/apis/api.vote.kunkunyu.com/v1alpha1/votes', {
    params,
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 投票详情
 */
export function getVoteDetail(name: string) {
  return http.Get<IResponse<IVoteDetail>>(`/apis/api.vote.kunkunyu.com/v1alpha1/votes/${name}/detail`, {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 投票用户列表
 */
export function getVoteUserList(name: string) {
  return http.Get<IResponse<unknown[]>>(`/apis/api.vote.kunkunyu.com/v1alpha1/votes/${name}/user-list`, {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 提交投票
 * @param canAnonymously 是否允许匿名;非匿名时带个人 token
 */
export function submitVote(name: string, data: IVoteSubmitReq, canAnonymously = true) {
  const headers: Record<string, string> = {}
  if (!canAnonymously) {
    const token = getPersonalToken()
    if (token)
      headers.Authorization = `Bearer ${token}`
  }
  return http.Post<IResponse<unknown>>(`/apis/api.vote.kunkunyu.com/v1alpha1/votes/${name}/submit`, data, {
    headers,
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/* ==================== 豆瓣(api.douban.moony.la) ==================== */

/**
 * 获取豆瓣条目详情
 */
export function getDoubanDetail(url: string) {
  return http.Get<IResponse<IDoubanDetail>>('/apis/api.douban.moony.la/v1alpha1/doubanmovies/-/getDoubanDetail', {
    params: { url },
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/* ==================== 评论验证码(api.commentwidget.halo.run) ==================== */

/**
 * 获取评论验证码
 */
export function getCommentWidgetCaptcha() {
  return http.Get<IResponse<string>>('/apis/api.commentwidget.halo.run/v1alpha1/captcha/-/generate', {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/* ==================== 数据看板(api.data.statistics.xhhao.com) ==================== */

/** 图表统计数据 */
export interface IDataStatistics {
  tags: { name: string, count: number }[]
  categories: { name: string, total: number }[]
  /** 发布趋势:articleTotal=当日笔记数,momentTotal=当日瞬间数,total=二者之和 */
  articles: { date: string, articleTotal: number, momentTotal: number, name: string, total: number }[]
  comments: { username: string, count: number }[]
  top10Articles: { name: string, views: number }[]
  [key: string]: unknown
}

/**
 * 获取图表统计数据
 * @description 标签、分类、笔记发布趋势、评论活跃用户、热门笔记 top10
 */
export function getChartData() {
  return http.Get<IResponse<IDataStatistics>>('/apis/api.data.statistics.xhhao.com/v1alpha1/chart/data', {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 获取 Github 配置信息
 */
export function getGithubConfig() {
  return http.Get<IResponse<unknown>>('/apis/api.data.statistics.xhhao.com/v1alpha1/github/config', {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 获取 Uptime Kuma 状态页面数据
 */
export function getUptimeKumaStatus() {
  return http.Get<IResponse<unknown>>('/apis/api.data.statistics.xhhao.com/v1alpha1/uptime/status', {
    cacheFor: 0,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/* ==================== 内部辅助 ==================== */

/**
 * 工具类插件授权头(源自应用配置 pluginConfig.toolsPlugin.Authorization)
 */
function getToolsAuthorization(): string {
  return getAppConfigFromStore().integrationConfig?.pluginConfig?.toolsPlugin?.Authorization || ''
}

/**
 * 读取应用配置(Pinia store 为单一数据源;persist 恢复与 fetchConfigs 均覆盖)
 */
function getAppConfigFromStore(): IAppConfig {
  return useAppConfigStore().configs
}

/** 评论验证码 cookie key(供拦截器/页面使用) */
export { COMMENT_WIDGET_CAPTCHA_COOKIES }

export type { ILoveDailyItem, ILoveStory }
