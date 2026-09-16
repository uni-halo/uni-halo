# PRD：我的信息 & 个人主页

> 版本：v1.1（2026-09-17）
> 变更记录：v1.1 ①「我的信息」页面更名为 `my-profile`；②个人主页移除统计条；③三态/加载更多统一使用 `uh-data-loading` + `uh-data-loadmore` + `useDataLoadingStatus`；④解绑微信确定为插件新增接口（M1）；⑤新增图片地址处理规范（原始地址入库、渲染时 check 补全）。
> 关联仓库：`uni-halo`（移动端）、`uni-halo-plugin`（插件端）
> 关联代码：`src/components/uh-user-popup/uh-user-popup.vue`（入口占位已添加，未接线）

---

## 1. 背景与目标

「我的」弹窗（uh-user-popup）已新增两个功能入口占位：

- **我的信息**（页面名 `my-profile`）：管理当前登录账号的资料——更新头像、昵称，一键绑定/解除绑定微信。
- **个人主页**（页面名 `user-profile`）：展示当前登录用户的信息（昵称、头像），并按时间线展示其发布的文章与瞬间。

目标：为登录用户提供完整的"账号自我服务"闭环与个人内容聚合页，风格延续现有玻璃拟态（`uh-global-card-glass` + 主题色 `#B9E424`）。

## 2. 用户故事

| # | 角色 | 故事 | 优先级 |
|---|------|------|--------|
| U1 | 登录用户 | 我可以更换头像与修改昵称，让账号信息保持最新 | P0 |
| U2 | 登录用户（微信小程序） | 我可以一键绑定微信号，之后用微信快速登录 | P0 |
| U3 | 已绑定微信的用户 | 我可以解除绑定 | P0 |
| U4 | 登录用户 | 我可以在个人主页看到自己的文章和瞬间的时间线 | P0 |
| U5 | 登录用户 | 我可以修改自己的密码 | P1 |

## 3. 页面设计

### 3.1 我的信息（`pages-blog/my-profile/my-profile`，pages-blog 分包）

结构（自上而下，均为玻璃卡片）：

1. **导航栏**：返回 + 标题「我的信息」（custom navigation，与现有一致）。
2. **头像卡片**：大头像（128rpx 圆形）+ 右下角相机角标；点击 → `uni.chooseImage` → 上传；未设置头像时显示昵称首字符占位。
3. **资料表单卡片**：
   - 昵称行：内联输入框（wot-ui `wd-input`），失焦或点"保存"提交；
   - 用户名行：只读展示（不可改，Halo 用户名是资源 name）；
   - 角色行：只读徽标（超级管理员 / 普通用户，复用现有判定）；
   - 邮箱行：只读展示。
4. **微信绑定卡片**：
   - 未绑定：说明文案 + 「一键绑定微信」按钮（仅 `isWechat` 环境显示按钮；H5/App 端提示"请在微信小程序内绑定"）；
   - 已绑定：显示"已绑定微信" + 绑定时间 + 「解除绑定」（`wd-message-box` 二次确认）；
   - 进入页面时拉取绑定状态并缓存到组件态。
5. **修改密码（P1）**：折叠区或独立行，旧密码 + 新密码。
6. **退出登录**：红色按钮，复用现有 `useTokenStore().logout()` 流程。

交互细节：

- 保存成功后同步 `useUserStore`（存**原始地址**，见第 6 节），弹窗处头像即时生效；
- 头像上传中显示 loading 态，失败 toast；
- 解绑成功后刷新绑定状态卡片。

> 注：本页面为表单型页面，无列表数据，**不涉及** `uh-data-loading` 三态；头像上传/保存等操作态用局部 loading + toast。

### 3.2 个人主页（`pages-blog/user-profile/user-profile`）

结构：

1. **头部**：渐变封面区（复用 about 页风格），叠加头像 + 昵称 + 用户名 + 简介（bio，无则显示"这个人很懒~"）。**无统计条**。
2. **分段 Tab**（文章 / 瞬间），两个 Tab 各自**独立维护一套数据状态与列表**：
   - **文章 Tab**：复用文章列表卡片样式（封面缩略图 + 标题 + 摘要 + 日期/浏览量），点击跳 `/pages-blog/article-detail/article-detail?name=xxx`；
   - **瞬间 Tab**：时间线卡片（正文 HTML + 媒体九宫格 + 时间），点击跳 `/pages-blog/moment-detail/moment-detail?name=xxx`；
   - 三态与加载更多规范见第 4 节。

### 3.3 入口接线

uh-user-popup 两个入口占位补 `@click`：关闭弹窗后 `uni.navigateTo`（`animationType: 'slide-in-right'`，与管理入口一致）。

## 4. 通用数据状态规范（三态 + 加载更多）

个人主页两个 Tab 的数据区**统一**使用项目既有组件与 Hook，写法对齐 `pages/tabbar/moments/moments.vue`：

| 环节 | 使用 | 说明 |
|------|------|------|
| 三态（加载/空/错误） | `<uh-data-loading :loading-status="loadingStatus" min-height="75vh" @refresh="handleGetData" />` | `loadingStatus !== Success` 时整块渲染三态组件（含刷新按钮）；`Success` 时渲染列表 |
| 状态机 | `useDataLoadingStatus()`（`src/hooks/useDataLoadingStatus.ts`） | `loadingStatus`（loading/error/empty/success/noNetwork）+ `loadMoreStatus`（active/hasNext/status/text） |
| 加载更多提示 | `<uh-data-loadmore :status="loadMoreStatus.status" :text="loadMoreStatus.text" />` | 列表底部，展示"哎嘿，往下还有数据哦~/呜呜，没有更多数据了~"等文案 |
| 触发时机 | `onReachBottom` | `active` 时防重复；`hasNext` 时 `page += 1` 并 `updateLoadMoreStatus({ active: true, status: 'loading' })` |
| 首屏/刷新 | `onPullDownRefresh` + `onShow` | `resetLoadMoreStatus()` + `page = 1` 重新拉取；成功后 `uni.stopPullDownRefresh()` |
| 请求成功分支 | 非 loadMore | `updateLoadingStatus(list.length === 0 ? Empty : Success)`；`updateLoadMoreStatus({ status: hasNext ? 'loadMore' : 'noMore', hasNext })` |
| 请求失败分支 | loadMore 中失败 → loadMore 置 `error`；首屏失败 → `loadingStatus = Error` | 与 moments.vue 完全一致 |

实现要点：

- 两个 Tab 各自独立一组 `dataList / queryParams / loadingStatus / loadMoreStatus`（建议抽 `usePagedList` 局部组合函数或直接双份状态，**避免共享状态导致切 Tab 串数据**）；
- Tab 切换不重置已加载数据（保留滚动位置），仅在该 Tab 首次进入或下拉刷新时重置；
- 接口失败静默降级为三态组件的错误态（自带刷新按钮），不弹全局 toast。

## 5. 功能可行性与接口分析

### 5.1 结论总表

| 能力 | 接口 | 可行性 | 说明 |
|------|------|--------|------|
| 读当前资料 | `GET /apis/api.unihalo.ialley.cn/v1alpha1/plugins/uni-halo/auth/profile` | ✅ 已有 | 插件 AuthEndpoint 已实现，app 端 `getAuthProfile()` 已封装 |
| 修改昵称 | `PUT /apis/api.halo.run/v1alpha1/users/-` | ✅ 原生支持 | Halo 2.26 `UserEndpoint#UpdateCurrentUser`，body 传 User（`spec.displayName`）；需角色含 `users[-]` update 权限（见 5.2） |
| 更新头像 | `POST /apis/api.halo.run/v1alpha1/users/-/avatar`（multipart） | ✅ 原生支持 | Halo 2.26 `UploadUserAvatar`，`uni.uploadFile` 直传；返回更新后的 User |
| 微信绑定状态 | `GET .../auth/my/wechat-binding` | ✅ 已有 | 插件 AuthEndpoint 已实现，仅需登录自身身份 |
| 一键绑定微信 | `POST .../auth/bind/wechat`（body: `{code}`） | ✅ 已有 | 插件已实现（`currentIdentity` + `authService.bindWechat`），仅微信小程序环境可用 |
| 解除绑定微信 | `DELETE .../auth/my/wechat-binding` | 🆕 **插件新增（M1，已确定）** | 规格见 5.3 |
| 我的文章 | `GET /apis/api.content.halo.run/v1alpha1/posts?fieldSelector=spec.owner=={username}` | ✅ 可行（需实测） | Halo 公开文章接口经 `PostQuery extends IListRequest` 支持 `fieldSelector`；`spec.owner` 已建索引（Halo UC 接口自身即按 `equal("spec.owner", ...)` 查询）。兜底方案见 5.4 |
| 我的瞬间 | `GET /apis/api.moment.halo.run/v1alpha1/moments?ownerName={username}` | ✅ 已确认 | plugin-moments `MomentPublicQuery` 源码明确支持 `ownerName` 参数（`equal("spec.owner", ...)`），公开接口直接可用 |

### 5.2 权限红线（关键）

移动端 PAT 权限"只减不增"：`PUT users/-`、`POST users/-/avatar` 走 `api.halo.run` 组，需要登录默认角色的 RBAC 规则聚合了 `apiGroups: ["api.halo.run"], resources: ["users"], resourceNames: ["-"], verbs: ["update"]`（或对应 UC 聚合模板）。**上线前必须实测**：若 403，则在该登录角色模板中补充聚合规则（插件 role-template 追加即可，符合"自选 API base 改动须同步 role-template"的既有约定）。

### 5.3 解除绑定微信（插件新增接口，M1 交付）

```
DELETE /apis/api.unihalo.ialley.cn/v1alpha1/plugins/uni-halo/auth/my/wechat-binding
```

- **鉴权**：需登录（PAT / 会话），`currentIdentity()` 取当前用户名，只允许操作**自己**的绑定（fail-closed，不暴露 username 路径参数）；
- **实现**：在 `AuthEndpoint` 追加路由，逻辑复用 `WechatUserEndpoint#unbind` 的 `findConnection` + `client.delete`（建议下沉到 AuthService 共用），仅删除 `UserConnection`，不删 Halo 用户；
- **幂等**：未绑定时同样返回 `{ "success": true }`（与 Console 解绑端点行为一致）；
- **错误契约**：沿用 `handleFailure`——`AuthException` 按自带状态码返回 `{ code, message }`，其余收敛为 500 `INTERNAL_ERROR`；
- **RBAC**：AUTH_API_BASE_PATH 属 `api.unihalo.ialley.cn`，role-anonymous 已全量放行该组，登录用户访问无额外授权问题；预计改动 <50 行；
- **前端**：`src/api/auth.ts` 封装 `unbindMyWechat()`，`meta: { needAuthToken: true }`。

### 5.4 我的文章的兜底方案

若公开接口 `fieldSelector=spec.owner==` 实测不可用（公开端点存在字段白名单的可能），改用 UC 接口：

- `GET /apis/uc.api.content.halo.run/v1alpha1/posts`：Halo 源码中 `PostQuery(request, username)` 构造器会强制 `equal("spec.owner", 当前登录用户)`，即天然"只看我自己的"；
- 前提：PAT 默认角色聚合 UC 内容读取权限（`uc.api.content.halo.run` posts list）；
- 差异：公开接口天然只返回"已发布"，UC 接口会包含草稿/待审（个人主页建议只显示已发布，按 `status.phase` 过滤或显示状态徽标，保持与站点一致）。

## 6. 图片地址处理规范（重要约定）

**原则：数据层一律保存服务端原始地址（允许相对路径），渲染时才做补全检查。**

- **存储**：头像/封面/瞬间媒体等图片，写入 user store、列表 item、缓存时**保存接口返回的原始值**（如 `/upload/avatars/xxx.png`），**不拼接域名成完整 URL 入库**；
- **渲染**：模板中 `:src="checkAvatarUrl(xxx)"` / `checkImageUrl()` / `checkThumbnailUrl()` 即时补全后再展示；
- **动机**：博客迁移（域名变更）后相对路径仍可正常访问；完整 URL 入库会污染平台数据与 Halo 原生数据，迁移后全部失效；
- **连带改动（M2）**：`src/store/user.ts` 的 `mapLoginUser()` 当前在写入时调用了 `checkAvatarUrl`，违反本原则，需改为存原始值；所有消费 `userInfo.avatar` 的模板处补渲染时 check（grep 排查）；
- **上传后回填**：头像上传成功取服务端返回的 `User.spec.avatar` 原始值经 `setUserAvatar` 入库。

## 7. 数据流（核心链路）

```
我的信息页 onLoad
  ├─ getAuthProfile()            → 头像/昵称/角色/邮箱 回显（原始地址入库）
  └─ getMyWechatBinding()        → 绑定卡片状态
       ├─ 未绑定 + isWechat  → wx.login → bindWechat(code) → 刷新状态
       └─ 已绑定             → 确认弹窗 → unbindMyWechat()（DELETE auth/my/wechat-binding）→ 刷新状态

更新头像: uni.chooseImage → uni.uploadFile(POST users/-/avatar) → setUserAvatar(原始值) → 渲染时 checkAvatarUrl
更新昵称: PUT users/- (spec.displayName) → getAuthProfile() 刷新 → setUserInfo

个人主页 onLoad（双 Tab 独立状态机）
  ├─ 文章 Tab: getPostList({ fieldSelector: ['spec.owner==<username>'], page, size })
  │    uh-data-loading 三态 + uh-data-loadmore + onReachBottom 分页
  └─ 瞬间 Tab: getMomentList({ ownerName: username, page, size })
       同上，独立一套状态
```

## 8. 非功能需求

- 三态齐全且统一走 `uh-data-loading`（含刷新按钮），加载更多统一走 `uh-data-loadmore`，文案沿用组件默认；
- 页面均 `navigationStyle: custom`，深色模式跟随现有 `dark:` 约定（4 种深色标记全兼容）；
- 个人主页允许"仅自己可见"扩展位：P1 可加 `visible` 开关，本期不做。

## 9. 里程碑

| 阶段 | 内容 | 涉及仓库 |
|------|------|----------|
| M1 | 插件新增 `DELETE auth/my/wechat-binding` 解绑接口 + 登录默认角色权限核查 | uni-halo-plugin |
| M2 | 我的信息页（`my-profile`：头像/昵称/绑定/解绑 + store 原始地址改造） | uni-halo |
| M3 | 个人主页页（`user-profile`：双 Tab 独立三态 + 分页 + 详情跳转 + 入口接线） | uni-halo |
| M4 | 联调实测 fieldSelector / avatar 上传权限；回归 uh-user-popup 入口 | 双端 |

## 10. 验收标准

1. 更新头像后：上传成功、store 中为**原始相对地址**、弹窗与个人页头像渲染时经 `checkAvatarUrl` 即时刷新、低版本 WebView 无报错。
2. 修改昵称后：个人主页、弹窗、瞬间 owner 显示名同步为新昵称。
3. 微信端可完成绑定 → 杀进程重启用微信一键登录可进同一账号；解绑（调用新增 DELETE 接口）后再登录走"自动建号"或账号密码，符合既有登录语义；未绑定时解绑返回成功（幂等）。
4. 个人主页文章/瞬间仅展示当前登录用户自己的已发布内容；两个 Tab 的加载/空/错误三态均由 `uh-data-loading` 呈现且可点击刷新重试；上拉加载由 `uh-data-loadmore` 呈现，无重复请求、无串 Tab 数据。
5. 无 `fieldSelector`/`ownerName` 参数时页面不报错（参数缺失回退为空列表提示）。

---

## 附：高保真原型

- `prototypes/my-profile.html` —— 我的信息（原 my-info.html 已更名）
- `prototypes/user-profile.html` —— 个人主页（无统计条，含空态预览）
