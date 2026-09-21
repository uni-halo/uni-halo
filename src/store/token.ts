import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { loginByPassword as _loginByPassword, loginByWechat as _loginByWechat, logout as _logoutApi, getWxCode, refreshToken as _refreshToken, registerByPassword as _registerByPassword, registerByWechat as _registerByWechat } from '@/api/auth';
import { isDoubleTokenRes, isSingleTokenRes } from '@/api/types/login';
import { useUserStore } from './user';
import { getCache } from '@/utils/storage';
import type { ILoginForm, IRegisterForm } from '@/api/auth';
import type { IAuthLoginRes, ISingleTokenRes } from '@/api/types/login';
import type { ILoginResult } from '@/api/types/uni-halo';
import type { UniHaloError } from '@/http/tools/exception'
/** 个人令牌存储 key */
const APP_TOKENS_KEY = 'UH_APP_TOKENS';

/**
 * 获取个人令牌
 * 用于需要个人 token 的接口(如非匿名投票 submitVote)
 * @returns 个人令牌,未配置时为空字符串
 */
export function getPersonalToken(): string {
	return getCache<{ personalToken?: string }>(APP_TOKENS_KEY)?.personalToken || '';
}

/**
 * 是否是双token模式
 */
export const isDoubleTokenMode = import.meta.env.VITE_AUTH_MODE === 'double';
// 初始化状态
const tokenInfoState = isDoubleTokenMode
	? {
			accessToken: '',
			accessExpiresIn: 0,
			refreshToken: '',
			refreshExpiresIn: 0
	  }
	: {
			token: '',
			expiresIn: 0
	  };

export const useTokenStore = defineStore(
	'token',
	() => {
		// 定义用户信息
		const tokenInfo = ref<IAuthLoginRes>({ ...tokenInfoState });

		// 添加一个时间戳 ref 作为响应式依赖
		const nowTime = ref(Date.now());
		/**
		 * 更新响应式数据:now
		 * 确保isTokenExpired/isRefreshTokenExpired重新计算,而不是用错误过期缓存值
		 * 可useTokenStore内部适时调用;也可链式调用:tokenStore.updateNowTime().hasLogin
		 * @returns 最新的tokenStore实例
		 */
		const updateNowTime = () => {
			nowTime.value = Date.now();
			return useTokenStore();
		};

		// 设置用户信息
		const setTokenInfo = (val: IAuthLoginRes) => {
			updateNowTime();
			tokenInfo.value = val;

			// 计算并存储过期时间
			const now = Date.now();
			if (isSingleTokenRes(val)) {
				// 单token模式
				const expireTime = now + val.expiresIn * 1000;
				uni.setStorageSync('accessTokenExpireTime', expireTime);
			} else if (isDoubleTokenRes(val)) {
				// 双token模式
				const accessExpireTime = now + val.accessExpiresIn * 1000;
				const refreshExpireTime = now + val.refreshExpiresIn * 1000;
				uni.setStorageSync('accessTokenExpireTime', accessExpireTime);
				uni.setStorageSync('refreshTokenExpireTime', refreshExpireTime);
			}
		};

		/**
		 * 判断token是否过期
		 */
		const isTokenExpired = computed(() => {
			if (!tokenInfo.value) {
				return true;
			}

			const now = nowTime.value;
			const expireTime = uni.getStorageSync('accessTokenExpireTime');

			if (!expireTime) {
				return true;
			}
			return now >= expireTime;
		});

		/**
		 * 判断refreshToken是否过期
		 */
		const isRefreshTokenExpired = computed(() => {
			if (!isDoubleTokenMode) {
				return true;
			}

			const now = nowTime.value;
			const refreshExpireTime = uni.getStorageSync('refreshTokenExpireTime');

			if (!refreshExpireTime) {
				return true;
			}
			return now >= refreshExpireTime;
		});

		/**
		 * 登录成功后处理逻辑
		 * @param tokenInfo 登录返回的token信息
		 * @param result 登录接口完整结果(已携带用户信息与权限时直接写入,不再调 profile)
		 */
		async function _postLogin(tokenInfo: IAuthLoginRes, result?: ILoginResult) {
			setTokenInfo(tokenInfo);
			const userStore = useUserStore();
			if (result?.user) {
				// 微信登录/密码登录接口均一并返回用户信息,无需再请求 profile
				userStore.setUserInfoFromLoginResult(result);
			}
			else {
				// 兜底:登录结果未携带用户信息时走独立接口
				await userStore.fetchUserInfo();
			}
		}

		/**
		 * 插件端 LoginResult → 单token结构
		 * expiresAt 为 ISO 时间,换算为剩余有效期(秒);缺失/非法按 0(立即过期)处理
		 */
		function toSingleToken(result: ILoginResult): ISingleTokenRes {
			const expiresAtMs = result.expiresAt ? Date.parse(result.expiresAt) : NaN;
			const expiresIn = Number.isFinite(expiresAtMs)
				? Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000))
				: 0;
			return { token: result.token || '', expiresIn };
		}

		/**
		 * 用户登录(账号密码,对接插件端 POST /auth/login)
		 * 登录接口直接返回 token + 用户信息 + 权限,无需独立获取用户信息接口
		 * @param loginForm 登录参数
		 * @returns 登录结果(插件端 LoginResult)
		 */
		const login = async (loginForm: ILoginForm) => {
			try {
				const res = await _loginByPassword(loginForm.username, loginForm.password);
				const result = res.data as ILoginResult;
				await _postLogin(toSingleToken(result), result);
				uni.showToast({
					title: '登录成功',
					icon: 'none'
				});
				return result;
			} catch (error) {
				const errorData = error as UniHaloError;
				console.error('登录失败:', error);
				let errMsg = errorData?.data?.message || '登录失败，请重试';
				uni.showToast({
					title: errMsg,
					icon: 'none'
				});
				throw error;
			} finally {
				updateNowTime();
			}
		};

		/**
		 * 微信登录(对接插件端 POST /auth/login/wechat,仅微信小程序可用)
		 * 已绑定则登录,未绑定则自动注册并登录;返回结构与账号密码登录一致
		 * @returns 登录结果(插件端 LoginResult)
		 */
		const wxLogin = async () => {
			try {
				// 获取微信小程序登录的code
				const loginRes = await getWxCode();
				const code = loginRes.code;
				const res = await _loginByWechat(code);
				const result = res.data as ILoginResult;
				await _postLogin(toSingleToken(result), result);
				uni.showToast({
					title: '登录成功',
					icon: 'none'
				});
				return result;
			} catch (error:any) {
				const errorData = error as UniHaloError;
				console.error('微信登录失败:', error);
				let errMsg = errorData?.data?.message || '登录失败，请重试';
				uni.showToast({
					title: errMsg,
					icon: 'none'
				});
				throw error;
			} finally {
				updateNowTime();
			}
		};

		/**
		 * 注册并登录(账号密码,对接插件端 POST /auth/register)
		 * 插件端中转 Halo 注册,成功直接返回 token + 用户信息,实现注册即登录
		 * @param form 注册表单
		 * @returns 注册结果(插件端 LoginResult)
		 */
		const register = async (form: IRegisterForm) => {
			try {
				const res = await _registerByPassword(form);
				const result = res.data as ILoginResult;
				await _postLogin(toSingleToken(result), result);
				uni.showToast({
					title: '注册成功',
					icon: 'none'
				});
				return result;
			} catch (error) {
				const errorData = error as UniHaloError;
				console.error('注册失败:', error);
				let errMsg = errorData?.data?.message || '注册失败，请重试';
				uni.showToast({
					title: errMsg,
					icon: 'none'
				});
				throw error;
			} finally {
				updateNowTime();
			}
		};

		/**
		 * 微信注册并登录(对接插件端 POST /auth/register/wechat,仅微信小程序可用)
		 * 与微信登录同源,用户不存在时服务端自动创建
		 * @returns 注册结果(插件端 LoginResult)
		 */
		const wxRegister = async () => {
			try {
				// 获取微信小程序登录的code
				const loginRes = await getWxCode();
				const code = loginRes.code;
				const res = await _registerByWechat(code);
				const result = res.data as ILoginResult;
				await _postLogin(toSingleToken(result), result);
				uni.showToast({
					title: '注册成功',
					icon: 'none'
				});
				return result;
			} catch (error) {
				const errorData = error as UniHaloError;
				console.error('微信注册失败:', error);
				let errMsg = errorData?.data?.message || '注册失败，请重试';
				uni.showToast({
					title: errMsg,
					icon: 'none'
				});
				throw error;
			} finally {
				updateNowTime();
			}
		};

		/**
		 * 退出登录 并 删除用户信息
		 * 服务端吊销当前 PAT(auth/logout),无论成功失败都清除本地登录状态
		 */
		const logout = async () => {
			try {
				await _logoutApi();
			} catch (error) {
				console.error('退出登录失败:', error);
			} finally {
				updateNowTime();

				// 无论成功失败，都需要清除本地token信息
				// 清除存储的过期时间
				uni.removeStorageSync('accessTokenExpireTime');
				uni.removeStorageSync('refreshTokenExpireTime');
				console.log('退出登录-清除用户信息');
				tokenInfo.value = { ...tokenInfoState };
				uni.removeStorageSync('token');
				const userStore = useUserStore();
				userStore.clearUserInfo();
			}
		};

		/**
		 * 刷新token（双 token 模式预留）
		 * 当前插件端为单 token 模式（Halo PAT），双 token 刷新接口待插件端提供后对接
		 * @returns 刷新结果
		 */
		const refreshToken = async () => {
			if (!isDoubleTokenMode) {
				console.error('单token模式不支持刷新token');
				throw new Error('单token模式不支持刷新token');
			}

			try {
				// 安全检查，确保refreshToken存在
				if (!isDoubleTokenRes(tokenInfo.value) || !tokenInfo.value.refreshToken) {
					throw new Error('无效的refreshToken');
				}

				const refreshToken = tokenInfo.value.refreshToken;
				const res = await _refreshToken(refreshToken);
				setTokenInfo(res.data as IAuthLoginRes);
				return res;
			} catch (error) {
				console.error('刷新token失败:', error);
				throw error;
			} finally {
				updateNowTime();
			}
		};

		/**
		 * 获取有效的token
		 * 注意：在computed中不直接调用异步函数，只做状态判断
		 * 实际的刷新操作应由调用方处理
		 * 建议这样使用 tokenStore.updateNowTime().validToken
		 */
		const getValidToken = computed(() => {
			// token已过期，返回空
			if (isTokenExpired.value) {
				return '';
			}

			if (!isDoubleTokenMode) {
				return isSingleTokenRes(tokenInfo.value) ? tokenInfo.value.token : '';
			} else {
				return isDoubleTokenRes(tokenInfo.value) ? tokenInfo.value.accessToken : '';
			}
		});

		/**
		 * 检查是否有登录信息（不考虑token是否过期）
		 */
		const hasLoginInfo = computed(() => {
			if (!tokenInfo.value) {
				return false;
			}
			if (isDoubleTokenMode) {
				return isDoubleTokenRes(tokenInfo.value) && !!tokenInfo.value.accessToken;
			} else {
				return isSingleTokenRes(tokenInfo.value) && !!tokenInfo.value.token;
			}
		});

		/**
		 * 检查是否已登录且token有效
		 * 建议这样使用tokenStore.updateNowTime().hasLogin
		 */
		const hasValidLogin = computed(() => {
			console.log('hasValidLogin', hasLoginInfo.value, !isTokenExpired.value);
			return hasLoginInfo.value && !isTokenExpired.value;
		});

		/**
		 * 尝试获取有效的token，如果过期且可刷新，则刷新token
		 * @returns 有效的token或空字符串
		 */
		const tryGetValidToken = async (): Promise<string> => {
			updateNowTime();
			if (!getValidToken.value && isDoubleTokenMode && !isRefreshTokenExpired.value) {
				try {
					await refreshToken();
					return getValidToken.value;
				} catch (error) {
					console.error('尝试刷新token失败:', error);
					return '';
				}
			}
			return getValidToken.value;
		};

		return {
			// 核心API方法
			login,
			wxLogin,
			register,
			wxRegister,
			logout,

			// 认证状态判断（最常用的）
			hasLogin: hasValidLogin,

			// 内部系统使用的方法
			refreshToken,
			tryGetValidToken,
			validToken: getValidToken,

			// 调试或特殊场景可能需要直接访问的信息
			tokenInfo,
			setTokenInfo,
			updateNowTime
		};
	},
	{
		// 添加持久化配置，确保刷新页面后token信息不丢失
		persist: true
	}
);
