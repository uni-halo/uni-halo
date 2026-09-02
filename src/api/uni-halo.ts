/**
 * uni-halo 自定义 API 接口定义
 * 覆盖 plugin-uni-halo(/apis/api.unihalo.ialley.cn)与三方插件接口:
 * 受限阅读(tools.muyin.site)、友链提交(linkssubmit.muyin.site)、投票(api.vote.kunkunyu.com)、
 * 豆瓣(api.douban.moony.la)、评论组件(api.commentwidget.halo.run)
 * 风格参考 src/api/foo-alova.ts:http.Get<IResponse<T>>(url, { params, header, meta })
 * 源自旧项目 api/v2/all.config.js、all.api.js(三方部分)、love.*.js,按需命名导出
 */
import { http } from '@/http/alova'
import { RequestFrom } from '@/http/tools/enum'
import type { IResponse } from '@/http/types'
import { getCache } from '@/utils/storage'
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
  ILoveConfig,
  ILoveDailyItem,
  ILoveDailyItemListReq,
  ILoveDailyItemListRes,
  ILoveStory,
  ILoveStoryListReq,
  ILoveStoryListRes,
  IMiniProgramLink,
  IMiniProgramLinkGroupedRes,
  IMiniProgramLinkGroupOption,
  IMiniProgramLinkSubmissionForm,
  IQRCodeInfo,
  IRestrictReadCheckReq,
  IRestrictReadCheckRes,
  ISubmitLinkForm,
  IUpdateCheckRes,
  IVote,
  IVoteListReq,
  IVoteListRes,
  IVoteSubmitReq,
  RestrictReadType,
} from './types/uni-halo'

/** 评论验证码 cookie key */
const COMMENT_WIDGET_CAPTCHA_COOKIES = 'comment-widget-captcha'

/* ==================== plugin-uni-halo 配置 ==================== */

/**
 * 获取应用配置
 */
export function getAppConfigs() {
  return http.Get<IResponse<IAppConfig>>('/apis/api.unihalo.ialley.cn/v1alpha1/plugins/plugin-uni-halo/getConfigs', {
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 获取审核模式数据(公开接口;auditModeEnabled=true 时返回选中引用列表,否则 {enabled:false})
 */
export function getAuditData() {
  return http.Get<IResponse<IAuditDataResult>>('/apis/api.unihalo.ialley.cn/v1alpha1/plugins/plugin-uni-halo/audit-data', {
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 获取首页轮播图列表(公开;按 priority 有序,脱敏不含 content)
 */
export function getBanners() {
  return http.Get<IResponse<IBannerPublicItem[]>>('/apis/api.unihalo.ialley.cn/v1alpha1/plugins/plugin-uni-halo/banners', {
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 获取轮播图详情(公开;含 content 富文本 HTML)
 */
export function getBannerDetail(name: string) {
  return http.Get<IResponse<IBannerPublicDetail>>(`/apis/api.unihalo.ialley.cn/v1alpha1/plugins/plugin-uni-halo/banners/${name}`, {
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 获取 Halo 全局配置信息
 */
export function getHaloGlobalInfo() {
  return http.Get<IResponse<IHaloGlobalConfig>>('/actuator/globalinfo', {
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 获取评论组件配置
 */
export function getCommentWidgetConfig() {
  return http.Get<IResponse<ICommentWidgetConfig>>('/apis/api.commentwidget.halo.run/v1alpha1/config', {
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 检查更新(uhalo-upgrade 插件对接,插件本体引入后业务侧入口)
 */
export function checkVersion(baseUrl: string) {
  return http.Get<IResponse<IUpdateCheckRes>>('/apis/api.unihalo.ialley.cn/v1alpha1/plugins/plugin-uni-halo/checkVersion', {
    params: { baseUrl },
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 获取二维码信息
 */
export function getQRCodeInfo(key: string) {
  return http.Get<IResponse<IQRCodeInfo>>(`/apis/api.unihalo.ialley.cn/v1alpha1/plugins/plugin-uni-halo/getQRCodeInfo/${key}`, {
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 获取文章二维码图片
 */
export function getQRCodeImg(postId: string) {
  return http.Get<IResponse<unknown>>(`/apis/api.unihalo.ialley.cn/v1alpha1/plugins/plugin-uni-halo/getQRCodeImg/${postId}`, {
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/* ==================== 恋爱模块 ==================== */

/**
 * 获取恋爱配置(纪念日 + 恋人信息)
 */
export function getLoveConfig() {
  return http.Get<IResponse<ILoveConfig>>('/apis/api.unihalo.ialley.cn/v1alpha1/plugins/plugin-uni-halo/love-config', {
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 获取恋爱相册列表
 */
export function getLoveAlbums(params: ILoveAlbumListReq) {
  return http.Get<IResponse<ILoveAlbumListRes>>('/apis/api.unihalo.ialley.cn/v1alpha1/plugins/plugin-uni-halo/love-albums', {
    params,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 获取恋爱相册详情
 */
export function getLoveAlbumByName(name: string, params: ILoveAlbumListReq) {
  return http.Get<IResponse<ILoveAlbum>>(`/apis/api.unihalo.ialley.cn/v1alpha1/plugins/plugin-uni-halo/love-albums/${name}`, {
    params,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 密码解锁相册
 */
export function unlockAlbum(name: string, password: string) {
  return http.Post<IResponse<{ token: string, photos?: unknown[] }>>(
    `/apis/api.unihalo.ialley.cn/v1alpha1/plugins/plugin-uni-halo/love-albums/${name}/unlock`,
    {
      password,
    },
    {
      meta: { requestFrom: RequestFrom.Halo },
    },
  )
}

/**
 * 获取恋爱清单列表(分页)
 */
export function getLoveDailyItems(params: ILoveDailyItemListReq) {
  return http.Get<IResponse<ILoveDailyItemListRes>>(
    '/apis/api.unihalo.ialley.cn/v1alpha1/plugins/plugin-uni-halo/love-daily-items',
    {
      params,
      meta: { requestFrom: RequestFrom.Halo },
    },
  )
}

/**
 * 获取恋爱故事列表
 */
export function getLoveStories(params: ILoveStoryListReq) {
  return http.Get<IResponse<ILoveStoryListRes>>('/apis/api.unihalo.ialley.cn/v1alpha1/plugins/plugin-uni-halo/love-stories', {
    params,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/* ==================== 小程序链接(plugin-uni-halo) ==================== */

/**
 * 获取小程序链接分组列表(grouped=true,仅可见,按分组聚合返回)
 */
export function getMiniProgramLinkGroupedList() {
  return http.Get<IResponse<IMiniProgramLinkGroupedRes>>(
    '/apis/api.unihalo.ialley.cn/v1alpha1/plugins/plugin-uni-halo/mini-program-links',
    {
      params: { grouped: true },
      meta: { requestFrom: RequestFrom.Halo },
    },
  )
}

/**
 * 获取小程序链接分组选项(/types,仅可见链接引用的分组)
 */
export function getMiniProgramLinkTypes() {
  return http.Get<IResponse<IMiniProgramLinkGroupOption[]>>(
    '/apis/api.unihalo.ialley.cn/v1alpha1/plugins/plugin-uni-halo/mini-program-links/types',
    {
      meta: { requestFrom: RequestFrom.Halo },
    },
  )
}

/**
 * 获取小程序链接详情(仅可见,不存在返回 404)
 */
export function getMiniProgramLinkDetail(name: string) {
  return http.Get<IResponse<IMiniProgramLink>>(
    `/apis/api.unihalo.ialley.cn/v1alpha1/plugins/plugin-uni-halo/mini-program-links/${name}`,
    {
      meta: { requestFrom: RequestFrom.Halo },
    },
  )
}

/**
 * 提交小程序链接申请(公开接口,落库为待审核;受 linkConfig.submissionEnabled 开关控制)
 */
export function submitMiniProgramLinkApplication(data: IMiniProgramLinkSubmissionForm) {
  return http.Post<IResponse<unknown>>(
    '/apis/api.unihalo.ialley.cn/v1alpha1/plugins/plugin-uni-halo/mini-program-links/submissions',
    {
      spec: data,
    },
    {
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
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/* ==================== 友链提交(linkssubmit.muyin.site) ==================== */

/**
 * 提交友链
 */
export function submitLink(form: ISubmitLinkForm) {
  return http.Post<IResponse<{ msg?: string, message?: string }>>('/apis/linkssubmit.muyin.site/v1alpha1/submit', form, {
    headers: {
      'Authorization': getLinksSubmitAuthorization(),
      'Wechat-Session-Id': getOpenid(),
    },
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/* ==================== 投票(api.vote.kunkunyu.com) ==================== */

/**
 * 投票列表
 */
export function getVoteList(params: IVoteListReq) {
  return http.Get<IResponse<IVoteListRes>>('/apis/api.vote.kunkunyu.com/v1alpha1/votes', {
    params,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 投票详情
 */
export function getVoteDetail(name: string) {
  return http.Get<IResponse<IVote>>(`/apis/api.vote.kunkunyu.com/v1alpha1/votes/${name}/detail`, {
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 投票用户列表
 */
export function getVoteUserList(name: string) {
  return http.Get<IResponse<unknown[]>>(`/apis/api.vote.kunkunyu.com/v1alpha1/votes/${name}/user-list`, {
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
  articles: { date: string, count: number }[]
  comments: { username: string, count: number }[]
  top10Articles: { name: string, views: number }[]
  [key: string]: unknown
}

/**
 * 获取图表统计数据
 * @description 标签、分类、文章发布趋势、评论活跃用户、热门文章 top10
 */
export function getChartData() {
  return http.Get<IResponse<IDataStatistics>>('/apis/api.data.statistics.xhhao.com/v1alpha1/chart/data', {
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 获取 Github 配置信息
 */
export function getGithubConfig() {
  return http.Get<IResponse<unknown>>('/apis/api.data.statistics.xhhao.com/v1alpha1/github/config', {
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/**
 * 获取 Uptime Kuma 状态页面数据
 */
export function getUptimeKumaStatus() {
  return http.Get<IResponse<unknown>>('/apis/api.data.statistics.xhhao.com/v1alpha1/uptime/status', {
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/* ==================== 内部辅助 ==================== */

/**
 * 工具类插件授权头(源自应用配置 pluginConfig.toolsPlugin.Authorization)
 */
function getToolsAuthorization(): string {
  return getAppConfigFromStore().pluginConfig?.toolsPlugin?.Authorization || ''
}

/**
 * 友链提交插件授权头(源自应用配置 pluginConfig.linksSubmitPlugin.Authorization)
 */
function getLinksSubmitAuthorization(): string {
  return getAppConfigFromStore().pluginConfig?.linksSubmitPlugin?.Authorization || ''
}

/**
 * 读取应用配置(store 未就绪时兜底为空)
 * 注:待 src/store/appConfig.ts 建立后改为 useAppConfigStore 读取
 */
function getAppConfigFromStore(): IAppConfig {
  // TODO: 迁移 store 后改为从 Pinia 读取,避免每次从 storage 解析
  const cached = getCache<IAppConfig>('APP_GLOBAL_CONFIGS')
  return cached || {}
}

/** 评论验证码 cookie key(供拦截器/页面使用) */
export { COMMENT_WIDGET_CAPTCHA_COOKIES }

export type { ILoveDailyItem, ILoveStory }
