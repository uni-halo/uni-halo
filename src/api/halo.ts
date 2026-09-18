/**
 * Halo 官方 API 接口定义
 */
import { http } from '@/http/alova';
import { RequestFrom } from '@/http/tools/enum';
import type { IResponse } from '@/http/types';
import { getCache } from '@/utils/storage';
import { getNologinEmail, getOpenid } from '@/utils/auth';
import type {
	IBlogStats,
	ICategory,
	ICategoryListReq,
	ICategoryListRes,
	IComment,
	ICommentListReq,
	ICommentListRes,
	ICommentReplyListRes,
	ILink,
	ILinkGroup,
	ILinkListRes,
	IMoment,
	IMomentListReq,
	IMomentListRes,
	IUcPostListRes,
	IPhotoGroupListReq,
	IPhotoGroupListRes,
	IPhotoListReq,
	IPhotoListRes,
	IPost,
	IPostListReq,
	IPostListRes,
	ISearchReq,
	ISearchRes,
	ITagListRes,
	ITrackerCounterReq,
	IUpvoteReq
} from './types/halo';

/** 评论验证码 cookie key */
const COMMENT_WIDGET_CAPTCHA_COOKIES = 'comment-widget-captcha';

/* ==================== 笔记 ==================== */

/**
 * 笔记列表
 */
export function getPostList(params: IPostListReq) {
	return http.Get<IResponse<IPostListRes>>('/apis/api.content.halo.run/v1alpha1/posts', {
		cacheFor: 0,
		meta: { requestFrom: RequestFrom.Halo, query: params }
	});
}

/**
 * UC「我的笔记」列表(服务端强制 owner=当前登录用户)。
 * 个人主页兜底:公开接口 fieldSelector=spec.owner 实测查不到内容,见 PRD 5.4。
 * 固定 publishPhase=PUBLISHED 仅返回已发布,与站点可见性保持一致。
 * 响应为 UC ListedPost 结构(post 包裹 + 顶层 owner/stats),调用方需 mapUcListedPost 映射。
 * RBAC 前提:登录默认角色需聚合 uc.api.content.halo.run posts 的 list 权限。
 */
export function getUcMyPostList(params: { page?: number, size?: number, sort?: string[] }) {
	return http.Get<IResponse<IUcPostListRes>>('/apis/uc.api.content.halo.run/v1alpha1/posts', {
		cacheFor: 0,
		meta: {
			requestFrom: RequestFrom.Halo,
			needAuthToken: true,
			query: { ...params, publishPhase: 'PUBLISHED' }
		}
	});
}

/**
 * 笔记详情(带访客标识头)
 */
export function getPostByName(name: string) {
	return http.Get<IResponse<IPost>>(`/apis/api.content.halo.run/v1alpha1/posts/${name}`, {
		headers: {
			'Wechat-Session-Id': getOpenid(),
			'nologin-email': getNologinEmail()
		},
		cacheFor: 0,
		meta: { requestFrom: RequestFrom.Halo }
	});
}

/**
 * 关键词搜索笔记
 */
export function getPostListByKeyword(params: ISearchReq) {
	return http.Post<IResponse<ISearchRes>>('/apis/api.halo.run/v1alpha1/indices/-/search', params, {
		cacheFor: 0,
		meta: { requestFrom: RequestFrom.Halo }
	});
}

/* ==================== 分类 / 标签 ==================== */

/**
 * 分类列表
 */
export function getCategoryList(params: ICategoryListReq) {
	return http.Get<IResponse<ICategoryListRes>>('/apis/api.content.halo.run/v1alpha1/categories', {
		params,
		cacheFor: 0,
		meta: { requestFrom: RequestFrom.Halo }
	});
}

/**
 * 分类下笔记列表
 */
export function getCategoryPostList(name: string, params: IPostListReq) {
	return http.Get<IResponse<IPostListRes>>(`/apis/api.content.halo.run/v1alpha1/categories/${name}/posts`, {
		cacheFor: 0,
		meta: { requestFrom: RequestFrom.Halo, query: params }
	});
}

/**
 * 标签列表
 */
export function getTagList(params: ICategoryListReq) {
	return http.Get<IResponse<ITagListRes>>('/apis/api.content.halo.run/v1alpha1/tags', {
		params,
		cacheFor: 0,
		meta: { requestFrom: RequestFrom.Halo }
	});
}

/**
 * 标签下笔记列表
 */
export function getPostByTagName(tagName: string, params: IPostListReq) {
	return http.Get<IResponse<IPostListRes>>(`/apis/api.content.halo.run/v1alpha1/tags/${tagName}/posts`, {
		params,
		cacheFor: 0,
		meta: { requestFrom: RequestFrom.Halo }
	});
}

/* ==================== 评论(含验证码 cookie 链路) ==================== */

/**
 * 评论列表
 */
export function getPostCommentList(params: ICommentListReq) {
	return http.Get<IResponse<ICommentListRes>>('/apis/api.halo.run/v1alpha1/comments', {
		params,
		cacheFor: 0,
		meta: { requestFrom: RequestFrom.Halo }
	});
}

/**
 * 评论回复列表
 */
export function getPostCommentReplyList(commentName: string, params: ICommentListReq) {
	return http.Get<IResponse<ICommentReplyListRes>>(`/apis/api.halo.run/v1alpha1/comments/${commentName}/reply`, {
		params,
		cacheFor: 0,
		meta: { requestFrom: RequestFrom.Halo }
	});
}

/** 新增评论(带验证码,captchaCode 转入请求头) */
export interface IAddCommentReq {
	allowNotification: boolean;
	raw: string;
	content?: string;
	owner?: Record<string, unknown>;
	/** 评论目标引用(subjectRef: group/kind/name/version) */
	subjectRef?: {
		group: string;
		kind: string;
		name: string;
		version?: string;
	};
	/** 验证码,提交时转入 X-Captcha-Code 头 */
	captchaCode?: string;
	/** 回复的回复:被引用回复(CommentReply)的 name */
	quoteReply?: string;
}

/**
 * 新增评论(captchaCode 拆出转 X-Captcha-Code 头 + Cookie)
 */
export function addPostComment(data: IAddCommentReq) {
	const { captchaCode, ...rest } = data;
	const headers: Record<string, string> = {
		Accept: 'application/json'
	};
	if (captchaCode) headers['X-Captcha-Code'] = captchaCode;
	const cookie = getCache<string>(COMMENT_WIDGET_CAPTCHA_COOKIES);
	if (cookie) headers.Cookie = cookie;
	return http.Post<IResponse<IComment>>('/apis/api.halo.run/v1alpha1/comments', rest, {
		headers,
		cacheFor: 0,
		meta: { requestFrom: RequestFrom.Halo }
	});
}

/**
 * 新增评论回复(同上,验证码逻辑)
 */
export function addPostCommentReply(commentName: string, data: IAddCommentReq) {
	const { captchaCode, ...rest } = data;
	const headers: Record<string, string> = {
		Accept: 'application/json'
	};
	if (captchaCode) headers['X-Captcha-Code'] = captchaCode;
	const cookie = getCache<string>(COMMENT_WIDGET_CAPTCHA_COOKIES);
	if (cookie) headers.Cookie = cookie;
	return http.Post<IResponse<IComment>>(`/apis/api.halo.run/v1alpha1/comments/${commentName}/reply`, rest, {
		headers,
		cacheFor: 0,
		meta: { requestFrom: RequestFrom.Halo }
	});
}

/* ==================== 瞬间 ==================== */

/**
 * 瞬间列表
 */
export function getMomentList(params: IMomentListReq) {
	return http.Get<IResponse<IMomentListRes>>('/apis/api.moment.halo.run/v1alpha1/moments', {
		params,
		cacheFor: 0,
		meta: { requestFrom: RequestFrom.Halo }
	});
}

/**
 * 瞬间详情
 */
export function getMomentByName(name: string) {
	return http.Get<IResponse<IMoment>>(`/apis/api.moment.halo.run/v1alpha1/moments/${name}`, {
		cacheFor: 0,
		meta: { requestFrom: RequestFrom.Halo }
	});
}

/* ==================== 图库 ==================== */

/**
 * 相册分组列表
 */
export function getPhotoGroupList(params: IPhotoGroupListReq) {
	return http.Get<IResponse<IPhotoGroupListRes>>('/apis/api.photo.halo.run/v1alpha1/photogroups', {
		params,
		cacheFor: 0,
		meta: { requestFrom: RequestFrom.Halo }
	});
}

/**
 * 照片列表(按相册)
 */
export function getPhotoListByGroupName(params: IPhotoListReq) {
	return http.Get<IResponse<IPhotoListRes>>('/apis/api.photo.halo.run/v1alpha1/photos', {
		params,
		cacheFor: 0,
		meta: { requestFrom: RequestFrom.Halo }
	});
}

/* ==================== 友链 ==================== */

/**
 * 友链分组列表
 */
export function getFriendLinkGroupList(params: ICategoryListReq) {
	return http.Get<IResponse<Array<ILinkGroup>>>('/apis/api.link.halo.run/v1alpha1/linkgroups', {
		params,
		cacheFor: 0,
		meta: { requestFrom: RequestFrom.Halo }
	});
}

/**
 * 友链列表
 */
export function getFriendLinkList(params: ICategoryListReq) {
	return http.Get<IResponse<ILinkListRes>>('/apis/api.link.halo.run/v1alpha1/links', {
		params,
		cacheFor: 0,
		meta: { requestFrom: RequestFrom.Halo }
	});
}

/* ==================== 统计 / 埋点 / 插件 ==================== */

/**
 * 博客统计信息
 */
export function getBlogStatistics() {
	return http.Get<IResponse<IBlogStats>>('/apis/api.halo.run/v1alpha1/stats/-', {
		cacheFor: 0,
		meta: { requestFrom: RequestFrom.Halo }
	});
}

/**
 * 提交点赞
 */
export function submitUpvote(data: IUpvoteReq) {
	return http.Post<IResponse<unknown>>('/apis/api.halo.run/v1alpha1/trackers/upvote', data, {
		cacheFor: 0,
		meta: { requestFrom: RequestFrom.Halo }
	});
}

/**
 * 提交计数埋点
 */
export function postTrackersCounter(data: ITrackerCounterReq) {
	return http.Post<IResponse<unknown>>('/apis/api.halo.run/v1alpha1/trackers/counter', data, {
		cacheFor: 0,
		meta: { requestFrom: RequestFrom.Halo }
	});
}

/**
 * 检查插件是否可用
 */
export function checkPluginAvailable(name: string) {
	return http.Get<IResponse<boolean>>(`/apis/api.plugin.halo.run/v1alpha1/plugins/${name}/available`, {
		cacheFor: 0,
		meta: { requestFrom: RequestFrom.Halo }
	});
}

/** 分类资源(供加密分类判断等场景) */
export type { ICategory, ILink, IMoment, IPost };
