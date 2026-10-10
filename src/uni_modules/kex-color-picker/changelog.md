## 1.0.0（2026-07-17）
首发：色域 / 色相 / 透明度选择
- 支持 HEX / RGB / HSL / HSV 格式切换与手动输入
- 预设色、最近使用（本地 Storage）、复制、清空
- 原色 / 新色对比预览；触发器尺寸；自定义触发插槽；ref.open()
- 自包含颜色换算，不依赖业务工程 libs

## 1.0.3（2026-07-17）
- 复制时关闭 setClipboardData 系统 toast，避免 App 真机双提示

## 1.0.2（2026-07-17）
- 复制提示改为弹层内 toast，避免被颜色面板压住
- 打开弹层时锁定页面滚动（H5/App webview + 遮罩拦截触摸）

## 1.0.1（2026-07-17）
- 对齐 kex-number-box 多端写法：touch/mouse 防双触发、input 双端取值
- 去掉 CSS `gap`，改用 margin；渐变改 `backgroundImage`
- `createSelectorQuery` 分节点查询 + 重试；微信 `virtualHost`
- 条件编译：弹层仅非 nvue；H5 鼠标拖出区域；安全区 constant/env
- 平台声明与 number-box 对齐（App vue / H5 / 各小程序 / 鸿蒙；nvue 不支持）

## 1.0.0（2026-07-17）
- 首发：色域 / 色相 / 透明度选择
- 支持 HEX / RGB / HSL / HSV 格式切换与手动输入
- 预设色、最近使用（本地 Storage）、复制、清空
- 原色 / 新色对比预览；触发器尺寸；自定义触发插槽；ref.open()
- 自包含颜色换算，不依赖业务工程 libs
