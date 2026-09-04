---
name: uni-halo
description: 提供 uni-halo 项目开发规范，包括目录分层、类型定义、alova API 约定、页面/组件/样式规范、请求 hooks 与完整示例代码。
license: Complete terms in LICENSE.txt
---

# uni-halo 开发规范

> 本技能是 uni-halo 项目的「开发手册」：所有规范均提炼自本仓库真实代码（`src/` 目录），
> 写代码前先读本文，能减少返工、保持全库风格统一。

## 什么时候使用这个技能

- 在本项目**新建或修改页面**（判断放 `src/pages/` 还是 `src/pages-blog/` 等分包、命名、`definePage` 写法）
- 在本项目**开发业务或通用组件**（`uh-` 前缀、组件内部结构、事件命名）
- **定义或修改 API**（约定使用 alova，格式、`meta` 传参、类型文件位置）
- **定义或修改类型**（`src/api/types/` 下的接口与请求/响应类型）
- **使用通用配置**（`src/config/` 的 appConfig / appSettings / haloGlobal / markdown）
- **页面数据请求**（`useDataLoadingStatus` + `updateLoadingStatus` 管理四态 + `uh-data-loading` 组件）
- **处理多平台差异**（H5 / 微信小程序 / APP，条件编译）

## 三条铁律（先记住）

1. **生成物不手改**：`src/pages.json`、`src/manifest.json`、`src/types/*.d.ts` 均由
   `*.config.ts` / `definePage` / 插件自动生成，手改会在下次构建被覆盖。
   页面路由写在页面内 `definePage` 宏里，不写进 `pages.config.ts`。
2. **平台差异只用条件编译**：`#ifdef H5 / #ifdef MP-WEIXIN / #ifdef APP-PLUS`，
   编译期能确定的不留到运行时；运行时判断仅用于编译期无法确定的场景。
3. **UI 优先原子类**：先 UnoCSS 原子类，再自定义 CSS（`<style scoped lang="scss">`），
   全局复用样式才放 `src/style/`。

---

## 1. 目录分层（代码放哪里）

```
src/
├── pages/          # 主包页面（约定式路由，文件路径即路由，无需注册）
│   ├── index/      # 入口页（definePage type: 'home'）
│   ├── tabbar/     # tabbar 四个主页面（home/category/gallery/moments/about）
│   ├── auth/       # 登录/注册
│   └── maintenance/ # 维护页
├── pages-blog/     # 分包一：博客业务页面（对应旧版 pagesA，如文章、投票、图库、瞬间）
├── pages-demo/     # 分包二：demo 预留
├── components/     # 全局组件（uh- 前缀，easycom 自动注册，免 import）
├── api/            # API 定义（alova），类型在 api/types/ 下
├── http/           # 请求封装（alova 实例、拦截器、错误工具）
├── hooks/          # 组合式函数（auto-import，页面免 import 直接调用）
├── config/         # 通用配置（appConfig/appSettings/haloGlobal/markdown 默认值）
├── store/          # Pinia store（持久化用 pinia-plugin-persistedstate）
├── style/          # 全局样式（index.scss 在 main.ts 引入）
├── static/         # 静态资源（@img → src/static/images；SVG 图标 → static/my-icons/）
├── tabbar/         # 底部导航（config.ts 是唯一配置源）
├── utils/          # 通用工具（url/storage/merge/plugin/vote 等）
├── locale/         # i18n（zh-Hans / en）
└── layouts/        # 布局（default.vue）
```

- 别名：`@` → `src/`，`@img` → `src/static/images`。
- **分包判断**：页面是否首屏必需？不是 → 放分包（`pages-blog` / `pages-demo`）。
  分包目录在 `vite.config.ts` 的 `UniPages({ subPackages: [...] })` 注册，**不能**是 `src/pages` 的子目录。
- **请求一律走 alova**（`@/http/alova`），业务代码禁止直接 `uni.request`。
- 服务端状态以接口为事实源，store 只放需要跨页共享/持久化的状态。

## 2. 类型定义（放哪、怎么命名）

**位置**：`src/api/types/`，与 API 文件一一对应：

| API 文件 | 类型文件 | 内容 |
|---------|---------|------|
| `src/api/halo.ts` | `src/api/types/halo.ts` | Halo 官方接口（文章/分类/标签/评论/瞬间/图库/友链） |
| `src/api/uni-halo.ts` | `src/api/types/uni-halo.ts` | plugin-uni-halo 插件与三方插件接口 |
| `src/api/login.ts` | `src/api/types/login.ts` | 登录相关 |

**命名规则**：

- 接口用 `I` 前缀 + PascalCase：`IPost`、`IUser`
- 请求参数 `IXxxReq`，响应 `IXxxRes`：`IPostListReq` / `IPostListRes`
- 对象类型用 `interface`，联合类型用 `type`，导入类型用 `import type`
- 响应统一包在 `IResponse<T>` 里（见 §3.3）

```ts
// src/api/types/halo.ts
/** 文章列表请求参数 */
export interface IPostListReq {
  page: number
  size: number
  sort?: string[]
  keyword?: string
  [key: string]: unknown
}

/** 文章列表响应 */
export interface IPostListRes {
  page: number
  size: number
  total: number
  hasNext: boolean
  items: IPost[]
}
```

## 3. API 定义（约定使用 alova）

### 3.1 请求实例

`src/http/alova.ts` 导出 `http` 实例（alova + uniapp 适配器），统一处理：baseURL、
token、超时、错误归一化、Halo 响应包装（原始数据 → `{ code, data, message }`）。
**业务代码不手写请求头 token**。

### 3.2 定义格式（GET / POST）

```ts
// src/api/halo.ts
import { http } from '@/http/alova'
import { RequestFrom } from '@/http/tools/enum'
import type { IResponse } from '@/http/types'
import type { IPostListReq, IPostListRes, ISearchReq, ISearchRes } from './types/halo'

/** GET：query 参数走 params */
export function getPostList(params: IPostListReq) {
  return http.Get<IResponse<IPostListRes>>('/apis/api.content.halo.run/v1alpha1/posts', {
    params,
    meta: { requestFrom: RequestFrom.Halo },
  })
}

/** POST：第一参 url，第二参 body */
export function getPostListByKeyword(params: ISearchReq) {
  return http.Post<IResponse<ISearchRes>>('/apis/api.halo.run/v1alpha1/indices/-/search', params, {
    meta: { requestFrom: RequestFrom.Halo },
  })
}
```

要点：

- 函数命名 `getXxx` / `submitXxx` / `checkXxx` / `unlockXxx`，见名知义
- URL 用 Halo 完整 API 路径：`/apis/api.content.halo.run/v1alpha1/posts`
- 每个函数顶部写 JSDoc 注释说明用途、特殊行为（如 `cacheFor: 0` 的原因）

**复杂 GET 参数用 `query: params`（不要用 `params`）**：

某些 GET 接口需要传复杂/嵌套参数（数组、对象、需要自定义序列化的参数）时，
`params` 无法满足；alova 类型中也**未定义 `query` 字段**（会报类型错误），
但它是 uni.request 原生的 query 参数（支持复杂序列化），项目约定**需要时直接传 `query: params`**：

```ts
/** 文章列表（复杂参数序列化：用 query 而非 params） */
export function getPostList(params: IPostListReq) {
  return http.Get<IResponse<IPostListRes>>('/apis/api.content.halo.run/v1alpha1/posts', {
    query: params, // 复杂/嵌套参数走 query；简单键值参数才用 params
    meta: { requestFrom: RequestFrom.Halo },
  })
}
```

- 简单键值参数（`{ page, size }` 等）用 `params` 即可
- 复杂/嵌套/需要特殊序列化的参数（数组、对象等）用 `query: params`
- alova 类型未声明 `query`，如遇类型报错需在调用处处理（如类型断言），不要改用 `params` 硬传

### 3.3 响应结构 `IResponse<T>` 与 `meta`

| 约定 | 说明 |
|------|------|
| `meta.requestFrom: RequestFrom.Halo` | **Halo 官方/插件接口必传**，拦截器会把原始数据归一化为 `{ code, data, message }`；标准接口为 `Standard` |
| `meta.domain` | 切换请求域名（如 `API_DOMAINS.SECONDARY`，见 `src/api/foo-alova.ts`） |
| `meta.personalToken` | 带个人令牌的接口（非匿名投票等） |
| `cacheFor: 0` | 绕过 alova 内存缓存，**配置类接口必加**（维护模式/配置变更需即时生效，如 `getAppConfigs`） |

响应拿到的是 `IResponse<T>`，业务里取 `res.data` 即为 `T`：

```ts
const res = await getPostList({ page: 1, size: 5 })
const items = res.data.items // IPost[]
```

### 3.4 带特殊 header 的接口

在 alova 配置项里直接传 `headers`（如访客标识）：

```ts
export function getPostByName(name: string) {
  return http.Get<IResponse<IPost>>(`/apis/api.content.halo.run/v1alpha1/posts/${name}`, {
    headers: {
      'Wechat-Session-Id': getOpenid(),
      'nologin-email': getNologinEmail(),
    },
    meta: { requestFrom: RequestFrom.Halo },
  })
}
```

### 3.5 错误处理

- 拦截器已统一错误提示，业务层 `try/catch` 即可，catch 到的是 `UniHaloError`（含 `message` / `code` / `data`）
- 需要静默的场景自行 `console.error` + 处理，不重复 toast
- 401 由拦截器统一处理（双 token 无感刷新），**业务不自行处理 401**

---

## 4. 通用配置（src/config/ 怎么用）

| 文件 | 导出 | 用途 |
|------|------|------|
| `src/config/appConfig.ts` | `DefaultAppConfigs` | 应用配置默认值（banner/布局/插件配置等），与 `getAppConfigs()` 返回 deepMerge |
| `src/config/appSettings.ts` | `DefaultAppSettings` + `IAppSettings` | 应用设置默认值与类型（头像圆角/布局/广告/图库瀑布流等） |
| `src/config/haloGlobal.ts` | `DefaultHaloGlobalConfigs` | Halo 全局配置默认值（匿名评论/注册开关等） |
| `src/config/markdown.ts` | `markdownConfig` | mp-html 富文本渲染配置（tagStyle / containerStyle） |

**正确用法**：

- **页面读配置**：优先从 store 读，不要直接 import 默认值
  ```ts
  import { useAppConfigStore } from '@/store/appConfig'
  const appConfigStore = useAppConfigStore()
  const haloConfigs = computed(() => appConfigStore.configs)
  // 取字段：haloConfigs.value.pageConfig?.homeConfig?.bannerConfig
  ```
- **拉取配置**：`appConfigStore.bootstrap()` 统一并行拉取
  getConfigs + audit-data + love-config，TTL 5 分钟内直接返回缓存，`{ force: true }` 强制刷新。
- **富文本渲染**：`<mp-html :content="html" :tag-style="markdownConfig.tagStyle" :container-style="markdownConfig.containStyle" />`
- 默认值是「兜底」，服务端返回后 `deepMerge` 覆盖，**不要直接改默认值文件**。

---

## 5. 页面规范

### 5.1 页面放哪个文件夹

| 页面类型 | 位置 | 示例 |
|---------|------|------|
| 入口页（首页分流） | `src/pages/index/` | `index.vue`（`definePage({ type: 'home' })`） |
| tabbar 主页面 | `src/pages/tabbar/模块/` | `tabbar/home/home.vue`、`tabbar/moments/moments.vue` |
| 登录/注册 | `src/pages/auth/` | `login.vue`、`register.vue` |
| 维护页 | `src/pages/maintenance/` | `maintenance.vue` |
| 博客业务页面 | `src/pages-blog/模块/`（分包） | `article-detail/`、`votes/`、`vote-detail/`、`gallery/`、`search/`、`setting/` |
| demo 示例 | `src/pages-demo/`（分包） | `ucharts/` |

**分包判断**：页面是否首屏必需？不是 → 放 `pages-blog/`（博客功能）或 `pages-demo/`（示例）。
`src/pages-blog` 对应旧版项目的 pagesA 子包。

### 5.2 命名规则

- **目录**：kebab-case（`article-detail/`、`vote-detail/`），页面文件与目录同名：`article-detail/article-detail.vue`
- **文件**：kebab-case，见名知义（`moment-detail.vue`、`submit-link.vue`、`data-visual.vue`）
- **tabbar 页面**：`src/pages/tabbar/模块名/模块名.vue`
- 页面私有组件放页面同目录 `components/` 子目录（构建时已排除，不会被识别成页面）

### 5.3 SFC 结构（顺序是 eslint 强制的）

```
<script setup lang="ts">   ← 第一个（页面配置 definePage 放最上面）
<template>                  ← 第二个
<style scoped lang="scss">  ← 最后一个（没有可省略）
```

```vue
<script lang="ts" setup>
/**
 * 页面职责注释（源自旧项目 pagesX/xxx，新建复刻 / 说明）
 */
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { getVoteList } from '@/api/uni-halo'
import type { IVoteItem } from '@/api/types/uni-halo'

definePage({
  style: {
    navigationBarTitleText: '投票中心',
    enablePullDownRefresh: true,
  },
})

/* ---------------- 状态 ---------------- */
const loading = ref<'loading' | 'success' | 'error'>('loading')
const dataList = ref<IVoteItem[]>([])

/* ---------------- 数据加载 ---------------- */
async function handleGetData() {
  // ...
}

/* ---------------- 生命周期 ---------------- */
onLoad(() => {
  handleGetData()
})
</script>
```

**约定**：

- 区块用 `/* ---- 状态 ---- */` 分隔：状态 → 计算属性 → 数据加载 → 跳转 → 生命周期
- 事件处理函数 `handleXxx`，跳转函数 `handleToXxxPage`
- 页面根节点用 `app-page` 类 + 主题底色：`<view class="app-page min-h-screen w-screen flex flex-col bg-page">`
- 页面标题 `navigationBarTitleText` 写中文；下拉刷新 `enablePullDownRefresh: true`

### 5.4 子页面自定义导航（uh-navbar 组件）

**用途**：子页面（非 tabbar 页，如文章详情、设置、投票详情等）的顶部自定义导航栏。
配合页面 `navigationStyle: 'custom'` 使用，**新页面一律使用它，不要用默认导航栏**。

**前提（definePage 里必须声明）**：

```ts
definePage({
  style: {
    navigationStyle: 'custom', // 关闭系统默认导航栏,让位给 uh-navbar
  },
})
```

**Props 一览**：

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `use-back` | `boolean` | `true` | 是否显示左侧返回按钮 |
| `use-title` | `boolean` | `true` | 是否显示标题 |
| `default-title` | `string` | - | 默认标题（顶部文案） |
| `title-color` | `string` | - | 标题颜色类名（如 `text-gray-900`），**带此属性时固定颜色、不随滚动变色** |
| `scroll-title` | `string` | - | 滚动后标题（配合 default-title：顶部显示默认标题，滚过 50% 换 scroll-title） |
| `need-placeholder` | `boolean` | `true` | 是否生成占位（为页面内容让出导航高度） |

**页面结构模板**（参考 `src/pages-blog/test/test.vue`）：

```vue
<script lang="ts" setup>
definePage({
  style: {
    navigationBarTitleText: '测试页面',
    navigationStyle: 'custom', // 使用 uh-navbar 必须声明
  },
})

const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()
</script>

<template>
  <!-- 最外层仅作容器(bg-page 底色),不设 padding -->
  <view class="w-full min-h-screen bg-page">
    <!-- 导航栏:置于页面最顶部,内置占位/安全区处理 -->
    <uh-navbar default-title="测试页面" :need-placeholder="true" title-color="text-gray-900" />

    <!-- 内容区:从这开始写,因为 uh-navbar 已内置占位(need-placeholder=true) -->
    <view class="box-border px-3">
      <uh-data-loading v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus" min-height="80vh" />
      <view v-else>
        请求成功啦
      </view>
    </view>
  </view>
</template>
```

**使用要点**：

- **`need-placeholder` 必须按场景传对**：
  - 页面内容直接从导航下开始（普通子页面）→ `:need-placeholder="true"`（默认即可，如 test.vue / setting.vue）
  - 页面顶部有全屏封面/背景图，内容要盖到导航下面 → `:need-placeholder="false"`（如 article-detail.vue，封面 `pt-72` 上移）
- **`title-color` 与 `scroll-title` 二选一**：
  - 页面底色非深色 → 传 `title-color="text-gray-900"`（固定深色，如 test.vue / setting.vue）
  - 不传时标题会随滚动变白→深灰（顶部透明、滚后加深），适合顶部是深色大图的场景（如 article-detail.vue 只传 `default-title` + `scroll-title`，让滚动变色）
- 中间标题可用**默认插槽覆盖**（不传则显示 `default-title`/`scroll-title`），右侧扩展用 **`#right` 插槽**：

```vue
<uh-navbar default-title="偏好设置" :need-placeholder="true">
  <template #right>
    <view @click="handleSave">保存</view>
  </template>
</uh-navbar>
```

- 返回按钮内置（`uni.navigateBack`），无需自写
- easycom 已配置 `uh-` 前缀，直接用 `<uh-navbar />`，**无需 import**

### 5.5 页面数据请求（统一 updateLoadingStatus + uh-data-loading 组件）

**数据加载四态**：`loading / error / empty / success`，统一用
`useDataLoadingStatus`（`src/hooks/useDataLoadingStatus.ts`）的
`updateLoadingStatus(DataLoadingStatusEnum.Xxx)` 管理，**取代「手工 ref + try/catch 逐个搬运状态」的写法**。
首页、图库、瞬间、分类等 tabbar 页面均为此写法（参考 `src/pages/tabbar/category/category.vue`），
**后续所有页面请求状态一律照此管理**。

```vue
<script lang="ts" setup>
import { computed, ref } from 'vue'
import { onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { getCategoryList } from '@/api/halo'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import type { ICategory } from '@/api/types/halo'

definePage({
  style: {
    navigationBarTitleText: '分类',
    enablePullDownRefresh: true,
    backgroundColor: '#f6f3ee',
  },
})

/* ---------------- 状态 ---------------- */
const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()
const queryParams = ref({ size: 20, page: 1 })
const hasNext = ref(false)
const dataList = ref<ICategory[]>([])
const isLoadMore = ref(false)
const loadMoreText = ref(t('common.loading'))

/* ---------------- 数据加载 ---------------- */
async function handleGetData() {
  updateLoadingStatus(DataLoadingStatusEnum.Loading) // 请求开始
  if (!isLoadMore.value) {
    updateLoadingStatus(DataLoadingStatusEnum.Loading)
  }
  loadMoreText.value = t('common.loading')

  try {
    const res = await getCategoryList({ ...queryParams.value })
    hasNext.value = res.data.hasNext
    dataList.value = isLoadMore.value
      ? dataList.value.concat(res.data.items)
      : res.data.items
    // 请求结束：按数据是否为空区分 success / empty
    updateLoadingStatus(dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
  }
  catch (err) {
    console.error(err)
    updateLoadingStatus(DataLoadingStatusEnum.Error) // 失败
    loadMoreText.value = t('common.loadFailed')
  }
  finally {
    setTimeout(() => {
      uni.hideLoading()
      uni.stopPullDownRefresh()
    }, 500)
  }
}

function handleResetInit() {
  dataList.value = []
  queryParams.value.page = 1
  hasNext.value = false
  isLoadMore.value = false
  loadMoreText.value = t('common.loading')
}

onMounted(() => {
  handleResetInit()
  handleGetData()
})

onPullDownRefresh(() => {
  handleResetInit()
  handleGetData()
})

onReachBottom(() => {
  if (hasNext.value) {
    queryParams.value.page += 1
    isLoadMore.value = true
    handleGetData()
  }
  else {
    uni.showToast({ icon: 'none', title: t('common.noMoreData') })
  }
})
</script>

<template>
  <view class="box-border min-h-screen w-screen flex flex-col bg-page p-3">
    <!-- 状态区：loading/error/empty 由 uh-data-loading 展示，refresh 触发重新请求 -->
    <uh-data-loading v-if="loadingStatus !== DataLoadingStatusEnum.Success" :loading-status="loadingStatus" />

    <!-- 成功态：渲染数据 -->
    <block v-else>
      <view v-for="item in dataList" :key="item.metadata.name" class="uh-global-card-glass rounded-xl p-4">
        {{ item.spec.displayName }}
      </view>
      <view class="w-full py-5 text-center text-xs text-gray-400">
        {{ loadMoreText }}
      </view>
    </block>
  </view>
</template>
```

**要点**：

- `useDataLoadingStatus()` 返回 `{ loadingStatus, updateLoadingStatus }`；`DataLoadingStatusEnum` 四态：
  `Loading / Error / Empty / Success`
- 请求开始置 `DataLoadingStatusEnum.Loading`；成功按数据是否为空置 `Success` / `Empty`；失败置 `Error`
- 模板里 `v-if="loadingStatus !== DataLoadingStatusEnum.Success"` 显示 `<uh-data-loading>`，否则渲染数据
- `<uh-data-loading>` 常用 props：`loading-status`（必传）、`min-height`、`loading-text`、
  `error-text`、`empty-text`（留空显示默认文案）；`@refresh` 绑重试函数
- 首页特例：入口拦截 + 文章列表空时用 `v-if="loadingStatus !== Success && articleList.length === 0"`，
  避免轮播/公告区被占位组件顶掉
- 详情页等单数据场景（如 `moment-detail`）可用 `useDataLoading` 状态机（返回 `{ data, status, run }`），
  列表页/四态展示优先 `updateLoadingStatus` 写法
- 简单场景也可用 `useRequest(fn, { immediate })`：返回 `{ loading, error, data, run }`

### 5.6 列表页（分页加载）

列表页可用 z-paging（easycom 已配置 `<z-paging>` 直接用）或手写分页。
手写分页的既有模式（参考 `src/pages/tabbar/home/home.vue`、`pages-blog/votes/votes.vue`）：

```ts
const isLoadMore = ref(false)
const hasNext = ref(false)
const queryParams = ref({ page: 1, size: 10 })

async function handleGetData() {
  if (!isLoadMore.value)
    loading.value = 'loading'
  try {
    const res = await getVoteList({ ...queryParams.value })
    hasNext.value = res.data.hasNext || false
    dataList.value = isLoadMore.value
      ? dataList.value.concat(res.data.items)
      : res.data.items
    loading.value = 'success'
  }
  catch (err) {
    console.error(err)
    loading.value = 'error'
  }
}

onReachBottom(() => {
  if (!hasNext.value) {
    uni.showToast({ icon: 'none', title: '没有更多数据了' })
    return
  }
  queryParams.value.page += 1
  isLoadMore.value = true
  handleGetData()
})
```

### 5.7 依赖插件的页面（插件可用性 + 维护拦截）

Halo 是插件化 CMS，页面可能依赖插件（投票 plugin-vote、瞬间 PluginMoments 等）：

```ts
import { usePluginAvailable } from '@/utils/plugin'

const uniHaloPluginId = 'plugin-vote'
const uniHaloPluginAvailable = ref(true)

onLoad(async () => {
  uniHaloPluginAvailable.value = await usePluginAvailable(uniHaloPluginId)
  if (!uniHaloPluginAvailable.value)
    return
  handleGetData()
})
```

```vue
<template>
  <view class="app-page min-h-screen w-screen flex flex-col bg-page">
    <uh-plugin-unavailable
      v-if="!uniHaloPluginAvailable"
      :plugin-id="uniHaloPluginId"
      error-text="检测到当前插件没有安装或者启用，无法使用投票功能哦，请联系管理员"
      @on-refresh="handleGetData"
    />
    <template v-else>
      <!-- 正常内容 -->
    </template>
  </view>
</template>
```

主插件可用性 + 维护模式拦截用统一 hook（入口页/首页已用）：

```ts
const { interceptOrContinue } = useMaintenanceIntercept()
onLoad(async () => {
  if (await interceptOrContinue())
    return // 已跳转维护页，中断后续逻辑
})
```

---

## 6. 组件规范

### 6.1 命名与位置

- **全局组件**：`src/components/uh-组件名/uh-组件名.vue`，easycom 自动注册（`^uh-(.*)`），
  页面直接 `<uh-xxx />`，**无需 import**
  - 现有：`uh-data-loading`、`uh-button`、`uh-navbar`、`uh-vote-card`、`uh-plugin-unavailable`、
    `uh-comment-list`、`uh-album-photo-viewer` 等
- **页面私有组件**：放页面目录的 `components/` 子目录（如 `src/pages-blog/xx/components/`）
- 组件名 kebab-case，目录与文件名一致

### 6.2 组件内部结构（标准模板）

```vue
<script lang="ts" setup>
/**
 * 组件职责注释（源自旧项目 components/xxx，新建复刻）
 * 说明：数据来源、与父组件的契约
 */
import { computed } from 'vue'
import { getVoteDetail } from '@/api/uni-halo'
import type { IVote } from '@/api/types/uni-halo'

interface IProps {
  /** 必传 prop */
  voteName: string
  /** 可选 prop */
  errorText?: string
}

const props = withDefaults(defineProps<IProps>(), {
  errorText: '',
})

const emit = defineEmits<{
  (e: 'on-vote-success'): void
}>()

const isSingle = computed(() => voteData.value?.spec?.type === 'single')

async function handleGetData() {
  // 组件内部请求自己的数据（业务内聚在组件里）
}

function handleSubmit() {
  // 处理完 emit 事件通知父组件
  emit('on-vote-success')
}
</script>

<template>
  <view class="uh-vote-card w-full rounded-[28rpx] bg-white p-4">
    <slot />
  </view>
</template>

<style scoped lang="scss">
/* unocss 表达不了的再写 scoped 样式（keyframes、复杂状态配色等） */
</style>
```

**约定**：

- `IProps` 接口定义 props，`withDefaults` 提供默认值；props 用 JSDoc 注释说明用途
- 事件命名 `on-xxx`（如 `on-refresh`、`on-vote-success`），模板里 `@on-refresh`
- 通用样式优先 unocss 原子类；动画/复杂状态用 `<style scoped lang="scss">`
- 根节点类名与组件名一致（`uh-vote-card`），方便定位
- **组件内的请求放 `onMounted` 中**：组件没有页面级 `onLoad` 生命周期，
  需要首屏请求时在 `onMounted` 里发起；依赖 props 变化重新请求用
  `watch(() => props.xxx, fn, { immediate: true })`（参考 `uh-vote-card`），
  需要父组件手动刷新时再 `defineExpose({ refresh })`

### 6.3 高内聚低耦合（业务尽量内聚）

- **业务逻辑能内聚在组件里的就内聚**：如 `uh-vote-card` 自己拉取投票详情、自己计算
  投票状态、自己提交投票，页面只传 `vote-name`、监听 `on-vote-success` 提示
- **页面尽量薄**：页面只负责数据请求编排（hooks）、跳转、传参给组件
- **能抽 hooks 的就抽 hooks**：跨页面复用的业务逻辑放 `src/hooks/`（如
  `useMaintenanceIntercept`、`useScroll`、`useUpload`），auto-import 免 import 直接调用
- 组件不直接依赖 store 的散装字段，通过 props 传入、events 传出，降低耦合

---

## 7. 样式规范（苹果玻璃拟态风格）

### 7.1 优先级（铁律 3）

```
UnoCSS 原子类（优先） → <style scoped lang="scss">（页面/组件内） → src/style/（全局复用）
```

### 7.2 主题色（uno.config.ts theme，与 wot-ui 联动）

| 令牌 | 值 | 用法 | 说明 |
|------|-----|------|------|
| `primary` | `#B9E424` | `text-primary` / `bg-primary` | 主主题色（荧光绿），已联动 wot-ui `--wot-color-theme` |
| `secondary` | `#D7F94C` | `text-secondary` / `bg-secondary` | 辅助色 |
| `page` | `#f6f3ee` | `bg-page` | 页面底色（米白） |

### 7.3 常用约定

- 快捷方式：`center`（flex 居中）
- 安全区：`p-safe` / `pt-safe` / `pb-safe`（刘海屏/底部横条）
- 小字号：`text-2xs`（20rpx）/ `text-3xs`（18rpx）
- 单位用 rpx；**动态拼接的图标类名必须加入 `uno.config.ts` 的 safelist**，否则不生成样式
- 本地 SVG 图标放 `src/static/my-icons/`，用 `i-my-icons-图标名` 调用
- 全局玻璃拟态工具类（`src/style/index.scss`）：
  - `uh-global-card-glass`：毛玻璃卡片（backdrop-blur 白底 + 柔和内阴影 + 低端安卓兜底）
  - `uh-shadow-xs`：柔和阴影（白色卡片常用）

### 7.4 苹果玻璃拟态（iOS 风格）要点

- 大面积 `bg-page` 米白底色 + 白色圆角卡片（`rounded-[28rpx]`）+ `uh-shadow-xs`
- 毛玻璃：半透明白底 + `backdrop-filter: blur(24rpx) saturate(160%)`（组件内写 scoped scss）
- 大圆角、留白充足、渐变/动效柔和克制（参考 `uh-data-loading` 的漂浮光晕动效）
- 文字层级：主文字深灰（`text-gray-900`）、次要灰（`text-gray-400/500`）、点缀用 primary 色
- UI 库 **wot-ui**（`wd-` 前缀，easycom 已配）：`wd-icon`、`wd-button`、`wd-empty`、`wd-tabs` 等；
  图标大量使用 `wd-icon`，emoji 表情用 `uhemoji-iconfont`

### 7.5 富文本

文章/瞬间正文用 `mp-html` 渲染（easycom 已配），配置走 `markdownConfig`：

```vue
<mp-html
  lazy-load
  :domain="markdownConfig.domain ?? ''"
  :loading-img="markdownConfig.loadingGif"
  :tag-style="markdownConfig.tagStyle"
  :container-style="markdownConfig.containStyle"
  :content="moment.spec.newHtml || ''"
  :markdown="true"
/>
```

---

## 8. 开发规范（高内聚低耦合）

### 8.1 业务逻辑分层

```
页面：请求编排（hooks）+ 跳转 + 传参给组件（薄页面）
  ↓
组件：自身业务内聚（自己拉数据、算状态、提交），props 进、events 出
  ↓
hooks：跨页面复用的业务逻辑（useDataLoading / useRequest / useScroll / useUpload / useMaintenanceIntercept）
  ↓
api：接口定义 + 类型（不写业务逻辑）
```

- **组件能自己处理业务就自己处理**，不在页面里写一堆判断
- **逻辑能抽 hooks 就抽 hooks**，页面里只留编排
- 组件不直接依赖 store 散装字段，props/events 解耦

### 8.2 TypeScript 规范

- **禁止新增 `any`**（团队约定）；对象类型 `interface`、联合类型 `type`、导入 `import type`
- API 响应必须走 `src/api/types/` 的类型，过边界校验后才使用
- 组件 props 用 `interface IProps` + `withDefaults`
- 不自动排序 import（条件编译注释可能包裹 import，eslint 已关排序）

### 8.3 状态管理（Pinia）

- store 放 `src/store/`，`defineStore` 定义
- 需要持久化的状态配置 `pinia-plugin-persistedstate`（如 `useAppConfigStore` 的 `persist: true`），不手写 `uni.setStorageSync` 同步业务状态
- `uni.getStorageSync` 读出的数据是**真边界数据**，使用前校验类型/结构
- 服务端状态以接口为事实源，store 只放跨页共享/持久化状态

### 8.4 国际化（i18n）

- 文案文件在 `src/locale/`（zh-Hans / en），页面用 `t()` 取文案：

```ts
import { t } from '@/locale'
loadMoreText.value = t('common.loadMore')
```

- 纯展示的静态中文（如状态文案）可写死在页面；会变化/需要多语言的走 t()

### 8.5 Hooks 规范

- 新 hooks 放 `src/hooks/`，auto-import（`unplugin-auto-import` 已配 `dirs: ['src/hooks']`），页面**免 import 直接调用**
- 命名 `useXxx`；有配套单测的写 `xxx.test.ts`（如 `useDataLoading.test.ts`、`useRequest.test.ts`）
- 参考既有实现风格：`useDataLoadingStatus`（页面四态管理，见 §5.4）、`useDataLoading`（详情页单数据状态机）、`useScroll`、`useUpload`（平台条件编译处理）

### 8.6 Git 提交与合入

- **提交信息必须使用中文**：subject 用中文描述（如 `feat: 新增投票功能`、`fix: 修复文章详情白屏`）
- commitlint 强制 conventional commits：`feat: / fix: / docs: / style: / refactor: / perf: / test: / chore:`
- 版本发布走 changesets（`pnpm upload:changeset`）
- 合入前三条命令全过（见 §10）

---

## 9. 平台差异（条件编译）

### 9.1 决策树

```
这个差异编译期就能确定吗?
├── 能  → 条件编译（#ifdef / #ifndef）
└── 不能 → 运行时 API 判断（uni.getSystemInfoSync().uniPlatform 等）
```

**禁止**：用 UA 嗅探替代条件编译；在能编译期剔除的代码里留运行时 if。

### 9.2 条件编译速查

```ts
// #ifdef H5
import { h5Api } from '@/utils/h5'
// #endif

// #ifndef MP-WEIXIN
// 所有平台生效，除微信小程序
// #endif
```

```vue
<template>
  <!-- #ifdef APP-PLUS -->
  <view>仅 APP</view>
  <!-- #endif -->
  <!-- #ifdef MP-WEIXIN -->
  <wd-button open-type="contact">提交反馈</wd-button>
  <!-- #endif -->
</template>
```

平台标识：`H5`、`MP-WEIXIN`、`MP-ALIPAY`、`APP-PLUS`（app-android / app-ios）、`MP`（泛小程序）。

### 9.3 本项目已有差异点（改动时别破坏）

| 差异点 | 位置 | 规则 |
|--------|------|------|
| devServer 代理（`VITE_APP_PROXY_*`） | vite.config.ts | 仅 H5 dev 生效；非 H5 端 dev 也是 build command，无热更新代理 |
| eruda 调试面板 | vite.config.ts | 仅 H5 development |
| 自动打开开发者工具 | scripts/open-dev-tools.js | mp-weixin/mp-alipay 构建后自动打开；上传用 `SKIP_OPEN_DEVTOOLS=true` 跳过 |
| bundle-optimizer 分包优化 | vite.config.ts | 仅微信小程序端 |
| 微信三环境地址 | env/.env | `VITE_SERVER_BASEURL__WEIXIN_DEVELOP/TRIAL/RELEASE` 按开发者工具 envVersion 覆写 |

---

## 10. 验证清单（合入前）

```bash
pnpm type-check   # vue-tsc --noEmit，类型零错误（同时重新生成 uni-pages.d.ts 等类型）
pnpm lint         # eslint 零 error（可用 pnpm lint:fix 自动修复）
pnpm test:run     # vitest 全绿
```

- 新建页面后跑 `pnpm type-check`：重新生成 `src/types/uni-pages.d.ts`，路由类型才可用
- 修改配置类（pages/manifest/uno）后重启 dev server
- 小程序上传：`pnpm upload:mp`

---

## Keywords

uni-halo, uniapp, uni-app, Vue3, TypeScript, alova, halo, halo2, 博客, CMS, pages-blog, 分包, subPackages, easycom, uh-data-loading, useDataLoading, useRequest, hooks, definePage, wot-ui, UnoCSS, unocss, scss, 苹果风格, 玻璃拟态, 主题色, primary, 条件编译, 多平台, H5, 小程序, APP, 页面规范, 组件规范, API规范, 类型定义, i18n, pinia

