# 偏好设置(Preferences)

> 本文档定义客户端偏好设置的数据结构、取值约定与后端插件 `getConfigs.preferences` 下发字段的映射关系,
> 供「偏好设置」页面、各消费页面与后端插件配置同步参考。
> 详细设计(含与旧值体系差异)见 `.docs/preferences.md`。

## 1. 数据流(两层偏好)

读取优先级:**本地差异 > 站点默认(L0)> 客户端内置默认**。

- L0 站点默认:插件 `getConfigs` 下发,由 `collectSiteDefaults`(`src/utils/preference.ts`)收集为差异形状;
- L1 本地差异:storage key `uh_pref_local_v1`,只存与站点默认不同的字段(字段级覆盖,本地优先),值缺省/删除即回退跟随站点默认;
- 内置默认:`src/config/appSettings.ts` 的 `DefaultAppSettings`(无 L0 下发时的兜底)。

## 2. 布局偏好结构(按页面分组)

```ts
/** src/config/appSettings.ts */
interface IPageLayoutPref {
  /** 列表布局:single=单列 / double=双列 */
  listLayout: string
  /** 卡片样式(组件 layout 值):image_top=上图下文 / image_right=左文右图 / image_bottom=上文下图(社交卡片) / image_left=左图右文 */
  cardType: string
}

layout: {
  home: IPageLayoutPref      // 首页
  articles: IPageLayoutPref  // 文章列表页
  archives: IPageLayoutPref  // 文章归档页
}
```

### 取值约定

| 字段 | 可选值 | 说明 |
|------|--------|------|
| `listLayout` | `single` / `double` | 单列 / 双列;「默认」= 跟随站点默认(本地不覆盖) |
| `cardType` | `image_top` / `image_right` / `image_bottom` / `image_left` | 上图下文 / 左文右图 / 上文下图(社交卡片) / 左图右文,与 `uh-article-card` 组件 layout 值一一对应 |

> 旧值体系(`lr_image_text` / `lr_text_image` / `tb_image_text` / `tb_text_image`)已废弃,统一改用组件 layout 值。

### 内置默认值(DefaultAppSettings)

| 页面 | listLayout | cardType |
|------|-----------|----------|
| home(首页) | `single` | `image_top` |
| articles(文章列表) | `double` | `image_top` |
| archives(文章归档) | `single` | `image_top` |

## 3. 后端插件字段映射(getConfigs.preferences)

`collectSiteDefaults` 维护以下映射(字段缺省则跳过,不产生覆盖):

| 后端 `preferences` 字段 | 本地路径 | 说明 |
|------------------------|---------|------|
| `homeListLayout` | `layout.home.listLayout` | 兼容旧值 `h_row_col1/2`,归一化为 `single/double` |
| `homeCardType` | `layout.home.cardType` | 值为 `image_top/image_right/image_bottom/image_left` |
| `articlesListLayout` | `layout.articles.listLayout` | 新增 |
| `articleCardType` | `layout.articles.cardType` | 沿用旧字段名(兼容既有下发) |
| `archivesListLayout` | `layout.archives.listLayout` | 新增 |
| `archivesCardType` | `layout.archives.cardType` | 新增 |
| `avatarRadius` | `isAvatarRadius` | 评论头像是否圆形 |

> 后端新增字段建议统一命名 `{页面}ListLayout` / `{页面}CardType`;
> 列表布局值建议直接下发 `single/double`,旧值 `h_row_col1/h_row_col2` 前端会归一化兼容;
> 卡片样式值直接下发组件 layout 值(4 个 `image_*`)。

## 4. 消费方

| 位置 | 消费内容 |
|------|---------|
| `src/pages-blog/setting/setting.vue` | 顶部分段器(布局 / 功能);「布局」按页面分组设置「列表布局 / 卡片样式」 |
| `src/pages/tabbar/home/home.vue` | `layout.home.listLayout` 决定容器单/双列;卡片 `from="home"` 读 `layout.home.cardType` |
| `src/pages-blog/articles/articles.vue` | `layout.articles.listLayout` 决定容器与 `variant`(grid/list);卡片 `from="articles"` |
| `src/pages-blog/archives/archives.vue` | `layout.archives.listLayout` 决定归档时间线内单/双列;卡片 `from="archives"` |
| `src/components/uh-article-card/uh-article-card.vue` | 按 `from` 读取对应页面 `cardType` 作为 layout;grid/双列窄列自动回退 `image_top`;非法值兜底 `image_top` |

## 5. 设置页枚举(「默认」= 跟随站点默认)

- 列表布局:跟随站点默认 / 单列(`single`)/ 双列(`double`)
- 卡片样式:跟随站点默认 / 上图下文(`image_top`)/ 左文右图(`image_right`)/ 上文下图(`image_bottom`)/ 左图右文(`image_left`)
- 选择「跟随站点默认」时写入差异 `null`(删除本地覆盖),回退 L0 站点默认;无 L0 时回退内置默认。

## 6. 变更记录

| 版本 | 变更 |
|------|------|
| v2.5 | 内置默认 cardType 统一为 `image_top`;组件非法值兜底同步为 `image_top` |
| v2.4 | 卡片样式值体系由旧 `lr_*/tb_*` 改为组件 layout 值 `image_top/image_right/image_bottom/image_left`;移除 `uh-article-card` 旧值映射(`CARD_TYPE_TO_LAYOUT`) |
| v2.3 | 布局偏好由全局 `layout.home` / `layout.cardType`(字符串)重构为按页面分组 `layout.{home,articles,archives}.{listLayout,cardType}`;设置页增加「布局 / 功能」分段器与页面分组设置项;三个消费页面联动卡片 |
