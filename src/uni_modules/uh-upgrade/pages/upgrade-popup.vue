<template>
	<view class="overlay" v-if="shown">
		<view class="dialog-wrap">
			<view class="dialog">
				<!-- 顶部品牌区：Logo 内嵌 + 柔光晕 -->
				<view class="hero">
					<view class="bubble b1"></view>
					<view class="bubble b2"></view>
					<view class="halo"></view>
					<view class="logo-wrap">
						<image class="logo-image" :src="logoUrl" mode="aspectFill"></image>
					</view>
				</view>

				<!-- 内容区 -->
				<view class="body">
					<view class="title-row">
						<text class="title">{{ subTitle }}</text>
						<text class="ver">{{ version }}</text>
					</view>
					<view class="meta">
						<!-- 包体积仅在实际下载开始后才有值，为 0 时只显示下载建议 -->
						<text v-if="packageFileSize > 0">安装包 {{ packageFileSize }} MB</text>
						<view v-if="packageFileSize > 0" class="dot"></view>
						<text>{{ metaText }}</text>
					</view>

					<!-- 更新日志卡片（rich-text 渲染后台文本） -->
					<view class="notes">
						<view class="notes-head">
							<text>{{ title }}</text>
						</view>
						<scroll-view class="notes-scroll" scroll-y="true" :show-scrollbar="false">
							<rich-text class="box-des" :nodes="contents" />
						</scroll-view>
					</view>

					<!-- 底部操作区：按钮与进度条同位切换，进度条在上 -->
					<view class="footer">
						<template v-if="isApplicationStore">
							<button class="btn-primary" hover-class="btn-primary-hover" @click="jumpToApplicationStore">
								<text class="btn-label">{{ downLoadBtnTextiOS }}</text>
							</button>
						</template>
						<template v-else>
							<template v-if="!downloadSuccess">
								<view class="progress-box flex-column" v-if="downloading">
									<progress class="progress" :percent="downLoadPercent" activeColor="#4CB813" show-info stroke-width="10" />
									<view class="progress-meta">
										<text>{{ downLoadingText }}</text>
										<text>({{ downloadedSize }}/{{ packageFileSize }}M)</text>
									</view>
								</view>
							<button v-else class="btn-primary" hover-class="btn-primary-hover" @click="updateApp">
								<text class="btn-label">{{ btnText }}</text>
							</button>
							</template>
							<button
								v-else-if="downloadSuccess && !installed"
								class="btn-primary"
								:class="{ 'btn-done': installing }"
								hover-class="btn-primary-hover"
								:loading="installing"
								:disabled="installing"
								@click="installPackage"
							>
								<view class="btn-label">
									<view v-if="installing" class="ico-done-check"></view>
									<text>{{ installing ? '正在安装……' : '下载完成，立即安装' }}</text>
								</view>
							</button>
							<button
								v-else-if="installed && !isWGT"
								class="btn-primary"
								hover-class="btn-primary-hover"
								:loading="installing"
								:disabled="installing"
								@click="installPackage"
							>
								<text class="btn-label">安装未完成，点击安装</text>
							</button>

							<button v-else-if="installed && isWGT" class="btn-primary btn-done" hover-class="btn-primary-hover" @click="restart">
								<text class="btn-label">安装完毕，点击重启</text>
							</button>
						</template>
					</view>
					<view v-if="!is_mandatory" class="btn-ghost" @click="closeUpdate">暂不更新</view>
				</view>
			</view>

			<!-- 底部悬浮关闭（沿用原关闭图片） -->
			<image v-if="!is_mandatory" class="close-fab" src="/uni_modules/uh-upgrade/static/app/app_update_close.png" mode="aspectFit" @click.stop="closeUpdate"></image>
		</view>
	</view>
</template>

<script>
// #ifdef APP-PLUS
import { createNotificationProgress, cancelNotificationProgress, finishNotificationProgress } from '@/uni_modules/uts-progressNotification';
// #endif
import { compare, platform_iOS, platform_Android, platform_Harmony, createUpgradeDownloadTask } from '../utils'
const localFilePathKey = 'UNI_ADMIN_UPGRADE_CENTER_LOCAL_FILE_PATH';
/** 应用 logo 兜底图（uni-halo-static 仓库 logo/logo-200.png 的 CDN 地址） */
const FALLBACK_LOGO = 'https://gcore.jsdelivr.net/gh/uni-halo/uni-halo-static@main/logo/logo-200.png';
/** Halo 插件公开的 getConfigs 接口路径（由 base_url 拼接） */
const GET_CONFIGS_API = '/apis/api.unihalo.ialley.cn/v1alpha1/getConfigs';

let downloadTask = null;
let openSchemePromise;

export default {
    emits: ['close', 'show'],
	data() {
		return {
			// 从之前下载安装
			installForBeforeFilePath: '',

			// 安装
			installed: false,
			installing: false,

			// 下载
			downloadSuccess: false,
			downloading: false,

			downLoadPercent: 0,
			downloadedSize: 0,
			packageFileSize: 0,

			tempFilePath: '', // 要安装的本地包地址

			// 默认安装包信息
			title: '更新日志',
			contents: '',
			version: '',
			is_mandatory: false,
			url: '',
			platform: [],
			store_list: null,
			download_type: 'direct',
			external_url: '',
			external_name: '',

			// 可自定义属性
			subTitle: '发现新版本',
			downLoadBtnTextiOS: '立即跳转更新',
			downLoadBtnText: '立即下载更新',
			downLoadingText: '安装包下载中，请稍后',

			// 应用 logo（初始为 uni-halo-static 兜底图,getConfigs 成功后替换为后台配置的应用信息 logo）
			logoUrl: FALLBACK_LOGO,

			// #ifdef APP-PLUS
			shown: true,
			// #endif
			// #ifdef APP-HARMONY
			shown: false,
			// #endif
		};
	},
	onLoad({ local_storage_key, base_url }) {
		if (!local_storage_key) {
			console.error('local_storage_key为空，请检查后重试');
			uni.navigateBack();
			return;
		}

		const localPackageInfo = uni.getStorageSync(local_storage_key);
		if (!localPackageInfo) {
			console.error('安装包信息为空，请检查后重试');
			uni.navigateBack();
			return;
		}

		this.setLocalPackageInfo(localPackageInfo)
		this.fetchAppLogo(base_url)
	},
	onBackPress() {
		// 强制更新不允许返回
		if (this.is_mandatory) return true;
		if (!this.needNotificationProgress) downloadTask && downloadTask.abort();
		uni.$emit('uh-upgrade:closed');
	},
	onHide() {
		openSchemePromise = null;
	},
	onUnload() {
		// 所有退出路径统一放行等待方(含程序化 navigateBack,uni-app 不触发 onBackPress)
		uni.$emit('uh-upgrade:closed');
	},
	computed: {
		isWGT() {
			return this.type === 'wgt';
		},
		isNativeApp() {
			return this.type === 'native_app';
		},
		isiOS() {
			return this.platform.indexOf(platform_iOS) !== -1;
		},
		isAndroid() {
			return this.platform.indexOf(platform_Android) !== -1;
		},
		isHarmony() {
			return this.platform.indexOf(platform_Harmony) !== -1;
		},
		isApplicationStore() {
			return !this.isWGT && this.isNativeApp && (
				this.isiOS ||
				this.isHarmony
			)
			// return this.isiOS || (!this.isiOS && !this.isWGT && this.url.indexOf('.apk') === -1);
		},
		// 商店分发模式:仅 Android 整包生效,iOS/Harmony 恒走 AppStore 分支
		storeEnabled() {
			return this.isAndroid && !this.isWGT
				&& this.download_type === 'store'
				&& (this.store_list || []).some((item) => item.enable);
		},
		// 外部链接模式:跳系统浏览器打开网盘/落地页,仅 Android 整包生效
		externalMode() {
			return this.isAndroid && !this.isWGT
				&& this.download_type === 'external'
				&& !!this.external_url;
		},
		btnText() {
			if (this.externalMode) return this.external_name || '前往下载';
			if (this.storeEnabled) return '前往商店更新';
			return this.downLoadBtnText;
		},
		metaText() {
			if (this.storeEnabled) return '将在应用商店完成更新';
			if (this.externalMode) return '即将前往外部页面下载';
			return '建议 Wi-Fi 环境下载';
		},
		needNotificationProgress() {
			return this.platform.indexOf(platform_iOS) === -1 && !this.is_mandatory && !this.isHarmony;
		}
	},
	methods: {
		// 应用信息 logo:请求 getConfigs 取 featureConfig.profile.appInfo.logo,相对路径按站点地址补全;失败或为空保持兜底图
		fetchAppLogo(baseUrl) {
			if (!baseUrl) return;
			const site = String(baseUrl).replace(/\/+$/, '');
			uni.request({
				url: site + GET_CONFIGS_API,
				method: 'GET',
				success: (res) => {
					const data = res.data || {};
					const profile = data.featureConfig && data.featureConfig.profile ? data.featureConfig.profile : {};
					const appInfo = profile.appInfo || {};
					const logo = appInfo.logo;
					if (!logo) return;
					this.logoUrl = /^https?:\/\//i.test(logo) ? logo : site + logo;
				},
				fail: () => {}
			});
		},
		show(shown, localPackageInfo) {
			// #ifdef APP-HARMONY
			this.$emit('show')
			if (localPackageInfo) {
				this.shown = shown
				this.setLocalPackageInfo(localPackageInfo)
			} else {
				console.error(`安装包信息为空，请检查后重试`);
			}
			// #endif
		},
		setLocalPackageInfo(localPackageInfo) {
			const requiredKey = ['version', 'url', 'type'];
			for (let key in localPackageInfo) {
				if (requiredKey.indexOf(key) !== -1 && !localPackageInfo[key]) {
					console.error(`参数 ${key} 必填，请检查后重试`);
					// #ifdef APP-PLUS
					uni.navigateBack();
					// #endif
					// #ifdef APP-HARMONY
					this.shown = false
					// #endif
					return;
				}
			}

			Object.assign(this, localPackageInfo);
			this.checkLocalStoragePackage();
		},
		checkLocalStoragePackage() {
			// 如果已经有下载好的包，则直接提示安装
			const localFilePathRecord = uni.getStorageSync(localFilePathKey);
			if (localFilePathRecord) {
				const { version, savedFilePath, installed } = localFilePathRecord;

				// 比对版本
				if (!installed && compare(version, this.version) === 0) {
					this.downloadSuccess = true;
					this.installForBeforeFilePath = savedFilePath;
					this.tempFilePath = savedFilePath;
				} else {
					// 如果保存的包版本小 或 已安装过，则直接删除
					this.deleteSavedFile(savedFilePath);
				}
			}
		},
		askAbortDownload() {
			uni.showModal({
				title: '是否取消下载？',
				cancelText: '否',
				confirmText: '是',
				success: (res) => {
					if (res.confirm) {
						downloadTask && downloadTask.abort();
            if (this.needNotificationProgress) {
              cancelNotificationProgress();
            }
						uni.$emit('uh-upgrade:closed');
						uni.navigateBack();
					}
				}
			});
		},
		async closeUpdate() {
			if (this.downloading) {
				if (this.is_mandatory) {
					return uni.showToast({
						title: '下载中，请稍后……',
						icon: 'none',
						duration: 500
					});
				}
				if (!this.needNotificationProgress) {
					this.askAbortDownload();
					return;
				}
			}

			if (!this.needNotificationProgress && this.downloadSuccess && this.tempFilePath) {
				// 包已经下载完毕，稍后安装，将包保存在本地
				await this.saveFile(this.tempFilePath, this.version);
			}

			// #ifdef APP-PLUS
			uni.$emit('uh-upgrade:closed');
			uni.navigateBack();
			// #endif
			// #ifdef APP-HARMONY
			this.shown = false
			this.$emit('close')
			// #endif
		},
		updateApp() {
			// 外部链接模式:跳系统浏览器打开网盘/落地页,不做应用内下载
			if (this.externalMode) {
				// #ifdef APP-PLUS
				plus.runtime.openURL(this.external_url);
				// #endif
				return;
			}
			this.checkStoreScheme()
				.catch(() => {
					if (this.storeEnabled) {
						uni.showToast({ icon: 'none', title: '未找到应用商店，已转为直接下载' });
					}
					this.downloadPackage();
				})
				.finally(() => {
					openSchemePromise = null;
				});
		},
		// 跳转应用商店
		checkStoreScheme() {
			const storeList = (this.store_list || []).filter((item) => item.enable);
			if (storeList && storeList.length) {
				storeList
					.sort((cur, next) => next.priority - cur.priority)
					.map((item) => item.scheme)
					.reduce((promise, cur, curIndex) => {
						openSchemePromise = (promise || (promise = Promise.reject())).catch(() => {
							return new Promise((resolve, reject) => {
								plus.runtime.openURL(cur, (err) => {
									reject(err);
								});
							});
						});
						return openSchemePromise;
					}, openSchemePromise);
				return openSchemePromise;
			}

			return Promise.reject();
		},
		downloadPackage() {
			this.downloading = true;
			uni.$emit('uh-upgrade:busy');
			//下载包
			downloadTask = createUpgradeDownloadTask({
				url: this.url,
				success: (res) => {
					if (res.statusCode == 200) {
						// fix: wgt 文件下载完成后后缀不是 wgt
						if (this.isWGT && res.tempFilePath.split('.').slice(-1)[0] !== 'wgt') {
							const failCallback = (e) => {
								console.log('[FILE RENAME FAIL]：', JSON.stringify(e));
							};
							// #ifndef APP-HARMONY
							plus.io.resolveLocalFileSystemURL(
								res.tempFilePath,
								(entry) => {
									entry.getParent((parent) => {
										const newName = `new_wgt_${Date.now()}.wgt`;
										entry.copyTo(
											parent,
											newName,
											(res) => {
												this.tempFilePath = res.fullPath;
												this.downLoadComplete();
											},
											failCallback
										);
									}, failCallback);
								},
								failCallback
							);
							// #endif
							// #ifdef APP-HARMONY
							failCallback({code: -1, message: 'Download content error, is not wgt.'})
							// #endif
						} else {
							this.tempFilePath = res.tempFilePath;
							this.downLoadComplete();
						}
					} else {
						console.log('下载错误：' + JSON.stringify(res))
            this.downloadFail()
					}
				},
        fail: (err) => {
          console.log('下载错误：' + JSON.stringify(err))
          this.downloadFail()
        }
			});

			downloadTask.onProgressUpdate((res) => {
				this.downLoadPercent = res.progress;
				this.downloadedSize = (res.totalBytesWritten / Math.pow(1024, 2)).toFixed(2);
				this.packageFileSize = (res.totalBytesExpectedToWrite / Math.pow(1024, 2)).toFixed(2);

				if (this.needNotificationProgress && !this.downloadSuccess) {
					createNotificationProgress({
						title: '升级中心正在下载安装包……',
						content: `${this.downLoadPercent}%`,
						progress: this.downLoadPercent,
						onClick: () => {
							this.askAbortDownload();
						}
					});
				}
			});
			if (this.needNotificationProgress) {
				uni.navigateBack();
			}
		},
    downloadFail() {
      const errMsg = '下载失败，请点击重试'

      this.downloadSuccess = false;
      this.downloading = false;

      this.downLoadPercent = 0;
      this.downloadedSize = 0;
      this.packageFileSize = 0;

      this.downLoadBtnText = errMsg

      downloadTask = null;

      if (this.needNotificationProgress) {
        finishNotificationProgress({
          title: '升级包下载失败',
          content: '请重新检查更新',
					onClick: () => {}
        });
      }
    },
		downLoadComplete() {
			this.downloadSuccess = true;
			this.downloading = false;

			this.downLoadPercent = 0;
			this.downloadedSize = 0;
			this.packageFileSize = 0;

			downloadTask = null;

			if (this.needNotificationProgress) {
				finishNotificationProgress({
					title: '安装升级包',
					content: '下载完成',
					onClick: () => {}
				});

				this.installPackage();
				return;
			}

			// 强制更新，直接安装
			if (this.is_mandatory) {
				this.installPackage();
			}
		},
		installPackage() {
			// #ifdef APP-PLUS || APP-HARMONY
			// wgt资源包安装
			if (this.isWGT) {
				this.installing = true;
			}
			plus.runtime.install(
				this.tempFilePath,
				{
					force: false
				},
				async (res) => {
					this.installing = false;
					this.installed = true;

					// wgt包，安装后会提示 安装成功，是否重启
					if (this.isWGT) {
						// 强制更新安装完成重启
						if (this.is_mandatory) {
							// #ifdef APP-PLUS
							uni.showLoading({
								icon: 'none',
								title: '安装成功，正在重启……'
							});
							// #endif

							setTimeout(() => {
								// #ifdef APP-PLUS
								uni.hideLoading();
								// #endif
								this.restart();
							}, 1000);
						}
					} else {
						const localFilePathRecord = uni.getStorageSync(localFilePathKey);
						uni.setStorageSync(localFilePathKey, {
							...localFilePathRecord,
							installed: true
						});
					}
				},
				async (err) => {
					// 如果是安装之前的包，安装失败后删除之前的包
					if (this.installForBeforeFilePath) {
						await this.deleteSavedFile(this.installForBeforeFilePath);
						this.installForBeforeFilePath = '';
					}

					// 安装失败需要重新下载安装包
					this.installing = false;
					this.installed = false;

					uni.showModal({
						title: '更新失败，请重新下载',
						content: err.message,
						showCancel: false
					});
				}
			);

			// 非wgt包，安装跳出覆盖安装，此处直接返回上一页
			if (!this.isWGT && !this.is_mandatory) {
				uni.navigateBack();
			}
			// #endif
		},
		restart() {
			this.installed = false;
			// #ifdef APP-HARMONY
			uni.showModal({
				title: '更新完毕',
				content: '请手动重启',
				showCancel: false,
				success(res) {
					plus.runtime.quit()
				}
			})
			// #endif
			// #ifdef APP-PLUS
			//更新完重启app
			plus.runtime.restart();
			// #endif
		},
		saveFile(tempFilePath, version) {
			return new Promise((resolve, reject) => {
				uni.saveFile({
					tempFilePath,
					success({ savedFilePath }) {
						uni.setStorageSync(localFilePathKey, {
							version,
							savedFilePath
						});
					},
					complete() {
						resolve();
					}
				});
			});
		},
		deleteSavedFile(filePath) {
			uni.removeStorageSync(localFilePathKey);
			return uni.removeSavedFile({
				filePath
			});
		},
		jumpToApplicationStore() {
			plus.runtime.openURL(this.url);
		}
	}
};
</script>

<style>
page {
	background: transparent;
}

/* ===== 遮罩层 ===== */
.overlay {
	position: fixed;
	top: 0;
	right: 0;
	bottom: 0;
	left: 0;
	z-index: 1000;
	display: flex;
	padding: 64rpx 40rpx calc(56rpx + env(safe-area-inset-bottom));
	background: rgba(13, 17, 9, 0.55);
	backdrop-filter: blur(16rpx);
	animation: fadeIn 0.3s ease both;
	overflow: auto;
}

.dialog-wrap {
	margin: auto;
	width: 672rpx;
	max-width: 88vw;
}

/* ===== 弹窗卡片 ===== */
.dialog {
	position: relative;
	background: #fff;
	border-radius: 52rpx;
	box-shadow:
		0 64rpx 160rpx -36rpx rgba(0, 0, 0, 0.15),
		0 12rpx 44rpx rgba(0, 0, 0, 0.18);
	animation: popIn 0.55s cubic-bezier(0.22, 1.35, 0.36, 1) both;
}

/* ===== 顶部品牌区 ===== */
.hero {
	position: relative;
	padding: 60rpx 40rpx 16rpx;
	text-align: center;
	border-radius: 52rpx 52rpx 0 0;
	background: linear-gradient(180deg, #e8f7d4 0%, #f4fce9 62%, #ffffff 100%);
	overflow: hidden;
}

.halo {
	position: absolute;
	left: 50%;
	top: 24rpx;
	transform: translateX(-50%);
	width: 300rpx;
	height: 300rpx;
	border-radius: 50%;
	background: radial-gradient(circle, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0) 68%);
}

.bubble {
	position: absolute;
	border-radius: 50%;
}

.b1 {
	width: 260rpx;
	height: 260rpx;
	left: -104rpx;
	top: -112rpx;
	background: radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0) 70%);
}

.b2 {
	width: 160rpx;
	height: 160rpx;
	right: -48rpx;
	top: -60rpx;
	background: radial-gradient(circle at 40% 40%, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0) 70%);
}

.logo-wrap {
	position: relative;
	z-index: 2;
	width: 132rpx;
	height: 132rpx;
	margin: 0 auto;
	border-radius: 50%;
	overflow: hidden;
	box-sizing: border-box;
	border: 6rpx solid #fff;
	background: linear-gradient(160deg, #95e44a 0%, #4cb813 58%, #33990a 100%);
	box-shadow:
		0 16rpx 36rpx -12rpx rgba(64, 148, 24, 0.35),
		inset 0 4rpx 10rpx rgba(255, 255, 255, 0.45),
		inset 0 -6rpx 12rpx rgba(0, 0, 0, 0.08);
	animation:
		logoIn 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.12s both,
		floatY 3.4s ease-in-out 0.9s infinite;
}

.logo-image {
	width: 100%;
	height: 100%;
}

/* ===== 内容区 ===== */
.body {
	padding: 28rpx 44rpx 44rpx;
	text-align: center;
}

.title-row {
	display: flex;
	align-items: center;
	justify-content: center;
	animation: itemIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.05s both;
}

.title {
	font-size: 36rpx;
	font-weight: 800;
	letter-spacing: 1rpx;
	color: #22301b;
}

.ver {
	margin-left: 16rpx;
	padding: 6rpx 20rpx;
	border-radius: 999rpx;
	font-size: 22rpx;
	font-weight: 700;
	letter-spacing: 1rpx;
	color: #fff;
	background: linear-gradient(135deg, #93e23e, #3fb411);
	box-shadow: 0 8rpx 20rpx rgba(88, 180, 40, 0.35);
}

.meta {
	margin-top: 14rpx;
	font-size: 24rpx;
	color: #98a392;
	display: flex;
	justify-content: center;
	align-items: center;
	animation: itemIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both;
}

.dot {
	margin: 0 12rpx;
	width: 6rpx;
	height: 6rpx;
	border-radius: 50%;
	background: #c4cdbb;
}

/* 更新日志卡片 */
.notes {
	margin-top: 28rpx;
	padding: 24rpx 28rpx 26rpx;
	text-align: left;
	background: #f5faee;
	border: 2rpx solid #eaf3dc;
	border-radius: 32rpx;
}

.notes-head {
	display: flex;
	justify-content: space-between;
	align-items: center;
	font-size: 23rpx;
	color: #8d9a82;
	letter-spacing: 2rpx;
	margin-bottom: 16rpx;
	animation: itemIn 0.5s ease 0.14s both;
}

/* rich-text 滚动区（后台文本可能较长，限高滚动） */
.notes-scroll {
	box-sizing: border-box;
	max-height: 320rpx;
	text-align: left;
}

.box-des {
	font-size: 26rpx;
	line-height: 1.55;
	color: #6e9057;
}

/* ===== 底部操作区（按钮/进度条同位切换，进度条在上） ===== */
.flex-column {
	display: flex;
	flex-direction: column;
	align-items: center;
}

.footer {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
}

/* ===== 原生 button 重置（统一用 <button>，清掉 uni-app 默认边框/内边距/行高） ===== */
button {
	margin: 0;
	padding: 0;
	background: none;
	border: none;
	border-radius: 0;
	line-height: normal;
	font-weight: normal;
}

button::after {
	border: none;
}

.uni-progress-info {
	font-size: 24rpx;
}

.uni-progress-bar {
	border-radius: 24rpx;
	overflow: hidden;
}

/* ===== 主按钮 ===== */
.btn-primary {
	position: relative;
	width: 100%;
	height: 76rpx;
	margin-top: 32rpx;
	border-radius: 999rpx;
	overflow: hidden;
	color: #fff;
	font-size: 28rpx;
	font-weight: 700;
	letter-spacing: 2rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	background: linear-gradient(135deg, #93e23e 0%, #3fb411 55%, #2f9505 100%);
	box-shadow:
		0 6rpx 44rpx -12rpx rgba(76, 183, 26, 0.55),
		inset 0 2rpx 0 rgba(255, 255, 255, 0.35);
	transition:
		transform 0.15s ease,
		filter 0.2s ease;
	animation: itemIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.46s both;
}

/* 按压态（对应 :active） */
.btn-primary-hover {
	transform: scale(0.965);
}

.btn-label {
	position: relative;
	z-index: 2;
	display: flex;
	align-items: center;
	justify-content: center;
}

/* 流光扫过 */
.btn-primary::after {
	content: '';
	position: absolute;
	top: 0;
	left: -70%;
	width: 45%;
	height: 100%;
	background: linear-gradient(105deg, transparent, rgba(255, 255, 255, 0.5), transparent);
	transform: skewX(-22deg);
	animation: shine 3s ease-in-out infinite;
	border: none;
	outline: none;
}

/* 完成态：关闭流光 */
.btn-done::after {
	display: none;
}

.btn-done {
	background: linear-gradient(135deg, #57cb1e, #2f9505);
	letter-spacing: 0;
}

.ico-done-check {
	margin-right: 16rpx;
	width: 32rpx;
	height: 32rpx;
	background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M4.5 12.5l5 5L19.5 7' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E") center / 32rpx 32rpx no-repeat;
}

.btn-ghost {
	margin: 20rpx auto 0;
	padding: 16rpx 28rpx;
	color: #9ba695;
	font-size: 26rpx;
	text-align: center;
	transition: color 0.2s;
	animation: itemIn 0.5s ease 0.52s both;
}

/* ===== 底部悬浮关闭（沿用原关闭图片） ===== */
.close-fab {
	display: block;
	margin: 40rpx auto 0;
	width: 70rpx;
	height: 70rpx;
}

.progress-box {
	width: 100%;
	margin-top: 24rpx;
}

.progress {
	width: 90%;
	height: 40rpx;
}

/* 状态文本行：占满宽度、两端留空分布 */
.progress-meta {
	width: 100%;
	margin-top: 8rpx;
	display: flex;
	justify-content: space-around;
	font-size: 24rpx;
	color: #5b6753;
}

/* ===== 动画 ===== */
@keyframes popIn {
	from {
		transform: scale(0.72) translateY(52rpx);
		opacity: 0;
	}

	to {
		transform: none;
		opacity: 1;
	}
}

@keyframes fadeIn {
	from {
		opacity: 0;
	}

	to {
		opacity: 1;
	}
}

@keyframes itemIn {
	from {
		opacity: 0;
		transform: translateY(20rpx);
	}

	to {
		opacity: 1;
		transform: none;
	}
}

@keyframes logoIn {
	from {
		transform: scale(0.4);
		opacity: 0;
	}

	to {
		transform: scale(1);
		opacity: 1;
	}
}

@keyframes floatY {
	0%,
	100% {
		transform: translateY(0);
	}

	50% {
		transform: translateY(-8rpx);
	}
}

@keyframes shine {
	0%,
	55% {
		left: -70%;
	}

	100% {
		left: 130%;
	}
}
</style>
