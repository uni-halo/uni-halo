# uh-upgrade

基于 DCloud 官方 `uni-upgrade-center-app`（v0.9.12）复制改造的 App 升级检测模块，适配 uni-halo 项目：

- **不再依赖 uniCloud**：原插件通过 `uniCloud.callFunction('uni-upgrade-center')` 检测升级，本插件改为 HTTP GET 请求 Halo 插件 [uni-halo-plugin](https://github.com/uhalo/uni-halo-plugin)（插件 ID：`uni-halo`）的公开接口 `checkVersion`；
- **baseUrl 由调用方传入**：uni_modules 插件无法直接读取项目配置文件（`config/uhalo.config.js`），因此调用时需显式传入 Halo 站点地址；
- 弹窗页面、下载安装、静默/强制更新、iOS 跳 AppStore 等逻辑与原插件保持一致。
- **不支持 uni-app x**：已移除 UNI-APP-X 适配（条件编译分支、uni-app-x 弹窗页面、uts-openSchema 依赖），仅支持 uni-app（vue）App 端。

## 接口约定

检测升级请求地址（后端见 `.docs/app-upgrade-design.md` 第 3.2 节）：

```
GET {baseUrl}/apis/api.unihalo.ialley.cn/v1alpha1/upgrade/checkVersion
    ?appid=xxx&appVersion=1.0.0&wgtVersion=1.0.0&platform=Android&isUniappX=false
```

返回结构与原插件 `UniUpgradeCenterResult` 完全一致（snake_case），app 端弹窗零改动复用。

## 使用方式

### 1. 页面注册

在项目 `pages.json` 中注册升级弹窗页面（App 端使用）：

```json
{
  "path": "uni_modules/uh-upgrade/pages/upgrade-popup",
  "style": {
    "disableScroll": true,
    "app-plus": {
      "backgroundColor": "rgba(0,0,0,0)",
      "animationType": "fade-in",
      "animationDuration": 200
    }
  }
}
```

### 2. 检测升级（推荐在 App.vue 中调用）

```js
import CheckAppUpdate from '@/uni_modules/uh-upgrade/utils/check-update'

// baseUrl 即 Halo 站点地址（域名后不带斜杠）
CheckAppUpdate({ baseUrl: import.meta.env.VITE_SERVER_BASEURL })
```

参数为对象 `CheckUpdateOptions`：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| baseUrl | string | 是 | Halo 站点地址（域名后不带斜杠） |
| component | any | Harmony 必填 | HarmonyOS Next 平台弹窗组件 |
| useModal | boolean | 否 | true 时用 uni.showModal 提示升级，默认走升级弹窗页面 |

若未传入 baseUrl，模块会 reject 并提示「未传入 baseUrl，无法检测升级」。

### 3. nvue 页面

nvue 工程使用 `@/uni_modules/uh-upgrade/utils/check-update-nvue.js`，用法相同：

```js
import CheckAppUpdate from '@/uni_modules/uh-upgrade/utils/check-update-nvue'
CheckAppUpdate(HaloTokenConfig.BASE_API)
```

## 依赖

- `uts-progressNotification`：通知栏下载进度（Android）

依赖模块需随项目一并安装（项目 `uni_modules/` 目录中已包含）。

## 与 uni-upgrade-center-app 的差异

| 项 | uni-upgrade-center-app | uh-upgrade |
|---|---|---|
| 检测方式 | `uniCloud.callFunction('uni-upgrade-center')` | HTTP GET `checkVersion`（Halo 插件） |
| baseUrl | 云函数自动获取 | 调用方传入（如 `HaloTokenConfig.BASE_API`） |
| 安装包地址 | `cloud://` 云存储临时链接 | Halo 附件直链（`/upload/...`），无需换临时链接 |
| 模块名/路径 | `uni_modules/uni-upgrade-center-app/` | `uni_modules/uh-upgrade/` |
| 数据库 | uniCloud 集合 | Halo 插件自定义扩展（AppInfo / AppVersion） |

## 完整升级链路

```
[Halo 控制台] 发布版本（标题/内容/平台/版本号/apk/wgt）→ 上线发行（stable_publish）
                      │
                      ▼
[app 端] 启动 → checkUpdate(baseUrl) → GET checkVersion（匿名，见 role-anonymous.yaml）
                      │
                      ▼
[Halo 插件] 按 appid+platform 查稳定版 → 选版本大者（wgt 优先）→ 101/102/0
                      │
                      ▼
[app 端] code>0 → 静默更新直接下载安装；否则弹窗（pages/upgrade-popup）
         → 下载 → plus.runtime.install → 强制更新重启；iOS 跳 AppStore
```
